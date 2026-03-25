# Open Wearables Setup Guide

Breaktapes uses a shared Open Wearables (OW) instance so users never have to self-host anything.
This guide covers deploying the shared instance and wiring it to the Cloudflare Worker proxy.

---

## Architecture

```
User browser → health.breaktapes.com (Cloudflare Worker)
                        ↓  adds OW_API_KEY secret
              Railway OW instance
                        ↓  OAuth per provider
         Garmin / Whoop / Apple Health / Fitbit / Strava / etc.
```

The Worker holds the OW API key — it never reaches the browser.

---

## Step 1: Deploy Open Wearables to Railway

1. Go to: https://railway.app/new
2. Search for **"Open Wearables"** in the template marketplace, or use the direct deploy button from https://docs.openwearables.io/deployment/railway
3. Click **Deploy Now** — Railway provisions 7 services automatically:
   - PostgreSQL, Redis, FastAPI backend, Celery Worker, Celery Beat, Flower, React frontend
4. Wait ~3 minutes for first deploy to complete
5. Note your backend URL: `https://open-wearables-production-xxxx.up.railway.app`

### Set admin credentials (before first start)
On the **Backend** service → Variables, set:
```
ADMIN_EMAIL=health@breaktapes.com
ADMIN_PASSWORD=<strong-password>
```

### Set a custom domain (optional but recommended)
- Frontend service → Settings → Networking → `portal.breaktapes.com`
- Backend service → Settings → Networking → `health-api.breaktapes.com`

---

## Step 2: Get the OW API key

1. Open the OW frontend URL (Railway assigns one, e.g. `xxx.up.railway.app`)
2. Log in with the admin credentials from Step 1
3. Go to **API Keys** → **Create API Key**
4. Copy the key — you'll need it in Step 3

---

## Step 3: Configure the Cloudflare Worker

```bash
cd health-proxy

# Install wrangler if needed
npm install

# Set the Railway backend URL as a secret
wrangler secret put OW_BASE_URL
# paste: https://open-wearables-production-xxxx.up.railway.app

# Set the OW API key as a secret
wrangler secret put OW_API_KEY
# paste: the key from Step 2

# Deploy the worker
npm run deploy
```

The worker deploys to `breaktapes-health.breaktapes.workers.dev` and routes via `health.breaktapes.com`.

---

## Step 4: Set up provider OAuth apps

You only need to do this once. Each provider requires registering an OAuth application
in their developer portal to get a Client ID + Secret.

| Provider | Developer Portal | Notes |
|---|---|---|
| Garmin | https://developer.garmin.com/gc-developer-program/ | Approval required (~3-5 days) |
| Whoop | https://developer.whoop.com/ | Approval required (~1-2 days) |
| Fitbit | https://dev.fitbit.com/apps/new | Usually instant |
| Strava | https://www.strava.com/settings/api | Instant |

For each provider:
1. Register app at their developer portal
2. Set OAuth redirect URI to: `https://portal.breaktapes.com/integrations/{provider}/callback`
3. Copy Client ID + Secret
4. In OW backend Railway service → Variables, add:
   ```
   GARMIN_CLIENT_ID=...
   GARMIN_CLIENT_SECRET=...
   WHOOP_CLIENT_ID=...
   WHOOP_CLIENT_SECRET=...
   FITBIT_CLIENT_ID=...
   FITBIT_CLIENT_SECRET=...
   STRAVA_CLIENT_ID=...
   STRAVA_CLIENT_SECRET=...
   ```

---

## Step 5: User onboarding flow (future)

When a Breaktapes user wants to connect wearables:

1. User clicks **"Connect Devices"** in Settings
2. Opens the OW portal (portal.breaktapes.com) pre-authenticated
3. User clicks **"Connect Garmin"** → OAuth flow with Garmin
4. OW creates a user record → returns a **User ID**
5. Breaktapes saves the User ID to Supabase `app_state.athlete.ow_uid`
6. All OW API calls from Breaktapes include this UID via `X-OW-User-ID` header to the Worker

**Current interim flow (staging only):**
Users manually paste their OW User ID into Settings → Wearables.

---

## Estimated costs

| Service | Cost |
|---|---|
| Railway (Hobby plan) | ~$5/month base + usage |
| Railway PostgreSQL | ~$5-15/month at small scale |
| Railway Redis | ~$3/month |
| Cloudflare Worker | Free tier (100k req/day) |
| **Total** | **~$15-25/month** |

No per-user fees (vs $0.50–$2/user/month for SaaS alternatives).
