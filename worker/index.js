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

import { PostHog } from 'posthog-node';

// ── Utilities ────────────────────────────────────────────────────────────────

function makePostHog(env) {
  if (!env.POSTHOG_API_KEY) return null;
  return new PostHog(env.POSTHOG_API_KEY, {
    host: env.POSTHOG_HOST || 'https://us.i.posthog.com',
    flushAt: 1,
    flushInterval: 0,
    enableExceptionAutocapture: true,
  });
}

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
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; font-src fonts.gstatic.com; style-src 'self' fonts.googleapis.com 'unsafe-inline'; img-src 'self' https: data:; script-src 'none'; frame-ancestors 'none';",
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
  if (!d) return '';
  const lower = String(d).toLowerCase().trim();
  if (lower === 'marathon' || lower === 'full marathon') return 'Marathon';
  if (lower === 'half marathon' || lower === 'half') return 'Half Marathon';
  if (lower === 'ironman' || lower === 'full ironman' || lower === 'full distance') return 'IRONMAN';
  if (lower === '70.3' || lower === 'half ironman' || lower === 'ironman 70.3' || lower === 'middle distance') return '70.3';
  if (lower === 'olympic' || lower === 'olympic triathlon') return 'Olympic';
  if (lower === 'sprint' || lower === 'sprint triathlon') return 'Sprint';
  if (lower === '5k' || lower === '5km') return '5K';
  if (lower === '10k' || lower === '10km') return '10K';
  if (lower === '10 mile' || lower === '10 miles' || lower === '10mi') return '10 Mile';
  if (lower === 'ultra' || lower === 'ultramarathon') return 'Ultra';
  if (lower === 'hyrox') return 'HYROX';
  const km = parseFloat(d);
  if (isNaN(km)) return d;
  if (km >= 225.9 && km <= 226.1) return 'IRONMAN';
  if (km >= 112.9 && km <= 113.1) return '70.3';
  if (km >= 51.4 && km <= 51.6) return 'Olympic';
  if (km >= 25.7 && km <= 25.8) return 'Sprint';
  if (km >= 42.0 && km <= 42.3) return 'Marathon';
  if (km >= 21.0 && km <= 21.2) return 'Half Marathon';
  if (km >= 16.0 && km <= 16.2) return '10 Mile';
  if (km >= 10 && km <= 10.1) return '10K';
  if (km >= 5 && km <= 5.1) return '5K';
  if (km > 42.3) return 'Ultra';
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
  return Math.round(
    races
      .filter(r => !r.outcome || r.outcome === 'Finished')
      .reduce((s, r) => {
        const k = parseFloat(r.distance);
        return s + (isNaN(k) ? 0 : k);
      }, 0)
  );
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

// Canonical PB distance definitions — mirrors Profile.tsx PB_DISTANCES exactly
const PB_DISTANCES = [
  // Running
  { key: '5',      label: '5K',           sport: 'Running' },
  { key: '10',     label: '10K',          sport: 'Running' },
  { key: '16.09',  label: '10 Mile',      sport: 'Running' },
  { key: '21.1',   label: 'Half Marathon',sport: 'Running' },
  { key: '42.2',   label: 'Marathon',     sport: 'Running' },
  { key: '42.195', label: 'Marathon',     sport: 'Running' },
  { key: '50',     label: '50K',          sport: 'Running', sportMatch: 'run' },
  { key: '100',    label: '100K',         sport: 'Running', sportMatch: 'run' },
  { key: '160.93', label: '100 Mile',     sport: 'Running', sportMatch: 'run' },
  // Triathlon
  { key: '25.75',  label: 'Sprint',       sport: 'Triathlon' },
  { key: '51.5',   label: 'Olympic',      sport: 'Triathlon' },
  { key: '113',    label: '70.3',         sport: 'Triathlon' },
  { key: '226',    label: 'IRONMAN',      sport: 'Triathlon' },
  // Cycling
  { key: '40|cy',     label: '40K TT',   sport: 'Cycling',  distValue: '40',     sportMatch: 'cycl' },
  { key: '100|cy',    label: '100K',     sport: 'Cycling',  distValue: '100',    sportMatch: 'cycl' },
  { key: '160.93|cy', label: '100 Mile', sport: 'Cycling',  distValue: '160.93', sportMatch: 'cycl' },
  // Swimming
  { key: '1.5|sw',    label: '1500m',    sport: 'Swimming', distValue: '1.5',    sportMatch: 'swim' },
  { key: '3|sw',      label: '3K',       sport: 'Swimming', distValue: '3',      sportMatch: 'swim' },
  { key: '10|sw',     label: '10K',      sport: 'Swimming', distValue: '10',     sportMatch: 'swim' },
  // HYROX
  { key: 'hyrox',     label: 'HYROX',    sport: 'HYROX',                         sportMatch: 'hyrox' },
];

const SPORT_ACCENT = {
  Running:   { color: '#00FF88', bg: 'rgba(0,255,136,0.06)',   glow: 'rgba(0,255,136,0.08)' },
  Triathlon: { color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', glow: 'rgba(124,58,237,0.08)' },
  Cycling:   { color: '#38BDF8', bg: 'rgba(56,189,248,0.07)', glow: 'rgba(56,189,248,0.08)' },
  Swimming:  { color: '#22D3EE', bg: 'rgba(34,211,238,0.07)', glow: 'rgba(34,211,238,0.08)' },
  HYROX:     { color: '#FB923C', bg: 'rgba(251,146,60,0.07)', glow: 'rgba(251,146,60,0.08)' },
};

// Compute personal bests using same logic as Profile.tsx buildPBByDist
function computePBs(races) {
  const pb = {};
  for (const entry of PB_DISTANCES) {
    const distToMatch = entry.distValue ?? entry.key;
    if (entry.key === 'hyrox') {
      for (const r of races) {
        if (!r.time) continue;
        const rSport = (r.sport || '').toLowerCase();
        if (!rSport.includes('hyrox')) continue;
        const secs = timeToSecs(r.time);
        if (!pb[entry.key] || secs < pb[entry.key].secs) {
          pb[entry.key] = { secs, time: r.time, raceName: r.name || '', label: entry.label, sport: entry.sport };
        }
      }
      continue;
    }
    for (const r of races) {
      if (!r.time || !r.distance) continue;
      if (r.distance !== distToMatch) continue;
      if (entry.sportMatch) {
        const rSport = (r.sport || '').toLowerCase();
        const isRunMatch = entry.sportMatch === 'run' && (rSport === '' || rSport.includes('run'));
        const isOtherMatch = entry.sportMatch !== 'run' && rSport.includes(entry.sportMatch);
        if (!isRunMatch && !isOtherMatch) continue;
      }
      const secs = timeToSecs(r.time);
      if (!pb[entry.key] || secs < pb[entry.key].secs) {
        pb[entry.key] = { secs, time: r.time, raceName: r.name || '', label: entry.label, sport: entry.sport };
      }
    }
  }
  return pb;
}

function countMedals(races) {
  return races.filter(r => r.medal && r.medal !== 'none' && r.medal !== '').length;
}

function uniqueCountries(races) {
  return new Set(races.map(r => r.country).filter(Boolean)).size;
}

// ── Supabase fetch helper ────────────────────────────────────────────────────

async function fetchProfile(username, env) {
  // Use the SERVICE-ROLE key (server-side only) so anon's SELECT on user_state
  // can be revoked — the raw row must not be readable with the public anon key.
  // Visibility is still enforced below in renderProfile().
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/user_state`);
  url.searchParams.set('username', `eq.${username}`);
  url.searchParams.set('is_public', 'eq.true');
  url.searchParams.set('select', 'state_json');
  url.searchParams.set('limit', '1');

  const res = await fetch(url.toString(), {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
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

  // Profile visibility gates — all default OFF (must be explicitly enabled)
  const pv = athlete.profileVisibility || {};
  const showBio      = pv.bio       === true; // explicit opt-in, matching all other visibility flags
  const showStats    = pv.stats     === true;
  const showRaces    = pv.races     === true;
  const showPBs      = pv.pbs       === true;
  const showMedals   = pv.medals    === true;
  const showUpcoming = pv.upcoming  === true;

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
  const clubPills = (Array.isArray(athlete.clubs) ? athlete.clubs : []).map(c =>
    `<span class="club-pill">${escapeHtml(c)}</span>`
  ).join('');

  // PB card grid — mirrors in-app PersonalBests component style
  const pbHiddenKeys = new Set(Array.isArray(athlete.pbHiddenKeys) ? athlete.pbHiddenKeys : []);

  function pbCardHtml(key) {
    if (!pbs[key] || pbHiddenKeys.has(key)) return '';
    const entry = PB_DISTANCES.find(d => d.key === key);
    if (!entry) return '';
    const accent = SPORT_ACCENT[entry.sport] ?? SPORT_ACCENT.Running;
    const time = escapeHtml(fmtTime(pbs[key].time));
    const raceName = escapeHtml((pbs[key].raceName || '').replace(/\s+\d{4}$/, '').substring(0, 24));
    return `<div style="background:linear-gradient(145deg,#141414 0%,${accent.bg} 100%);border:1px solid rgba(245,245,245,0.10);border-left:3px solid ${accent.color};border-radius:14px;padding:14px 14px 12px;min-width:0;box-shadow:inset 0 1px 0 ${accent.glow},0 4px 20px rgba(0,0,0,0.4);">
      <div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(232,224,213,0.45);margin-bottom:6px;">${escapeHtml(entry.label)}</div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:28px;color:${accent.color};line-height:1;letter-spacing:-0.01em;margin-bottom:8px;">${time}</div>
      ${raceName ? `<div style="font-size:11px;color:rgba(232,224,213,0.40);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${raceName}</div>` : ''}
    </div>`;
  }

  const PB_SPORT_ORDER = ['Running', 'Triathlon', 'Cycling', 'Swimming', 'HYROX'];
  let pbSection = '';
  for (const sport of PB_SPORT_ORDER) {
    const sportKeys = PB_DISTANCES.filter(d => d.sport === sport).map(d => d.key);
    const cards = sportKeys.map(pbCardHtml).filter(Boolean).join('');
    if (!cards) continue;
    const accent = SPORT_ACCENT[sport] ?? SPORT_ACCENT.Running;
    pbSection += `
      <p style="font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:${accent.color};opacity:0.7;margin:0 0 8px 2px;">${escapeHtml(sport)}</p>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;margin-bottom:16px;min-width:0;">${cards}</div>`;
  }

  // Recent races (last 5)
  const today = new Date().toISOString().slice(0, 10);
  const pastRaces = races
    .filter(r => r.date && r.date <= today)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 5);

  const raceRows = pastRaces.map(r => {
    const pb = isPB(r);
    const flag = r.country ? countryFlagEmoji(r.country) : '';
    const label = distLabel(r.distance);
    const time = r.time ? escapeHtml(fmtTime(r.time)) : 'DNF';
    const loc = [r.city ? escapeHtml(r.city) : '', r.country ? escapeHtml(shortCountryName(r.country)) : ''].filter(Boolean).join(', ');

    const pbStyle = pb
      ? 'border-color:rgba(200,160,40,0.45);background:rgba(200,150,40,0.04);box-shadow:inset 0 0 0 1px rgba(200,150,40,0.2);'
      : '';

    return `
    <div class="race-row" style="${pbStyle}">
      <div class="race-row-left">
        <div class="race-row-top">
          ${flag ? `<span class="race-medal">${flag}</span>` : ''}
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

    ${showBio ? bioHtml : ''}
    ${showBio && clubPills ? `<div class="clubs-row">${clubPills}</div>` : ''}

    ${showStats ? `
    <section class="profile-section" style="margin-top:20px;">
      <div class="career-stats">
        <div class="stat-pill"><span class="stat-val">${totalRaces}</span><span class="stat-lbl">races</span></div>
        <div class="stat-pill"><span class="stat-val">${km}</span><span class="stat-lbl">total km</span></div>
        <div class="stat-pill"><span class="stat-val">${countries}</span><span class="stat-lbl">countr${countries === 1 ? 'y' : 'ies'}</span></div>
        ${years > 0 ? `<div class="stat-pill"><span class="stat-val">${years}</span><span class="stat-lbl">year${years === 1 ? '' : 's'}</span></div>` : ''}
      </div>
    </section>
    ${countryPills ? `<div class="country-row">${countryPills}</div>` : ''}` : ''}

    ${showPBs && pbSection ? `
    <section class="profile-section">
      <h2 class="section-title">PERSONAL BESTS</h2>
      ${pbSection}
    </section>` : ''}

    ${showRaces && raceRows ? `
    <section class="profile-section">
      <h2 class="section-title">RECENT RACES</h2>
      <div class="race-list">${raceRows}</div>
    </section>` : ''}

    ${showUpcoming ? upcomingHtml : ''}
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
      Compare with you →
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

// ── Cryptographic Clerk JWT verification (RS256 via JWKS) ────────────────────
// decodeJwtPayload above only base64-decodes — an attacker could forge a token
// with any `sub` (read/write ANY user's data via the service-role key). This
// verifies the signature against Clerk's JWKS, with the issuer PINNED to known
// Clerk instances (so an attacker can't point us at their own JWKS).
const ALLOWED_ISS = new Set([
  'https://clerk.breaktapes.com',
  'https://accounts.breaktapes.com',
  'https://elegant-snipe-62.clerk.accounts.dev', // dev/local instance
]);
const _jwksCache = new Map(); // iss -> { keys, fetchedAt }

function _b64urlToBytes(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
  const bin = atob(b64 + pad);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function _getJwks(iss, force) {
  const cached = _jwksCache.get(iss);
  if (!force && cached && Date.now() - cached.fetchedAt < 3600_000) return cached.keys;
  const res = await fetch(`${iss}/.well-known/jwks.json`);
  if (!res.ok) throw new Error(`jwks ${res.status}`);
  const { keys } = await res.json();
  _jwksCache.set(iss, { keys, fetchedAt: Date.now() });
  return keys;
}

// Returns the verified payload, or null. Fails CLOSED on any error.
async function verifyClerkJwt(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const header = JSON.parse(atob(h.replace(/-/g, '+').replace(/_/g, '/')));
    if (header.alg !== 'RS256' || !header.kid) return null;
    const payload = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
    const iss = String(payload.iss ?? '');
    if (!ALLOWED_ISS.has(iss)) return null;
    if (!payload.sub || !String(payload.sub).startsWith('user_')) return null;
    const nowS = Math.floor(Date.now() / 1000);
    if (!payload.exp || nowS > payload.exp) return null;
    if (payload.nbf && nowS + 5 < payload.nbf) return null;

    let keys = await _getJwks(iss, false);
    let jwk = keys.find(k => k.kid === header.kid);
    if (!jwk) { keys = await _getJwks(iss, true); jwk = keys.find(k => k.kid === header.kid); } // key rotation
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'],
    );
    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5', key, _b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`),
    );
    return ok ? payload : null;
  } catch {
    return null;
  }
}

// ── Admin helpers ────────────────────────────────────────────────────────────

const ADMIN_ALLOWED_ORIGINS = new Set([
  'https://app.breaktapes.com',
  'https://dev.breaktapes.com',
  'http://localhost:3000',
]);

function adminCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = ADMIN_ALLOWED_ORIGINS.has(origin) ? origin : 'https://app.breaktapes.com';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Content-Type': 'application/json',
  };
}

// Legacy constant kept for the few spots that don't have a request reference.
// Prefer adminCorsHeaders(request) where possible.
const ADMIN_CORS = {
  'Access-Control-Allow-Origin': 'https://app.breaktapes.com',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Content-Type': 'application/json',
};

function adminCors(request) {
  return new Response(null, { headers: adminCorsHeaders(request) });
}

/** Verify Clerk token (signature) and return userId if valid admin, else null. */
async function resolveAdminUserId(request, env) {
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const payload = await verifyClerkJwt(token);
  if (!payload || !payload.sub) return null;
  const userId = payload.sub;
  // Check against ADMIN_USER_IDS env var (comma-separated Clerk IDs)
  const adminIds = (env.ADMIN_USER_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (!adminIds.includes(userId)) return null;
  return userId;
}

async function handleCatalogSubmit(request, env) {
  if (request.method === 'OPTIONS') return adminCors();
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: adminCorsHeaders(request) });

  // Auth: decode Clerk JWT
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return new Response('Unauthorized', { status: 401, headers: adminCorsHeaders(request) });
  const payload = await verifyClerkJwt(token);
  if (!payload || !payload.sub) return new Response('Invalid token', { status: 401, headers: adminCorsHeaders(request) });
  const userId = payload.sub;

  let body;
  try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400, headers: adminCorsHeaders(request) }); }

  const { name, city, country, sport, dist_label, dist_km, year, event_date, month, day } = body;
  if (!name || !city) return new Response('name and city required', { status: 400, headers: adminCorsHeaders(request) });

  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return new Response('Service unavailable', { status: 503, headers: adminCorsHeaders(request) });

  const supabaseUrl = env.SUPABASE_URL || 'https://kmdpufauamadwavqsinj.supabase.co';
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/upsert_catalog_contribution`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      p_name:           name,
      p_city:           city,
      p_country:        country ?? '',
      p_sport:          sport ?? 'Running',
      p_dist_label:     dist_label ?? null,
      p_dist_km:        dist_km ?? null,
      p_year:           year ?? null,
      p_event_date:     event_date ?? null,
      p_month:          month ?? null,
      p_day:            day ?? null,
      p_contributor_id: userId,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    return new Response(`RPC error: ${err}`, { status: 502, headers: adminCorsHeaders(request) });
  }
  return new Response(JSON.stringify({ ok: true }), { headers: adminCorsHeaders(request) });
}

async function handleAdminCheck(request, env) {
  if (request.method === 'OPTIONS') return adminCors();
  const userId = await resolveAdminUserId(request, env);
  if (!userId) return new Response(JSON.stringify({ ok: false }), { status: 403, headers: adminCorsHeaders(request) });
  return new Response(JSON.stringify({ ok: true }), { headers: adminCorsHeaders(request) });
}

async function handleAdminUsers(request, env) {
  if (request.method === 'OPTIONS') return adminCors();
  const userId = await resolveAdminUserId(request, env);
  if (!userId) return new Response('Forbidden', { status: 403, headers: adminCorsHeaders(request) });
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return new Response('Service unavailable', { status: 503, headers: adminCorsHeaders(request) });
  const supabaseUrl = env.SUPABASE_URL || 'https://kmdpufauamadwavqsinj.supabase.co';
  const res = await fetch(
    `${supabaseUrl}/rest/v1/user_state?select=user_id,username,is_public,updated_at,created_at,state_json&order=updated_at.desc&limit=500`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (!res.ok) return new Response('Database error', { status: 502, headers: adminCorsHeaders(request) });
  const rows = await res.json();
  const users = rows.map(r => {
    let raceCount = 0, upcomingCount = 0, sport = null, country = null, goalCount = 0;
    try {
      const s = r.state_json;
      if (s) {
        raceCount = Array.isArray(s.races) ? s.races.length : 0;
        upcomingCount = Array.isArray(s.upcoming_races) ? s.upcoming_races.length : 0;
        const g = s.goals ?? {};
        goalCount = Object.keys(g.annual ?? {}).length + (Array.isArray(g.distGoals) ? g.distGoals.length : 0);
        sport = s.athlete?.sport ?? null;
        country = s.athlete?.country ?? null;
      }
    } catch {}
    return { user_id: r.user_id, username: r.username, is_public: r.is_public, updated_at: r.updated_at, created_at: r.created_at, race_count: raceCount, upcoming_count: upcomingCount, goal_count: goalCount, sport, country };
  });
  return new Response(JSON.stringify(users), { headers: adminCorsHeaders(request) });
}

async function handleAdminFeedback(request, env) {
  if (request.method === 'OPTIONS') return adminCors();
  const userId = await resolveAdminUserId(request, env);
  if (!userId) return new Response('Forbidden', { status: 403, headers: adminCorsHeaders(request) });
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return new Response('Service unavailable', { status: 503, headers: adminCorsHeaders(request) });
  const supabaseUrl = env.SUPABASE_URL || 'https://kmdpufauamadwavqsinj.supabase.co';
  const res = await fetch(
    `${supabaseUrl}/rest/v1/beta_feedback?select=id,user_id,rating,message,page,created_at&order=created_at.desc&limit=300`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (!res.ok) return new Response('Database error', { status: 502, headers: adminCorsHeaders(request) });
  return new Response(await res.text(), { headers: adminCorsHeaders(request) });
}

async function handleAdminErrors(request, env) {
  if (request.method === 'OPTIONS') return adminCors();
  const userId = await resolveAdminUserId(request, env);
  if (!userId) return new Response('Forbidden', { status: 403, headers: adminCorsHeaders(request) });
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return new Response('Service unavailable', { status: 503, headers: adminCorsHeaders(request) });
  const supabaseUrl = env.SUPABASE_URL || 'https://kmdpufauamadwavqsinj.supabase.co';
  const res = await fetch(
    `${supabaseUrl}/rest/v1/beta_errors?select=id,message,stack,url,env,ts,created_at&order=created_at.desc&limit=200`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (!res.ok) return new Response('Database error', { status: 502, headers: adminCorsHeaders(request) });
  return new Response(await res.text(), { headers: adminCorsHeaders(request) });
}

async function handleAdminAnalytics(request, env) {
  if (request.method === 'OPTIONS') return adminCors();
  const userId = await resolveAdminUserId(request, env);
  if (!userId) return new Response('Forbidden', { status: 403, headers: adminCorsHeaders(request) });
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return new Response('Service unavailable', { status: 503, headers: adminCorsHeaders(request) });
  const supabaseUrl = env.SUPABASE_URL || 'https://kmdpufauamadwavqsinj.supabase.co';
  const svcH = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  const now = new Date();
  const d24h = new Date(now - 24*60*60*1000).toISOString();
  const d7d  = new Date(now - 7*24*60*60*1000).toISOString();
  const d30d = new Date(now - 30*24*60*60*1000).toISOString();

  const [dauRes, wauRes, mauRes, fbRes, usersRes, totalRes, wearRes, signupRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/user_state?select=user_id&updated_at=gte.${d24h}`, { headers: svcH }),
    fetch(`${supabaseUrl}/rest/v1/user_state?select=user_id&updated_at=gte.${d7d}`,  { headers: svcH }),
    fetch(`${supabaseUrl}/rest/v1/user_state?select=user_id&updated_at=gte.${d30d}`, { headers: svcH }),
    fetch(`${supabaseUrl}/rest/v1/beta_feedback?select=id,rating&limit=1000`, { headers: svcH }),
    fetch(`${supabaseUrl}/rest/v1/user_state?select=user_id,is_public,updated_at,state_json&limit=1000&order=updated_at.desc`, { headers: svcH }),
    fetch(`${supabaseUrl}/rest/v1/user_state?select=user_id`, { headers: { ...svcH, Prefer: 'count=exact', Range: '0-0' } }),
    fetch(`${supabaseUrl}/rest/v1/wearable_tokens?select=user_id,provider`, { headers: svcH }),
    fetch(`${supabaseUrl}/rest/v1/user_state?select=created_at&created_at=gte.${d30d}&order=created_at.asc`, { headers: svcH }),
  ]);

  const totalCount = parseInt(totalRes.headers.get('Content-Range')?.split('/')[1] ?? '0') || 0;
  const dau = dauRes.ok ? (await dauRes.json()).length : 0;
  const wau = wauRes.ok ? (await wauRes.json()).length : 0;
  const mau = mauRes.ok ? (await mauRes.json()).length : 0;

  let fbCount = 0, avgRating = 0;
  if (fbRes.ok) {
    const fbs = await fbRes.json();
    fbCount = fbs.length;
    const rated = fbs.filter(f => f.rating);
    if (rated.length) avgRating = Math.round(rated.reduce((s, f) => s + f.rating, 0) / rated.length * 10) / 10;
  }

  // Wearable adoption: distinct users per provider + any-provider count.
  const wearByProvider = {};
  const wearUserSet = new Set();
  if (wearRes.ok) {
    for (const w of await wearRes.json()) {
      if (!w.provider) continue;
      wearByProvider[w.provider] = (wearByProvider[w.provider] || 0) + 1;
      wearUserSet.add(w.user_id);
    }
  }

  const sportCounts = {}, distCounts = {}, countryCounts = {};
  let totalRaces = 0, usersWithRaces = 0;
  let publicCount = 0, withUpcoming = 0, withGoals = 0;
  let segPower = 0, segActive = 0, segDormant = 0;          // 10+ / 1-9 / 0 races
  let recToday = 0, recWeek = 0, recMonth = 0, recDormant = 0;
  const nowMs = now.getTime();
  if (usersRes.ok) {
    const rows = await usersRes.json();
    for (const r of rows) {
      const s = r.state_json ?? {};
      const races = Array.isArray(s.races) ? s.races : [];
      const upcoming = Array.isArray(s.upcoming_races) ? s.upcoming_races : [];
      const goalsObj = s.goals ?? {};
      const hasGoals = Object.keys(goalsObj.annual ?? {}).length > 0 || (Array.isArray(goalsObj.distGoals) && goalsObj.distGoals.length > 0);

      if (r.is_public) publicCount++;
      if (upcoming.length) withUpcoming++;
      if (hasGoals) withGoals++;

      if (races.length >= 10) segPower++;
      else if (races.length >= 1) segActive++;
      else segDormant++;

      if (races.length) { usersWithRaces++; totalRaces += races.length; }
      for (const rc of races) {
        if (rc.sport)     sportCounts[rc.sport]       = (sportCounts[rc.sport]       || 0) + 1;
        if (rc.distance)  distCounts[rc.distance]     = (distCounts[rc.distance]     || 0) + 1;
        if (rc.country)   countryCounts[rc.country]   = (countryCounts[rc.country]   || 0) + 1;
      }

      const age = nowMs - new Date(r.updated_at).getTime();
      if (age < 24*60*60*1000)       recToday++;
      else if (age < 7*24*60*60*1000)  recWeek++;
      else if (age < 30*24*60*60*1000) recMonth++;
      else recDormant++;
    }
  }

  // Signup growth: daily new-user counts over the last 30 days (created_at).
  const signupsByDay = {};
  if (signupRes.ok) {
    for (const r of await signupRes.json()) {
      if (!r.created_at) continue;
      const day = r.created_at.slice(0, 10); // YYYY-MM-DD
      signupsByDay[day] = (signupsByDay[day] || 0) + 1;
    }
  }
  const growth = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(nowMs - i*24*60*60*1000).toISOString().slice(0, 10);
    growth.push([d, signupsByDay[d] || 0]);
  }

  const pct = (n) => totalCount ? Math.round(n / totalCount * 100) : 0;

  return new Response(JSON.stringify({
    users:      { total: totalCount, dau, wau, mau },
    feedback:   { count: fbCount, avg_rating: avgRating },
    races:      { total: totalRaces, users_with_races: usersWithRaces, avg_per_user: usersWithRaces ? Math.round(totalRaces / usersWithRaces * 10) / 10 : 0 },
    segments:   { power: segPower, active: segActive, dormant: segDormant },
    adoption:   {
      public:   { count: publicCount,        pct: pct(publicCount) },
      upcoming: { count: withUpcoming,        pct: pct(withUpcoming) },
      goals:    { count: withGoals,           pct: pct(withGoals) },
      wearables:{ count: wearUserSet.size,    pct: pct(wearUserSet.size) },
    },
    recency:    { today: recToday, week: recWeek, month: recMonth, dormant: recDormant },
    wearables:  Object.entries(wearByProvider).sort((a, b) => b[1] - a[1]),
    growth,
    top_sports: Object.entries(sportCounts).sort((a, b) => b[1] - a[1]).slice(0, 8),
    top_distances: Object.entries(distCounts).sort((a, b) => b[1] - a[1]).slice(0, 10),
    top_countries: Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 10),
  }), { headers: adminCorsHeaders(request) });
}

async function handleAdminListContributions(request, env) {
  if (request.method === 'OPTIONS') return adminCors();

  const userId = await resolveAdminUserId(request, env);
  if (!userId) return new Response('Forbidden', { status: 403, headers: adminCorsHeaders(request) });

  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return new Response('Service unavailable', { status: 503, headers: adminCorsHeaders(request) });

  const supabaseUrl = env.SUPABASE_URL || 'https://kmdpufauamadwavqsinj.supabase.co';
  const res = await fetch(
    `${supabaseUrl}/rest/v1/pending_catalog_contributions?status=eq.pending&order=contributor_count.desc,created_at.asc&limit=200`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );

  if (!res.ok) {
    return new Response('Database error', { status: 502, headers: adminCorsHeaders(request) });
  }
  const data = await res.json();
  return new Response(JSON.stringify(data), { headers: adminCorsHeaders(request) });
}

async function handleAdminAction(request, env, id, action) {
  if (request.method === 'OPTIONS') return adminCors();

  const userId = await resolveAdminUserId(request, env);
  if (!userId) return new Response('Forbidden', { status: 403, headers: adminCorsHeaders(request) });

  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return new Response('Service unavailable', { status: 503, headers: adminCorsHeaders(request) });

  const supabaseUrl = env.SUPABASE_URL || 'https://kmdpufauamadwavqsinj.supabase.co';
  const svcHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

  if (action === 'approve') {
    // Fetch the contribution row
    const fetchRes = await fetch(
      `${supabaseUrl}/rest/v1/pending_catalog_contributions?id=eq.${id}&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    if (!fetchRes.ok) return new Response('Fetch failed', { status: 502, headers: adminCorsHeaders(request) });
    const rows = await fetchRes.json();
    if (!rows || rows.length === 0) return new Response('Not found', { status: 404, headers: adminCorsHeaders(request) });
    const c = rows[0];

    // Map sport to catalog type code
    const typeMap = { running: 'run', triathlon: 'tri', cycling: 'cycle', swimming: 'swim', hyrox: 'hyrox' };
    const type = typeMap[(c.sport ?? '').toLowerCase()] ?? (c.sport ?? '').toLowerCase();

    // Insert into race_catalog (idempotent via ON CONFLICT DO NOTHING)
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/race_catalog`, {
      method: 'POST',
      headers: { ...svcHeaders, Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({
        name:       c.name,
        city:       c.city,
        country:    c.country,
        type,
        dist:       c.dist_label ?? (c.dist_km ? String(c.dist_km) : null),
        dist_km:    c.dist_km,
        year:       c.year,
        month:      c.month,
        day:        c.day,
        start_time: null,
      }),
    });
    if (!insertRes.ok) {
      const err = await insertRes.text();
      return new Response(`Insert failed: ${err}`, { status: 502, headers: adminCorsHeaders(request) });
    }
  }

  // Mark as approved or rejected
  const updateRes = await fetch(
    `${supabaseUrl}/rest/v1/pending_catalog_contributions?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: { ...svcHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify({ status: action === 'approve' ? 'approved' : 'rejected' }),
    }
  );

  if (!updateRes.ok) {
    return new Response('Update failed', { status: 502, headers: adminCorsHeaders(request) });
  }
  return new Response(null, { status: 204, headers: adminCorsHeaders(request) });
}


function apiCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ADMIN_ALLOWED_ORIGINS.has(origin) ? origin : 'https://app.breaktapes.com';
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'Authorization, Content-Type' };
}

async function handleApiSync(request, env) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: { ...apiCorsHeaders(request), 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Auth: decode Clerk JWT from Authorization header
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return new Response('Unauthorized', { status: 401 });

  // Cryptographically verify the Clerk JWT signature (not just decode it).
  const payload = await verifyClerkJwt(token);
  if (!payload || !payload.sub) return new Response('Invalid token', { status: 401 });
  const userId = payload.sub;

  // Read body as text first so we can enforce size cap reliably.
  // Content-Length is client-controlled and absent on chunked transfers — post-parse check is the only reliable gate.
  let bodyText;
  try { bodyText = await request.text(); } catch { return new Response('Invalid body', { status: 400 }); }
  if (bodyText.length > 512_000) return new Response('Payload too large', { status: 413 });

  let body;
  try { body = JSON.parse(bodyText); }
  catch { return new Response('Invalid JSON', { status: 400 }); }

  // Validate username — normalize to lowercase first (Clerk may provide mixed-case)
  const rawUsername = body.username != null ? String(body.username).toLowerCase().trim() : null;
  if (rawUsername !== null && rawUsername !== '') {
    if (!/^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/.test(rawUsername)) {
      return new Response('Invalid username format', { status: 400 });
    }
    body = { ...body, username: rawUsername };
  }

  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return new Response('Service unavailable — SUPABASE_SERVICE_ROLE_KEY not set', { status: 503 });
  }

  // Upsert via service role (bypasses RLS)
  const supabaseUrl = env.SUPABASE_URL || 'https://kmdpufauamadwavqsinj.supabase.co';

  // Server-side UNION of delete tombstones. The write is a full state_json
  // replace, so a device that never pulled a delete would otherwise wipe the
  // tombstone and the deleted race would resurrect. Read the current row's
  // tombstones, merge with the incoming (newest per id, prune >90d), and write
  // the union back. Best-effort: on any error, fall back to the incoming set.
  let stateJson = body.state_json ?? {};
  try {
    const cur = await fetch(`${supabaseUrl}/rest/v1/user_state?user_id=eq.${encodeURIComponent(userId)}&select=state_json`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (cur.ok) {
      const rows = await cur.json().catch(() => []);
      const existing = Array.isArray(rows?.[0]?.state_json?.deleted_race_ids) ? rows[0].state_json.deleted_race_ids : [];
      const incoming = Array.isArray(stateJson.deleted_race_ids) ? stateJson.deleted_race_ids : [];
      const m = new Map();
      for (const t of [...existing, ...incoming]) {
        if (t && typeof t.id === 'string' && typeof t.at === 'number') {
          m.set(t.id, Math.max(m.get(t.id) ?? 0, t.at));
        }
      }
      const NINETY = 90 * 24 * 60 * 60 * 1000, now = Date.now();
      const merged = [];
      for (const [id, at] of m) { if (now - at < NINETY) merged.push({ id, at }); }
      stateJson = { ...stateJson, deleted_race_ids: merged };
    }
  } catch { /* fall back to incoming tombstones */ }

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
      state_json: stateJson,
    }),
  });

  if (!res.ok) {
    return new Response('Sync error', {
      status: 502,
      headers: apiCorsHeaders(request),
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', ...apiCorsHeaders(request) },
  });
}

async function handleApiState(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: { ...apiCorsHeaders(request), 'Access-Control-Allow-Methods': 'GET, OPTIONS' },
    });
  }

  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return new Response('Unauthorized', { status: 401 });

  const payload = await verifyClerkJwt(token);
  if (!payload || !payload.sub) return new Response('Invalid token', { status: 401 });
  const userId = payload.sub;

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
    return new Response('State fetch error', {
      status: 502,
      headers: apiCorsHeaders(request),
    });
  }

  const rows = await res.json();
  const stateJson = (rows && rows[0]?.state_json) ?? null;

  return new Response(JSON.stringify({ state_json: stateJson }), {
    headers: { 'Content-Type': 'application/json', ...apiCorsHeaders(request) },
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (err) {
      // Top-level guard: any throw in SSR / API / scraper paths would otherwise
      // become an unhandled rejection → Cloudflare's generic 1101 error page.
      // For profile/race SSR routes, degrade to a clean 404; otherwise 500.
      const p = new URL(request.url).pathname;
      if (p.startsWith('/u/')) return notFoundPage(p.split('/')[2] || '');
      return new Response('Internal error', { status: 500, headers: { 'X-Content-Type-Options': 'nosniff' } });
    }
  },
};

async function handleRequest(request, env) {
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

    // Admin: GET /api/admin/contributions — list pending
    if ((request.method === 'GET' || request.method === 'OPTIONS') && path === '/api/admin/contributions') {
      return handleAdminListContributions(request, env);
    }

    // Admin: POST /api/admin/contributions/:id/approve|reject
    const adminActionMatch = path.match(/^\/api\/admin\/contributions\/(\d+)\/(approve|reject)$/);
    if (request.method === 'POST' && adminActionMatch) {
      return handleAdminAction(request, env, Number(adminActionMatch[1]), adminActionMatch[2]);
    }

    // Admin: GET /api/admin/check — authz probe (drives the client gate; no
    // admin IDs are shipped in the bundle, so this 403 is the source of truth)
    if ((request.method === 'GET' || request.method === 'OPTIONS') && path === '/api/admin/check') {
      return handleAdminCheck(request, env);
    }

    // Admin: GET /api/admin/users
    if ((request.method === 'GET' || request.method === 'OPTIONS') && path === '/api/admin/users') {
      return handleAdminUsers(request, env);
    }

    // Admin: GET /api/admin/feedback
    if ((request.method === 'GET' || request.method === 'OPTIONS') && path === '/api/admin/feedback') {
      return handleAdminFeedback(request, env);
    }

    // Admin: GET /api/admin/errors
    if ((request.method === 'GET' || request.method === 'OPTIONS') && path === '/api/admin/errors') {
      return handleAdminErrors(request, env);
    }

    // Admin: GET /api/admin/analytics
    if ((request.method === 'GET' || request.method === 'OPTIONS') && path === '/api/admin/analytics') {
      return handleAdminAnalytics(request, env);
    }

    // POST /api/catalog/submit — user submits upcoming race to catalog
    if ((request.method === 'POST' || request.method === 'OPTIONS') && path === '/api/catalog/submit') {
      return handleCatalogSubmit(request, env);
    }

    // POST /api/error-report — client-side crash reporting (sendBeacon)
    if (request.method === 'POST' && path === '/api/error-report') {
      // Require a valid Clerk JWT — error reports are authenticated-only.
      // Prevents unauthenticated DB flooding. Falls through to 401 if no token.
      const errAuthHeader = request.headers.get('Authorization') ?? '';
      const errToken = errAuthHeader.startsWith('Bearer ') ? errAuthHeader.slice(7) : null;
      if (!errToken) return new Response(null, { status: 204 }); // silently drop unauthenticated reports
      const errPayload = await verifyClerkJwt(errToken);
      if (!errPayload) return new Response(null, { status: 204 });
      try {
        const errText = await request.text().catch(() => '');
        if (errText.length > 32_000) return new Response(null, { status: 204 }); // silently drop oversized reports
        const body = JSON.parse(errText);
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
        const posthog = makePostHog(env);
        if (posthog) {
          posthog.capture({
            distinctId: `profile_${username}`,
            event: 'public profile viewed',
            properties: {
              profile_username: username,
              referrer: request.headers.get('Referer') || null,
            },
          });
          await posthog.shutdown();
        }
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
        const posthog = makePostHog(env);
        if (posthog) {
          posthog.capture({
            distinctId: `profile_${username}`,
            event: 'race card viewed',
            properties: {
              profile_username: username,
              race_id: raceId,
              referrer: request.headers.get('Referer') || null,
            },
          });
          await posthog.shutdown();
        }
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
}
