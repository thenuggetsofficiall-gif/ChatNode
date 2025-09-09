import { useState, useEffect } from 'react';
import { AuthModal } from '@/components/AuthModal';
import { ChatInterface } from '@/components/ChatInterface';
import { useSocket } from '@/hooks/useSocket';
import { useToast } from '@/hooks/use-toast';

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
    join, 
    sendMessage, 
    switchRoom, 
    createRoom,
    updateUser,
    loadDirectConversations,
    startDirectChat,
    socketManager 
  } = useSocket();
  const { toast } = useToast();

  const handleAuth = async (email: string, password: string, username?: string) => {
    try {
      const response = await join(email, password, username);
      if (response.ok) {
        setIsAuthenticated(true);
        toast({
          title: "Welcome to MiniChat!",
          description: `Logged in as ${response.user?.username}`
        });
      } else {
        let errorMessage = 'Authentication failed';
        if (response.reason === 'invalid-password') {
          errorMessage = 'Incorrect password';
        } else if (response.reason === 'password-required') {
          errorMessage = 'Password is required for new accounts';
        } else if (response.reason === 'invalid-owner-password') {
          errorMessage = 'Incorrect owner password';
        }
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      if (error.reason === 'banned') {
        throw new Error('Your account has been banned from this chat.');
      }
      throw error;
    }
  };

  const handleSendMessage = async (text: string) => {
    const response = await sendMessage(text);
    if (!response.ok) {
      throw new Error(response.err || 'Failed to send message');
    }
  };

  const handleCreateRoom = async (name: string) => {
    const response = await createRoom(name);
    if (!response.ok) {
      throw new Error(response.err || 'Failed to create room');
    }
  };

  if (!isAuthenticated) {
    return (
      <AuthModal 
        onAuth={handleAuth} 
        connected={connected}
      />
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
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
      socketManager={socketManager}
    />
  );
}
