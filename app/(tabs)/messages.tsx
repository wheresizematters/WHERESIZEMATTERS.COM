import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, TextInput, Modal,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS, getSizeTier } from '@/constants/theme';
import { fetchConversations, searchUsers, getOrCreateConversation } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useUnread } from '@/context/UnreadContext';
import { Conversation } from '@/lib/types';
import PageContainer from '@/components/PageContainer';

function formatTime(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function ConversationRow({ conv, myId, onPress, unread }: {
  conv: Conversation; myId: string; onPress: () => void; unread: boolean;
}) {
  const other = conv.user_1_id === myId ? conv.user2 : conv.user1;
  if (!other) return null;
  const tier = getSizeTier(other.size_inches ?? 0);
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.avatarWrap}>
        <View style={[styles.avatar, { borderColor: tier.color }]}>
          <Text style={[styles.avatarText, { color: tier.color }]}>
            {(other.username ?? '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        {unread && <View style={styles.unreadDot} />}
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowUsername, unread && styles.rowUsernameUnread]}>
            @{other.username ?? 'deleted'}
          </Text>
          <Text style={styles.rowTime}>{formatTime(conv.last_message_at)}</Text>
        </View>
        <Text style={[styles.rowPreview, unread && styles.rowPreviewUnread]} numberOfLines={1}>
          {conv.last_message_preview ?? 'No messages yet'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function NewChatModal({ visible, onClose, myId }: {
  visible: boolean; onClose: () => void; myId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (query.length < 2) { setResults([]); setSearchError(false); return; }
    setSearching(true);
    setSearchError(false);
    const t = setTimeout(async () => {
      try {
        const data = await searchUsers(query);
        setResults((data as any[]).filter((u: any) => u.id !== myId));
      } catch {
        setSearchError(true);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, myId]);

  async function startChat(userId: string) {
    setStarting(true);
    const { id: convId, error } = await getOrCreateConversation(myId, userId);
    setStarting(false);
    if (error) {
      if (Platform.OS === 'web') {
        window.alert(`Could not start conversation: ${error}`);
      } else {
        Alert.alert('Error', `Could not start conversation: ${error}`);
      }
      return;
    }
    if (convId) {
      onClose();
      setQuery('');
      router.push(`/chat/${convId}` as any);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => { onClose(); setQuery(''); }}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>New Message</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={COLORS.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor={COLORS.muted}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {searching && <ActivityIndicator size="small" color={COLORS.gold} />}
        </View>

        {starting ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.gold} />
        ) : (
          <FlatList
            data={results}
            keyExtractor={item => item.id}
            renderItem={({ item }) => {
              const tier = getSizeTier(item.size_inches);
              return (
                <TouchableOpacity style={styles.searchRow} onPress={() => startChat(item.id)} activeOpacity={0.7}>
                  <View style={[styles.avatar, { borderColor: tier.color }]}>
                    <Text style={[styles.avatarText, { color: tier.color }]}>
                      {item.username.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.rowUsername}>@{item.username}</Text>
                    <Text style={[styles.rowPreview, { color: tier.color }]}>{tier.emoji} {item.size_inches.toFixed(1)}"</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              query.length >= 2 && !searching ? (
                <Text style={styles.emptyText}>{searchError ? 'Search failed. Try again.' : 'No users found'}</Text>
              ) : null
            }
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function MessagesScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { unreadIds, refresh: refreshUnread } = useUnread();
  const myId = session?.user.id ?? '';
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);

  const load = useCallback(async () => {
    if (!myId) return;
    const data = await fetchConversations(myId);
    setConvs(data);
    setLoading(false);
  }, [myId]);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.container}>
      <PageContainer>
        <View style={styles.header}>
          <View style={styles.headerTitle}>
            <Text style={styles.logo}>SIZE.</Text>
            <Text style={styles.title}>MESSAGES</Text>
          </View>
          <TouchableOpacity onPress={() => setShowCompose(true)}>
            <Ionicons name="create-outline" size={24} color={COLORS.muted} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.gold} />
          </View>
        ) : (
          <FlatList
            data={convs}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <ConversationRow
                conv={item}
                myId={myId}
                unread={unreadIds.includes(item.id)}
                onPress={() => router.push(`/chat/${item.id}` as any)}
              />
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={48} color={COLORS.muted} />
                <Text style={styles.emptyText}>No messages yet.</Text>
                <Text style={styles.emptySubtext}>Tap the compose icon to start a chat.</Text>
              </View>
            }
          />
        )}

        <NewChatModal
          visible={showCompose}
          onClose={() => setShowCompose(false)}
          myId={myId}
        />
      </PageContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  logo: { fontSize: 28, fontWeight: '900', color: COLORS.gold, letterSpacing: 4 },
  title: { fontSize: SIZES.xl, fontWeight: '900', color: COLORS.white, letterSpacing: 3 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.card },
  avatarText: { fontSize: 18, fontWeight: '800' },
  unreadDot: { position: 'absolute', bottom: 1, right: -1, width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.gold, borderWidth: 2, borderColor: COLORS.bg },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  rowUsername: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.md },
  rowUsernameUnread: { color: COLORS.white, fontWeight: '900' },
  rowTime: { color: COLORS.muted, fontSize: SIZES.xs },
  rowPreview: { color: COLORS.muted, fontSize: SIZES.sm },
  rowPreviewUnread: { color: COLORS.white, fontWeight: '600' },
  separator: { height: 1, backgroundColor: COLORS.cardBorder, marginLeft: 80 },
  empty: { paddingVertical: 80, alignItems: 'center', gap: 10 },
  emptyText: { color: COLORS.muted, fontSize: SIZES.md, fontWeight: '600' },
  emptySubtext: { color: COLORS.muted, fontSize: SIZES.sm },
  // Modal
  modal: { flex: 1, backgroundColor: COLORS.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  modalCancel: { color: COLORS.muted, fontSize: SIZES.md, width: 60 },
  modalTitle: { color: COLORS.white, fontSize: SIZES.md, fontWeight: '800' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder },
  searchInput: { flex: 1, color: COLORS.white, fontSize: SIZES.md },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14 },
});
