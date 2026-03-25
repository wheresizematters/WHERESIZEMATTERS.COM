import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import PageContainer from '@/components/PageContainer';
import UserAvatar from '@/components/UserAvatar';
import {
  getDickCoinInfo, getDickCoinHolders, getTierInfo,
  canWriteGeneral, canWriteBukake, CJ_TIERS, DickCoin, DickCoinHolder,
} from '@/lib/dickcoin';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? '';

interface CircleJerkMessage {
  id: string;
  senderId: string;
  senderUsername: string;
  senderTier: string;
  channel: 'GENERAL' | 'BUKAKE';
  content: string;
  createdAt: string;
}

export default function CircleJerkScreen() {
  const { coinAddress } = useLocalSearchParams<{ coinAddress: string }>();
  const router = useRouter();
  const { session, profile } = useAuth();

  const [coin, setCoin] = useState<DickCoin | null>(null);
  const [myTier, setMyTier] = useState<string>('NONE');
  const [channel, setChannel] = useState<'GENERAL' | 'BUKAKE'>('GENERAL');
  const [messages, setMessages] = useState<CircleJerkMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [gated, setGated] = useState(false);

  const loadData = useCallback(async () => {
    if (!coinAddress) return;
    const [coinData, holders] = await Promise.all([
      getDickCoinInfo(coinAddress),
      getDickCoinHolders(coinAddress),
    ]);
    setCoin(coinData);

    // Find my tier
    const walletAddr = profile?.wallet_address?.toLowerCase();
    const myHolding = holders.find(h =>
      h.holderAddress.toLowerCase() === walletAddr ||
      h.userId === session?.user.id
    );

    if (!myHolding || myHolding.tier === 'NONE') {
      setGated(true);
      setMyTier('NONE');
    } else {
      setGated(false);
      setMyTier(myHolding.tier);
    }

    // Fetch messages
    await loadMessages();
    setLoading(false);
  }, [coinAddress, profile?.wallet_address, session?.user.id]);

  async function loadMessages() {
    if (!API_BASE || !coinAddress) return;
    try {
      const token = (await (await import('@/lib/supabase')).supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${API_BASE}/api/v1/circle-jerks/${coinAddress}/messages?channel=${channel}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) setMessages(await res.json());
    } catch {}
  }

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadMessages(); }, [channel]);

  async function sendMessage() {
    if (!input.trim() || sending || !coinAddress) return;
    setSending(true);
    try {
      const token = (await (await import('@/lib/supabase')).supabase.auth.getSession()).data.session?.access_token;
      await fetch(`${API_BASE}/api/v1/circle-jerks/${coinAddress}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ content: input.trim(), channel }),
      });
      setInput('');
      await loadMessages();
    } catch {} finally { setSending(false); }
  }

  const tierInfo = getTierInfo(myTier);
  const canWrite = channel === 'GENERAL' ? canWriteGeneral(myTier) : canWriteBukake(myTier);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.gold} /></View>
      </SafeAreaView>
    );
  }

  // Gate screen — user doesn't hold any of this DickCoin
  if (gated) {
    return (
      <SafeAreaView style={styles.container}>
        <PageContainer>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.push("/(tabs)" as any)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.headerText}>{coin?.name ?? 'Circle Jerk'}</Text>
            <View style={{ width: 36 }} />
          </View>
          <View style={styles.gateContainer}>
            <Ionicons name="lock-closed" size={48} color={COLORS.muted} />
            <Text style={styles.gateTitle}>You need to hold {coin?.ticker ?? 'this token'}</Text>
            <Text style={styles.gateDesc}>Buy on Uniswap to enter this Circle Jerk. Your role is determined by how much you hold.</Text>
            {coin?.poolAddress && (
              <TouchableOpacity
                style={styles.buyBtn}
                onPress={() => { if (typeof window !== 'undefined') window.open(`https://app.uniswap.org/swap?outputCurrency=${coinAddress}&chain=base`, '_blank'); }}
              >
                <Ionicons name="cart-outline" size={16} color={COLORS.bg} />
                <Text style={styles.buyBtnText}>Buy on Uniswap</Text>
              </TouchableOpacity>
            )}
          </View>
        </PageContainer>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <PageContainer>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push("/(tabs)" as any)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerText}>{coin?.name ?? 'Circle Jerk'}</Text>
            <View style={styles.headerMeta}>
              <View style={[styles.tierBadge, { borderColor: `${tierInfo.color}60`, backgroundColor: `${tierInfo.color}15` }]}>
                <Text style={[styles.tierBadgeText, { color: tierInfo.color }]}>{myTier}</Text>
              </View>
              <Text style={styles.holderCount}>{coin?.holderCount ?? 0} holders</Text>
            </View>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Channel toggle */}
        <View style={styles.channelBar}>
          <TouchableOpacity
            style={[styles.channelBtn, channel === 'GENERAL' && styles.channelBtnActive]}
            onPress={() => setChannel('GENERAL')}
          >
            <Text style={[styles.channelBtnText, channel === 'GENERAL' && styles.channelBtnTextActive]}>General</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.channelBtn, channel === 'BUKAKE' && styles.channelBtnActive]}
            onPress={() => setChannel('BUKAKE')}
          >
            {!canWriteBukake(myTier) && <Ionicons name="lock-closed" size={12} color={COLORS.muted} />}
            <Text style={[styles.channelBtnText, channel === 'BUKAKE' && styles.channelBtnTextActive]}>Bukake</Text>
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          inverted
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => {
            const t = getTierInfo(item.senderTier);
            return (
              <View style={styles.msgRow}>
                <View style={styles.msgHeader}>
                  <Text style={[styles.msgUsername, { color: t.color }]}>@{item.senderUsername}</Text>
                  <View style={[styles.msgTierPill, { borderColor: `${t.color}40` }]}>
                    <Text style={[styles.msgTierText, { color: t.color }]}>{item.senderTier}</Text>
                  </View>
                  <Text style={styles.msgTime}>{timeAgo(item.createdAt)}</Text>
                </View>
                <Text style={styles.msgContent}>{item.content}</Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyMsg}>
              <Text style={styles.emptyMsgText}>No messages yet. Be the first.</Text>
            </View>
          }
        />

        {/* Input */}
        <View style={styles.inputBar}>
          {canWrite ? (
            <>
              <TextInput
                style={styles.msgInput}
                placeholder={channel === 'BUKAKE' ? 'Post to Bukake...' : 'Message...'}
                placeholderTextColor={COLORS.mutedDark}
                value={input}
                onChangeText={setInput}
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
                onPress={sendMessage}
                disabled={!input.trim() || sending}
              >
                {sending
                  ? <ActivityIndicator size="small" color={COLORS.bg} />
                  : <Ionicons name="send" size={16} color={COLORS.bg} />
                }
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.readOnly}>
              <Ionicons name="lock-closed" size={14} color={COLORS.muted} />
              <Text style={styles.readOnlyText}>
                {channel === 'BUKAKE' ? 'Finisher+ only' : 'Stroker+ to write'}
              </Text>
            </View>
          )}
        </View>
      </PageContainer>
    </SafeAreaView>
  );
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.cardBorder },
  headerCenter: { alignItems: 'center' },
  headerText: { fontSize: SIZES.base, fontWeight: '900', color: COLORS.white },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  tierBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full, borderWidth: 1 },
  tierBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  holderCount: { color: COLORS.muted, fontSize: SIZES.xs },

  // Channel toggle
  channelBar: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, backgroundColor: COLORS.card, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 3 },
  channelBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: RADIUS.full },
  channelBtnActive: { backgroundColor: `${COLORS.gold}20`, borderWidth: 1, borderColor: `${COLORS.gold}50` },
  channelBtnText: { color: COLORS.muted, fontSize: SIZES.sm, fontWeight: '700' },
  channelBtnTextActive: { color: COLORS.gold },

  // Messages
  messageList: { paddingHorizontal: 16, paddingBottom: 8 },
  msgRow: { marginBottom: 12 },
  msgHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  msgUsername: { fontWeight: '700', fontSize: SIZES.sm },
  msgTierPill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: RADIUS.full, borderWidth: 1 },
  msgTierText: { fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  msgTime: { color: COLORS.mutedDark, fontSize: SIZES.xs },
  msgContent: { color: COLORS.offWhite, fontSize: SIZES.md, lineHeight: 22 },
  emptyMsg: { alignItems: 'center', paddingTop: 40 },
  emptyMsgText: { color: COLORS.muted, fontSize: SIZES.sm },

  // Input
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  msgInput: { flex: 1, backgroundColor: COLORS.card, borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 10, color: COLORS.white, fontSize: SIZES.md, borderWidth: 1, borderColor: COLORS.cardBorder },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.3 },
  readOnly: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  readOnlyText: { color: COLORS.muted, fontSize: SIZES.sm },

  // Gate
  gateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  gateTitle: { fontSize: SIZES.xl, fontWeight: '900', color: COLORS.white, textAlign: 'center' },
  gateDesc: { fontSize: SIZES.sm, color: COLORS.muted, textAlign: 'center', lineHeight: 20 },
  buyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.gold, borderRadius: RADIUS.md, paddingVertical: 14, paddingHorizontal: 24, marginTop: 8 },
  buyBtnText: { color: COLORS.bg, fontWeight: '900', fontSize: SIZES.base },
});
