import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    clerkUserId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_clerk_user_id', ['clerkUserId']),

  playlists: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    ownerUserId: v.id('users'),
    visibility: v.union(v.literal('private'), v.literal('shared')),
    syncVersion: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_owner', ['ownerUserId']),

  playlist_members: defineTable({
    playlistId: v.id('playlists'),
    userId: v.id('users'),
    role: v.union(v.literal('owner'), v.literal('editor'), v.literal('viewer')),
    createdAt: v.number(),
  }).index('by_playlist_user', ['playlistId', 'userId'])
    .index('by_user', ['userId']),

  playlist_items: defineTable({
    playlistId: v.id('playlists'),
    addedByUserId: v.id('users'),
    canonicalTrackKey: v.string(),
    title: v.string(),
    artistNames: v.array(v.string()),
    albumName: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    isrc: v.optional(v.string()),
    artworkUrl: v.optional(v.string()),
    position: v.number(),
    status: v.union(v.literal('active'), v.literal('removed')),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_playlist', ['playlistId'])
    .index('by_playlist_track_key', ['playlistId', 'canonicalTrackKey']),

  track_mappings: defineTable({
    canonicalTrackKey: v.string(),
    provider: v.union(v.literal('spotify'), v.literal('apple_music')),
    providerTrackId: v.string(),
    providerUri: v.optional(v.string()),
    lastValidatedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_canonical_provider', ['canonicalTrackKey', 'provider'])
    .index('by_provider_track', ['provider', 'providerTrackId']),

  provider_playlists: defineTable({
    playlistId: v.id('playlists'),
    provider: v.union(v.literal('spotify'), v.literal('apple_music')),
    providerPlaylistId: v.string(),
    externalUrl: v.optional(v.string()),
    snapshotRef: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),
    createdByUserId: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_playlist_provider', ['playlistId', 'provider']),

  sync_jobs: defineTable({
    playlistId: v.id('playlists'),
    provider: v.union(v.literal('spotify'), v.literal('apple_music')),
    triggeredByUserId: v.id('users'),
    status: v.union(v.literal('pending'), v.literal('running'), v.literal('completed'), v.literal('partial_failure'), v.literal('failed')),
    summary: v.optional(v.string()),
    missingMappingsCount: v.number(),
    syncedCount: v.number(),
    failedCount: v.number(),
    providerPlaylistId: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_playlist', ['playlistId']),

  activity_events: defineTable({
    playlistId: v.id('playlists'),
    actorUserId: v.optional(v.id('users')),
    type: v.string(),
    message: v.string(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  }).index('by_playlist', ['playlistId']),

  invites: defineTable({
    playlistId: v.id('playlists'),
    invitedByUserId: v.id('users'),
    email: v.string(),
    token: v.string(),
    status: v.union(v.literal('pending'), v.literal('accepted'), v.literal('expired')),
    expiresAt: v.number(),
    acceptedByUserId: v.optional(v.id('users')),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_token', ['token'])
    .index('by_playlist', ['playlistId']),

  spotify_connections: defineTable({
    userId: v.id('users'),
    spotifyUserId: v.optional(v.string()),
    accessToken: v.string(),
    refreshToken: v.string(),
    scope: v.optional(v.string()),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),
});
