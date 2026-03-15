import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Hash, Plus, Settings, Crown, Shield, MessageCircle,
  LayoutDashboard, Mic, MicOff, Volume2, VolumeX, PhoneOff, Users,
} from 'lucide-react';
import { useState } from 'react';
import { AddDirectMessageModal } from './AddDirectMessageModal';
import type { User } from '@/types/chat';
import type { VoiceMember } from '@/hooks/useVoice';

const VOICE_CHANNELS = ['General', 'Gaming', 'Music'];

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
  // Voice
  voiceChannelMembers?: Record<string, VoiceMember[]>;
  currentVoiceChannel?: string | null;
  voiceMuted?: boolean;
  voiceDeafened?: boolean;
  voiceServerMuted?: boolean;
  voiceSpeaking?: boolean;
  voiceConnecting?: boolean;
  onJoinVoice?: (channelId: string) => void;
  onLeaveVoice?: () => void;
  onToggleMute?: () => void;
  onToggleDeafen?: () => void;
  onKickFromVoice?: (email: string) => void;
  onServerMuteVoice?: (email: string, muted: boolean) => void;
}

export function Sidebar({
  user, rooms, currentRoom, onRoomSwitch, onCreateRoom, onOpenSettings, onOpenPanel,
  directConversations = [], onLoadDirectConversations, onStartDirectChat,
  onStartDMByUsername, currentDirectChat,
  voiceChannelMembers = {}, currentVoiceChannel, voiceMuted, voiceDeafened,
  voiceServerMuted, voiceSpeaking, voiceConnecting,
  onJoinVoice, onLeaveVoice, onToggleMute, onToggleDeafen,
  onKickFromVoice, onServerMuteVoice,
}: SidebarProps) {
  const isAdmin = user.role === 'admin' || user.role === 'owner';
  const [activeTab, setActiveTab] = useState<'rooms' | 'direct' | 'voice'>('rooms');
  const [showAddDMModal, setShowAddDMModal] = useState(false);
  const [hoveredVoiceMember, setHoveredVoiceMember] = useState<string | null>(null);

  const getRoleColor = (role: string) => {
    switch (role) { case 'owner': return 'bg-yellow-500 text-black'; case 'admin': return 'bg-red-500 text-white'; default: return 'bg-primary text-primary-foreground'; }
  };

  const canActOnUser = (memberEmail: string) => {
    if (!isAdmin) return false;
    if (memberEmail === user.email) return false;
    // Can't act on owners
    return true;
  };

  return (
    <div className="w-72 bg-card border-r border-border flex flex-col h-full">
      {/* User Info Header */}
      <div className="p-4 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <Avatar className="w-9 h-9 flex-shrink-0">
              {user.profileImageUrl && <AvatarImage src={user.profileImageUrl} alt={user.username} className="object-cover" />}
              <AvatarFallback className={`text-xs font-medium ${getRoleColor(user.role)}`}>
                {user.role === 'owner' ? <Crown className="h-4 w-4" /> : user.role === 'admin' ? <Shield className="h-4 w-4" /> : user.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="font-medium text-sm truncate" data-testid="text-username">{user.username}</div>
              <span className={`px-1.5 py-0.5 rounded text-xs ${getRoleColor(user.role)}`} data-testid="text-user-role">{user.role.toUpperCase()}</span>
            </div>
          </div>
          <div className="flex items-center space-x-1 flex-shrink-0">
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={onOpenPanel} className="text-xs px-2" title="Panel">
                <LayoutDashboard className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onOpenSettings} data-testid="button-settings"><Settings className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-border flex-shrink-0">
        <button className={`flex-1 py-2.5 text-xs font-medium transition-colors ${activeTab === 'rooms' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setActiveTab('rooms')} data-testid="tab-rooms">
          <Hash className="h-3.5 w-3.5 inline mr-1" />Rooms
        </button>
        <button className={`flex-1 py-2.5 text-xs font-medium transition-colors ${activeTab === 'direct' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => { setActiveTab('direct'); onLoadDirectConversations?.(); }} data-testid="tab-direct">
          <MessageCircle className="h-3.5 w-3.5 inline mr-1" />Direct
        </button>
        <button className={`flex-1 py-2.5 text-xs font-medium transition-colors relative ${activeTab === 'voice' ? 'border-b-2 border-green-500 text-green-500' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setActiveTab('voice')} data-testid="tab-voice">
          <Volume2 className="h-3.5 w-3.5 inline mr-1" />Voice
          {currentVoiceChannel && <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
        </button>
      </div>

      {/* Section header */}
      <div className="px-4 py-2 flex items-center justify-between flex-shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {activeTab === 'rooms' ? 'Channels' : activeTab === 'direct' ? 'Messages' : 'Voice Channels'}
        </span>
        {activeTab === 'rooms' && (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onCreateRoom} data-testid="button-create-room"><Plus className="h-4 w-4" /></Button>
        )}
        {activeTab === 'direct' && (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowAddDMModal(true)} data-testid="button-new-dm"><Plus className="h-4 w-4" /></Button>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-2 pb-2" data-testid={activeTab === 'rooms' ? 'list-rooms' : activeTab === 'direct' ? 'list-direct' : 'list-voice'}>
        {/* ── ROOMS ── */}
        {activeTab === 'rooms' && (
          <div className="space-y-0.5">
            {rooms.map(room => (
              <Button key={room} variant={room === currentRoom && !currentDirectChat ? 'secondary' : 'ghost'} className="w-full justify-start h-8 text-sm" onClick={() => onRoomSwitch(room)} data-testid={`button-room-${room}`}>
                <Hash className="h-3.5 w-3.5 mr-2 text-muted-foreground" />{room}
              </Button>
            ))}
          </div>
        )}

        {/* ── DIRECT ── */}
        {activeTab === 'direct' && (
          <div className="space-y-0.5">
            {directConversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs mt-1 opacity-70">Press + to message someone</p>
              </div>
            ) : directConversations.map(conv => (
              <Button key={conv.userId} variant={currentDirectChat === conv.userId ? 'secondary' : 'ghost'} className="w-full justify-start h-auto py-2 px-2" onClick={() => onStartDirectChat?.(conv.userId)} data-testid={`button-dm-${conv.userId}`}>
                <Avatar className="h-7 w-7 mr-2 flex-shrink-0">
                  <AvatarFallback className="text-xs">{conv.username[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="text-left min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium truncate">{conv.username}</div>
                    {(conv.unread || 0) > 0 && (
                      <span className="ml-1 flex-shrink-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">NEW</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate max-w-36">{conv.lastMessage}</div>
                </div>
              </Button>
            ))}
          </div>
        )}

        {/* ── VOICE ── */}
        {activeTab === 'voice' && (
          <div className="space-y-2">
            {VOICE_CHANNELS.map(ch => {
              const members = voiceChannelMembers[ch] || [];
              const isActive = currentVoiceChannel === ch;
              return (
                <div key={ch}>
                  {/* Channel row */}
                  <button
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors group ${isActive ? 'bg-green-500/10 text-green-400' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                    onClick={() => isActive ? onLeaveVoice?.() : onJoinVoice?.(ch)}
                    disabled={voiceConnecting}
                  >
                    <div className="flex items-center gap-2">
                      <Volume2 className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-green-500' : ''}`} />
                      <span className="font-medium">{ch}</span>
                      {isActive && <span className="text-[9px] bg-green-500 text-white px-1.5 py-0.5 rounded-full font-bold tracking-wide">LIVE</span>}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>{members.length}/50</span>
                    </div>
                  </button>

                  {/* Members in channel — Discord style */}
                  {members.length > 0 && (
                    <div className="ml-3 border-l-2 border-border pl-2 space-y-0.5 mt-0.5 mb-1">
                      {members.map(m => {
                        const isMe = m.email === user.email;
                        const isSpeaking = m.speaking && !m.serverMuted;
                        return (
                          <div
                            key={m.email}
                            className="flex items-center justify-between px-1 py-1 rounded group/member hover:bg-muted/40 transition-colors"
                            onMouseEnter={() => setHoveredVoiceMember(m.email)}
                            onMouseLeave={() => setHoveredVoiceMember(null)}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {/* Avatar with speaking ring */}
                              <div className={`relative flex-shrink-0 rounded-full ${isSpeaking ? 'ring-2 ring-green-500 ring-offset-1 ring-offset-card' : ''}`}>
                                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                  {m.username[0]?.toUpperCase()}
                                </div>
                              </div>
                              <span className={`text-xs truncate ${isMe ? 'text-green-400 font-medium' : 'text-foreground/80'}`}>
                                {m.username}{isMe ? ' (you)' : ''}
                              </span>
                            </div>

                            {/* Status icons */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {/* Admin controls (visible on hover) */}
                              {!isMe && isAdmin && canActOnUser(m.email) && hoveredVoiceMember === m.email && (
                                <div className="flex items-center gap-0.5 mr-1">
                                  <button
                                    className={`p-0.5 rounded transition-colors ${m.serverMuted ? 'text-red-400 hover:text-red-300' : 'text-muted-foreground hover:text-yellow-400'}`}
                                    onClick={e => { e.stopPropagation(); onServerMuteVoice?.(m.email, !m.serverMuted); }}
                                    title={m.serverMuted ? 'Unmute' : 'Server mute'}
                                  >
                                    {m.serverMuted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                                  </button>
                                  <button
                                    className="p-0.5 rounded text-muted-foreground hover:text-red-400 transition-colors"
                                    onClick={e => { e.stopPropagation(); onKickFromVoice?.(m.email); }}
                                    title="Disconnect from voice"
                                  >
                                    <PhoneOff className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                              {m.serverMuted && <span title="Server muted"><MicOff className="h-3 w-3 text-red-400" /></span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Active voice bar (Discord style) ── */}
      {currentVoiceChannel && (
        <div className="border-t border-border bg-green-950/20 flex-shrink-0">
          {/* Status row */}
          <div className="px-3 pt-2.5 pb-1">
            <div className="flex items-center gap-2 mb-0.5">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${voiceSpeaking && !voiceMuted ? 'bg-green-400 animate-pulse' : 'bg-green-600'}`} />
              <span className="text-xs font-medium text-green-400 truncate">
                {voiceServerMuted ? '🔇 Server muted' : voiceMuted ? 'Muted' : voiceDeafened ? 'Deafened' : voiceSpeaking ? 'Speaking' : 'Voice Connected'}
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground pl-4">{currentVoiceChannel}</div>
          </div>

          {/* Controls */}
          <div className="flex items-center px-2 pb-2 gap-1">
            {/* Mute */}
            <button
              title={voiceServerMuted ? 'Server muted — cannot unmute' : voiceMuted ? 'Unmute' : 'Mute'}
              disabled={!!voiceServerMuted}
              onClick={onToggleMute}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors
                ${voiceServerMuted ? 'bg-red-900/30 text-red-400 cursor-not-allowed opacity-70' :
                  voiceMuted ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' :
                  'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'}`}
            >
              {voiceMuted || voiceServerMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              {voiceServerMuted ? 'Muted' : voiceMuted ? 'Unmute' : 'Mute'}
            </button>

            {/* Deafen */}
            <button
              title={voiceDeafened ? 'Undeafen' : 'Deafen'}
              onClick={onToggleDeafen}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors
                ${voiceDeafened ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' :
                'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'}`}
            >
              {voiceDeafened ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              {voiceDeafened ? 'Undeafen' : 'Deafen'}
            </button>

            {/* Leave */}
            <button
              title="Leave voice channel"
              onClick={onLeaveVoice}
              className="flex items-center justify-center p-1.5 rounded-md text-red-400 hover:bg-red-500/20 transition-colors"
            >
              <PhoneOff className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <AddDirectMessageModal
        isOpen={showAddDMModal}
        onClose={() => setShowAddDMModal(false)}
        onStartConversation={async (username: string) => { if (onStartDMByUsername) await onStartDMByUsername(username); }}
      />
    </div>
  );
}
