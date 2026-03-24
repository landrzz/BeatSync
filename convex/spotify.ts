import { action, internalMutation, internalQuery, mutation, query, type ActionCtx } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import { now } from './lib/helpers';
import { getCurrentUserRecord } from './users';
import { Id } from './_generated/dataModel';

const SPOTIFY_API = 'https://api.spotify.com/v1';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SCOPES = ['playlist-modify-private', 'playlist-modify-public', 'playlist-read-private', 'user-read-email'];

type PlaylistData = {
  playlist: { name: string; description: string | undefined; visibility: 'private' | 'shared' };
  providerEntry: { _id: Id<'provider_playlists'>; providerPlaylistId: string; externalUrl: string | undefined | null } | null;
  trackRows: Array<{
    _id: Id<'playlist_items'>;
    title: string;
    canonicalTrackKey: string;
    spotifyMapping: { providerUri?: string; providerTrackId?: string } | null;
  }>;
};

type ConnectionRecord = {
  _id: Id<'spotify_connections'>;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  spotifyUserId?: string;
  scope?: string;
};

function getSpotifyConfig() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Spotify environment variables are missing on the server. Set SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_REDIRECT_URI in your Convex dashboard.');
  }
  return { clientId, clientSecret, redirectUri };
}

function basicAuthHeader(clientId: string, clientSecret: string) {
  return `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
}

async function spotifyFetch(path: string, accessToken: string, init?: RequestInit) {
  const response = await fetch(`${SPOTIFY_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  return response;
}

// ---------------------------------------------------------------------------
// Internal DB helpers (called from actions via ctx.runQuery / ctx.runMutation)
// ---------------------------------------------------------------------------

export const _getConnection = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, args): Promise<ConnectionRecord | null> => {
    return await ctx.db
      .query('spotify_connections')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .unique() as ConnectionRecord | null;
  },
});

export const _upsertConnection = internalMutation({
  args: {
    userId: v.id('users'),
    spotifyUserId: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    scope: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('spotify_connections')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .unique();
    const ts = now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        spotifyUserId: args.spotifyUserId,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        scope: args.scope,
        expiresAt: args.expiresAt,
        updatedAt: ts,
      });
      return { spotifyUserId: args.spotifyUserId, expiresAt: args.expiresAt };
    }
    await ctx.db.insert('spotify_connections', {
      userId: args.userId,
      spotifyUserId: args.spotifyUserId,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      scope: args.scope,
      expiresAt: args.expiresAt,
      createdAt: ts,
      updatedAt: ts,
    });
    return { spotifyUserId: args.spotifyUserId, expiresAt: args.expiresAt };
  },
});

export const _patchConnection = internalMutation({
  args: {
    connectionId: v.id('spotify_connections'),
    accessToken: v.string(),
    refreshToken: v.string(),
    scope: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connectionId, {
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      scope: args.scope,
      expiresAt: args.expiresAt,
      updatedAt: now(),
    });
  },
});

export const _getCurrentUserId = internalQuery({
  args: {},
  handler: async (ctx): Promise<Id<'users'>> => {
    const user = await getCurrentUserRecord(ctx);
    return user._id;
  },
});

export const _getPlaylistData = internalQuery({
  args: { playlistId: v.id('playlists'), userId: v.id('users') },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query('playlist_members')
      .withIndex('by_playlist_user', (q) => q.eq('playlistId', args.playlistId).eq('userId', args.userId))
      .unique();
    if (!membership) throw new Error('Forbidden');

    const playlist = await ctx.db.get(args.playlistId);
    if (!playlist) throw new Error('Playlist not found');

    const providerEntry = await ctx.db
      .query('provider_playlists')
      .withIndex('by_playlist_provider', (q) => q.eq('playlistId', args.playlistId).eq('provider', 'spotify'))
      .unique();

    const tracks = (await ctx.db
      .query('playlist_items')
      .withIndex('by_playlist', (q) => q.eq('playlistId', args.playlistId))
      .take(500))
      .filter((item) => item.status === 'active')
      .sort((a, b) => a.position - b.position);

    const trackRows = await Promise.all(tracks.map(async (track) => ({
      _id: track._id,
      title: track.title,
      canonicalTrackKey: track.canonicalTrackKey,
      spotifyMapping: await ctx.db
        .query('track_mappings')
        .withIndex('by_canonical_provider', (q) => q.eq('canonicalTrackKey', track.canonicalTrackKey).eq('provider', 'spotify'))
        .unique(),
    })));

    return {
      playlist: { name: playlist.name, description: playlist.description, visibility: playlist.visibility },
      providerEntry: providerEntry ? {
        _id: providerEntry._id,
        providerPlaylistId: providerEntry.providerPlaylistId,
        externalUrl: providerEntry.externalUrl,
      } : null,
      trackRows,
    };
  },
});

export const _insertSyncJob = internalMutation({
  args: { playlistId: v.id('playlists'), userId: v.id('users') },
  handler: async (ctx, args): Promise<Id<'sync_jobs'>> => {
    return await ctx.db.insert('sync_jobs', {
      playlistId: args.playlistId,
      provider: 'spotify',
      triggeredByUserId: args.userId,
      status: 'running',
      summary: 'Sync in progress',
      missingMappingsCount: 0,
      syncedCount: 0,
      failedCount: 0,
      startedAt: now(),
      createdAt: now(),
      updatedAt: now(),
    });
  },
});

export const _insertProviderPlaylist = internalMutation({
  args: {
    playlistId: v.id('playlists'),
    userId: v.id('users'),
    providerPlaylistId: v.string(),
    externalUrl: v.optional(v.string()),
    snapshotRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ts = now();
    const id = await ctx.db.insert('provider_playlists', {
      playlistId: args.playlistId,
      provider: 'spotify',
      providerPlaylistId: args.providerPlaylistId,
      externalUrl: args.externalUrl,
      snapshotRef: args.snapshotRef,
      lastSyncedAt: ts,
      createdByUserId: args.userId,
      createdAt: ts,
      updatedAt: ts,
    });
    return id;
  },
});

export const _patchProviderPlaylist = internalMutation({
  args: {
    providerPlaylistId: v.string(),
    playlistId: v.id('playlists'),
    snapshotRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query('provider_playlists')
      .withIndex('by_playlist_provider', (q) => q.eq('playlistId', args.playlistId).eq('provider', 'spotify'))
      .unique();
    if (!entry) return;
    await ctx.db.patch(entry._id, {
      snapshotRef: args.snapshotRef,
      lastSyncedAt: now(),
      updatedAt: now(),
    });
  },
});

export const _finalizeSyncJob = internalMutation({
  args: {
    jobId: v.id('sync_jobs'),
    playlistId: v.id('playlists'),
    userId: v.id('users'),
    providerPlaylistId: v.string(),
    externalUrl: v.optional(v.string()),
    syncedCount: v.number(),
    missingMappingsCount: v.number(),
    failedCount: v.number(),
    status: v.union(v.literal('completed'), v.literal('partial_failure'), v.literal('failed')),
    summary: v.string(),
    missingTrackTitles: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: args.status,
      summary: args.summary,
      missingMappingsCount: args.missingMappingsCount,
      syncedCount: args.syncedCount,
      failedCount: args.failedCount,
      providerPlaylistId: args.providerPlaylistId,
      completedAt: now(),
      updatedAt: now(),
    });
    await ctx.db.insert('activity_events', {
      playlistId: args.playlistId,
      actorUserId: args.userId,
      type: 'spotify.sync',
      message: args.summary,
      metadata: {
        providerPlaylistId: args.providerPlaylistId,
        missingTrackTitles: args.missingTrackTitles,
      },
      createdAt: now(),
    });
  },
});

// ---------------------------------------------------------------------------
// Public read-only query (no HTTP — stays as query)
// ---------------------------------------------------------------------------

export const isSpotifyConnected = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserRecord(ctx);
    const connection = await ctx.db
      .query('spotify_connections')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();
    return connection !== null;
  },
});

// ---------------------------------------------------------------------------
// Helper: get a valid (non-expired) connection, refreshing if needed
// ---------------------------------------------------------------------------

async function getValidConnection(
  ctx: ActionCtx,
  userId: Id<'users'>,
): Promise<ConnectionRecord> {
  const connection = await ctx.runQuery(internal.spotify._getConnection, { userId }) as ConnectionRecord | null;
  if (!connection) throw new Error('Spotify is not connected. Please connect your Spotify account first.');
  if (connection.expiresAt > now() + 60_000) return connection;

  const { clientId, clientSecret } = getSpotifyConfig();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: connection.refreshToken,
  });
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!response.ok) throw new Error('Spotify token refresh failed. Please reconnect your Spotify account.');
  const json: any = await response.json();
  const ts = now();
  const newExpiry = ts + (json.expires_in ?? 3600) * 1000;
  await ctx.runMutation(internal.spotify._patchConnection, {
    connectionId: connection._id,
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? connection.refreshToken,
    scope: json.scope ?? connection.scope,
    expiresAt: newExpiry,
  });
  return {
    ...connection,
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? connection.refreshToken,
    expiresAt: newExpiry,
    scope: json.scope ?? connection.scope,
  };
}

// ---------------------------------------------------------------------------
// Public actions (make HTTP calls to Spotify)
// ---------------------------------------------------------------------------

export const connectSpotify = action({
  args: {
    code: v.string(),
    codeVerifier: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ connected: true; spotifyUserId: string; expiresAt: number }> => {
    const userId: Id<'users'> = await ctx.runQuery(internal.spotify._getCurrentUserId, {});
    const { clientId, clientSecret, redirectUri } = getSpotifyConfig();

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: args.code,
      redirect_uri: redirectUri,
      client_id: clientId,
    });
    if (args.codeVerifier) body.set('code_verifier', args.codeVerifier);

    const tokenResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(clientId, clientSecret),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Spotify token exchange failed (${tokenResponse.status}): ${errText}`);
    }

    const tokenJson: any = await tokenResponse.json();
    const profileResponse = await spotifyFetch('/me', tokenJson.access_token);
    if (!profileResponse.ok) throw new Error('Spotify profile lookup failed');
    const profile: any = await profileResponse.json();

    const ts = now();
    const result = await ctx.runMutation(internal.spotify._upsertConnection, {
      userId,
      spotifyUserId: profile.id,
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token ?? '',
      scope: tokenJson.scope ?? SCOPES.join(' '),
      expiresAt: ts + (tokenJson.expires_in ?? 3600) * 1000,
    });

    const r = result as { spotifyUserId: string; expiresAt: number };
    return { connected: true, spotifyUserId: r.spotifyUserId, expiresAt: r.expiresAt };
  },
});

export const refreshSpotifyToken = action({
  args: {},
  handler: async (ctx) => {
    const userId: Id<'users'> = await ctx.runQuery(internal.spotify._getCurrentUserId, {});
    const connection = await ctx.runQuery(internal.spotify._getConnection, { userId }) as ConnectionRecord | null;
    if (!connection) throw new Error('Spotify is not connected');

    const { clientId, clientSecret } = getSpotifyConfig();
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.refreshToken,
    });

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(clientId, clientSecret),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!response.ok) throw new Error(`Spotify token refresh failed: ${response.status}`);

    const json: any = await response.json();
    const ts = now();
    const newExpiry = ts + (json.expires_in ?? 3600) * 1000;
    await ctx.runMutation(internal.spotify._patchConnection, {
      connectionId: connection._id,
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? connection.refreshToken,
      scope: json.scope ?? connection.scope,
      expiresAt: newExpiry,
    });

    return { refreshed: true, expiresAt: newExpiry };
  },
});

export const searchSpotifyTracks = action({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const userId: Id<'users'> = await ctx.runQuery(internal.spotify._getCurrentUserId, {});
    const connection = await getValidConnection(ctx, userId);

    const response = await spotifyFetch(
      `/search?type=track&limit=10&q=${encodeURIComponent(args.query)}`,
      connection.accessToken,
    );
    if (response.status === 401) throw new Error('Spotify token expired; reconnect or refresh token');
    if (!response.ok) throw new Error(`Spotify search failed: ${response.status}`);

    const json: any = await response.json();
    return (json.tracks?.items ?? []).map((track: any) => ({
      provider: 'spotify',
      providerTrackId: track.id,
      providerUri: track.uri,
      title: track.name,
      artistNames: track.artists?.map((artist: any) => artist.name) ?? [],
      albumName: track.album?.name,
      durationMs: track.duration_ms,
      isrc: track.external_ids?.isrc,
      artworkUrl: track.album?.images?.[0]?.url,
      externalUrl: track.external_urls?.spotify,
    }));
  },
});

export const syncPlaylistToSpotify = action({
  args: { playlistId: v.id('playlists') },
  handler: async (ctx, args) => {
    const userId: Id<'users'> = await ctx.runQuery(internal.spotify._getCurrentUserId, {});
    const connection = await getValidConnection(ctx, userId);

    const { playlist, providerEntry, trackRows } = await ctx.runQuery(
      internal.spotify._getPlaylistData,
      { playlistId: args.playlistId, userId },
    ) as PlaylistData;

    const jobId: Id<'sync_jobs'> = await ctx.runMutation(internal.spotify._insertSyncJob, {
      playlistId: args.playlistId,
      userId,
    });

    let providerPlaylistId: string;
    let externalUrl: string | undefined;

    if (!providerEntry) {
      const createResponse = await spotifyFetch(
        `/users/${connection.spotifyUserId}/playlists`,
        connection.accessToken,
        {
          method: 'POST',
          body: JSON.stringify({
            name: playlist.name,
            description: playlist.description ?? 'Synced from Beat Sync Buddy',
            public: playlist.visibility === 'shared',
          }),
        },
      );
      if (!createResponse.ok) throw new Error(`Spotify playlist creation failed: ${createResponse.status}`);
      const createJson: any = await createResponse.json();
      providerPlaylistId = createJson.id;
      externalUrl = createJson.external_urls?.spotify;
      await ctx.runMutation(internal.spotify._insertProviderPlaylist, {
        playlistId: args.playlistId,
        userId,
        providerPlaylistId,
        externalUrl,
        snapshotRef: createJson.snapshot_id,
      });
    } else {
      providerPlaylistId = providerEntry.providerPlaylistId;
      externalUrl = providerEntry.externalUrl ?? undefined;
    }

    const uris: string[] = [];
    const missingMappings: Array<{ title: string }> = [];
    for (const track of trackRows) {
      if (track.spotifyMapping?.providerUri) {
        uris.push(track.spotifyMapping.providerUri);
      } else if (track.spotifyMapping?.providerTrackId) {
        uris.push(`spotify:track:${track.spotifyMapping.providerTrackId}`);
      } else {
        missingMappings.push({ title: track.title });
      }
    }

    let failedCount = 0;
    let syncedCount = 0;
    let snapshotRef: string | undefined;

    if (uris.length > 0) {
      const replaceResponse = await spotifyFetch(
        `/playlists/${providerPlaylistId}/tracks`,
        connection.accessToken,
        { method: 'PUT', body: JSON.stringify({ uris }) },
      );
      if (!replaceResponse.ok) {
        failedCount = uris.length;
      } else {
        const replaceJson: any = await replaceResponse.json();
        syncedCount = uris.length;
        snapshotRef = replaceJson.snapshot_id;
        await ctx.runMutation(internal.spotify._patchProviderPlaylist, {
          providerPlaylistId,
          playlistId: args.playlistId,
          snapshotRef,
        });
      }
    }

    const status = failedCount > 0 || missingMappings.length > 0 ? 'partial_failure' : 'completed';
    const summary = [
      syncedCount ? `Synced ${syncedCount} tracks` : 'No tracks synced',
      missingMappings.length ? `${missingMappings.length} missing Spotify mapping(s)` : null,
      failedCount ? `${failedCount} track update failure(s)` : null,
    ].filter(Boolean).join('. ');

    await ctx.runMutation(internal.spotify._finalizeSyncJob, {
      jobId,
      playlistId: args.playlistId,
      userId,
      providerPlaylistId,
      externalUrl,
      syncedCount,
      missingMappingsCount: missingMappings.length,
      failedCount,
      status,
      summary,
      missingTrackTitles: missingMappings.map((t) => t.title),
    });

    return { providerPlaylistId, externalUrl, syncedCount, missingMappingsCount: missingMappings.length, failedCount, status, summary };
  },
});
