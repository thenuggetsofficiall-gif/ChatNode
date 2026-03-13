import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface AddDirectMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartConversation: (username: string) => Promise<void>;
}

export function AddDirectMessageModal({ isOpen, onClose, onStartConversation }: AddDirectMessageModalProps) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      toast({ title: "Error", description: "Please enter a username.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await onStartConversation(username.trim());
      setUsername('');
      onClose();
    } catch (error) {
      toast({
        title: "User Not Found",
        description: error instanceof Error ? error.message : "No user found with that username.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setUsername('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="modal-add-direct-message">
        <DialogHeader>
          <DialogTitle>New Direct Message</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="Search by username..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoFocus
              data-testid="input-username"
            />
            <p className="text-sm text-muted-foreground">
              Enter the exact username of a registered user.
            </p>
          </div>
          
          <DialogFooter className="space-x-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !username.trim()} data-testid="button-start-conversation">
              {loading ? "Searching..." : "Start Chat"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
