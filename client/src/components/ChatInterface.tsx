import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Hash, MessageCircle, Send, Smile, X, Reply } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { MessageList } from './MessageList';
import { AdminModals } from './AdminModals';
import { SettingsModal } from './SettingsModal';
import { BroadcastModal } from './BroadcastModal';
import { PasswordModal } from './PasswordModal';
import { AnnouncementBanner } from './AnnouncementBanner';
import { AdminPanel } from './AdminPanel';
import { useToast } from '@/hooks/use-toast';
import { useVoice } from '@/hooks/useVoice';
import type { User, Message, MessageLog, Ban, Warning } from '@/types/chat';

const COMMON_EMOJIS = ['😀','😂','😍','🥰','😎','😭','😅','🤔','👍','👏','🎉','❤️','🔥','✨','💀','🙏','🤣','😊','😢','😤','😳','🤯','💯','🚀','👀','😏','🥺','😬','🤝','💪'];

interface ChatInterfaceProps {
  user: User;
  rooms: string[];
  currentRoom: string;
  messages: Message[];
  connected: boolean;
  onRoomSwitch: (room: string) => void;
  onSendMessage: (text: string, replyTo?: Message) => Promise<void>;
  onCreateRoom: (name: string) => Promise<void>;
  onUpdateUser?: (user: User) => void;
  directConversations?: Array<{ userId: string; username: string; lastMessage: string; timestamp: Date; unread?: number }>;
  currentDirectChat?: string | null;
  onLoadDirectConversations?: () => void;
  onStartDirectChat?: (userId: string) => void;
  onStartDMByUsername?: (username: string) => Promise<void>;
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
  onUpdateUser,
  directConversations,
  currentDirectChat,
  onLoadDirectConversations,
  onStartDirectChat,
  onStartDMByUsername,
  socketManager
}: ChatInterfaceProps) {
  const [messageText, setMessageText] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [showBans, setShowBans] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [bans, setBans] = useState<Record<string, Ban>>({});
  const [warning, setWarning] = useState<Warning | null>(null);
  const [banned, setBanned] = useState<Ban | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Voice
  const [micDeviceId, setMicDeviceId] = useState('');
  const [speakerDeviceId, setSpeakerDeviceId] = useState('');
  const rawSocket = socketManager?.getSocket?.() ?? null;
  const voice = useVoice(rawSocket, user.email);

  const handleJoinVoice = (channelId: string) => {
    voice.joinChannel(channelId, micDeviceId || undefined).catch(() => {
      toast({ title: 'Mic Access Denied', description: 'Please allow microphone access to use voice chat.', variant: 'destructive' });
    });
  };

  const handleMicChange = (deviceId: string) => {
    setMicDeviceId(deviceId);
    voice.setMicDevice(deviceId);
  };

  const handleSpeakerChange = (deviceId: string) => {
    setSpeakerDeviceId(deviceId);
    voice.applySpeaker(deviceId);
  };

  useState(() => {
    if (socketManager) {
      socketManager.onWarning((w: Warning) => setWarning(w));
      socketManager.onBanned((b: Ban) => setBanned(b));
    }
  });

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-emoji-picker]')) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    try {
      await onSendMessage(messageText.trim(), replyTo || undefined);
      setMessageText('');
      setReplyTo(null);
    } catch (error: any) {
      toast({ title: "Failed to send message", description: error.message, variant: "destructive" });
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;
    try {
      await onCreateRoom(roomName.trim());
      setRoomName('');
      setShowCreateRoom(false);
      toast({ title: "Room Created", description: `"${roomName}" created` });
    } catch (error: any) {
      toast({ title: "Failed to create room", description: error.message, variant: "destructive" });
    }
  };

  const handleOpenLogs = async () => {
    try {
      const response = await socketManager.getLogs();
      if (response.ok) { setLogs(response.logs || []); setShowLogs(true); }
    } catch {
      toast({ title: "Error", description: "Failed to load logs", variant: "destructive" });
    }
  };

  const handleOpenBans = async () => {
    try {
      const response = await socketManager.getBans();
      if (response.ok) { setBans(response.bans || {}); setShowBans(true); }
    } catch {
      toast({ title: "Error", description: "Failed to load bans", variant: "destructive" });
    }
  };

  const handleWarnUser = async (email: string, reason: string) => {
    const response = await socketManager.warnUser(email, reason);
    if (!response.ok) throw new Error(response.err || 'Failed to warn user');
  };

  const handleBanUser = async (email: string, reason: string) => {
    const response = await socketManager.banUser(email, reason);
    if (!response.ok) throw new Error(response.err || 'Failed to ban user');
  };

  const handleUnbanUser = async (email: string) => {
    try {
      await socketManager.unbanUser(email);
      const response = await socketManager.getBans();
      if (response.ok) setBans(response.bans || {});
      toast({ title: "User Unbanned", description: `${email} has been unbanned` });
    } catch {
      toast({ title: "Error", description: "Failed to unban user", variant: "destructive" });
    }
  };

  const handleUpdateProfile = async (updates: { username?: string; profileImageUrl?: string }) => {
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, ...updates }),
      });
      if (!response.ok) throw new Error('Failed to update profile');
      const result = await response.json();
      if (result.success && result.user) {
        onUpdateUser?.(result.user);
      }
    } catch (error) {
      throw error;
    }
  };

  const handleAckWarning = async () => {
    try {
      await socketManager.ackWarning();
      setWarning(null);
      toast({ title: "Warning Acknowledged" });
    } catch {
      toast({ title: "Error", description: "Failed to acknowledge warning", variant: "destructive" });
    }
  };

  const handleSendBroadcast = async (message: string) => {
    setBroadcastLoading(true);
    try {
      const socket = socketManager.getSocket();
      socket?.emit('createBroadcast', { message }, (response: any) => {
        setBroadcastLoading(false);
        if (response.ok) {
          toast({ title: "Broadcast sent" });
        } else {
          toast({ title: "Error", description: "Failed to send broadcast.", variant: "destructive" });
        }
      });
    } catch {
      setBroadcastLoading(false);
      toast({ title: "Error", description: "Failed to send broadcast.", variant: "destructive" });
    }
  };

  const insertEmoji = (emoji: string) => {
    const input = inputRef.current;
    if (!input) {
      setMessageText(prev => prev + emoji);
    } else {
      const start = input.selectionStart ?? messageText.length;
      const end = input.selectionEnd ?? messageText.length;
      const newText = messageText.slice(0, start) + emoji + messageText.slice(end);
      setMessageText(newText);
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 10);
    }
    setShowEmojiPicker(false);
  };

  // Determine the chat header
  const chatHeader = currentDirectChat
    ? directConversations?.find(c => c.userId === currentDirectChat)?.username || 'Direct Message'
    : currentRoom;

  return (
    <div className="w-full h-screen flex flex-col overflow-hidden" data-testid="chat-interface">
      <AnnouncementBanner socketManager={socketManager} />

      <div className="flex-1 flex min-h-0">
        <Sidebar
          user={user}
          rooms={rooms}
          currentRoom={currentRoom}
          onRoomSwitch={onRoomSwitch}
          onCreateRoom={() => setShowCreateRoom(true)}
          onOpenSettings={() => setShowSettings(true)}
          onOpenPanel={() => setShowAdminPanel(true)}
          directConversations={directConversations}
          onLoadDirectConversations={onLoadDirectConversations}
          onStartDirectChat={onStartDirectChat}
          onStartDMByUsername={onStartDMByUsername}
          currentDirectChat={currentDirectChat}
          voiceChannelMembers={voice.channelMembers}
          currentVoiceChannel={voice.currentChannel}
          voiceMuted={voice.muted}
          voiceConnecting={voice.connecting}
          onJoinVoice={handleJoinVoice}
          onLeaveVoice={voice.leaveChannel}
          onToggleMute={voice.toggleMute}
        />

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 h-full">
          {/* Chat Header */}
          <div className="px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
            <div className="flex items-center space-x-2">
              {currentDirectChat ? (
                <MessageCircle className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Hash className="h-5 w-5 text-muted-foreground" />
              )}
              <h2 className="text-base font-semibold" data-testid="text-current-room">{chatHeader}</h2>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${connected ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                {connected ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Messages - fills remaining space and scrolls */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <MessageList
              messages={messages}
              currentUserEmail={user.email}
              onReply={setReplyTo}
              isDirect={!!currentDirectChat}
              onReport={!currentDirectChat ? async (message) => {
                try {
                  await socketManager.reportMessage({
                    reportedEmail: message.email,
                    reportedUsername: message.display,
                    messageText: message.text,
                    room: currentRoom,
                  });
                  toast({ title: 'Message Reported', description: 'Admins have been notified.' });
                } catch {
                  toast({ title: 'Error', description: 'Failed to report message.', variant: 'destructive' });
                }
              } : undefined}
            />
          </div>

          {/* Reply preview */}
          {replyTo && (
            <div className="px-4 py-2 bg-muted/50 border-t border-border flex items-center space-x-3 flex-shrink-0">
              <Reply className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-primary">{replyTo.display}</span>
                <p className="text-xs text-muted-foreground truncate">{replyTo.text}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Message Input */}
          <div className="p-3 border-t border-border bg-card/50 flex-shrink-0">
            <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
              <div className="flex-1 relative" data-emoji-picker>
                <Input
                  ref={inputRef}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={replyTo ? `Reply to ${replyTo.display}...` : `Message ${currentDirectChat ? chatHeader : '#' + currentRoom}`}
                  className="pr-10"
                  maxLength={1000}
                  disabled={!connected}
                  data-testid="input-message"
                  style={{ fontFamily: 'system-ui, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif' }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowEmojiPicker(p => !p)}
                >
                  <Smile className="h-4 w-4 text-muted-foreground" />
                </Button>

                {/* Emoji Picker Dropdown */}
                {showEmojiPicker && (
                  <div className="absolute bottom-full right-0 mb-2 bg-card border border-border rounded-lg shadow-xl p-3 z-50 w-72">
                    <div className="grid grid-cols-10 gap-1">
                      {COMMON_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="text-xl hover:bg-muted rounded p-0.5 transition-colors leading-none"
                          onClick={() => insertEmoji(emoji)}
                          title={emoji}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={!messageText.trim() || !connected}
                data-testid="button-send-message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Create Room Modal */}
      <Dialog open={showCreateRoom} onOpenChange={setShowCreateRoom}>
        <DialogContent data-testid="modal-create-room">
          <DialogHeader><DialogTitle>Create New Room</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateRoom}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="roomName">Room Name</Label>
                <Input id="roomName" value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="my-room" className="mt-2" data-testid="input-room-name" />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setShowCreateRoom(false)}>Cancel</Button>
              <Button type="submit" disabled={!roomName.trim()} data-testid="button-create-room-submit">Create Room</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Admin Panel Popup */}
      <AdminPanel
        user={user}
        isOpen={showAdminPanel}
        onClose={() => setShowAdminPanel(false)}
        socketManager={socketManager}
        onOpenBroadcast={() => setShowBroadcast(true)}
        onOpenPasswords={() => setShowPasswords(true)}
      />

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

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        currentUser={user}
        onUpdateProfile={handleUpdateProfile}
        micDeviceId={micDeviceId}
        speakerDeviceId={speakerDeviceId}
        onMicChange={handleMicChange}
        onSpeakerChange={handleSpeakerChange}
      />

      <BroadcastModal
        open={showBroadcast}
        onOpenChange={setShowBroadcast}
        onSendBroadcast={handleSendBroadcast}
        isLoading={broadcastLoading}
      />

      <PasswordModal
        open={showPasswords}
        onOpenChange={setShowPasswords}
        socketManager={socketManager}
      />
    </div>
  );
}
