import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button, Card, Muted, Screen } from '@/components/ui';

type ItunesTrack = {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl100: string;
  trackTimeMillis: number;
  isrc?: string;
};

export default function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === 'new';
  const playlistId = id as any;

  const details = useQuery(api.playlists.getPlaylistDetails, !isNew && id ? { playlistId } : 'skip');
  const tracks = useQuery(api.tracks.getPlaylistTracks, !isNew && id ? { playlistId } : 'skip');
  const addTrack = useMutation(api.tracks.addTrackToPlaylist);
  const syncPlaylist = useMutation(api.spotify.syncPlaylistToSpotify);
  const createPlaylist = useMutation(api.playlists.createPlaylist);

  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const onCreatePlaylist = async () => {
    if (!newName.trim()) return;
    const newId = await createPlaylist({ name: newName.trim(), description: newDescription.trim() || undefined });
    router.replace(`/playlists/${newId}` as any);
  };

  const onAddTrack = async (track: ItunesTrack) => {
    await addTrack({
      playlistId,
      title: track.trackName,
      artistNames: [track.artistName],
      albumName: track.collectionName || undefined,
      durationMs: track.trackTimeMillis || undefined,
      artworkUrl: track.artworkUrl100 || undefined,
      isrc: track.isrc || undefined,
    });
    setAddedIds((prev) => new Set(prev).add(track.trackId));
  };

  const onSync = async () => {
    const result = await syncPlaylist({ playlistId });
    setSyncStatus(result.summary);
  };

  if (isNew) {
    return (
      <Screen>
        <Card title="New Playlist" subtitle="Give your playlist a name to get started.">
          <PlainInput value={newName} onChangeText={setNewName} placeholder="Playlist name" />
          <PlainInput value={newDescription} onChangeText={setNewDescription} placeholder="Description (optional)" />
          <Button title="Create Playlist" onPress={onCreatePlaylist} disabled={!newName.trim()} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card title={details?.playlist.name ?? 'Playlist'} subtitle={details?.playlist.description ?? undefined}>
        <Muted>
          {tracks?.length ?? 0} tracks · Spotify {details?.providerSpotify ? 'linked' : 'not synced'}
        </Muted>
        <Link href={`/invite/${id}` as any} style={{ color: '#4ade80', fontSize: 14 }}>
          Invite a collaborator
        </Link>
      </Card>

      <Pressable
        onPress={() => setSearchOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#1e293b',
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 13,
          borderWidth: 1,
          borderColor: '#334155',
          gap: 10,
        }}
      >
        <Text style={{ color: '#475569', fontSize: 16 }}>🔍</Text>
        <Text style={{ color: '#475569', fontSize: 15, flex: 1 }}>Search for a song or artist…</Text>
      </Pressable>

      <Card title={`Tracks (${tracks?.length ?? 0})`}>
        {tracks?.length ? tracks.map((track: any) => (
          <View key={track._id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
            {track.artworkUrl ? (
              <Image source={{ uri: track.artworkUrl }} style={{ width: 44, height: 44, borderRadius: 6 }} />
            ) : (
              <View style={{ width: 44, height: 44, borderRadius: 6, backgroundColor: '#1e293b' }} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#f1f5f9', fontWeight: '600', fontSize: 14 }} numberOfLines={1}>
                {track.title}
              </Text>
              <Text style={{ color: '#94a3b8', fontSize: 12 }} numberOfLines={1}>
                {track.artistNames.join(', ')}
              </Text>
            </View>
          </View>
        )) : <Muted>No tracks yet. Tap the search bar above to add songs.</Muted>}
      </Card>

      <Card title="Sync to Spotify">
        <Button title="Sync now" onPress={onSync} />
        {syncStatus
          ? <Muted>{syncStatus}</Muted>
          : <Muted>{details?.latestSyncJob?.summary ?? 'No sync run yet.'}</Muted>}
      </Card>

      <SongSearchModal
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onAdd={onAddTrack}
        addedIds={addedIds}
      />
    </Screen>
  );
}

function SongSearchModal({
  visible,
  onClose,
  onAdd,
  addedIds,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (track: ItunesTrack) => Promise<void>;
  addedIds: Set<number>;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ItunesTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [visible]);

  const doSearch = useCallback(async (q: string) => {
    setSearching(true);
    try {
      const encoded = encodeURIComponent(q.trim());
      const res = await fetch(`https://itunes.apple.com/search?term=${encoded}&media=music&entity=song&limit=25`);
      const json = await res.json();
      setResults(json.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const onChangeText = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(text), 300);
  };

  const handleAdd = async (track: ItunesTrack) => {
    setAddingId(track.trackId);
    try {
      await onAdd(track);
    } finally {
      setAddingId(null);
    }
  };

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={onChangeText}
            placeholder="Search for a song or artist…"
            placeholderTextColor="#475569"
            returnKeyType="search"
            autoCorrect={false}
            style={{
              flex: 1,
              backgroundColor: '#1e293b',
              color: '#f1f5f9',
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 15,
              borderWidth: 1,
              borderColor: '#334155',
            }}
          />
          <Pressable onPress={handleClose} style={{ paddingHorizontal: 4 }}>
            <Text style={{ color: '#94a3b8', fontSize: 15, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
        </View>

        {searching && (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <ActivityIndicator color="#22c55e" size="large" />
          </View>
        )}

        {!searching && query.trim().length >= 3 && results.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ color: '#475569', fontSize: 15 }}>No results found</Text>
          </View>
        )}

        {!searching && query.trim().length < 3 && query.length > 0 && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ color: '#475569', fontSize: 14 }}>Keep typing…</Text>
          </View>
        )}

        <FlatList
          data={results}
          keyExtractor={(item) => String(item.trackId)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#1e293b' }} />}
          renderItem={({ item }) => {
            const added = addedIds.has(item.trackId);
            const adding = addingId === item.trackId;
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
                {item.artworkUrl100 ? (
                  <Image source={{ uri: item.artworkUrl100 }} style={{ width: 50, height: 50, borderRadius: 6 }} />
                ) : (
                  <View style={{ width: 50, height: 50, borderRadius: 6, backgroundColor: '#1e293b' }} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#f1f5f9', fontWeight: '600', fontSize: 14 }} numberOfLines={1}>
                    {item.trackName}
                  </Text>
                  <Text style={{ color: '#94a3b8', fontSize: 12 }} numberOfLines={1}>
                    {item.artistName} · {item.collectionName}
                  </Text>
                </View>
                <Pressable
                  onPress={() => !added && !adding && handleAdd(item)}
                  style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: added ? '#166534' : '#22c55e', alignItems: 'center', justifyContent: 'center', backgroundColor: added ? '#166534' : 'transparent' }}
                >
                  {adding
                    ? <ActivityIndicator color="#22c55e" size="small" />
                    : <Text style={{ color: added ? '#4ade80' : '#22c55e', fontSize: 20, lineHeight: 22, fontWeight: '400' }}>
                        {added ? '✓' : '+'}
                      </Text>}
                </Pressable>
              </View>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

function PlainInput({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#475569"
      style={{
        backgroundColor: '#1e293b',
        color: '#f1f5f9',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        borderWidth: 1,
        borderColor: '#334155',
      }}
    />
  );
}
