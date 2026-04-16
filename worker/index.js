/**
 * BREAKTAPES Public Profile Worker
 *
 * Routes:
 *   GET /u/:username            — Public athlete profile (SSR HTML)
 *   GET /u/:username/race/:id   — Individual race card (SSR HTML)
 *   GET /*                      — Fall through to static assets (SPA)
 *
 * Env vars (set via wrangler secret put or wrangler.toml [vars]):
 *   SUPABASE_URL       — e.g. https://kmdpufauamadwavqsinj.supabase.co
 *   SUPABASE_ANON_KEY  — safe to use in Worker; RLS gates what anon sees
 *
 * KV binding:
 *   PROFILE_KV         — view counts + og:image cache keys
 */

// ── Utilities ────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function html(status, body, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

function fmtTime(t) {
  if (!t) return '';
  // Normalise "H:MM:SS" or "MM:SS" to something readable
  const parts = String(t).split(':').map(Number);
  if (parts.length === 3) {
    const [h, m, s] = parts;
    if (h === 0) return `${m}:${String(s).padStart(2, '0')}`;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return t;
}

function fmtDate(d) {
  if (!d) return '';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch (_) { return d; }
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr + 'T00:00:00') - new Date()) / 86400000);
  return diff;
}

function timeToSecs(t) {
  if (!t) return Infinity;
  const parts = String(t).split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Infinity;
}

// Compute personal bests: { distance: { time, raceName, raceDate } }
function computePBs(races) {
  const pb = {};
  const PRIORITY = ['Marathon', 'Half Marathon', '70.3 / Half Ironman', 'Ironman / Full',
    '10K', '5K', '21.1km', '42.2km', '10 Miles', 'Ultra'];
  for (const r of races) {
    if (!r.time || !r.distance) continue;
    const secs = timeToSecs(r.time);
    if (secs === Infinity) continue;
    if (!pb[r.distance] || secs < pb[r.distance].secs) {
      pb[r.distance] = { secs, time: r.time, raceName: r.name || '', raceDate: r.date || '' };
    }
  }
  // Return sorted by PRIORITY then alphabetically
  const ordered = {};
  for (const dist of PRIORITY) {
    if (pb[dist]) ordered[dist] = pb[dist];
  }
  for (const dist of Object.keys(pb)) {
    if (!ordered[dist]) ordered[dist] = pb[dist];
  }
  return ordered;
}

function countMedals(races) {
  return races.filter(r => r.medal && r.medal !== 'none' && r.medal !== '').length;
}

function uniqueCountries(races) {
  return new Set(races.map(r => r.country).filter(Boolean)).size;
}

// ── Supabase fetch helper ────────────────────────────────────────────────────

async function fetchProfile(username, env) {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/user_state`);
  url.searchParams.set('username', `eq.${username}`);
  url.searchParams.set('is_public', 'eq.true');
  url.searchParams.set('select', 'races,athlete,next_race,upcoming_races');
  url.searchParams.set('limit', '1');

  const res = await fetch(url.toString(), {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) return null;
  const rows = await res.json();
  return rows && rows.length > 0 ? rows[0] : null;
}

// ── View count (fire-and-forget) ─────────────────────────────────────────────

function incrementViewCount(username, env) {
  if (!env.PROFILE_KV) return;
  const key = `views:${username}`;
  env.PROFILE_KV.get(key, 'text')
    .then(val => {
      const count = parseInt(val || '0', 10) + 1;
      return env.PROFILE_KV.put(key, String(count));
    })
    .catch(() => {}); // silently ignore
}

// ── 404 page ─────────────────────────────────────────────────────────────────

function notFoundPage(username) {
  const body = pageShell({
    title: 'Profile not found | BREAKTAPES',
    description: 'This athlete profile is private or does not exist.',
    ogTitle: 'BREAKTAPES',
    ogDescription: 'Track your race life.',
    ogImage: 'https://app.breaktapes.com/og-placeholder.png',
    canonical: `https://app.breaktapes.com/u/${encodeURIComponent(username)}`,
    bodyContent: `
      <div class="not-found">
        <div class="nf-icon">🔒</div>
        <h1>Profile not found</h1>
        <p>This athlete's profile is private or doesn't exist yet.</p>
        <a href="https://app.breaktapes.com/" class="cta-btn">Track your own race life →</a>
      </div>
    `,
    username,
    showJoinCta: true,
  });
  return html(404, body);
}

// ── Profile page render ───────────────────────────────────────────────────────

function renderProfile(row, username) {
  const athlete = row.athlete || {};
  const races = Array.isArray(row.races) ? row.races : [];
  const nextRace = row.next_race || null;

  const displayName = escapeHtml(athlete.name || username);
  const location = [athlete.city, athlete.country].filter(Boolean).map(escapeHtml).join(', ');
  const sport = escapeHtml(athlete.primary || '');

  // Stats
  const totalRaces = races.length;
  const totalMedals = countMedals(races);
  const countries = uniqueCountries(races);

  // PBs
  const pbs = computePBs(races);
  const pbDistances = ['Marathon', 'Half Marathon', '10K', '5K',
    '70.3 / Half Ironman', 'Ironman / Full', '10 Miles', 'Ultra'];

  const pbRows = pbDistances
    .filter(d => pbs[d])
    .slice(0, 5)
    .map(d => `
      <div class="pb-row">
        <span class="pb-dist">${escapeHtml(d)}</span>
        <span class="pb-time">${escapeHtml(fmtTime(pbs[d].time))}</span>
      </div>`).join('');

  // Recent races (last 5, sorted by date descending)
  const pastRaces = races
    .filter(r => r.date && r.date <= new Date().toISOString().slice(0, 10))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 5);

  const raceRows = pastRaces.map(r => `
    <div class="race-row">
      <div class="race-row-main">
        <span class="race-row-name">${escapeHtml(r.name || 'Race')}</span>
        <span class="race-row-time">${r.time ? escapeHtml(fmtTime(r.time)) : 'DNF'}</span>
      </div>
      <div class="race-row-meta">
        ${r.date ? `<span>${escapeHtml(fmtDate(r.date))}</span>` : ''}
        ${r.city ? `<span>${escapeHtml(r.city)}${r.country ? ', ' + escapeHtml(r.country) : ''}</span>` : ''}
        ${r.distance ? `<span>${escapeHtml(r.distance)}</span>` : ''}
      </div>
    </div>`).join('');

  // Upcoming race
  let upcomingHtml = '';
  if (nextRace && nextRace.date) {
    const days = daysUntil(nextRace.date);
    const daysLabel = days == null ? '' : days <= 0 ? 'Today!' : `${days} day${days === 1 ? '' : 's'} away`;
    upcomingHtml = `
      <section class="profile-section">
        <h2 class="section-title">NEXT RACE</h2>
        <div class="upcoming-card">
          <span class="upcoming-flag">🏁</span>
          <div class="upcoming-info">
            <div class="upcoming-name">${escapeHtml(nextRace.name || 'Upcoming race')}</div>
            <div class="upcoming-meta">
              ${nextRace.date ? escapeHtml(fmtDate(nextRace.date)) : ''}
              ${daysLabel ? `· <strong>${escapeHtml(daysLabel)}</strong>` : ''}
            </div>
          </div>
        </div>
      </section>`;
  }

  // og meta
  const pbMarathon = pbs['Marathon'];
  const ogDescription = [
    `${totalRaces} race${totalRaces !== 1 ? 's' : ''}`,
    `${totalMedals} medal${totalMedals !== 1 ? 's' : ''}`,
    pbMarathon ? `${fmtTime(pbMarathon.time)} marathon PB` : null,
    countries > 1 ? `${countries} countries` : null,
  ].filter(Boolean).join(' · ');

  const bodyContent = `
    <div class="profile-header">
      <div class="avatar-placeholder">${escapeHtml((athlete.name || username).slice(0, 2).toUpperCase())}</div>
      <div class="profile-identity">
        <h1 class="athlete-name">${displayName}</h1>
        ${location ? `<div class="athlete-location">📍 ${location}</div>` : ''}
        ${sport ? `<div class="athlete-sport">${escapeHtml(sport)}</div>` : ''}
      </div>
    </div>

    <section class="profile-section">
      <div class="career-stats">
        <div class="stat-pill">
          <span class="stat-val">${totalRaces}</span>
          <span class="stat-lbl">races</span>
        </div>
        <div class="stat-pill">
          <span class="stat-val">${totalMedals}</span>
          <span class="stat-lbl">medals</span>
        </div>
        <div class="stat-pill">
          <span class="stat-val">${countries}</span>
          <span class="stat-lbl">countr${countries === 1 ? 'y' : 'ies'}</span>
        </div>
      </div>
    </section>

    ${pbRows ? `
    <section class="profile-section">
      <h2 class="section-title">PERSONAL BESTS</h2>
      <div class="pb-list">${pbRows}</div>
    </section>` : ''}

    ${raceRows ? `
    <section class="profile-section">
      <h2 class="section-title">RECENT RACES</h2>
      <div class="race-list">${raceRows}</div>
    </section>` : ''}

    ${upcomingHtml}
  `;

  const body = pageShell({
    title: `${athlete.name || username}'s Race Profile | BREAKTAPES`,
    description: ogDescription || `${athlete.name || username} on BREAKTAPES`,
    ogTitle: `${athlete.name || username}'s Race Profile | BREAKTAPES`,
    ogDescription: ogDescription,
    ogImage: `https://health.breaktapes.com/og/u/${encodeURIComponent(username)}`,
    canonical: `https://app.breaktapes.com/u/${encodeURIComponent(username)}`,
    bodyContent,
    username,
    showJoinCta: true,
    athleteName: athlete.name || '',
  });

  return html(200, body, {
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
  });
}

// ── Race card page render ─────────────────────────────────────────────────────

function renderRaceCard(row, username, raceId) {
  const races = Array.isArray(row.races) ? row.races : [];
  const athlete = row.athlete || {};
  const race = races.find(r => r.id === raceId || String(r.id) === raceId);
  if (!race) return notFoundPage(username);

  const athleteName = escapeHtml(athlete.name || username);
  const raceName = escapeHtml(race.name || 'Race');

  const bodyContent = `
    <div class="race-card-hero">
      <div class="rc-athlete">${athleteName}</div>
      <h1 class="rc-name">${raceName}</h1>
      ${race.date ? `<div class="rc-date">${escapeHtml(fmtDate(race.date))}</div>` : ''}
      ${race.city || race.country ? `<div class="rc-location">📍 ${escapeHtml([race.city, race.country].filter(Boolean).join(', '))}</div>` : ''}
    </div>

    <section class="profile-section">
      <div class="career-stats">
        ${race.time ? `<div class="stat-pill"><span class="stat-val">${escapeHtml(fmtTime(race.time))}</span><span class="stat-lbl">finish time</span></div>` : ''}
        ${race.distance ? `<div class="stat-pill"><span class="stat-val">${escapeHtml(race.distance)}</span><span class="stat-lbl">distance</span></div>` : ''}
        ${race.placing ? `<div class="stat-pill"><span class="stat-val">${escapeHtml(race.placing)}</span><span class="stat-lbl">placing</span></div>` : ''}
      </div>
    </section>

    <div class="rc-back">
      <a href="/u/${encodeURIComponent(username)}" class="back-link">← ${athleteName}'s profile</a>
    </div>
  `;

  const ogDesc = [
    race.distance,
    race.time ? fmtTime(race.time) : null,
    race.city,
  ].filter(Boolean).join(' · ');

  const body = pageShell({
    title: `${race.name || 'Race'} — ${athlete.name || username} | BREAKTAPES`,
    description: ogDesc,
    ogTitle: `${athlete.name || username}: ${race.name || 'Race'} | BREAKTAPES`,
    ogDescription: ogDesc,
    ogImage: `https://health.breaktapes.com/og/u/${encodeURIComponent(username)}`,
    canonical: `https://app.breaktapes.com/u/${encodeURIComponent(username)}/race/${encodeURIComponent(raceId)}`,
    bodyContent,
    username,
    showJoinCta: true,
  });

  return html(200, body, {
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
  });
}

// ── HTML shell ────────────────────────────────────────────────────────────────

function pageShell({ title, description, ogTitle, ogDescription, ogImage, canonical,
  bodyContent, username, showJoinCta, athleteName = '' }) {
  const joinUrl = `https://app.breaktapes.com/?ref=u-${encodeURIComponent(username)}-profile`
    + (athleteName ? `&join_context=compare-with-${encodeURIComponent(athleteName)}` : '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">

  <!-- Open Graph -->
  <meta property="og:type" content="profile">
  <meta property="og:title" content="${escapeHtml(ogTitle)}">
  <meta property="og:description" content="${escapeHtml(ogDescription)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:site_name" content="BREAKTAPES">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}">
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">

  <link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Barlow:wght@400;500;600&display=swap" rel="stylesheet">

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --black:      #000000;
      --white:      #F5F5F5;
      --orange:     #FF4D00;
      --surface:    #0D0D0D;
      --surface2:   #141414;
      --surface3:   #1A1A1A;
      --border:     rgba(245,245,245,0.06);
      --border2:    rgba(245,245,245,0.12);
      --muted:      rgba(245,245,245,0.35);
      --muted2:     rgba(245,245,245,0.18);
    }

    html, body {
      background: var(--surface);
      color: var(--white);
      font-family: 'Barlow', sans-serif;
      font-size: 16px;
      min-height: 100vh;
    }

    /* Header */
    .site-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      border-bottom: 1px solid var(--border2);
      background: var(--surface);
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .site-logo {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 900;
      font-size: 20px;
      letter-spacing: 0.06em;
      color: var(--white);
      text-decoration: none;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .btn-ghost {
      background: transparent;
      border: 1px solid var(--border2);
      color: var(--white);
      font-family: 'Barlow', sans-serif;
      font-weight: 600;
      font-size: 13px;
      padding: 7px 14px;
      border-radius: 6px;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
    }

    .btn-orange {
      background: var(--orange);
      border: none;
      color: var(--white);
      font-family: 'Barlow', sans-serif;
      font-weight: 700;
      font-size: 13px;
      padding: 7px 14px;
      border-radius: 6px;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
    }

    /* Main */
    .profile-container {
      max-width: 540px;
      margin: 0 auto;
      padding: 24px 20px ${showJoinCta ? '100px' : '32px'};
    }

    /* Profile header */
    .profile-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 28px;
    }

    .avatar-placeholder {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: var(--orange);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 900;
      font-size: 24px;
      color: var(--white);
      flex-shrink: 0;
    }

    .athlete-name {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 900;
      font-size: 28px;
      letter-spacing: 0.02em;
      line-height: 1.1;
    }

    .athlete-location {
      color: var(--muted);
      font-size: 14px;
      margin-top: 4px;
    }

    .athlete-sport {
      color: var(--orange);
      font-weight: 600;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-top: 4px;
    }

    /* Career stats */
    .career-stats {
      display: flex;
      gap: 12px;
    }

    .stat-pill {
      flex: 1;
      background: var(--surface2);
      border: 1px solid var(--border2);
      border-radius: 10px;
      padding: 14px 10px;
      text-align: center;
    }

    .stat-val {
      display: block;
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 900;
      font-size: 26px;
      color: var(--white);
      line-height: 1;
    }

    .stat-lbl {
      display: block;
      font-size: 11px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-top: 4px;
    }

    /* Sections */
    .profile-section {
      margin-bottom: 28px;
    }

    .section-title {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 800;
      font-size: 12px;
      letter-spacing: 0.12em;
      color: var(--muted);
      text-transform: uppercase;
      margin-bottom: 12px;
    }

    /* PBs */
    .pb-list {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
    }

    .pb-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
    }

    .pb-row:last-child { border-bottom: none; }

    .pb-dist {
      font-weight: 500;
      font-size: 15px;
      color: var(--white);
    }

    .pb-time {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 800;
      font-size: 18px;
      color: var(--orange);
    }

    /* Races */
    .race-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .race-row {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px 16px;
    }

    .race-row-main {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
    }

    .race-row-name {
      font-weight: 600;
      font-size: 15px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .race-row-time {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 800;
      font-size: 16px;
      color: var(--orange);
      flex-shrink: 0;
    }

    .race-row-meta {
      display: flex;
      gap: 10px;
      margin-top: 4px;
      font-size: 12px;
      color: var(--muted);
    }

    .race-row-meta span + span::before {
      content: '·';
      margin-right: 10px;
    }

    /* Upcoming */
    .upcoming-card {
      display: flex;
      align-items: center;
      gap: 14px;
      background: var(--surface2);
      border: 1px solid var(--border2);
      border-radius: 10px;
      padding: 16px;
    }

    .upcoming-flag { font-size: 28px; }

    .upcoming-name {
      font-weight: 700;
      font-size: 16px;
    }

    .upcoming-meta {
      font-size: 13px;
      color: var(--muted);
      margin-top: 4px;
    }

    /* Not found */
    .not-found {
      text-align: center;
      padding: 80px 20px;
    }

    .nf-icon { font-size: 48px; margin-bottom: 16px; }

    .not-found h1 {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 900;
      font-size: 28px;
      margin-bottom: 12px;
    }

    .not-found p {
      color: var(--muted);
      margin-bottom: 24px;
    }

    /* Race card hero */
    .race-card-hero {
      text-align: center;
      padding: 32px 0 24px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 24px;
    }

    .rc-athlete {
      font-size: 13px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }

    .rc-name {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 900;
      font-size: 32px;
      margin-bottom: 8px;
    }

    .rc-date, .rc-location {
      color: var(--muted);
      font-size: 14px;
      margin-top: 4px;
    }

    .rc-back { margin-top: 24px; }

    .back-link {
      color: var(--muted);
      text-decoration: none;
      font-size: 14px;
    }

    /* CTAs */
    .cta-btn {
      display: inline-block;
      background: var(--orange);
      color: var(--white);
      font-family: 'Barlow', sans-serif;
      font-weight: 700;
      font-size: 15px;
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none;
      cursor: pointer;
    }

    /* Join CTA bar */
    .join-cta-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #0a0a0a;
      border-top: 1px solid var(--border2);
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      z-index: 100;
      padding-bottom: max(16px, env(safe-area-inset-bottom, 16px));
    }

    .join-cta-text {
      font-size: 13px;
      color: var(--muted);
      line-height: 1.4;
    }

    .join-cta-text strong {
      display: block;
      color: var(--white);
      font-weight: 600;
    }

    .join-cta-btn {
      background: var(--orange);
      color: var(--white);
      font-family: 'Barlow', sans-serif;
      font-weight: 700;
      font-size: 14px;
      padding: 10px 18px;
      border-radius: 8px;
      text-decoration: none;
      white-space: nowrap;
      flex-shrink: 0;
    }

    @media (max-width: 400px) {
      .athlete-name { font-size: 24px; }
      .stat-val { font-size: 22px; }
      .join-cta-text { display: none; }
    }
  </style>
</head>
<body>
  <header class="site-header">
    <a href="https://app.breaktapes.com/" class="site-logo">BREAKTAPES</a>
    <div class="header-actions">
      <a href="https://app.breaktapes.com/" class="btn-ghost">Sign In</a>
      <a href="${escapeHtml(joinUrl)}" class="btn-orange">Join</a>
    </div>
  </header>

  <main class="profile-container">
    ${bodyContent}
  </main>

  ${showJoinCta ? `
  <div class="join-cta-bar">
    <div class="join-cta-text">
      <strong>Track your race life on BREAKTAPES</strong>
      Race history, medals, PBs &amp; gear — all in one place.
    </div>
    <a href="${escapeHtml(joinUrl)}" class="join-cta-btn">Join free →</a>
  </div>` : ''}
</body>
</html>`;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Only handle GET requests for profile routes
    if (request.method === 'GET') {
      // /u/:username
      const profileMatch = path.match(/^\/u\/([a-z0-9][a-z0-9-]{1,18}[a-z0-9])$/i);
      if (profileMatch) {
        const username = profileMatch[1].toLowerCase();
        const row = await fetchProfile(username, env);
        if (!row) return notFoundPage(username);
        incrementViewCount(username, env);
        return renderProfile(row, username);
      }

      // /u/:username/race/:raceId
      const raceMatch = path.match(/^\/u\/([a-z0-9][a-z0-9-]{1,18}[a-z0-9])\/race\/([a-z0-9_-]+)$/i);
      if (raceMatch) {
        const username = raceMatch[1].toLowerCase();
        const raceId = raceMatch[2];
        const row = await fetchProfile(username, env);
        if (!row) return notFoundPage(username);
        incrementViewCount(username, env);
        return renderRaceCard(row, username, raceId);
      }
    }

    // SPA fallback: routes without a file extension that aren't /u/* get index.html
    // This enables React Router client-side routing (direct nav to /train, /you, /races etc.)
    const hasExtension = /\.[a-z0-9]{2,6}$/i.test(path);
    if (!hasExtension && !path.startsWith('/u/')) {
      return env.ASSETS.fetch(new Request(new URL('/', request.url), request));
    }

    return env.ASSETS.fetch(request);
  },
};
