import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Megaphone, Send } from 'lucide-react';

interface BroadcastModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendBroadcast: (message: string) => void;
  isLoading?: boolean;
}

export function BroadcastModal({ 
  open, 
  onOpenChange, 
  onSendBroadcast,
  isLoading = false 
}: BroadcastModalProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    onSendBroadcast(message.trim());
    setMessage('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="modal-broadcast">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Megaphone className="h-5 w-5 text-yellow-500" />
            <span>Broadcast Announcement</span>
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="broadcast-message">Announcement Message</Label>
            <Textarea
              id="broadcast-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your public announcement..."
              className="min-h-[100px] resize-none"
              maxLength={500}
              disabled={isLoading}
              data-testid="textarea-broadcast-message"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {message.length}/500 characters • Announcement will be visible to all users for 1 hour
            </p>
          </div>
          
          <div className="flex justify-between">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              data-testid="button-cancel-broadcast"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!message.trim() || isLoading}
              data-testid="button-send-broadcast"
            >
              <Send className="h-4 w-4 mr-2" />
              {isLoading ? 'Broadcasting...' : 'Broadcast'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}