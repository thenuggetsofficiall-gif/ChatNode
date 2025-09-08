import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AuthModalProps {
  onAuth: (email: string, username?: string) => Promise<void>;
  connected: boolean;
}

export function AuthModal({ onAuth, connected }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      await onAuth(email.trim(), username.trim() || undefined);
    } catch (error: any) {
      toast({
        title: "Authentication Failed",
        description: error.message || "Failed to join chat",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="bg-primary/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="text-primary text-2xl h-8 w-8" />
          </div>
          <CardTitle className="text-2xl">Welcome to MiniChat</CardTitle>
          <p className="text-muted-foreground">Enter your details to join the conversation</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="mt-2"
                data-testid="input-email"
              />
            </div>
            
            <div>
              <Label htmlFor="username">Username (Optional)</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter a username"
                className="mt-2"
                data-testid="input-username"
              />
              <p className="text-xs text-muted-foreground mt-1">Leave empty for auto-generated username</p>
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || !connected}
              data-testid="button-join"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Join Chat'
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <div className="flex items-center justify-center text-sm text-muted-foreground">
              <div 
                className={`w-2 h-2 rounded-full mr-2 ${
                  connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`}
                data-testid="status-indicator"
              />
              <span data-testid="text-connection-status">
                {connected ? 'Connected to server' : 'Disconnected'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
