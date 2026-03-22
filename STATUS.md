# BeatSync MVP — Current Status

**Last updated:** 2026-03-22 (Sunday afternoon)

## What works now

### ✅ Infrastructure
- Convex backend deployed: `quick-ladybug-606` (dev deployment)
- Convex schema pushed successfully
- All 14 table indexes active
- Clerk auth configured with Convex
- Environment variables wired correctly:
  - `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `EXPO_PUBLIC_CONVEX_URL`
  - `EXPO_PUBLIC_CONVEX_SITE_URL`
  - `CLERK_JWT_ISSUER_DOMAIN` (set in Convex dashboard)
  - `CONVEX_DEPLOYMENT`

### ✅ App scaffold
- TypeScript passes cleanly
- Expo boots successfully
- Metro bundler runs
- Clerk Expo integration loaded
- ConvexProviderWithClerk wired correctly
- Auth route structure in place:
  - `app/(auth)/sign-in.tsx`
  - `app/(auth)/sign-up.tsx`

### ✅ Core flows (on paper)
- User sign-up with Clerk
- User sign-in with Clerk
- Automatic `createUserIfNotExists` after Clerk sign-in
- Home screen shows user name after auth
- Playlist list query
- Playlist creation
- Invite generation
- Track addition
- Spotify search
- Spotify connection
- Manual playlist sync to Spotify

### ⚠️ Not yet tested end-to-end
- Actual sign-up/sign-in through Clerk UI
- First user bootstrap into Convex
- Creating a playlist
- Adding a track
- Connecting Spotify
- Running the full sync-to-Spotify flow

### 🚧 Known gaps
- Spotify OAuth redirect/callback flow not yet wired in Expo
- Apple Music intentionally stubbed
- No real-time auto-sync (manual only for MVP)
- Minimal UI polish
- No error recovery UX beyond basic try/catch

## What to do next

### Option 1: Test auth flow
1. Open the app in a browser or on a device
2. Sign up with Clerk
3. Verify user record appears in Convex
4. Create a playlist
5. See if it shows up in the list

### Option 2: Wire Spotify OAuth
1. Set up Spotify app credentials in Spotify Developer Dashboard
2. Add redirect URI for Expo
3. Add env vars:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `SPOTIFY_REDIRECT_URI`
4. Test Spotify connect flow
5. Test search/add track
6. Test sync to Spotify

### Option 3: Deploy and run on a real device
1. Build Expo dev client or use Expo Go
2. Test on iOS/Android
3. Verify native Clerk auth works
4. Test full user flow

## Architecture notes

- **BeatSync is the source of truth** for playlist data
- External playlists (Spotify, Apple Music) are **derived/synced representations**
- Canonical track model uses ISRC when available, falls back to title+artist+duration
- Each user has their own provider playlist mapping
- Sync is **manual** for MVP (user taps "Sync")
- Clerk `tokenIdentifier` is the stable user identity key in Convex

## Current file structure

```
/Users/alanders/repo/BeatSync/
├── app/
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── playlists/[id].tsx
│   ├── invite/[id].tsx
│   └── connect-spotify.tsx
├── convex/
│   ├── auth.config.ts
│   ├── schema.ts
│   ├── users.ts
│   ├── playlists.ts
│   ├── tracks.ts
│   ├── invites.ts
│   ├── spotify.ts
│   └── lib/
│       ├── auth.ts
│       ├── helpers.ts
│       └── serverTypes.ts
├── components/ui.tsx
├── lib/
│   ├── env.ts
│   └── providers.tsx
├── .env.local
├── package.json
├── README.md
└── STATUS.md (this file)
```

## Key commands

```bash
# Start Convex backend
npx convex dev

# Start Expo web
npx expo start --web

# TypeScript check
npm run typecheck

# Expo doctor
npx expo-doctor
```

## Important URLs

- Convex dashboard: https://dashboard.convex.dev/d/quick-ladybug-606
- Clerk dashboard: https://dashboard.clerk.com
- Repo: /Users/alanders/repo/BeatSync
