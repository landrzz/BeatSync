import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { now } from './lib/helpers';
import { getCurrentUserRecord } from './users';

const SPOTIFY_API = 'https://api.spotify.com/v1';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SCOPES = ['playlist-modify-private', 'playlist-modify-public', 'playlist-read-private', 'user-read-email'];

type ConnectionRecord = {
  _id: string;
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
    throw new Error('Spotify environment variables are missing');
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

export const connectSpotify = mutation({
  args: {
    code: v.string(),
    codeVerifier: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserRecord(ctx);
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
      throw new Error(`Spotify token exchange failed: ${tokenResponse.status}`);
    }

    const tokenJson: any = await tokenResponse.json();
    const profileResponse = await spotifyFetch('/me', tokenJson.access_token);
    if (!profileResponse.ok) throw new Error('Spotify profile lookup failed');
    const profile: any = await profileResponse.json();

    const existing = await ctx.db.query('spotify_connections').withIndex('by_user', (q) => q.eq('userId', user._id)).unique();
    const ts = now();
    const payload = {
      userId: user._id,
      spotifyUserId: profile.id,
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token ?? existing?.refreshToken,
      scope: tokenJson.scope ?? SCOPES.join(' '),
      expiresAt: ts + (tokenJson.expires_in ?? 3600) * 1000,
      updatedAt: ts,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return { connected: true, spotifyUserId: profile.id, expiresAt: payload.expiresAt };
    }

    await ctx.db.insert('spotify_connections', {
      ...payload,
      refreshToken: payload.refreshToken ?? '',
      createdAt: ts,
    });
    return { connected: true, spotifyUserId: profile.id, expiresAt: payload.expiresAt };
  },
});

export const refreshSpotifyToken = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserRecord(ctx);
    const connection = await ctx.db.query('spotify_connections').withIndex('by_user', (q) => q.eq('userId', user._id)).unique();
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
    await ctx.db.patch(connection._id, {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? connection.refreshToken,
      scope: json.scope ?? connection.scope,
      expiresAt: ts + (json.expires_in ?? 3600) * 1000,
      updatedAt: ts,
    });

    return { refreshed: true, expiresAt: ts + (json.expires_in ?? 3600) * 1000 };
  },
});

export const isSpotifyConnected = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserRecord(ctx);
    const connection = await ctx.db.query('spotify_connections').withIndex('by_user', (q) => q.eq('userId', user._id)).unique();
    return connection !== null;
  },
});

async function getValidConnection(ctx: any, userId: any): Promise<ConnectionRecord> {
  const connection = await ctx.db.query('spotify_connections').withIndex('by_user', (q: any) => q.eq('userId', userId)).unique();
  if (!connection) throw new Error('Spotify is not connected');
  if (connection.expiresAt > now() + 60_000) return connection as any;

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
  if (!response.ok) throw new Error('Spotify token refresh failed while preparing request');
  const json: any = await response.json();
  const ts = now();
  await ctx.db.patch(connection._id as any, {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? connection.refreshToken,
    scope: json.scope ?? connection.scope,
    expiresAt: ts + (json.expires_in ?? 3600) * 1000,
    updatedAt: ts,
  });
  return {
    ...(connection as any),
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? connection.refreshToken,
    expiresAt: ts + (json.expires_in ?? 3600) * 1000,
    scope: json.scope ?? connection.scope,
  };
}

export const searchSpotifyTracks = mutation({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUserRecord(ctx);
    const connection = await getValidConnection(ctx, user._id);
    const response = await spotifyFetch(`/search?type=track&limit=10&q=${encodeURIComponent(args.query)}`, connection.accessToken);
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

export const syncPlaylistToSpotify = mutation({
  args: { playlistId: v.id('playlists') },
  handler: async (ctx, args) => {
    const user = await getCurrentUserRecord(ctx);

    const connection = await getValidConnection(ctx, user._id);
    const membership = await ctx.db
      .query('playlist_members')
      .withIndex('by_playlist_user', (q) => q.eq('playlistId', args.playlistId).eq('userId', user._id))
      .unique();
    if (!membership) throw new Error('Forbidden');

    const playlist = await ctx.db.get(args.playlistId);
    if (!playlist) throw new Error('Playlist not found');

    const providerSpotifyExisting = await ctx.db
      .query('provider_playlists')
      .withIndex('by_playlist_provider', (q) => q.eq('playlistId', args.playlistId).eq('provider', 'spotify'))
      .unique();

    const tracks = (await ctx.db.query('playlist_items').withIndex('by_playlist', (q) => q.eq('playlistId', args.playlistId)).collect())
      .filter((item: any) => item.status === 'active')
      .sort((a: any, b: any) => a.position - b.position);

    const trackRows = await Promise.all(tracks.map(async (track: any) => ({
      ...track,
      spotifyMapping: await ctx.db
        .query('track_mappings')
        .withIndex('by_canonical_provider', (q) => q.eq('canonicalTrackKey', track.canonicalTrackKey).eq('provider', 'spotify'))
        .unique(),
    })));

    const jobId = await ctx.db.insert('sync_jobs', {
      playlistId: args.playlistId,
      provider: 'spotify',
      triggeredByUserId: user._id,
      status: 'running',
      summary: 'Sync in progress',
      missingMappingsCount: 0,
      syncedCount: 0,
      failedCount: 0,
      startedAt: now(),
      createdAt: now(),
      updatedAt: now(),
    } as any);

    let providerPlaylist = providerSpotifyExisting;
    if (!providerPlaylist) {
      const createResponse = await spotifyFetch(`/users/${connection.spotifyUserId}/playlists`, connection.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          name: playlist.name,
          description: playlist.description ?? 'Synced from BeatSync',
          public: playlist.visibility === 'shared',
        }),
      });
      if (!createResponse.ok) throw new Error(`Spotify playlist creation failed: ${createResponse.status}`);
      const createJson: any = await createResponse.json();
      const ts = now();
      const id = await ctx.db.insert('provider_playlists', {
        playlistId: args.playlistId,
        provider: 'spotify',
        providerPlaylistId: createJson.id,
        externalUrl: createJson.external_urls?.spotify,
        snapshotRef: createJson.snapshot_id,
        lastSyncedAt: ts,
        createdByUserId: user._id,
        createdAt: ts,
        updatedAt: ts,
      } as any);
      providerPlaylist = { _id: id, providerPlaylistId: createJson.id, externalUrl: createJson.external_urls?.spotify } as any;
    }

    const uris: string[] = [];
    const missingMappings: any[] = [];
    for (const track of trackRows) {
      if (track.spotifyMapping?.providerUri) {
        uris.push(track.spotifyMapping.providerUri);
      } else if (track.spotifyMapping?.providerTrackId) {
        uris.push(`spotify:track:${track.spotifyMapping.providerTrackId}`);
      } else {
        missingMappings.push(track);
      }
    }

    let failedCount = 0;
    let syncedCount = 0;
    if (uris.length > 0) {
      const replaceResponse = await spotifyFetch(`/playlists/${providerPlaylist!.providerPlaylistId}/tracks`, connection.accessToken, {
        method: 'PUT',
        body: JSON.stringify({ uris }),
      });
      if (!replaceResponse.ok) {
        failedCount = uris.length;
      } else {
        const replaceJson: any = await replaceResponse.json();
        syncedCount = uris.length;
        await ctx.db.patch((providerPlaylist as any)._id, {
          snapshotRef: replaceJson.snapshot_id,
          lastSyncedAt: now(),
          updatedAt: now(),
        });
      }
    }

    const status = failedCount > 0 || missingMappings.length > 0 ? 'partial_failure' : 'completed';
    const summary = [
      syncedCount ? `Synced ${syncedCount} tracks` : 'No tracks synced',
      missingMappings.length ? `${missingMappings.length} missing Spotify mapping(s)` : null,
      failedCount ? `${failedCount} track update failure(s)` : null,
    ].filter(Boolean).join('. ');

    await ctx.db.patch(jobId as any, {
      status,
      summary,
      missingMappingsCount: missingMappings.length,
      syncedCount,
      failedCount,
      providerPlaylistId: providerPlaylist!.providerPlaylistId,
      completedAt: now(),
      updatedAt: now(),
    });
    await ctx.db.insert('activity_events', {
      playlistId: args.playlistId,
      actorUserId: user._id,
      type: 'spotify.sync',
      message: summary,
      metadata: {
        providerPlaylistId: providerPlaylist!.providerPlaylistId,
        missingMappings: missingMappings.map((track) => ({ id: track._id, title: track.title })),
      },
      createdAt: now(),
    } as any);

    return {
      providerPlaylistId: providerPlaylist!.providerPlaylistId,
      externalUrl: providerPlaylist!.externalUrl,
      syncedCount,
      missingMappingsCount: missingMappings.length,
      failedCount,
      status,
      summary,
    };
  },
});
