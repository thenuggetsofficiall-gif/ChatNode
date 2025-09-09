import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Hash, Plus, Settings, List, Ban, Crown, Shield, Megaphone } from 'lucide-react';
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
  onOpenBroadcast
}: SidebarProps) {
  const isAdmin = user.role === 'admin' || user.role === 'owner';

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
    <div className="w-80 bg-card border-r border-border flex flex-col">
      {/* User Info Header */}
      <div className="p-4 border-b border-border">
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

      {/* Rooms Section */}
      <div className="flex-1 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Rooms</h3>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onCreateRoom}
            data-testid="button-create-room"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-2" data-testid="list-rooms">
          {rooms.map((room) => (
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
          ))}
        </div>
      </div>

      {/* Admin Panel */}
      {isAdmin && (
        <div className="border-t border-border p-4">
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
          </div>
        </div>
      )}
    </div>
  );
}
