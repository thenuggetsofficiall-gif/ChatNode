import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, EyeOff, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UserPassword {
  id: string;
  email: string;
  username?: string;
  password: string;
  role: string;
}

interface PasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  socketManager: any;
}

export function PasswordModal({ open, onOpenChange, socketManager }: PasswordModalProps) {
  const [users, setUsers] = useState<UserPassword[]>([]);
  const [loading, setLoading] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    if (open && socketManager) {
      fetchUsers();
    }
  }, [open, socketManager]);

  const fetchUsers = () => {
    setLoading(true);
    const socket = socketManager.getSocket();
    if (!socket) {
      setLoading(false);
      return;
    }

    socket.emit('getAllUsers', (response: any) => {
      setLoading(false);
      if (response.ok) {
        setUsers(response.users || []);
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch user data.",
          variant: "destructive",
        });
      }
    });
  };

  const togglePasswordVisibility = (userId: string) => {
    const newVisible = new Set(visiblePasswords);
    if (newVisible.has(userId)) {
      newVisible.delete(userId);
    } else {
      newVisible.add(userId);
    }
    setVisiblePasswords(newVisible);
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: `${type} copied to clipboard.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'text-purple-600 font-bold';
      case 'admin': return 'text-blue-600 font-semibold';
      default: return 'text-gray-600';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0" data-testid="modal-passwords">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-bold text-destructive">
            🔒 Password Management (Owner Only)
          </DialogTitle>
        </DialogHeader>
        
        <div className="px-6 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading user data...</p>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-[60vh] w-full border rounded-md">
              <div className="p-4">
                <div className="grid grid-cols-5 gap-4 pb-4 border-b font-semibold text-sm bg-muted p-3 rounded-t-md">
                  <div>Email</div>
                  <div>Username</div>
                  <div>Role</div>
                  <div>Password</div>
                  <div>Actions</div>
                </div>
                
                <div className="space-y-2">
                  {users.map((user) => (
                    <div 
                      key={user.id} 
                      className="grid grid-cols-5 gap-4 p-3 border-b hover:bg-muted/50 transition-colors items-center"
                      data-testid={`row-user-${user.id}`}
                    >
                      <div className="font-mono text-sm break-all" data-testid={`text-email-${user.id}`}>
                        {user.email}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2 h-6 w-6 p-0"
                          onClick={() => copyToClipboard(user.email, 'Email')}
                          data-testid={`button-copy-email-${user.id}`}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      <div className="text-sm" data-testid={`text-username-${user.id}`}>
                        {user.username || 'N/A'}
                        {user.username && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-2 h-6 w-6 p-0"
                            onClick={() => copyToClipboard(user.username!, 'Username')}
                            data-testid={`button-copy-username-${user.id}`}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      
                      <div className={`text-sm ${getRoleColor(user.role)}`} data-testid={`text-role-${user.id}`}>
                        {user.role.toUpperCase()}
                      </div>
                      
                      <div className="font-mono text-sm break-all" data-testid={`text-password-${user.id}`}>
                        {visiblePasswords.has(user.id) ? user.password : '••••••••••••'}
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePasswordVisibility(user.id)}
                          data-testid={`button-toggle-password-${user.id}`}
                        >
                          {visiblePasswords.has(user.id) ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(user.password, 'Password')}
                          data-testid={`button-copy-password-${user.id}`}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                
                {users.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No users found.
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
          
          <div className="flex justify-between items-center mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Total Users: {users.length}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={fetchUsers}
                disabled={loading}
                data-testid="button-refresh-users"
              >
                Refresh
              </Button>
              <Button
                variant="secondary"
                onClick={() => onOpenChange(false)}
                data-testid="button-close-passwords"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}