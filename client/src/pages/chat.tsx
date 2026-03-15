import { useState } from 'react';
import { AuthModal } from '@/components/AuthModal';
import { ChatInterface } from '@/components/ChatInterface';
import { useSocket } from '@/hooks/useSocket';
import type { Message } from '@/types/chat';

export default function Chat() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const {
    connected,
    user,
    rooms,
    currentRoom,
    messages,
    directConversations,
    currentDirectChat,
    timedOut,
    join,
    sendMessage,
    switchRoom,
    createRoom,
    updateUser,
    loadDirectConversations,
    startDirectChat,
    startDMByUsername,
    socketManager
  } = useSocket();

  const handleAuth = async (email: string, password: string, username?: string) => {
    const response = await join(email, password, username);
    if (response.ok) {
      setIsAuthenticated(true);
    } else {
      const reason = (response as any).reason;
      if (reason === 'invalid-password') throw new Error('Incorrect password');
      if (reason === 'password-required') throw new Error('Password is required to create an account');
      if (reason === 'username-mismatch') throw new Error((response as any).message || 'Incorrect username for this email');
      if (reason === 'username-taken') throw new Error((response as any).message || 'That username is already taken');
      if (reason === 'banned') throw new Error('Your account has been banned');
      throw new Error('Authentication failed');
    }
  };

  const handleSendMessage = async (text: string, replyTo?: Message) => {
    await sendMessage(text, replyTo);
  };

  const handleCreateRoom = async (name: string) => {
    const response = await createRoom(name);
    if (!response.ok) throw new Error((response as any).err || 'Failed to create room');
  };

  if (!isAuthenticated) {
    return <AuthModal onAuth={handleAuth} connected={connected} />;
  }

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ChatInterface
      user={user}
      rooms={rooms}
      currentRoom={currentRoom}
      messages={messages}
      connected={connected}
      onRoomSwitch={switchRoom}
      onSendMessage={handleSendMessage}
      onCreateRoom={handleCreateRoom}
      onUpdateUser={updateUser}
      directConversations={directConversations}
      currentDirectChat={currentDirectChat}
      onLoadDirectConversations={loadDirectConversations}
      onStartDirectChat={startDirectChat}
      onStartDMByUsername={startDMByUsername}
      socketManager={socketManager}
      timedOut={timedOut}
    />
  );
}
