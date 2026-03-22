import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { v } from 'convex/values';
import { now } from './lib/helpers';
import { requireIdentity } from './lib/auth';

function getIdentityKey(identity: Awaited<ReturnType<typeof requireIdentity>>) {
  return identity.tokenIdentifier ?? identity.subject;
}

export async function getCurrentUserRecord(ctx: QueryCtx | MutationCtx) {
  const identity = await requireIdentity(ctx);
  const clerkUserId = getIdentityKey(identity);
  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', clerkUserId))
    .unique();
  if (!user) throw new Error('User missing. Call createUserIfNotExists first.');
  return user;
}

export const createUserIfNotExists = mutation({
  args: {
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const clerkUserId = getIdentityKey(identity);
    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', clerkUserId))
      .unique();

    const ts = now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email ?? existing.email ?? identity.email,
        name: args.name ?? existing.name ?? identity.name,
        imageUrl: args.imageUrl ?? existing.imageUrl,
        updatedAt: ts,
      });
      return existing._id;
    }

    return await ctx.db.insert('users', {
      clerkUserId,
      email: args.email ?? identity.email,
      name: args.name ?? identity.name,
      imageUrl: args.imageUrl,
      createdAt: ts,
      updatedAt: ts,
    });
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const clerkUserId = identity.tokenIdentifier ?? identity.subject;
    return await ctx.db
      .query('users')
      .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', clerkUserId))
      .unique();
  },
});
