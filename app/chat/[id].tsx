import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, Modal, Image, Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { COLORS, SIZES, RADIUS } from '@/constants/theme';
import {
  fetchMessages, sendMessage, fetchConversations,
  uploadMessageMedia, getMessageMediaUrl, markMediaViewed, markConversationRead,
} from '@/lib/api';
import { useUnread } from '@/context/UnreadContext';
import { pickMedia } from '@/lib/media';
import { useAuth } from '@/context/AuthContext';
import { SUPABASE_READY, getToken } from '@/lib/supabase';
import { Message, Conversation } from '@/lib/types';

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Snap Viewer ──────────────────────────────────────────────────────────────
function SnapViewer({
  visible, mediaUrl, mediaType, onClose,
}: {
  visible: boolean;
  mediaUrl: string | null;
  mediaType: 'image' | 'video' | null;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    if (!visible || !mediaUrl) return;
    setUrl(null);
    getMessageMediaUrl(mediaUrl).then(setUrl);
  }, [visible, mediaUrl]);

  if (!visible) return null;

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <View style={snap.container}>
        {!url ? (
          <ActivityIndicator size="large" color={COLORS.white} />
        ) : mediaType === 'image' ? (
          <Image source={{ uri: url }} style={snap.media} resizeMode="contain" />
        ) : (
          <Video
            ref={videoRef}
            source={{ uri: url }}
            style={snap.media}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            isLooping={false}
            onPlaybackStatusUpdate={status => {
              if ((status as any).didJustFinish) onClose();
            }}
          />
        )}
        {/* Tap anywhere to close */}
        <Pressable style={snap.closeArea} onPress={onClose} />
        <View style={snap.topBar}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={28} color={COLORS.white} />
          </TouchableOpacity>
          {mediaType === 'video' && url && (
            <Text style={snap.snapLabel}>▶ Playing once</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({
  msg, isMe, onSnapTap,
}: {
  msg: Message;
  isMe: boolean;
  onSnapTap: (msg: Message) => void;
}) {
  const isSnap = !!msg.media_url;
  const isViewed = !!msg.viewed_at;

  if (isSnap) {
    const canView = !isMe && !isViewed;
    return (
      <View style={[styles.bubbleWrap, isMe ? styles.bubbleWrapMe : styles.bubbleWrapThem]}>
        <TouchableOpacity
          style={[
            styles.snapCard,
            isMe ? styles.snapCardMe : styles.snapCardThem,
            isViewed && styles.snapCardViewed,
          ]}
          onPress={canView ? () => onSnapTap(msg) : undefined}
          activeOpacity={canView ? 0.7 : 1}
          disabled={!canView}
        >
          <Text style={styles.snapIcon}>
            {msg.media_type === 'video' ? '🎥' : '📸'}
          </Text>
          <View>
            <Text style={[styles.snapLabel, isViewed && styles.snapLabelViewed]}>
              {isMe
                ? isViewed ? 'Opened' : `${msg.media_type === 'video' ? 'Video' : 'Photo'} sent`
                : isViewed ? 'Opened' : `Tap to view ${msg.media_type === 'video' ? 'video' : 'photo'}`}
            </Text>
            {msg.content ? <Text style={styles.snapCaption}>{msg.content}</Text> : null}
          </View>
          {canView && (
            <Ionicons name="chevron-forward" size={16} color={COLORS.gold} style={{ marginLeft: 'auto' }} />
          )}
        </TouchableOpacity>
        <Text style={[styles.bubbleTime, isMe ? styles.bubbleTimeMe : null]}>
          {formatTime(msg.created_at)}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleWrap, isMe ? styles.bubbleWrapMe : styles.bubbleWrapThem]}>
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
        <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
          {msg.content}
        </Text>
      </View>
      <Text style={[styles.bubbleTime, isMe ? styles.bubbleTimeMe : null]}>
        {formatTime(msg.created_at)}
      </Text>
    </View>
  );
}

// ── Chat Screen ───────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { markRead } = useUnread();
  const myId = session?.user.id ?? '';

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [otherUsername, setOtherUsername] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [mediaAsset, setMediaAsset] = useState<any | null>(null);

  // Snap viewer state
  const [snapMsg, setSnapMsg] = useState<Message | null>(null);

  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try {
      const msgs = await fetchMessages(conversationId);
      setMessages(msgs);
      if (myId) {
        markRead(conversationId);
        markConversationRead(conversationId, myId).catch(() => {});
      }
    } catch {
      // silent — chat still renders empty rather than hanging
    } finally {
      setLoading(false);
    }
  }, [conversationId, myId]);

  useEffect(() => {
    async function resolveOtherUser() {
      if (!myId) return;
      const convs = await fetchConversations(myId);
      const conv = convs.find((c: Conversation) => c.id === conversationId);
      if (conv) {
        const other = conv.user_1_id === myId ? conv.user2 : conv.user1;
        if (other?.username) setOtherUsername(other.username);
      }
    }
    resolveOtherUser();
  }, [conversationId, myId]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription
  useEffect(() => {
    if (!SUPABASE_READY) return;
  }, [conversationId]);

  async function handlePickMedia() {
    const asset = await pickMedia('all');
    if (asset) setMediaAsset(asset);
  }

  async function handleSend() {
    const content = text.trim();
    if (!content && !mediaAsset) return;
    if (sending) return;

    setSending(true);
    setText('');
    const asset = mediaAsset;
    setMediaAsset(null);

    let mediaPath: string | undefined;
    let mediaType: 'image' | 'video' | undefined;

    if (asset) {
      const mimeType = asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
      mediaType = mimeType.includes('video') ? 'video' : 'image';
      const { path, error: uploadErr } = await uploadMessageMedia(conversationId, asset.uri, mimeType);
      if (uploadErr) {
        setSending(false);
        setMediaAsset(asset); // restore
        setText(content);
        if (Platform.OS === 'web') {
          window.alert(`Upload failed: ${uploadErr}`);
        } else {
          Alert.alert('Upload failed', uploadErr);
        }
        return;
      }
      mediaPath = path ?? undefined;
    }

    const { error } = await sendMessage(conversationId, myId, content, mediaPath, mediaType);
    setSending(false);
    if (error) {
      setText(content);
      if (asset) setMediaAsset(asset);
      if (Platform.OS === 'web') {
        window.alert(`Failed to send: ${error}`);
      } else {
        Alert.alert('Error', `Failed to send: ${error}`);
      }
    }
  }

  async function handleSnapClose() {
    if (!snapMsg) return;
    const msg = snapMsg;
    setSnapMsg(null);
    // Mark as viewed and update local state
    await markMediaViewed(msg.id);
    setMessages(prev =>
      prev.map(m => m.id === msg.id ? { ...m, viewed_at: new Date().toISOString() } : m)
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerName}>{otherUsername ? `@${otherUsername}` : ''}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.gold} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <MessageBubble
                msg={item}
                isMe={item.sender_id === myId}
                onSnapTap={msg => setSnapMsg(msg)}
              />
            )}
            inverted
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Send a message to get started.</Text>
              </View>
            }
          />
        )}

        {/* Media preview strip */}
        {mediaAsset && (
          <View style={styles.mediaPreviewStrip}>
            <View style={styles.mediaPreviewBadge}>
              <Text style={styles.mediaPreviewIcon}>
                {(mediaAsset.mimeType ?? '').includes('video') ? '🎥' : '📸'}
              </Text>
              <Text style={styles.mediaPreviewLabel}>
                {(mediaAsset.mimeType ?? '').includes('video') ? 'Video ready' : 'Photo ready'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setMediaAsset(null)} hitSlop={8}>
              <Ionicons name="close-circle" size={22} color={COLORS.muted} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.cameraBtn} onPress={handlePickMedia} disabled={sending}>
            <Ionicons name="camera-outline" size={22} color={mediaAsset ? COLORS.gold : COLORS.muted} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder={mediaAsset ? 'Add a caption...' : 'Message...'}
            placeholderTextColor={COLORS.muted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, ((!text.trim() && !mediaAsset) || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={(!text.trim() && !mediaAsset) || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color={COLORS.bg} />
              : <Ionicons name="arrow-up" size={20} color={COLORS.bg} />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <SnapViewer
        visible={!!snapMsg}
        mediaUrl={snapMsg?.media_url ?? null}
        mediaType={snapMsg?.media_type ?? null}
        onClose={handleSnapClose}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerName: { color: COLORS.white, fontWeight: '800', fontSize: SIZES.base },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messageList: { paddingHorizontal: 16, paddingVertical: 12 },

  // Text bubbles
  bubbleWrap: { marginVertical: 3, maxWidth: '75%' },
  bubbleWrapMe: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleWrapThem: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { borderRadius: RADIUS.lg, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe: { backgroundColor: COLORS.gold },
  bubbleThem: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder },
  bubbleText: { fontSize: SIZES.md, lineHeight: 20 },
  bubbleTextMe: { color: COLORS.bg, fontWeight: '600' },
  bubbleTextThem: { color: COLORS.white },
  bubbleTime: { color: COLORS.muted, fontSize: 10, marginTop: 3, marginHorizontal: 4 },
  bubbleTimeMe: { textAlign: 'right' },

  // Snap cards
  snapCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: RADIUS.lg, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1.5, minWidth: 180,
  },
  snapCardMe: { backgroundColor: `${COLORS.gold}18`, borderColor: `${COLORS.gold}60` },
  snapCardThem: { backgroundColor: `${COLORS.gold}22`, borderColor: COLORS.gold },
  snapCardViewed: { backgroundColor: COLORS.card, borderColor: COLORS.cardBorder },
  snapIcon: { fontSize: 22 },
  snapLabel: { color: COLORS.gold, fontWeight: '700', fontSize: SIZES.sm },
  snapLabelViewed: { color: COLORS.muted },
  snapCaption: { color: COLORS.muted, fontSize: SIZES.xs, marginTop: 2 },

  // Media preview
  mediaPreviewStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.cardBorder,
  },
  mediaPreviewBadge: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  mediaPreviewIcon: { fontSize: 20 },
  mediaPreviewLabel: { color: COLORS.gold, fontSize: SIZES.sm, fontWeight: '700' },

  // Input
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.cardBorder, gap: 8 },
  cameraBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 10 : 8, color: COLORS.white, fontSize: SIZES.md, maxHeight: 100 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { color: COLORS.muted, fontSize: SIZES.sm },
});

const snap = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  media: { width: '100%', height: '100%' },
  closeArea: { ...StyleSheet.absoluteFillObject },
  topBar: {
    position: 'absolute', top: 52, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  snapLabel: { color: 'rgba(255,255,255,0.8)', fontSize: SIZES.sm, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
});
