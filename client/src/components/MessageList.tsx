import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Crown, Shield, Reply, X } from 'lucide-react';
import type { Message } from '@/types/chat';

interface MessageListProps {
  messages: Message[];
  currentUserEmail?: string;
  onReply?: (message: Message) => void;
}

export function MessageList({ messages, currentUserEmail, onReply }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getRoleIcon = (role: string) => {
    if (role === 'owner') return <Crown className="h-3 w-3 text-yellow-500" />;
    if (role === 'admin') return <Shield className="h-3 w-3 text-red-500" />;
    return null;
  };

  const getRoleColor = (role: string) => {
    if (role === 'owner') return 'text-yellow-500';
    if (role === 'admin') return 'text-red-500';
    return 'text-foreground';
  };

  const getAvatarColor = (role: string) => {
    if (role === 'owner') return 'bg-yellow-500';
    if (role === 'admin') return 'bg-red-500';
    return 'bg-blue-500';
  };

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-4 space-y-1"
      data-testid="scroll-messages"
      style={{ scrollBehavior: 'smooth' }}
    >
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <p className="text-sm">No messages yet. Say something!</p>
        </div>
      )}
      {messages.map((message, index) => (
        <div
          key={index}
          className="flex space-x-3 hover:bg-muted/30 px-2 py-1.5 rounded-md group relative"
          data-testid={`message-${index}`}
          onMouseEnter={() => setHoveredIndex(index)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <Avatar className="h-9 w-9 flex-shrink-0 mt-0.5">
            {message.profileImageUrl ? (
              <AvatarImage src={message.profileImageUrl} alt={message.display} className="object-cover" />
            ) : null}
            <AvatarFallback className={`text-xs font-medium text-white ${getAvatarColor(message.role)}`}>
              {message.role === 'owner' ? <Crown className="h-4 w-4" /> : message.role === 'admin' ? <Shield className="h-4 w-4" /> : message.display[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            {/* Reply reference */}
            {(message as any).replyTo && (
              <div className="flex items-center space-x-2 mb-1 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 border-l-2 border-muted-foreground/30">
                <Reply className="h-3 w-3 flex-shrink-0" />
                <span className="font-medium">{(message as any).replyTo.display}</span>
                <span className="truncate">{(message as any).replyTo.text}</span>
              </div>
            )}

            <div className="flex items-center space-x-2 mb-0.5">
              <span className={`font-semibold text-sm ${getRoleColor(message.role)}`} data-testid={`text-message-sender-${index}`}>
                {message.display}
              </span>
              {getRoleIcon(message.role)}
              <span className="text-xs text-muted-foreground" data-testid={`text-message-time-${index}`}>
                {formatTime(message.ts)}
              </span>
            </div>

            <div
              className="text-sm text-foreground break-words leading-relaxed"
              data-testid={`text-message-content-${index}`}
              style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif' }}
            >
              {message.text}
            </div>
          </div>

          {/* Reply button - shows on hover */}
          {hoveredIndex === index && onReply && (
            <button
              className="absolute right-2 top-1.5 p-1.5 rounded bg-background border border-border shadow-sm hover:bg-muted transition-colors"
              onClick={() => onReply(message)}
              title="Reply"
            >
              <Reply className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
