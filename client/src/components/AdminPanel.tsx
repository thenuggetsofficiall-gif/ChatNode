import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { X, List, Ban, Megaphone, Lock, ShieldPlus, ShieldMinus, Crown, Shield } from 'lucide-react';
import type { User, MessageLog, Ban as BanType } from '@/types/chat';

interface AdminPanelProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  socketManager: any;
  onOpenBroadcast: () => void;
  onOpenPasswords: () => void;
}

export function AdminPanel({ user, isOpen, onClose, socketManager, onOpenBroadcast, onOpenPasswords }: AdminPanelProps) {
  const [activeSection, setActiveSection] = useState<'logs' | 'bans' | 'admins' | null>(null);
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [bans, setBans] = useState<Record<string, BanType>>({});
  const [admins, setAdmins] = useState<Array<{ email: string; username: string }>>([]);
  const [adminIdentifier, setAdminIdentifier] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const { toast } = useToast();

  const isOwner = user.role === 'owner';

  const loadLogs = async () => {
    const response = await socketManager.getLogs();
    if (response.ok) setLogs(response.logs || []);
    setActiveSection('logs');
  };

  const loadBans = async () => {
    const response = await socketManager.getBans();
    if (response.ok) setBans(response.bans || {});
    setActiveSection('bans');
  };

  const loadAdmins = async () => {
    const socket = socketManager.getSocket();
    socket?.emit('getAdmins', (response: any) => {
      if (response.ok) setAdmins(response.admins || []);
    });
    setActiveSection('admins');
  };

  const handleUnban = async (email: string) => {
    await socketManager.unbanUser(email);
    const response = await socketManager.getBans();
    if (response.ok) setBans(response.bans || {});
    toast({ title: 'User Unbanned', description: `${email} has been unbanned` });
  };

  const handleSetAdmin = async (action: 'add' | 'remove') => {
    if (!adminIdentifier.trim()) return;
    setAdminLoading(true);
    const socket = socketManager.getSocket();
    socket?.emit('setAdmin', { identifier: adminIdentifier.trim(), action }, (response: any) => {
      setAdminLoading(false);
      if (response.ok) {
        setAdmins(response.admins || []);
        setAdminIdentifier('');
        toast({
          title: action === 'add' ? 'Admin Added' : 'Admin Removed',
          description: action === 'add' ? `${adminIdentifier} is now an admin` : `${adminIdentifier} is no longer an admin`,
        });
      } else {
        toast({ title: 'Error', description: response.message || 'Failed to update admin', variant: 'destructive' });
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div className="flex items-center space-x-3">
            {isOwner ? <Crown className="h-5 w-5 text-yellow-500" /> : <Shield className="h-5 w-5 text-red-500" />}
            <h2 className="text-xl font-semibold">{isOwner ? 'Owner Panel' : 'Admin Panel'}</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-red-500 hover:text-red-600 hover:bg-red-500/10">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left nav */}
          <div className="w-48 border-r border-border p-4 space-y-2 flex-shrink-0">
            <Button
              variant={activeSection === 'logs' ? 'secondary' : 'ghost'}
              className="w-full justify-start"
              onClick={loadLogs}
            >
              <List className="h-4 w-4 mr-2" />
              View Logs
            </Button>
            <Button
              variant={activeSection === 'bans' ? 'secondary' : 'ghost'}
              className="w-full justify-start"
              onClick={loadBans}
            >
              <Ban className="h-4 w-4 mr-2" />
              Manage Bans
            </Button>

            {isOwner && (
              <>
                <div className="border-t border-border pt-2 mt-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 px-1">Owner Only</p>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-yellow-500 hover:text-yellow-500 hover:bg-yellow-500/10"
                    onClick={() => { onOpenBroadcast(); onClose(); }}
                  >
                    <Megaphone className="h-4 w-4 mr-2" />
                    Broadcast
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-yellow-500 hover:text-yellow-500 hover:bg-yellow-500/10"
                    onClick={() => { onOpenPasswords(); onClose(); }}
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    Passwords
                  </Button>
                  <Button
                    variant={activeSection === 'admins' ? 'secondary' : 'ghost'}
                    className="w-full justify-start text-yellow-500 hover:text-yellow-500 hover:bg-yellow-500/10"
                    onClick={loadAdmins}
                  >
                    <ShieldPlus className="h-4 w-4 mr-2" />
                    Admins
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Content area */}
          <div className="flex-1 p-4 overflow-y-auto">
            {activeSection === null && (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <p className="text-sm">Select an option from the left panel</p>
              </div>
            )}

            {activeSection === 'logs' && (
              <div>
                <h3 className="font-semibold mb-3">Message Logs ({logs.length})</h3>
                {logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No logs yet</p>
                ) : (
                  <div className="space-y-2">
                    {logs.slice().reverse().map((log, i) => (
                      <div key={i} className="text-xs bg-muted rounded p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{log.username || log.email}</span>
                          <span className="text-muted-foreground">{new Date(log.ts).toLocaleString()}</span>
                        </div>
                        <div className="text-muted-foreground">[{log.room}] {log.text}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeSection === 'bans' && (
              <div>
                <h3 className="font-semibold mb-3">Banned Users ({Object.keys(bans).length})</h3>
                {Object.keys(bans).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No banned users</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(bans).map(([email, ban]) => (
                      <div key={email} className="flex items-center justify-between bg-muted rounded p-3">
                        <div>
                          <div className="text-sm font-medium">{email}</div>
                          <div className="text-xs text-muted-foreground">Reason: {ban.reason}</div>
                          <div className="text-xs text-muted-foreground">By: {ban.issuer}</div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleUnban(email)}>
                          Unban
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeSection === 'admins' && isOwner && (
              <div>
                <h3 className="font-semibold mb-3">Admin Management</h3>

                {/* Add/Remove Admin */}
                <div className="bg-muted rounded-lg p-4 mb-4 space-y-3">
                  <Label>Email or Username</Label>
                  <Input
                    value={adminIdentifier}
                    onChange={(e) => setAdminIdentifier(e.target.value)}
                    placeholder="Enter email or username..."
                  />
                  <div className="flex space-x-2">
                    <Button
                      className="flex-1"
                      size="sm"
                      disabled={adminLoading || !adminIdentifier.trim()}
                      onClick={() => handleSetAdmin('add')}
                    >
                      <ShieldPlus className="h-4 w-4 mr-2" />
                      Give Admin
                    </Button>
                    <Button
                      className="flex-1"
                      size="sm"
                      variant="destructive"
                      disabled={adminLoading || !adminIdentifier.trim()}
                      onClick={() => handleSetAdmin('remove')}
                    >
                      <ShieldMinus className="h-4 w-4 mr-2" />
                      Remove Admin
                    </Button>
                  </div>
                </div>

                {/* Admin List */}
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Current Admins</h4>
                {admins.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No admins yet</p>
                ) : (
                  <div className="space-y-2">
                    {admins.map((admin) => (
                      <div key={admin.email} className="flex items-center justify-between bg-muted rounded p-3">
                        <div>
                          <div className="text-sm font-medium flex items-center space-x-2">
                            <Shield className="h-3 w-3 text-red-500" />
                            <span>{admin.username}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">{admin.email}</div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-500 border-red-500/30 hover:bg-red-500/10"
                          onClick={() => {
                            setAdminIdentifier(admin.email);
                            handleSetAdmin('remove');
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
