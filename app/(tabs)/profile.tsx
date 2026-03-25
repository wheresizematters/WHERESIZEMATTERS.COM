import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Platform, Share,
  Image, TextInput, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import PageContainer from '@/components/PageContainer';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS, getSizeTier } from '@/constants/theme';
import { WORLD_AVERAGE } from '@/lib/mockData';
import { fetchUserRank, fetchUserPostCount, fetchTotalUserCount, fetchUserPosts, searchUsers, fetchUserPercentile } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Post } from '@/lib/types';

type ProfileTab = 'posts' | 'compare';

const TAG_COLORS: Record<string, string> = { size: '#A78BFA', content: '#60A5FA', viral: '#F87171' };
const TAG_CATEGORIES: Record<string, string> = {
  Hung: 'size', Massive: 'size', 'Above Average': 'size', Average: 'size', Micro: 'size', Grower: 'size', Shower: 'size',
  OC: 'content', 'Rate Me': 'content', Comparison: 'content', Measurement: 'content', Progress: 'content', 'First Post': 'content', Soft: 'content', Hard: 'content', Bulge: 'content',
  'Guess My Size': 'viral', 'Be Honest': 'viral', 'Brutal Rating': 'viral', 'Top %': 'viral', "Biggest You've Seen?": 'viral',
};

function timeAgo(ts: string): string {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d`;
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function joinedDate(ts: string): string {
  return new Date(ts).toLocaleDateString([], { month: 'long', year: 'numeric' });
}

function PostItem({ post }: { post: Post }) {
  const totalVotes = post.poll_options?.reduce((s, o) => s + o.vote_count, 0) ?? 0;
  const tagColor = post.tag ? (TAG_COLORS[TAG_CATEGORIES[post.tag]] ?? COLORS.muted) : null;
  return (
    <View style={styles.postItem}>
      <View style={styles.postItemTop}>
        {post.tag && tagColor && (
          <View style={[styles.postTagChip, { borderColor: tagColor, backgroundColor: `${tagColor}18` }]}>
            <Text style={[styles.postTagText, { color: tagColor }]}>{post.tag}</Text>
          </View>
        )}
        <Text style={styles.postItemTime}>{timeAgo(post.created_at)}</Text>
      </View>
      <Text style={styles.postItemContent} numberOfLines={3}>{post.content}</Text>
      <View style={styles.postItemFooter}>
        {post.type === 'poll' && (
          <View style={styles.postItemStat}>
            <Ionicons name="stats-chart-outline" size={12} color={COLORS.muted} />
            <Text style={styles.postItemStatText}>{totalVotes.toLocaleString()} votes</Text>
          </View>
        )}
        <View style={styles.postItemStat}>
          <Ionicons name="chatbubble-outline" size={12} color={COLORS.muted} />
          <Text style={styles.postItemStatText}>{post.comment_count}</Text>
        </View>
      </View>
    </View>
  );
}

function SizeBar({ size, maxSize, label, color, isYou }: { size: number; maxSize: number; label: string; color: string; isYou: boolean }) {
  const pct = Math.min((size / maxSize) * 100, 100);
  return (
    <View style={styles.barWrap}>
      <View style={styles.barLabelRow}>
        <Text style={[styles.barLabel, isYou && { color: COLORS.white, fontWeight: '700' }]}>{label}</Text>
        <Text style={[styles.barSize, { color }]}>{size.toFixed(1)}"</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

async function pickAndUploadImage(bucket: 'avatars' | 'headers', userId: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) { resolve(null); return; }
        const ext = file.name.split('.').pop() ?? 'jpg';
        const path = `${userId}/photo.${ext}`;
        const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
        if (error) { console.error(error); resolve(null); return; }
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        resolve(data.publicUrl + `?t=${Date.now()}`);
      };
      input.click();
    });
  }

  // Native
  try {
    const ImagePicker = require('expo-image-picker');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return null;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true, aspect: bucket === 'avatars' ? [1, 1] : [3, 1] });
    if (result.canceled) return null;
    const uri = result.assets[0].uri;
    const ext = uri.split('.').pop() ?? 'jpg';
    const path = `${userId}/photo.${ext}`;
    const response = await fetch(uri);
    const blob = await response.blob();
    const { error } = await supabase.storage.from(bucket).upload(path, blob, { upsert: true, contentType: `image/${ext}` });
    if (error) { console.error(error); return null; }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl + `?t=${Date.now()}`;
  } catch {
    return null;
  }
}

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, session, signOut, demoMode, refreshProfile } = useAuth();
  const [rank, setRank] = useState<number | null>(null);
  const [postCount, setPostCount] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [showSize, setShowSize] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  // Compare state
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [compareTarget, setCompareTarget] = useState<any | null>(null);
  const [percentile, setPercentile] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);

  // Upload state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingHeader, setUploadingHeader] = useState(false);

  const size = profile?.size_inches ?? 0;
  const tier = getSizeTier(size);

  useEffect(() => {
    if (!session?.user.id) return;
    fetchUserRank(session.user.id).then(setRank).catch(() => {});
    fetchUserPostCount(session.user.id).then(setPostCount).catch(() => {});
    fetchTotalUserCount().then(setTotalUsers).catch(() => {});
    fetchUserPercentile(size).then(setPercentile).catch(() => {});
    setPostsLoading(true);
    fetchUserPosts(session.user.id).then(setUserPosts).catch(() => setUserPosts([])).finally(() => setPostsLoading(false));
  }, [session?.user.id]);

  useEffect(() => {
    if (search.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try { setSearchResults(await searchUsers(search)); } catch { setSearchResults([]); } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const percentileVal = rank && totalUsers ? Math.max(0, Math.min(100, Math.round((1 - rank / totalUsers) * 100))) : null;
  const myTier = getSizeTier(size);
  const targetTier = compareTarget ? getSizeTier(compareTarget.size_inches) : null;
  const maxSize = compareTarget ? Math.max(size, compareTarget.size_inches, WORLD_AVERAGE) * 1.15 : Math.max(size, WORLD_AVERAGE) * 1.15;

  async function handleShare() {
    if (!session) return;
    const inviteUrl = `https://wheresizematters.com/invite/${session.user.id}`;
    const message = `Hey. Join me on SIZE. 🍆\n\nThe app where size actually matters — rankings, real stats, and the most honest size community on the internet.\n\nSee where you stack up 👇\n${inviteUrl}`;
    if (Platform.OS === 'web') {
      try { await navigator.share({ title: 'Join me on SIZE.', text: message, url: inviteUrl }); return; } catch {}
      try { await navigator.clipboard.writeText(message); window.alert('Invite link copied!'); } catch { window.alert(`Share:\n${inviteUrl}`); }
      return;
    }
    await Share.share({ message, url: inviteUrl });
  }

  async function handleSignOut() {
    if (Platform.OS === 'web') {
      if (!window.confirm('Are you sure you want to sign out?')) return;
      setSigningOut(true); await signOut(); return;
    }
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { setSigningOut(true); await signOut(); } },
    ]);
  }

  async function handleAvatarUpload() {
    if (!session?.user.id) return;
    setUploadingAvatar(true);
    const url = await pickAndUploadImage('avatars', session.user.id);
    if (url) {
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', session.user.id);
      refreshProfile?.();
    }
    setUploadingAvatar(false);
  }

  async function handleHeaderUpload() {
    if (!session?.user.id) return;
    setUploadingHeader(true);
    const url = await pickAndUploadImage('headers', session.user.id);
    if (url) {
      await supabase.from('profiles').update({ header_url: url }).eq('id', session.user.id);
      refreshProfile?.();
    }
    setUploadingHeader(false);
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={COLORS.gold} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <PageContainer>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.inner}>

          {/* ── Header banner ── */}
          <TouchableOpacity onPress={handleHeaderUpload} activeOpacity={0.85} style={styles.headerBanner}>
            {profile.header_url
              ? <Image source={{ uri: profile.header_url }} style={styles.headerImg} resizeMode="cover" />
              : <LinearGradient colors={['#1A0A00', '#0A0A0A']} style={styles.headerPlaceholder} />
            }
            <View style={styles.headerOverlay}>
              {uploadingHeader
                ? <ActivityIndicator color="#fff" />
                : <View style={styles.headerEditHint}><Ionicons name="camera-outline" size={16} color="rgba(255,255,255,0.7)" /><Text style={styles.headerEditText}>Edit cover</Text></View>
              }
            </View>
            {/* Top row: settings */}
            <View style={styles.topBar}>
              <TouchableOpacity onPress={() => router.push('/settings' as any)} style={styles.topBarBtn}>
                <Ionicons name="settings-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>

          {/* ── Avatar row ── */}
          <View style={styles.avatarRow}>
            <TouchableOpacity onPress={handleAvatarUpload} activeOpacity={0.85} style={[styles.avatarWrap, { borderColor: tier.color }]}>
              {uploadingAvatar
                ? <ActivityIndicator color={tier.color} />
                : profile.avatar_url
                  ? <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
                  : <Text style={styles.avatarInitial}>{profile.username.charAt(0).toUpperCase()}</Text>
              }
              <View style={styles.avatarCameraBtn}>
                <Ionicons name="camera" size={12} color="#fff" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.editProfileBtn}
              onPress={() => router.push('/edit-profile' as any)}
            >
              <Text style={styles.editProfileText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>

          {/* ── Name + bio ── */}
          <View style={styles.bioSection}>
            <View style={styles.nameRow}>
              <Text style={styles.username}>@{profile.username}</Text>
              {profile.is_verified && (
                <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓</Text></View>
              )}
              <View style={[styles.tierPill, { borderColor: tier.color }]}>
                <Text style={styles.tierEmoji}>{tier.emoji}</Text>
                <Text style={[styles.tierLabel, { color: tier.color }]}>{tier.label}</Text>
              </View>
            </View>

            {profile.bio ? <Text style={styles.bioText}>{profile.bio}</Text> : null}

            {(profile as any).x_handle ? (
              <TouchableOpacity onPress={() => { if (typeof window !== 'undefined') window.open(`https://x.com/${(profile as any).x_handle}`, '_blank'); }}>
                <View style={styles.metaRow}>
                  <Ionicons name="logo-twitter" size={14} color="#1DA1F2" />
                  <Text style={[styles.metaLink, { color: '#1DA1F2' }]}>@{(profile as any).x_handle}</Text>
                </View>
              </TouchableOpacity>
            ) : null}

            {profile.website ? (
              <TouchableOpacity onPress={() => { const u = profile.website!.startsWith('http') ? profile.website! : `https://${profile.website}`; if (typeof window !== 'undefined') window.open(u, '_blank'); }}>
                <View style={styles.metaRow}>
                  <Ionicons name="link-outline" size={14} color={COLORS.gold} />
                  <Text style={styles.metaLink}>{profile.website}</Text>
                </View>
              </TouchableOpacity>
            ) : null}

            <View style={styles.metaRowGroup}>
              {profile.country ? (
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={14} color={COLORS.muted} />
                  <Text style={styles.metaText}>{profile.country}</Text>
                </View>
              ) : null}
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={14} color={COLORS.muted} />
                <Text style={styles.metaText}>Joined {joinedDate(profile.created_at)}</Text>
              </View>
            </View>

            {!profile.is_verified && (
              <TouchableOpacity style={styles.verifyHint} onPress={() => router.push('/verify' as any)}>
                <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.gold} />
                <Text style={styles.verifyHintText}>Get Verified to unlock the full leaderboard →</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Size card ── */}
          <LinearGradient colors={['#1A1200', '#111111', '#0A0A0A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sizeCard}>
            <LinearGradient colors={['rgba(232,80,10,0.21)', 'rgba(201,168,76,0.09)', 'rgba(191,90,242,0.06)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sizeCardInner}>
              <View style={styles.sizeCardTop}>
                <Text style={styles.sizeCardLabel}>YOUR SIZE</Text>
                <TouchableOpacity onPress={() => setShowSize(!showSize)}>
                  <Ionicons name={showSize ? 'eye-outline' : 'eye-off-outline'} size={18} color={COLORS.muted} />
                </TouchableOpacity>
              </View>
              {showSize
                ? <>
                    <LinearGradient colors={['#FF6B2B', '#E8500A', '#C9A84C', '#BF5AF2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sizeDisplayGrad}>
                      <Text style={styles.sizeDisplay}>{size.toFixed(1)}"</Text>
                    </LinearGradient>
                    {profile?.girth_inches ? (
                      <Text style={styles.girthLabel}>{profile.girth_inches.toFixed(1)}" girth</Text>
                    ) : null}
                  </>
                : <Text style={styles.sizeDisplayHidden}>••••</Text>
              }
            </LinearGradient>
          </LinearGradient>

          {/* ── Stats grid ── */}
          <View style={styles.statsGrid}>
            {[
              { val: rank ? `#${rank.toLocaleString()}` : '—', lbl: 'Global Rank' },
              { val: percentileVal !== null ? `${percentileVal}th` : '—', lbl: 'Percentile' },
              { val: size >= WORLD_AVERAGE ? `+${(size - WORLD_AVERAGE).toFixed(1)}"` : `-${(WORLD_AVERAGE - size).toFixed(1)}"`, lbl: 'vs Avg' },
              { val: String(postCount), lbl: 'Posts' },
            ].map((s, i) => (
              <View key={i} style={[styles.statCell, i % 2 !== 0 && styles.statCellBorder, i >= 2 && styles.statCellTop]}>
                <Text style={styles.statVal}>{s.val}</Text>
                <Text style={styles.statLbl}>{s.lbl}</Text>
              </View>
            ))}
          </View>

          {/* ── Tab bar: Posts / Compare ── */}
          <View style={styles.tabBar}>
            {(['posts', 'compare'] as ProfileTab[]).map(tab => (
              <TouchableOpacity key={tab} style={styles.tabBtn} onPress={() => setActiveTab(tab)}>
                <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>
                  {tab === 'posts' ? 'Posts' : 'Compare'}
                </Text>
                {activeTab === tab && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Posts ── */}
          {activeTab === 'posts' && (
            postsLoading
              ? <ActivityIndicator style={{ marginTop: 32 }} color={COLORS.gold} />
              : userPosts.length === 0
                ? <View style={styles.tabEmpty}><Ionicons name="document-text-outline" size={36} color={COLORS.muted} /><Text style={styles.tabEmptyText}>No posts yet</Text></View>
                : <View style={styles.postList}>{userPosts.map(p => <PostItem key={p.id} post={p} />)}</View>
          )}

          {/* ── Compare ── */}
          {activeTab === 'compare' && (
            <View style={styles.compareSection}>
              <Text style={styles.compareTitle}>SIZE COMPARISON</Text>

              {/* Search */}
              <View style={styles.searchWrap}>
                <Ionicons name="search-outline" size={16} color={COLORS.muted} style={{ marginLeft: 12 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search a username to compare..."
                  placeholderTextColor={COLORS.muted}
                  value={search}
                  onChangeText={setSearch}
                  autoCapitalize="none"
                />
                {searching && <ActivityIndicator size="small" color={COLORS.gold} style={{ marginRight: 12 }} />}
              </View>

              {searchResults.length > 0 && (
                <View style={styles.searchResults}>
                  {searchResults.map(u => (
                    <TouchableOpacity key={u.id} style={styles.searchRow} onPress={() => { setCompareTarget(u); setSearch(''); setSearchResults([]); }}>
                      <View style={styles.searchRowLeft}>
                        <Text style={styles.searchUsername}>@{u.username}</Text>
                        {u.is_verified && <View style={styles.verifiedDot}><Text style={styles.verifiedDotText}>✓</Text></View>}
                      </View>
                      <Text style={[styles.searchSize, { color: getSizeTier(u.size_inches).color }]}>{u.size_inches.toFixed(1)}"</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Bars */}
              <View style={styles.barsSection}>
                <SizeBar size={size} maxSize={maxSize} label="You" color={myTier.color} isYou />
                {compareTarget && targetTier && (
                  <SizeBar size={compareTarget.size_inches} maxSize={maxSize} label={`@${compareTarget.username}`} color={targetTier.color} isYou={false} />
                )}
                <SizeBar size={WORLD_AVERAGE} maxSize={maxSize} label="World Avg" color={COLORS.muted} isYou={false} />
              </View>

              {compareTarget && (
                <View style={styles.compareResult}>
                  <Text style={styles.compareResultText}>
                    {size > compareTarget.size_inches
                      ? `You're ${(size - compareTarget.size_inches).toFixed(1)}" larger than @${compareTarget.username}`
                      : size < compareTarget.size_inches
                        ? `@${compareTarget.username} is ${(compareTarget.size_inches - size).toFixed(1)}" larger than you`
                        : `You and @${compareTarget.username} are the same size`
                    }
                  </Text>
                  <TouchableOpacity onPress={() => setCompareTarget(null)}>
                    <Text style={styles.clearCompare}>Clear</Text>
                  </TouchableOpacity>
                </View>
              )}

              {percentile !== null && (
                <View style={styles.percentileCard}>
                  <Text style={styles.percentileLabel}>YOUR PERCENTILE</Text>
                  <Text style={styles.percentileVal}>{percentile}th</Text>
                  <Text style={styles.percentileSub}>Larger than {percentile}% of SIZE users</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Invite friends ── */}
          <TouchableOpacity style={styles.inviteBtn} onPress={handleShare}>
            <Ionicons name="person-add-outline" size={18} color={COLORS.gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.inviteBtnLabel}>Invite Friends</Text>
              <Text style={styles.inviteBtnSub}>Share your invite link & earn 250 $SIZE coins</Text>
            </View>
            <Ionicons name="share-outline" size={18} color={COLORS.gold} />
          </TouchableOpacity>

          {/* ── Admin ── */}
          {(profile as any).is_admin && (
            <TouchableOpacity style={styles.adminBtn} onPress={() => router.push('/admin' as any)}>
              <Ionicons name="shield-outline" size={18} color={COLORS.purple} />
              <Text style={styles.adminText}>Verify Queue</Text>
            </TouchableOpacity>
          )}

          {/* ── Sign out ── */}
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} disabled={signingOut}>
            {signingOut
              ? <ActivityIndicator size="small" color={COLORS.red} />
              : <><Ionicons name="log-out-outline" size={18} color={COLORS.red} /><Text style={styles.signOutText}>Sign Out</Text></>
            }
          </TouchableOpacity>

        </ScrollView>
      </PageContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  inner: { paddingBottom: 100 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header banner
  headerBanner: { height: 140, position: 'relative', overflow: 'hidden' },
  headerImg: { width: '100%', height: '100%' },
  headerPlaceholder: { width: '100%', height: '100%' },
  headerOverlay: { position: 'absolute', bottom: 8, right: 12 },
  headerEditHint: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 5 },
  headerEditText: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600' },
  topBar: { position: 'absolute', top: 12, right: 14, flexDirection: 'row', gap: 10 },
  topBarBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },

  // Avatar
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: -36, marginBottom: 12 },
  avatarWrap: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  avatarImg: { width: 80, height: 80, borderRadius: 40 },
  avatarInitial: { color: COLORS.white, fontSize: SIZES.xxxl, fontWeight: '900' },
  avatarCameraBtn: { position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.bg },
  editProfileBtn: { borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: RADIUS.full, paddingHorizontal: 18, paddingVertical: 8 },
  editProfileText: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.sm },

  // Bio section
  bioSection: { paddingHorizontal: 16, marginBottom: 16, gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  username: { color: COLORS.white, fontSize: SIZES.xl, fontWeight: '900' },
  verifiedBadge: { backgroundColor: COLORS.gold, borderRadius: RADIUS.full, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  verifiedText: { color: COLORS.bg, fontSize: 11, fontWeight: '900' },
  tierPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 3 },
  tierEmoji: { fontSize: 12 },
  tierLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  bioText: { color: COLORS.offWhite, fontSize: SIZES.md, lineHeight: 22 },
  metaRowGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: COLORS.muted, fontSize: SIZES.sm },
  metaLink: { color: COLORS.gold, fontSize: SIZES.sm, fontWeight: '600' },
  verifyHint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  verifyHintText: { color: COLORS.gold, fontSize: SIZES.xs, fontWeight: '600' },

  // Size card
  sizeCard: { marginHorizontal: 16, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: 'rgba(232,80,10,0.3)', overflow: 'hidden', marginBottom: 16 },
  sizeCardInner: { padding: 20, alignItems: 'center', gap: 10 },
  sizeCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  sizeCardLabel: { color: COLORS.gold, fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', fontWeight: '800' },
  sizeDisplayGrad: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center' },
  sizeDisplay: { fontSize: 52, fontWeight: '900', lineHeight: 60, color: COLORS.white },
  sizeDisplayHidden: { fontSize: 52, fontWeight: '900', lineHeight: 60, color: COLORS.mutedDark },
  girthLabel: { color: COLORS.muted, fontSize: SIZES.sm, marginTop: 6, letterSpacing: 1 },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 16, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, marginBottom: 16, overflow: 'hidden' },
  statCell: { width: '50%', padding: 16, alignItems: 'center' },
  statCellBorder: { borderLeftWidth: 1, borderLeftColor: COLORS.cardBorder },
  statCellTop: { borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  statVal: { color: COLORS.gold, fontSize: SIZES.xl, fontWeight: '900' },
  statLbl: { color: COLORS.muted, fontSize: SIZES.xs, marginTop: 2, letterSpacing: 0.5 },

  // Tabs
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder, marginBottom: 4 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, position: 'relative' },
  tabBtnText: { fontSize: SIZES.md, fontWeight: '700', color: COLORS.muted },
  tabBtnTextActive: { color: COLORS.white },
  tabUnderline: { position: 'absolute', bottom: 0, left: '15%', right: '15%', height: 2, backgroundColor: COLORS.gold, borderRadius: 2 },
  tabEmpty: { paddingVertical: 48, alignItems: 'center', gap: 10 },
  tabEmptyText: { color: COLORS.muted, fontSize: SIZES.md },

  // Posts
  postList: { gap: 1 },
  postItem: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder, gap: 8 },
  postItemTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  postTagChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full, borderWidth: 1 },
  postTagText: { fontSize: 10, fontWeight: '800' },
  postItemTime: { color: COLORS.muted, fontSize: SIZES.xs, marginLeft: 'auto' },
  postItemContent: { color: COLORS.offWhite, fontSize: SIZES.md, lineHeight: 20 },
  postItemFooter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  postItemStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postItemStatText: { color: COLORS.muted, fontSize: SIZES.xs },

  // Compare
  compareSection: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  compareTitle: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder },
  searchInput: { flex: 1, color: COLORS.white, fontSize: SIZES.md, paddingVertical: 12, paddingHorizontal: 10 },
  searchResults: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden' },
  searchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  searchRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchUsername: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.md },
  searchSize: { fontWeight: '800', fontSize: SIZES.md },
  verifiedDot: { backgroundColor: COLORS.gold, borderRadius: RADIUS.full, width: 15, height: 15, alignItems: 'center', justifyContent: 'center' },
  verifiedDotText: { color: COLORS.bg, fontSize: 9, fontWeight: '900' },
  barsSection: { gap: 14, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 16 },
  barWrap: { gap: 6 },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { color: COLORS.muted, fontSize: SIZES.sm, fontWeight: '600' },
  barSize: { fontSize: SIZES.sm, fontWeight: '800' },
  barTrack: { height: 8, backgroundColor: COLORS.cardBorder, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  compareResult: { backgroundColor: `${COLORS.gold}10`, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: `${COLORS.gold}30`, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  compareResultText: { color: COLORS.white, fontSize: SIZES.sm, flex: 1, lineHeight: 20 },
  clearCompare: { color: COLORS.muted, fontSize: SIZES.sm, fontWeight: '700' },
  percentileCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 20, alignItems: 'center', gap: 6 },
  percentileLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '800', letterSpacing: 2 },
  percentileVal: { color: COLORS.gold, fontSize: 48, fontWeight: '900', lineHeight: 54 },
  percentileSub: { color: COLORS.muted, fontSize: SIZES.sm },

  // Invite
  inviteBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 16, marginTop: 20, paddingVertical: 16, paddingHorizontal: 18, backgroundColor: `${COLORS.gold}10`, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: `${COLORS.gold}40`, marginBottom: 10 },
  inviteBtnLabel: { color: COLORS.gold, fontWeight: '800', fontSize: SIZES.md },
  inviteBtnSub: { color: COLORS.muted, fontSize: SIZES.xs, marginTop: 2 },

  // Admin / Sign out
  adminBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, paddingVertical: 16, backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: `${COLORS.purple}40`, marginBottom: 10 },
  adminText: { color: COLORS.purple, fontWeight: '700', fontSize: SIZES.md },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, paddingVertical: 16, backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: `${COLORS.red}40` },
  signOutText: { color: COLORS.red, fontWeight: '700', fontSize: SIZES.md },
});
