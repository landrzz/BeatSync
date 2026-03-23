import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

const ACCENT = '#22c55e';
const ACCENT_DIM = '#16a34a';
const BG = '#0a0f1a';
const SURFACE = '#111827';
const BORDER = '#1f2937';

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
  const navigation = useNavigation();
  const isNew = id === 'new';
  const playlistId = id as any;

  const details = useQuery(api.playlists.getPlaylistDetails, !isNew && id ? { playlistId } : 'skip');
  const tracks = useQuery(api.tracks.getPlaylistTracks, !isNew && id ? { playlistId } : 'skip');
  const spotifyConnected = useQuery(api.spotify.isSpotifyConnected, !isNew ? {} : 'skip');
  const addTrack = useMutation(api.tracks.addTrackToPlaylist);
  const syncPlaylist = useMutation(api.spotify.syncPlaylistToSpotify);
  const createPlaylist = useMutation(api.playlists.createPlaylist);

  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  useEffect(() => {
    if (details?.playlist.name) {
      navigation.setOptions({ title: details.playlist.name });
    }
  }, [details?.playlist.name, navigation]);

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

  const onSpotifyPress = async () => {
    if (!spotifyConnected) {
      router.push('/connect-spotify' as any);
    } else {
      setSyncing(true);
      try {
        const result = await syncPlaylist({ playlistId });
        setSyncStatus(result.summary);
      } finally {
        setSyncing(false);
      }
    }
  };

  if (isNew) {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
          <View style={{ gap: 6, marginBottom: 8 }}>
            <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>New Playlist</Text>
            <Text style={{ color: '#64748b', fontSize: 14 }}>Give your playlist a name to get started.</Text>
          </View>
          <StyledInput value={newName} onChangeText={setNewName} placeholder="Playlist name" autoFocus />
          <StyledInput value={newDescription} onChangeText={setNewDescription} placeholder="Description (optional)" />
          <Pressable
            onPress={onCreatePlaylist}
            disabled={!newName.trim()}
            style={({ pressed }) => ({
              backgroundColor: !newName.trim() ? '#1e293b' : pressed ? ACCENT_DIM : ACCENT,
              padding: 16,
              borderRadius: 14,
              alignItems: 'center',
              marginTop: 8,
            })}
          >
            <Text style={{ color: !newName.trim() ? '#475569' : '#020617', fontWeight: '800', fontSize: 16 }}>
              Create Playlist
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  const trackCount = tracks?.length ?? 0;
  const playlistName = details?.playlist.name ?? '';
  const playlistDesc = details?.playlist.description;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 28, gap: 16 }}>
          {/* Playlist art + meta */}
          <View style={{ alignItems: 'center', gap: 12 }}>
            <View style={{
              width: 140,
              height: 140,
              borderRadius: 20,
              backgroundColor: '#1a1a3e',
              borderWidth: 1,
              borderColor: '#2d1b69',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#7c3aed',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
            }}>
              <Text style={{ fontSize: 56 }}>🎵</Text>
            </View>
            {playlistDesc ? (
              <Text style={{ color: '#64748b', fontSize: 13, textAlign: 'center' }} numberOfLines={2}>
                {playlistDesc}
              </Text>
            ) : null}
          </View>

          {/* Stats row */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <StatPill label={`${trackCount}`} sub={trackCount === 1 ? 'track' : 'tracks'} />
            <StatPill
              label={details?.providerSpotify ? 'Linked' : 'Not synced'}
              sub="Spotify"
              accent={!!details?.providerSpotify}
            />
          </View>

        </View>

        {/* Tracks */}
        <View style={{ paddingHorizontal: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>Tracks</Text>
            <Text style={{ color: '#64748b', fontSize: 13 }}>{trackCount > 0 ? `${trackCount} songs` : ''}</Text>
          </View>

          {tracks?.length ? (
            <View style={{ gap: 2 }}>
              {(tracks as any[]).map((track, index) => (
                <View
                  key={track._id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 10,
                    paddingHorizontal: 4,
                    borderBottomWidth: index < tracks.length - 1 ? 1 : 0,
                    borderBottomColor: BORDER,
                  }}
                >
                  {track.artworkUrl ? (
                    <Image source={{ uri: track.artworkUrl }} style={{ width: 48, height: 48, borderRadius: 8 }} />
                  ) : (
                    <View style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 20 }}>🎵</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#f1f5f9', fontWeight: '600', fontSize: 15 }} numberOfLines={1}>
                      {track.title}
                    </Text>
                    <Text style={{ color: '#64748b', fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                      {track.artistNames.join(', ')}
                    </Text>
                  </View>
                  <Text style={{ color: '#334155', fontSize: 18 }}>⋯</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={{
              alignItems: 'center',
              justifyContent: 'center',
              padding: 48,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: BORDER,
              borderStyle: 'dashed',
              gap: 8,
            }}>
              <Text style={{ fontSize: 36 }}>🎼</Text>
              <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 15 }}>No tracks yet</Text>
              <Text style={{ color: '#475569', fontSize: 13, textAlign: 'center' }}>
                Tap the search bar above to add songs
              </Text>
            </View>
          )}
        </View>

        {/* Spotify Card */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
          <Pressable
            onPress={onSpotifyPress}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: spotifyConnected ? '#052e16' : SURFACE,
              borderRadius: 14,
              padding: 16,
              borderWidth: 1,
              borderColor: spotifyConnected ? '#166534' : BORDER,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: spotifyConnected ? '#14532d' : '#1e293b', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 22 }}>🎧</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: spotifyConnected ? '#4ade80' : '#e2e8f0', fontWeight: '700', fontSize: 15 }}>
                {spotifyConnected ? 'Sync to Spotify' : 'Connect Spotify'}
              </Text>
              <Text style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                {syncStatus
                  ? syncStatus
                  : spotifyConnected
                    ? (details?.latestSyncJob?.summary ?? 'No sync run yet')
                    : 'Link your Spotify to sync this playlist'}
              </Text>
            </View>
            {syncing
              ? <ActivityIndicator color={ACCENT} size="small" />
              : <Text style={{ color: spotifyConnected ? '#4ade80' : '#475569', fontSize: 18 }}>
                  {spotifyConnected ? '↑' : '→'}
                </Text>}
          </Pressable>
        </View>

        {/* Invite link */}
        <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
          <Link
            href={`/invite/${id}` as any}
            style={{
              color: '#4ade80',
              fontSize: 14,
              fontWeight: '600',
              textAlign: 'center',
              paddingVertical: 12,
            }}
          >
            + Invite a collaborator
          </Link>
        </View>
      </ScrollView>

      {/* Floating search FAB */}
      <Pressable
        onPress={() => setSearchOpen(true)}
        style={({ pressed }) => ({
          position: 'absolute',
          bottom: 36,
          right: 24,
          backgroundColor: pressed ? ACCENT_DIM : ACCENT,
          width: 60,
          height: 60,
          borderRadius: 30,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: ACCENT,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.5,
          shadowRadius: 12,
          elevation: 8,
        })}
      >
        <Text style={{ fontSize: 26, color: '#020617' }}>🔍</Text>
      </Pressable>

      <SongSearchModal
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onAdd={onAddTrack}
        addedIds={addedIds}
      />
    </View>
  );
}

function StatPill({ label, sub, accent }: { label: string; sub: string; accent?: boolean }) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: accent ? '#052e16' : SURFACE,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: accent ? '#166534' : BORDER,
      padding: 12,
      alignItems: 'center',
    }}>
      <Text style={{ color: accent ? '#4ade80' : '#f1f5f9', fontWeight: '800', fontSize: 18 }}>{label}</Text>
      <Text style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>{sub}</Text>
    </View>
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
      <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
        {/* Modal header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, gap: 4 }}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>Add Songs</Text>
          <Text style={{ color: '#64748b', fontSize: 13 }}>Search the iTunes catalog</Text>
        </View>

        {/* Search bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={onChangeText}
            placeholder="Song name or artist…"
            placeholderTextColor="#475569"
            returnKeyType="search"
            autoCorrect={false}
            style={{
              flex: 1,
              backgroundColor: SURFACE,
              color: '#f1f5f9',
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 13,
              fontSize: 15,
              borderWidth: 1,
              borderColor: BORDER,
            }}
          />
          <Pressable
            onPress={() => query.length > 1 ? onChangeText('') : handleClose()}
            style={{ paddingHorizontal: 4 }}
          >
            <Text style={{ color: '#94a3b8', fontSize: 15, fontWeight: '600' }}>
              {query.length > 1 ? 'Clear' : 'Cancel'}
            </Text>
          </Pressable>
        </View>

        {searching && (
          <View style={{ alignItems: 'center', paddingTop: 48 }}>
            <ActivityIndicator color={ACCENT} size="large" />
            <Text style={{ color: '#475569', fontSize: 14, marginTop: 12 }}>Searching…</Text>
          </View>
        )}

        {!searching && query.trim().length >= 3 && results.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 64 }}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🔍</Text>
            <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 15 }}>No results found</Text>
            <Text style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Try a different search</Text>
          </View>
        )}

        {!searching && query.trim().length < 3 && query.length > 0 && (
          <View style={{ alignItems: 'center', paddingTop: 64 }}>
            <Text style={{ color: '#475569', fontSize: 14 }}>Keep typing…</Text>
          </View>
        )}

        {!searching && query.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 64, gap: 8 }}>
            <Text style={{ fontSize: 36 }}>🎵</Text>
            <Text style={{ color: '#475569', fontSize: 14 }}>Start typing to search for songs</Text>
          </View>
        )}

        <FlatList
          data={results}
          keyExtractor={(item) => String(item.trackId)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: BORDER }} />}
          renderItem={({ item }) => {
            const added = addedIds.has(item.trackId);
            const adding = addingId === item.trackId;
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 }}>
                {item.artworkUrl100 ? (
                  <Image source={{ uri: item.artworkUrl100 }} style={{ width: 52, height: 52, borderRadius: 8 }} />
                ) : (
                  <View style={{ width: 52, height: 52, borderRadius: 8, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 22 }}>🎵</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#f1f5f9', fontWeight: '600', fontSize: 14 }} numberOfLines={1}>
                    {item.trackName}
                  </Text>
                  <Text style={{ color: '#64748b', fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                    {item.artistName} · {item.collectionName}
                  </Text>
                </View>
                <Pressable
                  onPress={() => !added && !adding && handleAdd(item)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    borderWidth: 2,
                    borderColor: added ? '#166534' : ACCENT,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: added ? '#166534' : 'transparent',
                  }}
                >
                  {adding
                    ? <ActivityIndicator color={ACCENT} size="small" />
                    : <Text style={{ color: added ? '#4ade80' : ACCENT, fontSize: 20, lineHeight: 22, fontWeight: '400' }}>
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

function StyledInput({
  value,
  onChangeText,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#475569"
      autoFocus={autoFocus}
      style={{
        backgroundColor: SURFACE,
        color: '#f1f5f9',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        borderWidth: 1,
        borderColor: BORDER,
      }}
    />
  );
}
