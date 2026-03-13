import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Hash, Plus, Settings, Crown, Shield, MessageCircle, LayoutDashboard } from 'lucide-react';
import { useState } from 'react';
import { AddDirectMessageModal } from './AddDirectMessageModal';
import type { User } from '@/types/chat';

interface SidebarProps {
  user: User;
  rooms: string[];
  currentRoom: string;
  onRoomSwitch: (room: string) => void;
  onCreateRoom: () => void;
  onOpenSettings: () => void;
  onOpenPanel: () => void;
  directConversations?: Array<{ userId: string; username: string; lastMessage: string; timestamp: Date; unread?: number }>;
  onLoadDirectConversations?: () => void;
  onStartDirectChat?: (userId: string) => void;
  onStartDMByUsername?: (username: string) => Promise<void>;
  currentDirectChat?: string | null;
}

export function Sidebar({ 
  user, 
  rooms, 
  currentRoom, 
  onRoomSwitch, 
  onCreateRoom,
  onOpenSettings,
  onOpenPanel,
  directConversations = [],
  onLoadDirectConversations,
  onStartDirectChat,
  onStartDMByUsername,
  currentDirectChat
}: SidebarProps) {
  const isAdmin = user.role === 'admin' || user.role === 'owner';
  const [activeTab, setActiveTab] = useState<'rooms' | 'direct'>('rooms');
  const [showAddDMModal, setShowAddDMModal] = useState(false);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-yellow-500 text-black';
      case 'admin': return 'bg-red-500 text-white';
      default: return 'bg-primary text-primary-foreground';
    }
  };

  return (
    <div className="w-72 bg-card border-r border-border flex flex-col h-full">
      {/* User Info Header */}
      <div className="p-4 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <Avatar className="w-9 h-9 flex-shrink-0">
              {user.profileImageUrl ? (
                <AvatarImage src={user.profileImageUrl} alt={user.username} className="object-cover" />
              ) : null}
              <AvatarFallback className={`text-xs font-medium ${getRoleColor(user.role)}`}>
                {user.role === 'owner' ? <Crown className="h-4 w-4" /> : user.role === 'admin' ? <Shield className="h-4 w-4" /> : user.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="font-medium text-sm truncate" data-testid="text-username">{user.username}</div>
              <span className={`px-1.5 py-0.5 rounded text-xs ${getRoleColor(user.role)}`} data-testid="text-user-role">
                {user.role.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-1 flex-shrink-0">
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={onOpenPanel} className="text-xs px-2" title="Panel">
                <LayoutDashboard className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onOpenSettings} data-testid="button-settings">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-border flex-shrink-0">
        <button
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${activeTab === 'rooms' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveTab('rooms')}
          data-testid="tab-rooms"
        >
          <Hash className="h-4 w-4 inline mr-1.5" />
          Rooms
        </button>
        <button
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${activeTab === 'direct' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => { setActiveTab('direct'); onLoadDirectConversations?.(); }}
          data-testid="tab-direct"
        >
          <MessageCircle className="h-4 w-4 inline mr-1.5" />
          Direct
        </button>
      </div>

      {/* Tab Header with + button */}
      <div className="px-4 py-2 flex items-center justify-between flex-shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {activeTab === 'rooms' ? 'Channels' : 'Messages'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={activeTab === 'rooms' ? onCreateRoom : () => setShowAddDMModal(true)}
          data-testid={activeTab === 'rooms' ? "button-create-room" : "button-new-dm"}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4" data-testid={activeTab === 'rooms' ? "list-rooms" : "list-direct"}>
        {activeTab === 'rooms' ? (
          <div className="space-y-0.5">
            {rooms.map((room) => (
              <Button
                key={room}
                variant={room === currentRoom && !currentDirectChat ? "secondary" : "ghost"}
                className="w-full justify-start h-8 text-sm"
                onClick={() => onRoomSwitch(room)}
                data-testid={`button-room-${room}`}
              >
                <Hash className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                {room}
              </Button>
            ))}
          </div>
        ) : (
          <div className="space-y-0.5">
            {directConversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs mt-1 opacity-70">Press + to message someone</p>
              </div>
            ) : (
              directConversations.map((conv) => (
                <Button
                  key={conv.userId}
                  variant={currentDirectChat === conv.userId ? "secondary" : "ghost"}
                  className="w-full justify-start h-auto py-2 px-2"
                  onClick={() => onStartDirectChat?.(conv.userId)}
                  data-testid={`button-dm-${conv.userId}`}
                >
                  <Avatar className="h-7 w-7 mr-2 flex-shrink-0">
                    <AvatarFallback className="text-xs">{conv.username[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="text-left min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium truncate">{conv.username}</div>
                      {(conv.unread || 0) > 0 && (
                        <span className="ml-1 flex-shrink-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                          NEW
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate max-w-36">{conv.lastMessage}</div>
                  </div>
                </Button>
              ))
            )}
          </div>
        )}
      </div>

      <AddDirectMessageModal
        isOpen={showAddDMModal}
        onClose={() => setShowAddDMModal(false)}
        onStartConversation={async (username: string) => {
          if (onStartDMByUsername) await onStartDMByUsername(username);
        }}
      />
    </div>
  );
}
