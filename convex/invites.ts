import { mutation } from './_generated/server';
import { v } from 'convex/values';
import { createInviteToken, createShortCode, now } from './lib/helpers';
import { getCurrentUserRecord } from './users';

const TTL_24H = 1000 * 60 * 60 * 24;

export const createInvite = mutation({
  args: { playlistId: v.id('playlists'), email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await getCurrentUserRecord(ctx);
    const membership = await ctx.db
      .query('playlist_members')
      .withIndex('by_playlist_user', (q) => q.eq('playlistId', args.playlistId).eq('userId', user._id))
      .unique();
    if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
      throw new Error('Forbidden');
    }

    const normalizedEmail = args.email ? args.email.trim().toLowerCase() : undefined;
    const ts = now();

    if (normalizedEmail) {
      const pendingForPlaylist = await ctx.db
        .query('invites')
        .withIndex('by_playlist', (q) => q.eq('playlistId', args.playlistId))
        .take(100);
      const existingPending = pendingForPlaylist.find(
        (invite) => invite.email === normalizedEmail && invite.status === 'pending' && invite.expiresAt > ts
      );
      if (existingPending) {
        return { inviteId: existingPending._id, token: existingPending.token, shortCode: existingPending.shortCode ?? null, reused: true };
      }
    }

    const token = createInviteToken();
    const shortCode = createShortCode();
    const inviteId = await ctx.db.insert('invites', {
      playlistId: args.playlistId,
      invitedByUserId: user._id,
      email: normalizedEmail,
      token,
      shortCode,
      status: 'pending',
      expiresAt: ts + TTL_24H,
      createdAt: ts,
      updatedAt: ts,
    });

    await ctx.db.insert('activity_events', {
      playlistId: args.playlistId,
      actorUserId: user._id,
      type: 'invite.created',
      message: normalizedEmail ? `Invited ${normalizedEmail}` : 'Created invite link',
      metadata: normalizedEmail ? { email: normalizedEmail } : {},
      createdAt: ts,
    });

    return { inviteId, token, shortCode, reused: false };
  },
});

export const acceptInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUserRecord(ctx);
    const invite = await ctx.db.query('invites').withIndex('by_token', (q) => q.eq('token', args.token)).unique();
    if (!invite) throw new Error('Invite not found');

    const ts = now();
    if (invite.expiresAt < ts) {
      await ctx.db.patch(invite._id, { status: 'expired', updatedAt: ts });
      throw new Error('Invite expired');
    }
    if (invite.status === 'accepted') {
      return { playlistId: invite.playlistId, alreadyAccepted: true };
    }

    const userEmail = user.email?.toLowerCase();
    if (userEmail && userEmail !== invite.email) {
      throw new Error('Invite email does not match signed-in user');
    }

    const existing = await ctx.db
      .query('playlist_members')
      .withIndex('by_playlist_user', (q) => q.eq('playlistId', invite.playlistId).eq('userId', user._id))
      .unique();
    if (!existing) {
      await ctx.db.insert('playlist_members', {
        playlistId: invite.playlistId,
        userId: user._id,
        role: 'editor',
        createdAt: ts,
      });
    }

    await ctx.db.patch(invite._id, {
      status: 'accepted',
      acceptedByUserId: user._id,
      updatedAt: ts,
    });
    await ctx.db.insert('activity_events', {
      playlistId: invite.playlistId,
      actorUserId: user._id,
      type: 'invite.accepted',
      message: `${user.name ?? user.email ?? 'A user'} joined the playlist`,
      createdAt: ts,
    });

    return { playlistId: invite.playlistId, alreadyAccepted: false };
  },
});

export const acceptByShortCode = mutation({
  args: { shortCode: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUserRecord(ctx);
    const normalizedCode = args.shortCode.trim().toUpperCase();
    const invite = await ctx.db
      .query('invites')
      .withIndex('by_short_code', (q) => q.eq('shortCode', normalizedCode))
      .unique();
    if (!invite) throw new Error('Invite code not found');

    const ts = now();
    if (invite.expiresAt < ts) {
      await ctx.db.patch(invite._id, { status: 'expired', updatedAt: ts });
      throw new Error('Invite code has expired');
    }
    if (invite.status === 'accepted') {
      return { playlistId: invite.playlistId, alreadyAccepted: true };
    }

    const userEmail = user.email?.toLowerCase();
    if (invite.email && userEmail && userEmail !== invite.email) {
      throw new Error('Invite email does not match signed-in user');
    }

    const existing = await ctx.db
      .query('playlist_members')
      .withIndex('by_playlist_user', (q) => q.eq('playlistId', invite.playlistId).eq('userId', user._id))
      .unique();
    if (!existing) {
      await ctx.db.insert('playlist_members', {
        playlistId: invite.playlistId,
        userId: user._id,
        role: 'editor',
        createdAt: ts,
      });
    }

    await ctx.db.patch(invite._id, {
      status: 'accepted',
      acceptedByUserId: user._id,
      updatedAt: ts,
    });
    await ctx.db.insert('activity_events', {
      playlistId: invite.playlistId,
      actorUserId: user._id,
      type: 'invite.accepted',
      message: `${user.name ?? user.email ?? 'A user'} joined the playlist`,
      createdAt: ts,
    });

    return { playlistId: invite.playlistId, alreadyAccepted: false };
  },
});
