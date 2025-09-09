import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Megaphone } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';

interface Broadcast {
  id: number;
  message: string;
  createdAt: number;
  expiresAt: number;
  createdBy: string;
}

export function AnnouncementBanner() {
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    // Request current broadcast when component mounts
    socket.emit('getBroadcast', (response: any) => {
      if (response.ok && response.broadcast) {
        setBroadcast(response.broadcast);
        setIsVisible(true);
      }
    });

    // Listen for new broadcasts
    const handleBroadcast = (newBroadcast: Broadcast) => {
      setBroadcast(newBroadcast);
      setIsVisible(true);
    };

    socket.on('broadcast', handleBroadcast);

    return () => {
      socket.off('broadcast', handleBroadcast);
    };
  }, [socket]);

  // Auto-hide expired broadcasts
  useEffect(() => {
    if (!broadcast) return;

    const now = Date.now();
    if (now >= broadcast.expiresAt) {
      setBroadcast(null);
      setIsVisible(false);
      return;
    }

    const timeUntilExpiry = broadcast.expiresAt - now;
    const timer = setTimeout(() => {
      setBroadcast(null);
      setIsVisible(false);
    }, timeUntilExpiry);

    return () => clearTimeout(timer);
  }, [broadcast]);

  const handleDismiss = () => {
    if (!socket || !broadcast) return;

    socket.emit('dismissBroadcast', { broadcastId: broadcast.id }, (response: any) => {
      if (response.ok) {
        setIsVisible(false);
      }
    });
  };

  if (!broadcast || !isVisible) {
    return null;
  }

  const timeRemaining = Math.max(0, broadcast.expiresAt - Date.now());
  const minutesRemaining = Math.ceil(timeRemaining / (1000 * 60));

  return (
    <div className="bg-yellow-500/20 border-b border-yellow-500/30 px-4 py-3 relative">
      <div className="flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <Megaphone className="h-5 w-5 text-yellow-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-sm font-medium text-yellow-800">
                Public Announcement
              </span>
              <span className="text-xs text-yellow-700 bg-yellow-200/50 px-2 py-1 rounded">
                {minutesRemaining > 1 ? `${minutesRemaining} min remaining` : 'Expires soon'}
              </span>
            </div>
            <p 
              className="text-sm text-yellow-900 break-words pr-4"
              data-testid="text-broadcast-message"
            >
              {broadcast.message}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="text-yellow-700 hover:text-yellow-900 hover:bg-yellow-200/50 flex-shrink-0"
          data-testid="button-dismiss-broadcast"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}