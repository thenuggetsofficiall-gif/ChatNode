import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AuthModalProps {
  onAuth: (email: string, password: string, username?: string) => Promise<void>;
  connected: boolean;
}

export function AuthModal({ onAuth, connected }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    try {
      await onAuth(email.trim().toLowerCase(), password.trim(), username.trim() || undefined);
    } catch (error: any) {
      toast({
        title: "Login Failed",
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
            <MessageCircle className="text-primary h-8 w-8" />
          </div>
          <CardTitle className="text-2xl">Welcome to MiniChat</CardTitle>
          <p className="text-muted-foreground text-sm">Sign in or create an account</p>
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
                placeholder="your@email.com"
                className="mt-2"
                data-testid="input-email"
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className="mt-2"
                data-testid="input-password"
              />
            </div>

            <div>
              <Label htmlFor="username">
                Username <span className="text-muted-foreground font-normal text-xs">(required if returning user, optional for new)</span>
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your username"
                className="mt-2"
                data-testid="input-username"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Existing users must enter their exact username to log in.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !connected || !email.trim() || !password.trim()}
              data-testid="button-join"
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Connecting...</>
              ) : 'Join Chat'}
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-center text-sm text-muted-foreground">
            <div className={`w-2 h-2 rounded-full mr-2 ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span>{connected ? 'Connected to server' : 'Disconnected'}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
