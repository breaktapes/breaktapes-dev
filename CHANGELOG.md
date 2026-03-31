# Changelog

All notable changes to BREAKTAPES are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.1.0.0] - 2026-03-31

### Added
- **Wearables tab** in Train page with integration cards for WHOOP, Garmin, COROS (coming soon), Oura (coming soon), and Apple Health
- **WHOOP OAuth integration** — direct OAuth 2.0 connect/disconnect, activity feed, recovery data; tokens stored in Supabase for cross-device sync
- **Garmin OAuth integration** — PKCE-secured OAuth flow, activity feed with distance/duration/HR; client secrets kept server-side in Cloudflare Worker
- **Apple Health import** — upload `export.xml` from iPhone Health app; records parsed and stored by date in Supabase
- **Supabase tables** — `wearable_tokens` (WHOOP/Garmin OAuth tokens with RLS) and `apple_health_data` (imported records, keyed by date)
- **Health proxy routes** — `POST /whoop/token`, `POST /whoop/refresh`, `POST /garmin/token`, `POST /garmin/refresh` added to Cloudflare Worker
- **Brand logos** — proper SVG logos for all 5 integration cards (WHOOP W-in-circle, Garmin triangle, COROS hex-spiral, Oura ō ring, Apple Health heart)
- **15 new tests** covering `whoopSportName`, `parseAppleHealthXML`, and all new wearable function smoke tests (144 total, up from 129)
