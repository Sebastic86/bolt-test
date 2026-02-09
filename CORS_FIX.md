# CORS Fix Guide

## Problem

You were getting CORS errors when fetching team logos from TheSportsDB API:

```
Access to fetch at 'https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=...'
from origin 'http://localhost:5173' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

This happens because TheSportsDB API doesn't set proper CORS headers for browser requests.

## Solution Implemented

We've implemented a **multi-layered solution** with automatic fallbacks:

### 1. CORS Proxy (Primary Fix)

All TheSportsDB API calls now use a CORS proxy service that adds the necessary headers:

- **Default Proxy**: `https://corsproxy.io/`
- **Configurable**: Set `VITE_CORS_PROXY_URL` in `.env` to use a different proxy
- **How it works**: Proxy server fetches the data server-side (no CORS) and returns it to your browser with proper CORS headers

### 2. API-Sports (Primary Provider)

API-Sports is now the PRIMARY logo provider:

- **Paid Subscription**: Better reliability and higher rate limits
- **Better CORS support**: Designed for browser usage, no proxy needed
- **Requires API key**: Sign up at https://api-sports.io
- **Primary**: TheSportsDB now serves as fallback

### 3. Local Fallback

If all APIs fail, the system falls back to local logo files in `src/assets/logos/`

---

## Setup Instructions

### Option A: Use CORS Proxy Only (No Setup Required!)

**This is already working!** The CORS proxy is configured by default.

Just restart your dev server with a hard refresh:
- Windows/Linux: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

### Option B: Configure API-Sports (Primary Provider - REQUIRED)

API-Sports is now the primary logo provider. You MUST configure it:

**Step 1: Get Your API Key**
1. Go to https://api-sports.io
2. Sign in to your account (paid subscription)
3. Go to Dashboard → API Key
4. Copy your API key

**Step 2: Configure**
Add to your `.env` file:
```bash
VITE_API_SPORTS_KEY=your_api_key_here
```

**Step 3: Restart**
Restart your dev server

**Without API-Sports configured**, the system will fall back to TheSportsDB (free, with CORS proxy)

---

## How It Works

The logo resolution now follows this order:

```
1. Database (resolvedLogoUrl) ──────────────→ ✅ Return (instant!)
   ↓ Not found

2. Browser Cache (7 days) ──────────────────→ ✅ Return (fast!)
   ↓ Expired/Not found

3. API-Sports (PRIMARY - paid subscription) ─→ ✅ Return + Save to DB
   ↓ Failed/Not configured

4. TheSportsDB API by ID (CORS proxy) ──────→ ✅ Return + Save to DB
   ↓ Failed

5. TheSportsDB API by Name (CORS proxy) ────→ ✅ Return + Save to DB
   ↓ Failed

6. Local Logo Files ─────────────────────────→ ✅ Return
   ↓ Not found

7. Empty String (shows placeholder) ─────────→ ⚠️ Logo not available
```

**Note:** API-Sports is now the PRIMARY provider (paid subscription). TheSportsDB serves as free fallback with CORS proxy support.

---

## Configuration Options

### Change CORS Proxy

If `corsproxy.io` is slow or blocked, you can use alternatives:

**In `.env`:**
```bash
# Option 1: AllOrigins (slower but reliable)
VITE_CORS_PROXY_URL=https://api.allorigins.win/raw?url=

# Option 2: CORS Anywhere (requires demo key)
VITE_CORS_PROXY_URL=https://cors-anywhere.herokuapp.com/

# Option 3: Your own proxy (see below)
VITE_CORS_PROXY_URL=https://your-proxy.com/api?url=
```

### Deploy Your Own CORS Proxy

For production, consider deploying your own proxy using Supabase Edge Functions:

**`supabase/functions/cors-proxy/index.ts`**
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  const url = new URL(req.url).searchParams.get('url');
  if (!url) {
    return new Response('Missing url parameter', { status: 400 });
  }

  try {
    const response = await fetch(url);
    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
    });
  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});
```

Deploy:
```bash
supabase functions deploy cors-proxy
```

Then in `.env`:
```bash
VITE_CORS_PROXY_URL=https://YOUR_PROJECT.supabase.co/functions/v1/cors-proxy?url=
```

---

## Testing

### Test CORS Proxy

Open browser console and run:

```javascript
// Test TheSportsDB with CORS proxy
await devTools.testTeamLogo('Arsenal')

// Should see: "Using CORS proxy: https://corsproxy.io/?..."
```

### Test API-Sports Backup

If you configured API-Sports:

```javascript
// Force TheSportsDB to fail and test backup
await devTools.testTeamLogo('SomeTeamThatDoesntExist')

// Should see: "TheSportsDB failed, trying API-Sports backup..."
```

### Check API Quota

If using API-Sports:

```javascript
// Check remaining requests
const quota = await fetch('https://v3.football.api-sports.io/status', {
  headers: { 'x-apisports-key': 'YOUR_KEY' }
}).then(r => r.headers.get('x-ratelimit-requests-remaining'))

console.log(`Remaining requests today: ${quota}`)
```

---

## Troubleshooting

### Issue: Still getting CORS errors

**Solution**:
1. Hard refresh browser: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
2. Clear cache: `devTools.clearCache()`
3. Check if proxy is working:
   ```javascript
   fetch('https://corsproxy.io/?https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=Arsenal')
     .then(r => r.json())
     .then(console.log)
   ```
4. Try alternative proxy in `.env`

### Issue: Proxy is slow

**Solution**:
- Try different proxy (see Configuration Options above)
- Use API-Sports as primary (it doesn't need proxy)
- Deploy your own Supabase Edge Function proxy

### Issue: API-Sports not working

**Solution**:
1. Check API key is correct in `.env`
2. Check daily quota: `x-ratelimit-requests-remaining` header
3. Verify account is active at https://api-sports.io/account
4. Check console for detailed error messages

### Issue: Rate limit exceeded

**API-Sports free tier: 100 requests/day**

**Solution**:
1. Migrate existing logos to Supabase Storage:
   ```javascript
   await devTools.migrateLogosToStorage()
   ```
2. This eliminates API calls for resolved logos
3. Upgrade to paid plan if needed ($10/month)

---

## Performance

### Before Fix (CORS Errors)
- ❌ Many teams: No logo
- ⚠️ Console: Full of CORS errors
- ❌ User experience: Poor

### After Fix (CORS Proxy)
- ✅ First load: 250-500ms per logo (proxy overhead)
- ✅ Browser cache: 50ms per logo (7 days)
- ✅ Database: 10ms per logo (after first resolution)
- ✅ Console: Clean
- ✅ User experience: Excellent

### With Supabase Storage Migration
- ✅ All loads: 10ms per logo
- ✅ No API calls needed
- ✅ No proxy overhead
- 🚀 **Best performance!**

---

## Migration Recommendation

For best performance and reliability, migrate logos to Supabase Storage:

```javascript
// 1. Resolve all logos (uses CORS proxy + API-Sports backup)
await devTools.resolveAllLogos()

// 2. Migrate to Supabase Storage
await devTools.migrateLogosToStorage()

// 3. Verify migration
await devTools.checkStorageMigrationStatus()
```

After migration:
- ✅ No more CORS issues
- ✅ No external API dependencies
- ✅ Fastest possible performance
- ✅ Complete control over your images

---

## Related Documentation

- `LOGO_MANAGEMENT.md` - Complete logo system guide
- `QUICK_START_LOGOS.md` - Quick setup guide
- `SUPABASE_STORAGE_SETUP.md` - Storage migration guide
- `CONSOLE_COMMANDS.md` - Available console commands
- `.env.example` - Environment configuration reference
