# BeatSync MVP

BeatSync is a collaborative playlist app where **BeatSync is the canonical source of truth** and streaming platforms are downstream sync targets.

That architectural choice matters:
- adding a track writes to BeatSync first
- collaborators edit the BeatSync playlist, not the provider playlist directly
- Spotify/Apple Music state is treated as a projection of BeatSync state
- sync failures never mutate BeatSync history away

## What ships in this scaffold

### Backend (Convex)
- user bootstrap: `createUserIfNotExists`
- playlist create/list/detail flows
- invite create/accept flows
- track add/list flows
- Spotify OAuth token exchange + refresh
- Spotify search mutation
- manual Spotify sync mutation
- activity log + sync job records
- Apple Music stub noted explicitly for future work

### Frontend (Expo Router)
- Login/setup screen
- Playlist list screen
- Playlist detail screen with manual track add + sync button
- Invite screen
- Connect Spotify screen

## MVP behavior and edge cases

Handled in code:
- **duplicate track additions**: prevented via canonical track key
- **missing Spotify mappings**: sync completes with `partial_failure` and detailed summary
- **expired tokens**: refreshes before Spotify requests when possible
- **playlist already exists on provider**: existing `provider_playlists` mapping is reused
- **partial sync failures**: sync job persists summary, counts, and activity event

## Project structure

```text
app/
  _layout.tsx
  index.tsx
  playlists/[id].tsx
  invite/[id].tsx
  connect-spotify.tsx
components/
  ui.tsx
lib/
  env.ts
  providers.tsx
convex/
  schema.ts
  users.ts
  playlists.ts
  invites.ts
  tracks.ts
  spotify.ts
  lib/
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create environment variables

Use either a local `.env`/Expo env setup or your preferred secret manager.

### Expo / client env

```bash
EXPO_PUBLIC_CONVEX_URL=
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=
EXPO_PUBLIC_SPOTIFY_CLIENT_ID=
EXPO_PUBLIC_SPOTIFY_REDIRECT_URI=beatsync://spotify-callback
```

### Convex / server env

```bash
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=beatsync://spotify-callback
```

If you use Convex deployment env vars, set the server vars there as well.

### 3. Clerk setup

This scaffold assumes Clerk is your auth provider.

You need:
- an Expo-compatible Clerk app
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- Convex auth integration configured for Clerk
- your sign-in/up flow wired where you want it

Right now the Login screen is intentionally thin and acts as a bootstrap/setup entry point instead of a fully polished auth UX.

### 4. Convex setup

```bash
npx convex dev
```

Then generate Convex bindings and keep the local dev server running.

### 5. Spotify app setup

Create a Spotify app and configure:
- redirect URI: `beatsync://spotify-callback` for native testing, or your Expo redirect URI
- scopes:
  - `playlist-modify-private`
  - `playlist-modify-public`
  - `playlist-read-private`
  - `user-read-email`

Important notes:
- Spotify token exchange in this scaffold is done server-side in Convex.
- For production, prefer hardened OAuth state validation and secret management.
- Expo redirect URIs differ between Expo Go, development builds, and standalone builds. Confirm the exact callback URI for your environment.

## Running the app

```bash
npm run start
```

## Data model notes

### Canonical playlist items

`playlist_items` stores BeatSync's canonical track list.

Canonical track identity is derived by:
- ISRC when available, otherwise
- normalized title + normalized artists + duration bucket

That gives you dedupe behavior across providers and manual entry.

### Provider mappings

`track_mappings` stores provider-specific IDs/URIs for a canonical BeatSync track.

This lets BeatSync:
- keep its own stable identity model
- sync only tracks that have provider mappings
- report unmapped tracks instead of corrupting provider playlists

### Provider playlist projections

`provider_playlists` tracks the downstream Spotify playlist created for a BeatSync playlist.

That avoids re-creating provider playlists on every sync.

## Sync flow

`syncPlaylistToSpotify` does the following:
1. validates membership/auth
2. ensures a usable Spotify token exists
3. loads the BeatSync playlist + tracks
4. creates the Spotify playlist if it has not been mapped yet
5. replaces Spotify playlist tracks with the mapped BeatSync order
6. records a sync job with completed vs partial failure status

Current MVP limitation:
- if a track has no Spotify mapping, it is skipped and counted
- Apple Music sync is not implemented yet
- advanced reconciliation (diff-based updates instead of replace) is intentionally postponed

## What is intentionally stubbed

### Apple Music

Apple Music is represented only as an architectural placeholder in this MVP.

That is deliberate. The important thing for the scaffold is that the app is provider-agnostic at the BeatSync layer.

## Recommended next steps

1. add a real Clerk sign-in/sign-up UI
2. add a search screen that calls `searchSpotifyTracks` and pipes results into `addTrackToPlaylist`
3. replace simple sync replace semantics with diff-aware sync
4. add provider webhooks or scheduled reconciliation
5. build Apple Music adapter once Spotify flow is validated
6. encrypt or otherwise harden stored provider tokens depending on your deployment posture

## Key files

- `convex/users.ts`
- `convex/playlists.ts`
- `convex/invites.ts`
- `convex/tracks.ts`
- `convex/spotify.ts`
- `convex/schema.ts`
- `app/index.tsx`
- `app/playlists/[id].tsx`
- `app/invite/[id].tsx`
- `app/connect-spotify.tsx`
- `lib/providers.tsx`
- `components/ui.tsx`

## Notes on live execution

This repo now contains real code, not pseudocode, but full live end-to-end execution still depends on:
- a working Convex project and generated bindings
- Clerk auth being configured for Convex
- valid Spotify OAuth credentials and redirect URI setup

Those pieces are environment-specific, so they are isolated to config and documented here rather than faked in code.
