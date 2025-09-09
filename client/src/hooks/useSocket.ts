import { useEffect, useState } from 'react';
import { socketManager } from '@/lib/socket';
import type { User, Message, Warning, Ban } from '@/types/chat';

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<string[]>([]);
  const [currentRoom, setCurrentRoom] = useState('General');
  const [messages, setMessages] = useState<Record<string, Message[]>>({});

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

    socketManager.onConnect(handleConnect);
    socketManager.onDisconnect(handleDisconnect);
    socketManager.onMessage(handleMessage);
    socketManager.onRooms(handleRooms);

    return () => {
      socketManager.off('connect', handleConnect);
      socketManager.off('disconnect', handleDisconnect);
      socketManager.off('message', handleMessage);
      socketManager.off('rooms', handleRooms);
    };
  }, []);

  const join = async (email: string, password: string, username?: string) => {
    const response = await socketManager.join(email, password, username);
    if (response.ok && response.user) {
      setUser(response.user);
      if (response.rooms) {
        setRooms(response.rooms);
      }
    }
    return response;
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

  return {
    connected,
    user,
    rooms,
    currentRoom,
    messages: messages[currentRoom] || [],
    join,
    sendMessage,
    switchRoom,
    createRoom,
    socketManager
  };
}
