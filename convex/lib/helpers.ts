export const now = () => Date.now();

export function buildCanonicalTrackKey(input: { isrc?: string; title: string; artists: string[]; durationMs?: number }) {
  if (input.isrc) return `isrc:${input.isrc.toUpperCase()}`;
  const normalizedTitle = input.title.trim().toLowerCase();
  const normalizedArtists = [...input.artists].map((a) => a.trim().toLowerCase()).sort().join('|');
  const bucketedDuration = input.durationMs ? Math.round(input.durationMs / 1000) : 'unknown';
  return `fallback:${normalizedTitle}:${normalizedArtists}:${bucketedDuration}`;
}

function randomSegment(length: number) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function createInviteToken() {
  return `invite_${Date.now().toString(36)}_${randomSegment(10)}`;
}

export function createShortCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
