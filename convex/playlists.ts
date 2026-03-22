import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { now } from './lib/helpers';
import { getCurrentUserRecord } from './users';

export const createPlaylist = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    visibility: v.optional(v.union(v.literal('private'), v.literal('shared'))),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserRecord(ctx);
    const ts = now();
    const playlistId = await ctx.db.insert('playlists', {
      name: args.name,
      description: args.description,
      ownerUserId: user._id,
      visibility: args.visibility ?? 'shared',
      syncVersion: 1,
      createdAt: ts,
      updatedAt: ts,
    });

    await ctx.db.insert('playlist_members', {
      playlistId,
      userId: user._id,
      role: 'owner',
      createdAt: ts,
    });

    await ctx.db.insert('activity_events', {
      playlistId,
      actorUserId: user._id,
      type: 'playlist.created',
      message: `Created playlist ${args.name}`,
      createdAt: ts,
    });

    return playlistId;
  },
});

export const getUserPlaylists = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserRecord(ctx);
    const memberships = await ctx.db
      .query('playlist_members')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();

    const playlists = await Promise.all(
      memberships.map(async (membership: any) => {
        const playlist = await ctx.db.get(membership.playlistId);
        if (!playlist) return null;
        const activeItems = await ctx.db
          .query('playlist_items')
          .withIndex('by_playlist', (q) => q.eq('playlistId', membership.playlistId))
          .collect();
        return {
          ...playlist,
          membershipRole: membership.role,
          trackCount: activeItems.filter((item) => item.status === 'active').length,
        };
      })
    );

    return playlists.filter(Boolean).sort((a: any, b: any) => b.updatedAt - a.updatedAt);
  },
});

export const getPlaylistDetails = query({
  args: { playlistId: v.id('playlists') },
  handler: async (ctx, args) => {
    const user = await getCurrentUserRecord(ctx);
    const membership = await ctx.db
      .query('playlist_members')
      .withIndex('by_playlist_user', (q) => q.eq('playlistId', args.playlistId).eq('userId', user._id))
      .unique();
    if (!membership) throw new Error('Forbidden');

    const playlist = await ctx.db.get(args.playlistId);
    if (!playlist) throw new Error('Playlist not found');

    const providerSpotify = await ctx.db
      .query('provider_playlists')
      .withIndex('by_playlist_provider', (q) => q.eq('playlistId', args.playlistId).eq('provider', 'spotify'))
      .unique();

    const members = await ctx.db
      .query('playlist_members')
      .withIndex('by_playlist_user', (q) => q.eq('playlistId', args.playlistId))
      .collect();

    const resolvedMembers = await Promise.all(
      members.map(async (member: any) => {
        const record = await ctx.db.get(member.userId);
        return {
          ...member,
          user: record,
        };
      })
    );

    const activity = await ctx.db
      .query('activity_events')
      .withIndex('by_playlist', (q) => q.eq('playlistId', args.playlistId))
      .collect();

    const latestSyncJob = (await ctx.db
      .query('sync_jobs')
      .withIndex('by_playlist', (q) => q.eq('playlistId', args.playlistId))
      .collect())
      .sort((a: any, b: any) => b.createdAt - a.createdAt)[0] ?? null;

    return {
      playlist,
      membership,
      providerSpotify,
      providerAppleMusic: null,
      members: resolvedMembers,
      activity: activity.slice(-10).reverse(),
      latestSyncJob,
    };
  },
});
