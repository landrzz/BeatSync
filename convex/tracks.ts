import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { buildCanonicalTrackKey, now } from './lib/helpers';
import { getCurrentUserRecord } from './users';

export const addTrackToPlaylist = mutation({
  args: {
    playlistId: v.id('playlists'),
    title: v.string(),
    artistNames: v.array(v.string()),
    albumName: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    isrc: v.optional(v.string()),
    artworkUrl: v.optional(v.string()),
    spotifyTrackId: v.optional(v.string()),
    spotifyUri: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserRecord(ctx);
    const membership = await ctx.db
      .query('playlist_members')
      .withIndex('by_playlist_user', (q) => q.eq('playlistId', args.playlistId).eq('userId', user._id))
      .unique();
    if (!membership || membership.role === 'viewer') throw new Error('Forbidden');

    const canonicalTrackKey = buildCanonicalTrackKey({
      isrc: args.isrc,
      title: args.title,
      artists: args.artistNames,
      durationMs: args.durationMs,
    });

    const duplicate = await ctx.db
      .query('playlist_items')
      .withIndex('by_playlist_track_key', (q) => q.eq('playlistId', args.playlistId).eq('canonicalTrackKey', canonicalTrackKey))
      .unique();
    if (duplicate && duplicate.status === 'active') {
      return { itemId: duplicate._id, duplicated: true, canonicalTrackKey };
    }

    const existingItems = await ctx.db.query('playlist_items').withIndex('by_playlist', (q) => q.eq('playlistId', args.playlistId)).collect();
    const position = existingItems.filter((item: any) => item.status === 'active').length + 1;
    const ts = now();
    const itemId = await ctx.db.insert('playlist_items', {
      playlistId: args.playlistId,
      addedByUserId: user._id,
      canonicalTrackKey,
      title: args.title,
      artistNames: args.artistNames,
      albumName: args.albumName,
      durationMs: args.durationMs,
      isrc: args.isrc,
      artworkUrl: args.artworkUrl,
      position,
      status: 'active',
      createdAt: ts,
      updatedAt: ts,
    });

    if (args.spotifyTrackId) {
      const existingMapping = await ctx.db
        .query('track_mappings')
        .withIndex('by_canonical_provider', (q) => q.eq('canonicalTrackKey', canonicalTrackKey).eq('provider', 'spotify'))
        .unique();
      if (!existingMapping) {
        await ctx.db.insert('track_mappings', {
          canonicalTrackKey,
          provider: 'spotify',
          providerTrackId: args.spotifyTrackId,
          providerUri: args.spotifyUri,
          createdAt: ts,
          updatedAt: ts,
        });
      }
    }

    await ctx.db.patch(args.playlistId, { updatedAt: ts, syncVersion: position + 1 });
    await ctx.db.insert('activity_events', {
      playlistId: args.playlistId,
      actorUserId: user._id,
      type: 'track.added',
      message: `Added ${args.title} — ${args.artistNames.join(', ')}`,
      metadata: { canonicalTrackKey },
      createdAt: ts,
    });

    return { itemId, duplicated: false, canonicalTrackKey };
  },
});

export const getPlaylistTracks = query({
  args: { playlistId: v.id('playlists') },
  handler: async (ctx, args) => {
    const user = await getCurrentUserRecord(ctx);
    const membership = await ctx.db
      .query('playlist_members')
      .withIndex('by_playlist_user', (q) => q.eq('playlistId', args.playlistId).eq('userId', user._id))
      .unique();
    if (!membership) throw new Error('Forbidden');

    const items = await ctx.db.query('playlist_items').withIndex('by_playlist', (q) => q.eq('playlistId', args.playlistId)).collect();
    const activeItems = items.filter((item: any) => item.status === 'active').sort((a: any, b: any) => a.position - b.position);

    const mappings = await Promise.all(
      activeItems.map(async (item: any) => {
        const spotifyMapping = await ctx.db
          .query('track_mappings')
          .withIndex('by_canonical_provider', (q) => q.eq('canonicalTrackKey', item.canonicalTrackKey).eq('provider', 'spotify'))
          .unique();
        return { ...item, spotifyMapping };
      })
    );
    return mappings;
  },
});
