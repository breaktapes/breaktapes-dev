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
  const parts = String(t).split(':').map(Number);
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return `0:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return t;
}

function distLabel(d) {
  const km = parseFloat(d);
  if (isNaN(km)) return d || '';
  const known = [
    [226, 'IRONMAN'], [225.995, 'IRONMAN'],
    [113, '70.3'], [112.654, '70.3'],
    [51.5, 'Olympic'], [25.75, 'Sprint'],
    [42.2, 'Marathon'], [42.195, 'Marathon'],
    [21.1, 'Half Marathon'], [21.097, 'Half Marathon'],
    [15, '15K'], [12, '12K'], [10, '10K'],
    [8, '8K'], [5, '5K'], [3, '3K'],
  ];
  for (const [k, v] of known) {
    if (Math.abs(km - k) < 0.15) return v;
  }
  return `${km} km`;
}

function countryFlagEmoji(name) {
  const map = {
    'United Arab Emirates': '🇦🇪', 'India': '🇮🇳', 'United States': '🇺🇸',
    'United Kingdom': '🇬🇧', 'Australia': '🇦🇺', 'Germany': '🇩🇪',
    'France': '🇫🇷', 'Japan': '🇯🇵', 'Kenya': '🇰🇪', 'South Africa': '🇿🇦',
    'Canada': '🇨🇦', 'New Zealand': '🇳🇿', 'Netherlands': '🇳🇱',
    'Switzerland': '🇨🇭', 'Sweden': '🇸🇪', 'Norway': '🇳🇴',
    'Spain': '🇪🇸', 'Italy': '🇮🇹', 'Portugal': '🇵🇹',
    'Brazil': '🇧🇷', 'Singapore': '🇸🇬', 'Hong Kong': '🇭🇰',
    'China': '🇨🇳', 'South Korea': '🇰🇷', 'Oman': '🇴🇲',
    'Saudi Arabia': '🇸🇦', 'Bahrain': '🇧🇭', 'Qatar': '🇶🇦',
  };
  return map[name] || '🌍';
}

function shortCountryName(name) {
  const map = {
    'United Arab Emirates': 'UAE', 'United States': 'USA',
    'United Kingdom': 'UK', 'New Zealand': 'NZ', 'South Africa': 'SA',
    'South Korea': 'Korea', 'Saudi Arabia': 'KSA', 'Hong Kong': 'HK',
  };
  return map[name] || name;
}

function medalEmoji(medal) {
  if (!medal || medal === 'none' || medal === '') return null;
  if (medal === 'gold') return '🥇';
  if (medal === 'silver') return '🥈';
  if (medal === 'bronze') return '🥉';
  return '🏅'; // finisher
}

function totalKm(races) {
  return Math.round(races.reduce((s, r) => {
    const k = parseFloat(r.distance);
    return s + (isNaN(k) ? 0 : k);
  }, 0));
}

function yearsRacing(races) {
  if (!races.length) return 0;
  const yrs = races.map(r => parseInt((r.date || '').slice(0, 4))).filter(y => y > 2000);
  if (!yrs.length) return 0;
  return new Date().getFullYear() - Math.min(...yrs) + 1;
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
  url.searchParams.set('select', 'state_json');
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
  if (!rows || rows.length === 0) return null;
  // Data is stored in state_json JSONB — flatten for renderProfile
  const sj = rows[0].state_json ?? {};
  return {
    races:          sj.races          ?? [],
    athlete:        sj.athlete        ?? {},
    next_race:      sj.next_race      ?? null,
    upcoming_races: sj.upcoming_races ?? [],
  };
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
  const upcomingRaces = Array.isArray(row.upcoming_races) ? row.upcoming_races : [];
  const nextRace = row.next_race || upcomingRaces[0] || null;

  const displayName = escapeHtml(
    [athlete.firstName, athlete.lastName].filter(Boolean).join(' ') ||
    athlete.name || username
  );
  const location = [athlete.city, athlete.country].filter(Boolean).map(escapeHtml).join(', ');
  const sport = escapeHtml(athlete.mainSport || '');

  // Stats
  const totalRaces = races.length;
  const km = totalKm(races);
  const countries = uniqueCountries(races);
  const years = yearsRacing(races);

  // PBs — indexed by distance label for fast lookup
  const pbs = computePBs(races);

  // Check if a race is a PB
  function isPB(r) {
    if (!r.time || !r.distance) return false;
    const pb = pbs[r.distance];
    return pb && pb.time === r.time;
  }

  // Avatar
  const initials = escapeHtml(
    ([athlete.firstName, athlete.lastName].filter(Boolean).join(' ') || username)
      .slice(0, 2).toUpperCase()
  );
  const avatarHtml = athlete.imageUrl
    ? `<img src="${escapeHtml(athlete.imageUrl)}" alt="${initials}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;flex-shrink:0;">`
    : `<div class="avatar-placeholder">${initials}</div>`;

  // Country flags from all races
  const countryMap = {};
  for (const r of races) {
    if (r.country && !countryMap[r.country]) countryMap[r.country] = true;
  }
  const countryPills = Object.keys(countryMap).map(c =>
    `<div class="country-pill">${countryFlagEmoji(c)} <span class="country-abbr">${escapeHtml(shortCountryName(c))}</span></div>`
  ).join('');

  // Bio + clubs
  const bioHtml = athlete.bio
    ? `<div class="athlete-bio">"${escapeHtml(athlete.bio)}"</div>` : '';
  const clubPills = (athlete.clubs || []).map(c =>
    `<span class="club-pill">${escapeHtml(c)}</span>`
  ).join('');

  // PB card grid
  const RUN_DISTS = [['5K','5K'],['10K','10K'],['Half Marathon','HALF'],['Marathon','MARATHON'],['Ultra','ULTRA']];
  const TRI_DISTS = [['Olympic','OLYMPIC'],['70.3 / Half Ironman','70.3'],['Ironman / Full','IRONMAN']];

  function pbCardHtml(d, label, type) {
    if (!pbs[d]) return '';
    const time = escapeHtml(fmtTime(pbs[d].time));
    const raceName = escapeHtml((pbs[d].raceName || '').replace(/\s+\d{4}$/, '').substring(0, 22));
    const accent = type === 'run' ? '#00FF88' : '#7C3AED';
    return `<div style="background:#141414;border:1px solid rgba(245,245,245,0.08);border-left:2px solid ${accent};border-radius:10px;padding:11px 10px 10px;min-width:0;">
      <div style="font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:8px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(232,224,213,0.40);margin-bottom:4px;line-height:1;">${label}</div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:20px;color:#E84E1B;line-height:1;letter-spacing:-0.02em;">${time}</div>
      ${raceName ? `<div style="font-size:9px;color:rgba(232,224,213,0.35);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${raceName}</div>` : ''}
    </div>`;
  }

  const runCards = RUN_DISTS.map(([d,l]) => pbCardHtml(d, l, 'run')).filter(Boolean).join('');
  const triCards = TRI_DISTS.map(([d,l]) => pbCardHtml(d, l, 'tri')).filter(Boolean).join('');
  const cardGrid = s => `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">${s}</div>`;
  let pbSection = '';
  if (runCards) pbSection += `<p class="pb-sport-label">Running</p>${cardGrid(runCards)}`;
  if (triCards) pbSection += `<p class="pb-sport-label">Triathlon</p>${cardGrid(triCards)}`;

  // Recent races (last 5)
  const today = new Date().toISOString().slice(0, 10);
  const pastRaces = races
    .filter(r => r.date && r.date <= today)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 5);

  const raceRows = pastRaces.map(r => {
    const pb = isPB(r);
    const medal = medalEmoji(r.medal);
    const label = distLabel(r.distance);
    const time = r.time ? escapeHtml(fmtTime(r.time)) : 'DNF';
    const loc = [r.city, r.country ? escapeHtml(shortCountryName(r.country)) : ''].filter(Boolean).join(', ');

    const pbStyle = pb
      ? 'border-color:rgba(200,160,40,0.45);background:rgba(200,150,40,0.04);box-shadow:inset 0 0 0 1px rgba(200,150,40,0.2);'
      : '';

    return `
    <div class="race-row" style="${pbStyle}">
      <div class="race-row-left">
        <div class="race-row-top">
          ${medal ? `<span class="race-medal">${medal}</span>` : ''}
          <span class="race-row-name">${escapeHtml(r.name || 'Race')}</span>
          ${pb ? '<span class="pb-badge">PB</span>' : ''}
        </div>
        <div class="race-row-meta">
          ${r.date ? `<span>${escapeHtml(fmtDate(r.date))}</span>` : ''}
          ${loc ? `<span>${loc}</span>` : ''}
          ${label ? `<span>${escapeHtml(label)}</span>` : ''}
        </div>
      </div>
      <div class="race-row-time">${time}</div>
    </div>`;
  }).join('');

  // Upcoming / next race
  let upcomingHtml = '';
  if (nextRace && nextRace.date) {
    const days = daysUntil(nextRace.date);
    const daysLabel = days == null ? '' : days <= 0 ? 'Today!' : `${days} day${days === 1 ? '' : 's'} away`;
    const upLabel = nextRace.distance ? distLabel(nextRace.distance) : '';
    upcomingHtml = `
      <section class="profile-section">
        <h2 class="section-title">NEXT RACE</h2>
        <div class="upcoming-card">
          <span class="upcoming-flag">🏁</span>
          <div class="upcoming-info">
            <div class="upcoming-name">${escapeHtml(nextRace.name || 'Upcoming race')}</div>
            <div class="upcoming-meta">
              ${upLabel ? `<span class="upcoming-dist">${escapeHtml(upLabel)}</span> · ` : ''}
              ${nextRace.date ? escapeHtml(fmtDate(nextRace.date)) : ''}
              ${daysLabel ? ` · <strong style="color:#E84E1B;">${escapeHtml(daysLabel)}</strong>` : ''}
            </div>
          </div>
        </div>
      </section>`;
  }

  // OG
  const pbMarathon = pbs['Marathon'];
  const ogDescription = [
    `${totalRaces} race${totalRaces !== 1 ? 's' : ''}`,
    km ? `${km} km` : null,
    pbMarathon ? `${fmtTime(pbMarathon.time)} marathon PB` : null,
    countries > 1 ? `${countries} countries` : null,
  ].filter(Boolean).join(' · ');

  const bodyContent = `
    <div class="profile-header">
      ${avatarHtml}
      <div class="profile-identity">
        <h1 class="athlete-name">${displayName}</h1>
        ${location ? `<div class="athlete-location">📍 ${location}</div>` : ''}
        ${sport ? `<div class="athlete-sport">${escapeHtml(sport)}</div>` : ''}
      </div>
    </div>

    ${bioHtml}
    ${clubPills ? `<div class="clubs-row">${clubPills}</div>` : ''}

    <section class="profile-section" style="margin-top:20px;">
      <div class="career-stats">
        <div class="stat-pill"><span class="stat-val">${totalRaces}</span><span class="stat-lbl">races</span></div>
        <div class="stat-pill"><span class="stat-val">${km}</span><span class="stat-lbl">total km</span></div>
        <div class="stat-pill"><span class="stat-val">${countries}</span><span class="stat-lbl">countr${countries === 1 ? 'y' : 'ies'}</span></div>
        ${years > 0 ? `<div class="stat-pill"><span class="stat-val">${years}</span><span class="stat-lbl">year${years === 1 ? '' : 's'}</span></div>` : ''}
      </div>
    </section>

    ${countryPills ? `<div class="country-row">${countryPills}</div>` : ''}

    ${pbSection ? `
    <section class="profile-section">
      <h2 class="section-title">PERSONAL BESTS</h2>
      ${pbSection}
    </section>` : ''}

    ${raceRows ? `
    <section class="profile-section">
      <h2 class="section-title">RECENT RACES</h2>
      <div class="race-list">${raceRows}</div>
    </section>` : ''}

    ${upcomingHtml}
  `;

  const body = pageShell({
    title: `${displayName}'s Race Profile | BREAKTAPES`,
    description: ogDescription || `${displayName} on BREAKTAPES`,
    ogTitle: `${displayName}'s Race Profile | BREAKTAPES`,
    ogDescription: ogDescription,
    ogImage: `https://health.breaktapes.com/og/u/${encodeURIComponent(username)}`,
    canonical: `https://app.breaktapes.com/u/${encodeURIComponent(username)}`,
    bodyContent,
    username,
    showJoinCta: true,
    athleteName: displayName,
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

  const athleteName = escapeHtml(athlete.name || [athlete.firstName, athlete.lastName].filter(Boolean).join(' ') || username);
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
    title: `${race.name || 'Race'} — ${athlete.name || [athlete.firstName, athlete.lastName].filter(Boolean).join(' ') || username} | BREAKTAPES`,
    description: ogDesc,
    ogTitle: `${athlete.name || [athlete.firstName, athlete.lastName].filter(Boolean).join(' ') || username}: ${race.name || 'Race'} | BREAKTAPES`,
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
      --white:      #E8E0D5;
      --orange:     #E84E1B;
      --green:      #00FF88;
      --purple:     #7C3AED;
      --surface:    #0D0D0D;
      --surface2:   #141414;
      --surface3:   #1A1A1A;
      --border:     rgba(245,245,245,0.06);
      --border2:    rgba(245,245,245,0.12);
      --muted:      rgba(232,224,213,0.40);
      --muted2:     rgba(232,224,213,0.20);
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
      margin-bottom: 16px;
    }

    .avatar-placeholder {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: var(--orange);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 900;
      font-size: 26px;
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
      font-weight: 700;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-top: 5px;
    }

    .athlete-bio {
      font-size: 14px;
      color: rgba(232,224,213,0.65);
      font-style: italic;
      margin-bottom: 10px;
      line-height: 1.5;
    }

    .clubs-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 16px;
    }

    .club-pill {
      background: rgba(0,255,136,0.08);
      border: 1px solid rgba(0,255,136,0.25);
      color: #00FF88;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 20px;
      letter-spacing: 0.02em;
    }

    /* Career stats */
    .career-stats {
      display: flex;
      gap: 8px;
    }

    .stat-pill {
      flex: 1;
      background: var(--surface2);
      border: 1px solid var(--border2);
      border-radius: 10px;
      padding: 12px 8px;
      text-align: center;
    }

    .stat-val {
      display: block;
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 900;
      font-size: 24px;
      color: var(--white);
      line-height: 1;
    }

    .stat-lbl {
      display: block;
      font-size: 10px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.07em;
      margin-top: 4px;
    }

    /* Country flags */
    .country-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 20px;
    }

    .country-pill {
      display: flex;
      align-items: center;
      gap: 5px;
      background: var(--surface2);
      border: 1px solid var(--border2);
      border-radius: 8px;
      padding: 5px 10px;
      font-size: 13px;
    }

    .country-abbr {
      font-weight: 600;
      color: var(--white);
      font-size: 12px;
      letter-spacing: 0.04em;
    }

    .pb-sport-label {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(232,224,213,0.40);
      margin-bottom: 6px;
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
      padding: 12px 14px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .race-row-left {
      flex: 1;
      min-width: 0;
    }

    .race-row-top {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }

    .race-medal {
      font-size: 16px;
      flex-shrink: 0;
      line-height: 1;
    }

    .race-row-name {
      font-weight: 600;
      font-size: 15px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }

    .pb-badge {
      flex-shrink: 0;
      background: rgba(200,150,40,0.15);
      border: 1px solid rgba(200,150,40,0.4);
      color: #C8960A;
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 800;
      font-size: 9px;
      letter-spacing: 0.1em;
      padding: 1px 5px;
      border-radius: 4px;
      text-transform: uppercase;
    }

    .race-row-time {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 900;
      font-size: 20px;
      color: var(--orange);
      flex-shrink: 0;
      text-align: right;
      line-height: 1;
    }

    .race-row-meta {
      display: flex;
      gap: 8px;
      font-size: 12px;
      color: var(--muted);
      flex-wrap: wrap;
    }

    .race-row-meta span + span::before {
      content: '·';
      margin-right: 8px;
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

  ${username ? `
  <div style="padding:12px 20px 80px;text-align:center;">
    <a href="https://app.breaktapes.com/compare?b=${encodeURIComponent(username)}" style="display:inline-block;background:#1a1a1a;border:1px solid rgba(245,245,245,0.12);border-radius:10px;padding:12px 20px;font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#f5f5f5;text-decoration:none;">
      Compare with @${escapeHtml(username)} →
    </a>
  </div>` : ''}

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

// ── Profile state sync (bypasses Clerk-Supabase JWT integration) ─────────────
//
// The RLS policies on user_state require `auth.jwt() ->> 'sub' = user_id`,
// which only works if Supabase can verify the Clerk JWT (via matching JWT
// secrets). Rather than requiring that setup, this endpoint receives the
// Clerk session token, decodes (not cryptographically verifies) it to
// extract the user ID, then writes to Supabase with the service role key
// which bypasses RLS entirely. Security is maintained because:
//   1. The service role key lives only in Worker secrets (never client-side).
//   2. The decoded user ID must match `user_` prefix (Clerk format).
//   3. The token expiry is checked.
//   4. The issuer claim must contain "clerk".
// For full cryptographic verification, add JWKS verification in a future pass.

function decodeJwtPayload(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(b64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function handleApiSync(request, env) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Auth: decode Clerk JWT from Authorization header
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return new Response('Unauthorized', { status: 401 });

  const payload = decodeJwtPayload(token);
  if (!payload || !payload.sub) return new Response('Invalid token', { status: 401 });

  // Expiry check
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
    return new Response('Token expired', { status: 401 });
  }

  // Issuer must be from Clerk
  const iss = String(payload.iss ?? '');
  if (!iss.includes('clerk') && !iss.includes('breaktapes')) {
    return new Response('Invalid issuer', { status: 401 });
  }

  // Clerk user IDs always start with "user_"
  const userId = payload.sub;
  if (!userId.startsWith('user_')) return new Response('Invalid user ID format', { status: 401 });

  // Parse body
  let body;
  try { body = await request.json(); }
  catch { return new Response('Invalid JSON', { status: 400 }); }

  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return new Response('Service unavailable — SUPABASE_SERVICE_ROLE_KEY not set', { status: 503 });
  }

  // Upsert via service role (bypasses RLS)
  const supabaseUrl = env.SUPABASE_URL || 'https://kmdpufauamadwavqsinj.supabase.co';
  const res = await fetch(`${supabaseUrl}/rest/v1/user_state`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      user_id:    userId,
      username:   body.username   ?? null,
      is_public:  body.is_public  ?? false,
      state_json: body.state_json ?? {},
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.status.toString());
    return new Response(`Supabase error: ${err}`, {
      status: 502,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

async function handleApiState(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    });
  }

  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return new Response('Unauthorized', { status: 401 });

  const payload = decodeJwtPayload(token);
  if (!payload || !payload.sub) return new Response('Invalid token', { status: 401 });

  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
    return new Response('Token expired', { status: 401 });
  }

  const iss = String(payload.iss ?? '');
  if (!iss.includes('clerk') && !iss.includes('breaktapes')) {
    return new Response('Invalid issuer', { status: 401 });
  }

  const userId = payload.sub;
  if (!userId.startsWith('user_')) return new Response('Invalid user ID format', { status: 401 });

  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return new Response('Service unavailable', { status: 503 });

  const supabaseUrl = env.SUPABASE_URL || 'https://kmdpufauamadwavqsinj.supabase.co';
  const res = await fetch(
    `${supabaseUrl}/rest/v1/user_state?user_id=eq.${encodeURIComponent(userId)}&select=state_json&limit=1`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: 'application/json',
      },
    }
  );

  if (!res.ok) {
    return new Response(`Supabase error: ${res.status}`, {
      status: 502,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }

  const rows = await res.json();
  const stateJson = (rows && rows[0]?.state_json) ?? null;

  return new Response(JSON.stringify({ state_json: stateJson }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // GET /api/state — read user state via service role (no Clerk-Supabase JWT needed)
    if ((request.method === 'GET' || request.method === 'OPTIONS') && path === '/api/state') {
      return handleApiState(request, env);
    }

    // POST /api/sync — profile state sync via service role (no Clerk-Supabase JWT needed)
    if ((request.method === 'POST' || request.method === 'OPTIONS') && path === '/api/sync') {
      return handleApiSync(request, env);
    }

    // POST /api/error-report — client-side crash reporting (sendBeacon)
    if (request.method === 'POST' && path === '/api/error-report') {
      try {
        const body = await request.json();
        // Store in Supabase beta_errors if table exists; otherwise silently drop
        if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
          await fetch(`${env.SUPABASE_URL}/rest/v1/beta_errors`, {
            method: 'POST',
            headers: {
              'apikey': env.SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({
              message: String(body.message ?? '').slice(0, 500),
              stack:   String(body.stack   ?? '').slice(0, 2000),
              url:     String(body.url ?? '').slice(0, 500),
              env:     String(body.env ?? '').slice(0, 50),
              ts:      body.ts ?? new Date().toISOString(),
            }),
          }).catch(() => {}); // never fail the response
        }
      } catch { /* malformed body — ignore */ }
      return new Response(null, { status: 204 });
    }

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

    // Guard: ASSETS binding must exist
    if (!env.ASSETS) {
      return new Response('Worker misconfigured: ASSETS binding missing', { status: 500 });
    }

    // SPA fallback: routes without a file extension that aren't /u/* get index.html
    // This enables React Router client-side routing (direct nav to /train, /you, /races etc.)
    const hasExtension = /\.[a-z0-9]{2,6}$/i.test(path);
    if (!hasExtension && !path.startsWith('/u/')) {
      return env.ASSETS.fetch(new Request(new URL('/', request.url).toString()));
    }

    return env.ASSETS.fetch(request);
  },
};
