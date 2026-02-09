# Supabase Storage Setup Guide

This guide will walk you through setting up Supabase Storage to host your team logo images.

## Why Supabase Storage?

Instead of linking to external TheSportsDB URLs, storing images in Supabase Storage provides:

- **Full Control**: Own your images, no external dependencies
- **Performance**: Fast CDN delivery via Supabase
- **Reliability**: No risk of external URLs breaking
- **Privacy**: No external tracking or analytics
- **Optimization**: Can resize/optimize images as needed
- **Security**: Fine-grained access control

## Step 1: Create Storage Bucket

1. **Open Supabase Dashboard**
   - Navigate to your project at https://supabase.com/dashboard
   - Go to **Storage** in the left sidebar

2. **Create New Bucket**
   - Click **"New bucket"** button
   - Enter bucket name: `team-logos`
   - **Public bucket**: Check this box (logos need to be publicly accessible)
   - **File size limit**: 5 MB (optional, recommended)
   - **Allowed MIME types**: `image/png,image/jpeg,image/svg+xml` (optional)
   - Click **"Create bucket"**

3. **Set Bucket Policies** (if not public)

   If you didn't check "Public bucket", you need to add a policy:

   ```sql
   -- Allow public read access to team logos
   CREATE POLICY "Public Access"
   ON storage.objects FOR SELECT
   USING ( bucket_id = 'team-logos' );

   -- Allow authenticated users to upload (optional, for security)
   CREATE POLICY "Authenticated users can upload team logos"
   ON storage.objects FOR INSERT
   WITH CHECK (
     bucket_id = 'team-logos'
     AND auth.role() = 'authenticated'
   );
   ```

## Step 2: Configure Storage in Your App

Your app is already configured to use Supabase Storage via the existing `supabaseClient`.

No additional configuration needed! The storage service will automatically use your existing Supabase client.

## Step 3: Run Migration Script

### Option A: Browser Console (Easiest!)

Open your browser console and run:

```javascript
// Migrate all team logos to Supabase Storage
await devTools.migrateLogosToStorage()

// Check migration progress
await devTools.checkStorageMigrationStatus()

// Force re-migrate specific team
await devTools.migrateTeamLogoToStorage('team-uuid-here', true)
```

### Option B: In Your App

Add a button in your admin panel:

```tsx
import { migrateAllLogosToStorage } from './scripts/migrateLogosToStorage';

const handleMigrate = async () => {
  console.log('Starting migration...');
  const stats = await migrateAllLogosToStorage();
  alert(`Migrated: ${stats.success}, Failed: ${stats.failed}, Skipped: ${stats.skipped}`);
};
```

## Step 4: Verify Migration

1. **Check Supabase Dashboard**
   - Go to **Storage** > **team-logos** bucket
   - You should see files like `uuid.png`, `uuid.jpg`, etc.

2. **Check Database**
   ```sql
   SELECT name, resolvedLogoUrl
   FROM teams
   WHERE resolvedLogoUrl LIKE '%supabase%'
   LIMIT 10;
   ```

3. **Test in App**
   - Team logos should now load from your Supabase Storage
   - Check browser DevTools Network tab - URLs should be `https://YOUR_PROJECT.supabase.co/storage/v1/object/public/team-logos/...`

## Storage URL Format

After migration, your `resolvedLogoUrl` will look like:

```
https://YOUR_PROJECT_ID.supabase.co/storage/v1/object/public/team-logos/TEAM_UUID.png
```

Example:
```
https://abcdefghijklmnop.supabase.co/storage/v1/object/public/team-logos/a1b2c3d4-e5f6-7890-abcd-ef1234567890.png
```

## Migration Process Details

The migration script will:

1. **Fetch all teams** with existing `resolvedLogoUrl` from TheSportsDB
2. **Download each image** as a blob from TheSportsDB URL
3. **Upload to Supabase Storage** with filename `{teamId}.{ext}`
4. **Update database** with new Supabase Storage URL
5. **Skip teams** that already have Supabase Storage URLs
6. **Report progress** with detailed statistics

Typical migration time: **~1-2 seconds per team** (with 500ms delay between uploads to avoid rate limits)

## Troubleshooting

### Issue: "Bucket not found" error

**Solution**: Make sure you created the `team-logos` bucket in Supabase Dashboard (Step 1)

### Issue: "Permission denied" error

**Solution**:
1. Make sure bucket is set to **Public**
2. Or add the storage policies from Step 1
3. Make sure you're authenticated in your app

### Issue: Images not loading after migration

**Solution**:
1. Check if URLs are correct:
   ```javascript
   await devTools.checkStorageMigrationStatus()
   ```
2. Verify bucket is public
3. Check browser console for CORS errors
4. Clear cache: `devTools.clearCache()`

### Issue: Some images failed to migrate

**Solution**:
1. Check which teams failed:
   ```javascript
   const stats = await devTools.migrateLogosToStorage()
   // Check console for "Failed to migrate" messages
   ```
2. Manually check those team logos in TheSportsDB
3. Re-run migration with force flag:
   ```javascript
   await devTools.migrateTeamLogoToStorage('failed-team-uuid', true)
   ```

### Issue: Migration is slow

**Solution**: The script includes a 500ms delay between uploads to respect rate limits. For faster migration:

```javascript
// Reduce delay to 100ms (use with caution)
await devTools.migrateLogosToStorage(false, 100)
```

## Advanced: Cleanup Old Local Logos

After successful migration, you can optionally remove old local logo files to reduce bundle size:

1. **Verify all logos migrated successfully**
   ```javascript
   await devTools.checkStorageMigrationStatus()
   ```

2. **Backup your local logos first!**
   ```bash
   cp -r src/assets/logos src/assets/logos-backup
   ```

3. **Remove unused local logos**
   - Keep logos for teams without `resolvedLogoUrl` (fallback)
   - Delete logos for teams with Supabase Storage URLs

4. **Test thoroughly** before deleting originals

## Advanced: Optimize Images

You can add image optimization in the future:

```typescript
// Example: Resize images to 256x256 before upload
import sharp from 'sharp';

const optimizedBuffer = await sharp(imageBlob)
  .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
```

## Storage Costs

Supabase Storage is very affordable:

- **Free Tier**: 1 GB storage + 2 GB bandwidth/month
- **Pro Tier**: 100 GB storage + 200 GB bandwidth/month ($25/month)

Typical usage for 400 teams with 50KB logos each:
- Storage: ~20 MB (well within free tier)
- Bandwidth: Depends on traffic

## Next Steps

- ✅ Bucket created
- ✅ Migration completed
- ✅ All logos loading from Supabase Storage
- 🚀 Consider adding image optimization
- 🚀 Consider cleanup of old local files

## Need Help?

Check the full logo management documentation:
- `LOGO_MANAGEMENT.md` - Complete guide to logo system
- `QUICK_START_LOGOS.md` - Quick start guide
- `CONSOLE_COMMANDS.md` - Available console commands
