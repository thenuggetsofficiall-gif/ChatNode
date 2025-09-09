import { useEffect, useState } from 'react';
import { socketManager } from '@/lib/socket';
import type { User, Message, Warning, Ban, DirectMessage, DirectConversation } from '@/types/chat';

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<string[]>([]);
  const [currentRoom, setCurrentRoom] = useState('General');
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [directConversations, setDirectConversations] = useState<DirectConversation[]>([]);
  const [directMessages, setDirectMessages] = useState<Record<string, DirectMessage[]>>({});
  const [currentDirectChat, setCurrentDirectChat] = useState<string | null>(null);

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

    const handleRooms = (roomList: string[]) => {
      setRooms(roomList);
    };

    const handleDirectMessage = (message: DirectMessage) => {
      setDirectMessages(prev => {
        // We'll use the conversation partner's userId as the key
        const conversationId = message.fromUser?.id || message.toUser?.id || message.fromUserId;
        return {
          ...prev,
          [conversationId]: [...(prev[conversationId] || []), message]
        };
      });
      
      // Refresh conversations to show the new message
      if (user) {
        loadDirectConversations();
      }
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
  }, [user]);

  const join = async (email: string, password: string, username?: string) => {
    const response = await socketManager.join(email, password, username);
    if (response.ok && response.user) {
      setUser(response.user);
      if (response.rooms) {
        setRooms(response.rooms);
      }
      console.log('✅ User authenticated and loaded:', response.user);
    }
    return response;
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const sendMessage = async (text: string) => {
    return socketManager.sendMessage(currentRoom, text);
  };

  const switchRoom = async (room: string) => {
    setCurrentRoom(room);
    if (!messages[room]) {
      const response = await socketManager.getMessages(room);
      if (response.ok && response.messages) {
        setMessages(prev => ({
          ...prev,
          [room]: response.messages || []
        }));
      }
    }
  };

  const createRoom = async (roomName: string) => {
    return socketManager.createRoom(roomName);
  };

  const loadDirectConversations = async () => {
    if (!user) return;
    const response = await socketManager.getDirectConversations();
    if (response.ok && response.conversations) {
      setDirectConversations(response.conversations);
    }
  };

  const startDirectChat = async (otherUserId: string) => {
    setCurrentDirectChat(otherUserId);
    setCurrentRoom(''); // Clear current room when switching to DM
    
    if (!directMessages[otherUserId]) {
      const response = await socketManager.getDirectMessages(otherUserId);
      if (response.ok && response.data && response.data.messages) {
        setDirectMessages(prev => ({
          ...prev,
          [otherUserId]: response.data!.messages || []
        }));
      }
    }
  };

  const sendDirectMessage = async (text: string, toUserId: string) => {
    return socketManager.sendDirectMessage(toUserId, text);
  };

  const switchToRoom = (room: string) => {
    setCurrentDirectChat(null); // Clear direct chat when switching to room
    switchRoom(room);
  };

  return {
    connected,
    user,
    rooms,
    currentRoom,
    messages: currentDirectChat ? directMessages[currentDirectChat] || [] : messages[currentRoom] || [],
    directConversations,
    currentDirectChat,
    join,
    sendMessage: currentDirectChat ? 
      (text: string) => sendDirectMessage(text, currentDirectChat) : 
      sendMessage,
    switchRoom: switchToRoom,
    createRoom,
    updateUser,
    loadDirectConversations,
    startDirectChat,
    sendDirectMessage,
    socketManager
  };
}
