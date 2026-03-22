import { mutation } from './_generated/server';
import { v } from 'convex/values';
import { createInviteToken, now } from './lib/helpers';
import { getCurrentUserRecord } from './users';

export const createInvite = mutation({
  args: { playlistId: v.id('playlists'), email: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUserRecord(ctx);
    const membership = await ctx.db
      .query('playlist_members')
      .withIndex('by_playlist_user', (q) => q.eq('playlistId', args.playlistId).eq('userId', user._id))
      .unique();
    if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
      throw new Error('Forbidden');
    }

    const normalizedEmail = args.email.trim().toLowerCase();
    const pendingForEmail = await ctx.db
      .query('invites')
      .withIndex('by_playlist', (q) => q.eq('playlistId', args.playlistId))
      .collect();
    const existingPending = pendingForEmail.find(
      (invite: any) => invite.email === normalizedEmail && invite.status === 'pending' && invite.expiresAt > now()
    );
    if (existingPending) {
      return { inviteId: existingPending._id, token: existingPending.token, reused: true };
    }

    const token = createInviteToken();
    const ts = now();
    const inviteId = await ctx.db.insert('invites', {
      playlistId: args.playlistId,
      invitedByUserId: user._id,
      email: normalizedEmail,
      token,
      status: 'pending',
      expiresAt: ts + 1000 * 60 * 60 * 24 * 7,
      createdAt: ts,
      updatedAt: ts,
    });

    await ctx.db.insert('activity_events', {
      playlistId: args.playlistId,
      actorUserId: user._id,
      type: 'invite.created',
      message: `Invited ${normalizedEmail}`,
      metadata: { email: normalizedEmail },
      createdAt: ts,
    });

    return { inviteId, token, reused: false };
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
