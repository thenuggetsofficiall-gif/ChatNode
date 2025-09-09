import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Hash, Plus, Settings, List, Ban, Crown, Shield, Megaphone, Lock, MessageCircle, Users } from 'lucide-react';
import { useState } from 'react';
import { AddDirectMessageModal } from './AddDirectMessageModal';
import type { User } from '@/types/chat';

interface SidebarProps {
  user: User;
  rooms: string[];
  currentRoom: string;
  onRoomSwitch: (room: string) => void;
  onCreateRoom: () => void;
  onOpenLogs: () => void;
  onOpenBans: () => void;
  onOpenSettings: () => void;
  onOpenBroadcast?: () => void;
  onOpenPasswords?: () => void;
  directConversations?: Array<{ userId: string; username: string; lastMessage: string; timestamp: Date }>;
  onLoadDirectConversations?: () => void;
  onStartDirectChat?: (userId: string) => void;
  onStartDirectConversationByEmail?: (email: string) => Promise<void>;
  currentDirectChat?: string | null;
}

export function Sidebar({ 
  user, 
  rooms, 
  currentRoom, 
  onRoomSwitch, 
  onCreateRoom,
  onOpenLogs,
  onOpenBans,
  onOpenSettings,
  onOpenBroadcast,
  onOpenPasswords,
  directConversations = [],
  onLoadDirectConversations,
  onStartDirectChat,
  onStartDirectConversationByEmail,
  currentDirectChat
}: SidebarProps) {
  const isAdmin = user.role === 'admin' || user.role === 'owner';
  const [activeTab, setActiveTab] = useState<'rooms' | 'direct'>('rooms');
  const [showAddDMModal, setShowAddDMModal] = useState(false);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-yellow-500 text-black';
      case 'admin':
        return 'bg-red-500 text-white';
      default:
        return 'bg-primary text-primary-foreground';
    }
  };

  return (
    <div className="w-80 bg-card border-r border-border flex flex-col h-screen max-h-screen">
      {/* User Info Header - Fixed */}
      <div className="p-4 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="w-10 h-10">
              {user.profileImageUrl ? (
                <AvatarImage 
                  src={user.profileImageUrl} 
                  alt={user.username}
                  className="object-cover"
                />
              ) : null}
              <AvatarFallback className={`text-primary-foreground font-medium ${getRoleColor(user.role)}`}>
                {user.role === 'owner' ? (
                  <Crown className="h-5 w-5" />
                ) : user.role === 'admin' ? (
                  <Shield className="h-5 w-5" />
                ) : (
                  user.username[0].toUpperCase()
                )}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium" data-testid="text-username">{user.username}</div>
              <div className="text-xs">
                <span 
                  className={`px-2 py-1 rounded text-xs ${getRoleColor(user.role)}`}
                  data-testid="text-user-role"
                >
                  {user.role.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onOpenSettings}
            data-testid="button-settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tab System */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Tab Headers */}
        <div className="px-4 pt-4 pb-2 flex-shrink-0">
          <div className="flex space-x-2 mb-4">
            <Button
              variant={activeTab === 'rooms' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('rooms')}
              className="flex-1"
              data-testid="tab-rooms"
            >
              <Hash className="h-4 w-4 mr-2" />
              Rooms
            </Button>
            <Button
              variant={activeTab === 'direct' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => {
                setActiveTab('direct');
                onLoadDirectConversations?.();
              }}
              className="flex-1"
              data-testid="tab-direct"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Direct
            </Button>
          </div>

          {/* Tab Content Header */}
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
              {activeTab === 'rooms' ? 'Rooms' : 'Direct Messages'}
            </h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={activeTab === 'rooms' ? onCreateRoom : () => setShowAddDMModal(true)}
              data-testid={activeTab === 'rooms' ? "button-create-room" : "button-new-dm"}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Tab Content */}
        <div 
          className="flex-1 px-4 pb-4 scrollbar-thin" 
          data-testid={activeTab === 'rooms' ? "list-rooms" : "list-direct"}
          style={{ 
            height: '300px',
            overflowY: 'scroll',
            overflowX: 'hidden',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <div className="space-y-2">
            {activeTab === 'rooms' ? (
              // Rooms Tab Content
              rooms.map((room) => (
                <Button
                  key={room}
                  variant={room === currentRoom ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => onRoomSwitch(room)}
                  data-testid={`button-room-${room}`}
                >
                  <Hash className="h-4 w-4 mr-2" />
                  {room}
                </Button>
              ))
            ) : (
              // Direct Messages Tab Content
              directConversations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No direct messages yet</p>
                  <p className="text-xs mt-1">Click + to start a conversation</p>
                </div>
              ) : (
                directConversations.map((conversation) => (
                  <Button
                    key={conversation.userId}
                    variant={currentDirectChat === conversation.userId ? "secondary" : "ghost"}
                    className="w-full justify-start p-3 h-auto"
                    onClick={() => onStartDirectChat?.(conversation.userId)}
                    data-testid={`button-dm-${conversation.userId}`}
                  >
                    <div className="flex items-center space-x-3 w-full">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs font-medium">
                          {conversation.username[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-sm">{conversation.username}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-40">
                          {conversation.lastMessage}
                        </div>
                      </div>
                    </div>
                  </Button>
                ))
              )
            )}
          </div>
        </div>
      </div>

      {/* Admin Panel - Fixed at bottom */}
      {isAdmin && (
        <div className="border-t border-border p-4 flex-shrink-0">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider mb-4">
            Admin Panel
          </h3>
          <div className="space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={onOpenLogs}
              data-testid="button-view-logs"
            >
              <List className="h-4 w-4 mr-2" />
              View Logs
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={onOpenBans}
              data-testid="button-manage-bans"
            >
              <Ban className="h-4 w-4 mr-2" />
              Manage Bans
            </Button>
            {user.role === 'owner' && onOpenBroadcast && (
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={onOpenBroadcast}
                data-testid="button-broadcast"
              >
                <Megaphone className="h-4 w-4 mr-2" />
                Broadcast
              </Button>
            )}
            {user.role === 'owner' && onOpenPasswords && (
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={onOpenPasswords}
                data-testid="button-passwords"
              >
                <Lock className="h-4 w-4 mr-2" />
                Passwords
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Add Direct Message Modal */}
      <AddDirectMessageModal
        isOpen={showAddDMModal}
        onClose={() => setShowAddDMModal(false)}
        onStartConversation={async (email: string) => {
          if (onStartDirectConversationByEmail) {
            await onStartDirectConversationByEmail(email);
          }
        }}
      />
    </div>
  );
}
