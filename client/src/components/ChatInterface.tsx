import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Hash, Users, Search, Send, Smile } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { MessageList } from './MessageList';
import { AdminModals } from './AdminModals';
import { useToast } from '@/hooks/use-toast';
import type { User, Message, MessageLog, Ban, Warning } from '@/types/chat';

interface ChatInterfaceProps {
  user: User;
  rooms: string[];
  currentRoom: string;
  messages: Message[];
  connected: boolean;
  onRoomSwitch: (room: string) => void;
  onSendMessage: (text: string) => Promise<void>;
  onCreateRoom: (name: string) => Promise<void>;
  socketManager: any;
}

export function ChatInterface({
  user,
  rooms,
  currentRoom,
  messages,
  connected,
  onRoomSwitch,
  onSendMessage,
  onCreateRoom,
  socketManager
}: ChatInterfaceProps) {
  const [messageText, setMessageText] = useState('');
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [showBans, setShowBans] = useState(false);
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [bans, setBans] = useState<Record<string, Ban>>({});
  const [warning, setWarning] = useState<Warning | null>(null);
  const [banned, setBanned] = useState<Ban | null>(null);
  const { toast } = useToast();

  // Socket event handlers
  useState(() => {
    if (socketManager) {
      socketManager.onWarning((w: Warning) => setWarning(w));
      socketManager.onBanned((b: Ban) => setBanned(b));
    }
  });

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    try {
      await onSendMessage(messageText.trim());
      setMessageText('');
    } catch (error: any) {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;

    try {
      await onCreateRoom(roomName.trim());
      setRoomName('');
      setShowCreateRoom(false);
      toast({
        title: "Room Created",
        description: `Room "${roomName}" has been created`
      });
    } catch (error: any) {
      toast({
        title: "Failed to create room",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleOpenLogs = async () => {
    try {
      const response = await socketManager.getLogs();
      if (response.ok) {
        setLogs(response.logs || []);
        setShowLogs(true);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load logs",
        variant: "destructive"
      });
    }
  };

  const handleOpenBans = async () => {
    try {
      const response = await socketManager.getBans();
      if (response.ok) {
        setBans(response.bans || {});
        setShowBans(true);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load bans",
        variant: "destructive"
      });
    }
  };

  const handleWarnUser = async (email: string, reason: string) => {
    await socketManager.warnUser(email, reason);
  };

  const handleBanUser = async (email: string, reason: string) => {
    await socketManager.banUser(email, reason);
  };

  const handleUnbanUser = async (email: string) => {
    try {
      await socketManager.unbanUser(email);
      // Refresh bans list
      const response = await socketManager.getBans();
      if (response.ok) {
        setBans(response.bans || {});
      }
      toast({
        title: "User Unbanned",
        description: `${email} has been unbanned`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to unban user",
        variant: "destructive"
      });
    }
  };

  const handleAckWarning = async () => {
    try {
      await socketManager.ackWarning();
      setWarning(null);
      toast({
        title: "Warning Acknowledged",
        description: "You can now continue chatting"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to acknowledge warning",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="w-full h-full flex" data-testid="chat-interface">
      <Sidebar
        user={user}
        rooms={rooms}
        currentRoom={currentRoom}
        onRoomSwitch={onRoomSwitch}
        onCreateRoom={() => setShowCreateRoom(true)}
        onOpenLogs={handleOpenLogs}
        onOpenBans={handleOpenBans}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="p-4 border-b border-border bg-card/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Hash className="text-muted-foreground h-5 w-5" />
              <h2 className="text-lg font-semibold" data-testid="text-current-room">
                {currentRoom}
              </h2>
              <span className="text-sm text-muted-foreground">
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm">
                <Users className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <MessageList messages={messages} currentUserEmail={user.email} />

        {/* Message Input */}
        <div className="p-4 border-t border-border bg-card/50">
          <form onSubmit={handleSendMessage} className="flex space-x-3">
            <div className="flex-1 relative">
              <Input
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type a message..."
                className="pr-12"
                maxLength={1000}
                disabled={!connected}
                data-testid="input-message"
              />
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <Smile className="h-4 w-4" />
              </Button>
            </div>
            <Button 
              type="submit" 
              disabled={!messageText.trim() || !connected}
              data-testid="button-send-message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* Create Room Modal */}
      <Dialog open={showCreateRoom} onOpenChange={setShowCreateRoom}>
        <DialogContent data-testid="modal-create-room">
          <DialogHeader>
            <DialogTitle>Create New Room</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateRoom}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="roomName">Room Name</Label>
                <Input
                  id="roomName"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="awesome-room"
                  className="mt-2"
                  data-testid="input-room-name"
                />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowCreateRoom(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={!roomName.trim()}
                data-testid="button-create-room-submit"
              >
                Create Room
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Admin Modals */}
      <AdminModals
        logs={logs}
        bans={bans}
        showLogs={showLogs}
        showBans={showBans}
        showWarning={warning}
        showBanned={banned}
        onCloseLogs={() => setShowLogs(false)}
        onCloseBans={() => setShowBans(false)}
        onCloseWarning={() => setWarning(null)}
        onCloseBanned={() => setBanned(null)}
        onWarnUser={handleWarnUser}
        onBanUser={handleBanUser}
        onUnbanUser={handleUnbanUser}
        onAckWarning={handleAckWarning}
      />
    </div>
  );
}
