import { useEffect, useState, useCallback, useRef } from 'react';
import { socketManager } from '@/lib/socket';
import type { User, Message, Warning, Ban, DirectMessage, DirectConversation } from '@/types/chat';

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<string[]>([]);
  const [currentRoom, setCurrentRoom] = useState('General');
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [directConversations, setDirectConversations] = useState<DirectConversation[]>([]);
  // key = otherEmail, value = array of DM messages
  const [directMessages, setDirectMessages] = useState<Record<string, DirectMessage[]>>({});
  const [currentDirectChat, setCurrentDirectChat] = useState<string | null>(null);
  // Ref to access current user email inside socket handlers without stale closures
  const userEmailRef = useRef<string | null>(null);

  const loadDirectConversations = useCallback(async () => {
    const response = await socketManager.getDirectConversations();
    if (response.ok && response.conversations) {
      setDirectConversations(response.conversations);
    }
  }, []);

  useEffect(() => {
    const socket = socketManager.connect();

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    const handleMessage = (data: { room: string; msg: Message }) => {
      setMessages(prev => ({
        ...prev,
        [data.room]: [...(prev[data.room] || []), data.msg]
      }));
    };

    const handleRooms = (roomList: string[]) => setRooms(roomList);

    // Incoming real-time DM from another user (or our own message on another tab)
    const handleDirectMessage = (msg: DirectMessage) => {
      // Figure out which conversation this belongs to
      const myEmail = userEmailRef.current;
      const otherEmail = msg.fromEmail === myEmail ? msg.toEmail : msg.fromEmail;
      setDirectMessages(prevMsgs => {
        const existing = prevMsgs[otherEmail] || [];
        if (existing.some(m => m.id === msg.id)) return prevMsgs;
        return { ...prevMsgs, [otherEmail]: [...existing, msg] };
      });
      // Refresh conversation list to update last message + unread badge
      loadDirectConversations();
    };

    socketManager.onConnect(handleConnect);
    socketManager.onDisconnect(handleDisconnect);
    socketManager.onMessage(handleMessage);
    socketManager.onRooms(handleRooms);
    socketManager.onDirectMessage(handleDirectMessage);

    return () => {
      socketManager.off('connect', handleConnect);
      socketManager.off('disconnect', handleDisconnect);
      socketManager.off('message', handleMessage);
      socketManager.off('rooms', handleRooms);
      socketManager.off('directMessage', handleDirectMessage);
    };
  }, [loadDirectConversations]);

  const join = async (email: string, password: string, username?: string) => {
    const response = await socketManager.join(email, password, username);
    if (response.ok && response.user) {
      setUser(response.user);
      userEmailRef.current = response.user.email;
      if (response.rooms) setRooms(response.rooms);
      console.log('✅ User authenticated and loaded:', response.user);
    }
    return response;
  };

  const updateUser = (updatedUser: User) => setUser(updatedUser);

  const sendMessage = async (text: string, replyTo?: any) => {
    return socketManager.sendMessage(currentRoom, text, replyTo);
  };

  const switchRoom = async (room: string) => {
    setCurrentRoom(room);
    if (!messages[room]) {
      const response = await socketManager.getMessages(room);
      if (response.ok && response.messages) {
        setMessages(prev => ({ ...prev, [room]: response.messages || [] }));
      }
    }
  };

  const createRoom = async (roomName: string) => socketManager.createRoom(roomName);

  // Open a DM conversation with someone by their email
  const startDirectChat = async (otherEmail: string) => {
    setCurrentDirectChat(otherEmail);
    setCurrentRoom('');

    // Mark as read
    socketManager.markDMRead(otherEmail);
    setDirectConversations(prev =>
      prev.map(c => c.userId === otherEmail ? { ...c, unread: 0 } : c)
    );

    // Load messages if not already loaded
    if (!directMessages[otherEmail]) {
      const response = await socketManager.getDirectMessages(otherEmail);
      if (response.ok && (response as any).messages) {
        setDirectMessages(prev => ({ ...prev, [otherEmail]: (response as any).messages as DirectMessage[] }));
      }
    }
  };

  // Start DM by searching username - returns target user's email
  const startDMByUsername = async (username: string) => {
    const response = await socketManager.startDMByUsername(username);
    if (response.ok && response.data?.user?.email) {
      const targetEmail = response.data.user.email;
      const targetUsername = response.data.user.username;

      // Create conversation entry if it doesn't exist yet
      setDirectConversations(prev => {
        if (prev.find(c => c.userId === targetEmail)) return prev;
        return [{ userId: targetEmail, username: targetUsername, lastMessage: '', timestamp: new Date(0), unread: 0 }, ...prev];
      });

      // Also register in dmMessages so messages load
      setDirectMessages(prev => prev[targetEmail] ? prev : { ...prev, [targetEmail]: [] });

      await startDirectChat(targetEmail);
    } else {
      throw new Error((response as any).message || 'No user found with that username');
    }
  };

  const sendDirectMessage = async (text: string, toEmail: string) => {
    const response = await socketManager.sendDirectMessage(toEmail, text);
    if (response.ok && (response as any).message) {
      const msg: DirectMessage = (response as any).message;
      setDirectMessages(prev => ({
        ...prev,
        [toEmail]: [...(prev[toEmail] || []), msg]
      }));
      // Update conversation last message
      setDirectConversations(prev =>
        prev.map(c => c.userId === toEmail
          ? { ...c, lastMessage: msg.text, timestamp: new Date(msg.ts) }
          : c
        )
      );
    }
    return response;
  };

  const switchToRoom = (room: string) => {
    setCurrentDirectChat(null);
    switchRoom(room);
  };

  // Build the unified message list for the current view
  const getUnifiedMessages = (): any[] => {
    if (currentDirectChat) {
      const dms = directMessages[currentDirectChat] || [];
      return dms.map(dm => ({
        id: dm.id,
        display: dm.fromUsername,
        text: dm.text,
        email: dm.fromEmail,
        role: 'user',
        ts: dm.ts,
        isDirect: true,
      }));
    }
    return messages[currentRoom] || [];
  };

  return {
    connected,
    user,
    rooms,
    currentRoom,
    messages: getUnifiedMessages(),
    directConversations,
    currentDirectChat,
    join,
    sendMessage: currentDirectChat
      ? (text: string, _replyTo?: any) => sendDirectMessage(text, currentDirectChat)
      : sendMessage,
    switchRoom: switchToRoom,
    createRoom,
    updateUser,
    loadDirectConversations,
    startDirectChat,
    startDMByUsername,
    sendDirectMessage,
    socketManager
  };
}
