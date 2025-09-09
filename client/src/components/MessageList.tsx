import { useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Crown, Shield, Reply } from 'lucide-react';
import type { Message } from '@/types/chat';

interface MessageListProps {
  messages: Message[];
  currentUserEmail?: string;
}

export function MessageList({ messages, currentUserEmail }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-3 w-3 text-yellow-500" />;
      case 'admin':
        return <Shield className="h-3 w-3 text-red-500" />;
      default:
        return null;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'text-yellow-500';
      case 'admin':
        return 'text-red-500';
      default:
        return 'text-foreground';
    }
  };

  const getAvatarColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-yellow-500';
      case 'admin':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div 
      className="h-full p-4 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200" 
      ref={scrollRef}
      data-testid="scroll-messages"
      style={{ 
        height: '100%',
        overflowY: 'scroll',
        overflowX: 'hidden',
        border: '1px solid rgba(255,255,255,0.05)'
      }}
    >
      <div className="space-y-4">
        {messages.map((message, index) => (
          <div 
            key={index} 
            className="flex space-x-3 hover:bg-muted/30 p-2 rounded-md -mx-2 group"
            data-testid={`message-${index}`}
          >
            <Avatar className="h-8 w-8">
              {message.profileImageUrl ? (
                <AvatarImage 
                  src={message.profileImageUrl} 
                  alt={message.display}
                  className="object-cover"
                />
              ) : null}
              <AvatarFallback className={`text-xs font-medium text-white ${getAvatarColor(message.role)}`}>
                {message.role === 'owner' ? (
                  <Crown className="h-4 w-4" />
                ) : message.role === 'admin' ? (
                  <Shield className="h-4 w-4" />
                ) : (
                  message.display[0]?.toUpperCase()
                )}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <span 
                  className={`font-medium text-sm ${getRoleColor(message.role)}`}
                  data-testid={`text-message-sender-${index}`}
                >
                  {message.display}
                </span>
                {getRoleIcon(message.role)}
                <span 
                  className="text-xs text-muted-foreground"
                  data-testid={`text-message-time-${index}`}
                >
                  {formatTime(message.ts)}
                </span>
              </div>
              <div 
                className="text-sm text-foreground break-words"
                data-testid={`text-message-content-${index}`}
                style={{ 
                  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif',
                  lineHeight: '1.5'
                }}
              >
                {message.text}
              </div>
            </div>
            
            <div className="hidden group-hover:flex items-center space-x-1">
              <Button variant="ghost" size="sm">
                <Reply className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}