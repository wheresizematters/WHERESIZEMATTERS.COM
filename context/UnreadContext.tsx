import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchConversations } from '@/lib/api';
import { useAuth } from './AuthContext';
import { supabase, SUPABASE_READY } from '@/lib/supabase';
import { Conversation } from '@/lib/types';

interface UnreadContextType {
  hasUnread: boolean;
  unreadIds: string[];
  refresh: () => void;
  markRead: (conversationId: string) => void;
}

const UnreadContext = createContext<UnreadContextType>({
  hasUnread: false,
  unreadIds: [],
  refresh: () => {},
  markRead: () => {},
});

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const myId = session?.user.id ?? '';
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const load = useCallback(async () => {
    if (!myId) return;
    const data = await fetchConversations(myId);
    setConversations(data);
  }, [myId]);

  useEffect(() => { load(); }, [load]);

  // Refresh when conversations are created or updated (new messages)
  useEffect(() => {
    if (!SUPABASE_READY || !myId) return;
    const channel = supabase
      .channel('unread-tracker')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [myId, load]);

  const unreadIds = conversations
    .filter(conv => {
      const isUser1 = conv.user_1_id === myId;
      const myLastRead = isUser1 ? conv.user_1_last_read : conv.user_2_last_read;
      if (!myLastRead) return !!conv.last_message_preview; // never opened but has messages
      return new Date(conv.last_message_at) > new Date(myLastRead);
    })
    .map(c => c.id);

  // Optimistically mark a conversation as read in local state immediately
  function markRead(conversationId: string) {
    const now = new Date().toISOString();
    setConversations(prev =>
      prev.map(c => {
        if (c.id !== conversationId) return c;
        return {
          ...c,
          user_1_last_read: c.user_1_id === myId ? now : c.user_1_last_read,
          user_2_last_read: c.user_2_id === myId ? now : c.user_2_last_read,
        };
      })
    );
  }

  return (
    <UnreadContext.Provider value={{ hasUnread: unreadIds.length > 0, unreadIds, refresh: load, markRead }}>
      {children}
    </UnreadContext.Provider>
  );
}

export const useUnread = () => useContext(UnreadContext);
