import { useState } from 'react';
import { Link, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button, Card, Field, Label, Muted, Screen } from '@/components/ui';

export default function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const playlistId = id as any;
  const details = useQuery(api.playlists.getPlaylistDetails, id ? { playlistId } : 'skip');
  const tracks = useQuery(api.tracks.getPlaylistTracks, id ? { playlistId } : 'skip');
  const addTrack = useMutation(api.tracks.addTrackToPlaylist);
  const searchSpotifyTracks = useMutation(api.spotify.searchSpotifyTracks);
  const syncPlaylist = useMutation(api.spotify.syncPlaylistToSpotify);

  const [queryTitle, setQueryTitle] = useState('Blinding Lights');
  const [artists, setArtists] = useState('The Weeknd');
  const [spotifySearch, setSpotifySearch] = useState('The Weeknd Blinding Lights');
  const [spotifyResults, setSpotifyResults] = useState<any[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const onAddTrack = async () => {
    const result = await addTrack({
      playlistId,
      title: queryTitle,
      artistNames: artists.split(',').map((value) => value.trim()).filter(Boolean),
    });
    setStatus(result.duplicated ? 'Track already existed in BeatSync, so it was not added twice.' : 'Track added to BeatSync.');
  };

  const onSpotifySearch = async () => {
    const result = await searchSpotifyTracks({ query: spotifySearch });
    setSpotifyResults(result);
    setStatus(result.length ? `Found ${result.length} Spotify result(s).` : 'No Spotify results found.');
  };

  const onAddSpotifyResult = async (track: any) => {
    const result = await addTrack({
      playlistId,
      title: track.title,
      artistNames: track.artistNames,
      albumName: track.albumName,
      durationMs: track.durationMs,
      isrc: track.isrc,
      artworkUrl: track.artworkUrl,
      spotifyTrackId: track.providerTrackId,
      spotifyUri: track.providerUri,
    });
    setStatus(result.duplicated ? 'That Spotify result was already in BeatSync.' : 'Spotify result added and mapped for future sync.');
  };

  const onSync = async () => {
    const result = await syncPlaylist({ playlistId });
    setStatus(result.summary);
  };

  return (
    <Screen>
      <Card title={details?.playlist.name ?? 'Playlist'} subtitle={details?.playlist.description ?? 'No description yet.'}>
        <Muted>Version {details?.playlist.syncVersion ?? 0} · Spotify {details?.providerSpotify ? 'connected' : 'not synced yet'} · Apple Music stub only</Muted>
        <Link href={`/invite/${id}` as any} style={{ color: '#4ade80' }}>Invite a collaborator</Link>
      </Card>

      <Card title="Tracks">
        {tracks?.length ? tracks.map((track: any) => (
          <Muted key={track._id}>{track.position}. {track.title} — {track.artistNames.join(', ')} {track.spotifyMapping ? '· mapped' : '· missing Spotify mapping'}</Muted>
        )) : <Muted>No tracks yet.</Muted>}
      </Card>

      <Card title="Add track manually" subtitle="Manual entry is the canonical BeatSync write path.">
        <Label>Title</Label>
        <Field value={queryTitle} onChangeText={setQueryTitle} />
        <Label>Artists (comma separated)</Label>
        <Field value={artists} onChangeText={setArtists} />
        <Button title="Add track" onPress={onAddTrack} />
      </Card>

      <Card title="Search Spotify" subtitle="Optional helper to create BeatSync tracks with Spotify mappings attached.">
        <Label>Search query</Label>
        <Field value={spotifySearch} onChangeText={setSpotifySearch} />
        <Button title="Search Spotify" onPress={onSpotifySearch} />
        {spotifyResults.map((track) => (
          <Card key={track.providerTrackId} title={track.title} subtitle={`${track.artistNames.join(', ')} · ${track.albumName ?? 'Unknown album'}`}>
            <Muted>{track.isrc ? `ISRC ${track.isrc}` : 'No ISRC returned from Spotify.'}</Muted>
            <Button title="Add mapped track" onPress={() => onAddSpotifyResult(track)} />
          </Card>
        ))}
      </Card>

      <Card title="Sync to Spotify" subtitle="Creates the provider playlist if missing, refreshes tokens when needed, and reports partial failures.">
        <Button title="Manual sync to Spotify" onPress={onSync} />
        <Muted>{details?.latestSyncJob?.summary ?? 'No sync run yet.'}</Muted>
      </Card>

      {status ? <Card title="Status"><Muted>{status}</Muted></Card> : null}
      <Card title="Recent activity">
        {details?.activity?.length ? details.activity.map((item: any) => <Muted key={item._id}>{item.message}</Muted>) : <Muted>No activity yet.</Muted>}
      </Card>
    </Screen>
  );
}
