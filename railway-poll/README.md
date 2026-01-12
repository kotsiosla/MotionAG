# Railway Polling Service

This service calls the Supabase `check-stop-arrivals` function every 10 seconds to ensure background push notifications work even when the mobile app is closed.

## Environment Variables (set in Railway dashboard)

- `SUPABASE_URL` - Your Supabase project URL (e.g., `https://xxx.supabase.co`)
- `SERVICE_ROLE_KEY` - Your Supabase service role key

## Deployment

1. Push this folder to GitHub
2. In Railway: New Project → Deploy from GitHub
3. Select this repository
4. Railway will auto-detect the Dockerfile
5. Add the two environment variables in Settings → Variables
6. Deploy

## Cost

Railway Starter plan: $5/month for unlimited runtime.
