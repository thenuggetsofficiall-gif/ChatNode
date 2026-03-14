import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { X, List, Ban, Megaphone, Lock, ShieldPlus, ShieldMinus, Crown, Shield, Users, Flag, AlertTriangle } from 'lucide-react';
import type { User, MessageLog, Ban as BanType } from '@/types/chat';

type Section = 'logs' | 'bans' | 'users' | 'admins' | null;

interface AdminPanelProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  socketManager: any;
  onOpenBroadcast: () => void;
  onOpenPasswords: () => void;
}

export function AdminPanel({ user, isOpen, onClose, socketManager, onOpenBroadcast, onOpenPasswords }: AdminPanelProps) {
  const [activeSection, setActiveSection] = useState<Section>(null);

  // Logs
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [logView, setLogView] = useState<'all' | 'reported'>('all');

  // Bans
  const [bans, setBans] = useState<Record<string, BanType>>({});

  // Users
  const [regUsers, setRegUsers] = useState<Array<{ email: string; username: string; role: string }>>([]);
  const [warnTarget, setWarnTarget] = useState<{ email: string; username: string } | null>(null);
  const [banTarget, setBanTarget] = useState<{ email: string; username: string } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Admins
  const [admins, setAdmins] = useState<Array<{ email: string; username: string }>>([]);
  const [adminIdentifier, setAdminIdentifier] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  const { toast } = useToast();
  const isOwner = user.role === 'owner';

  const loadLogs = async () => {
    const [logsRes, reportsRes] = await Promise.all([
      socketManager.getLogs(),
      socketManager.getReports(),
    ]);
    if (logsRes.ok) setLogs(logsRes.logs || []);
    if (reportsRes.ok) setReports(reportsRes.reports || []);
    setActiveSection('logs');
  };

  const loadBans = async () => {
    const response = await socketManager.getBans();
    if (response.ok) setBans(response.bans || {});
    setActiveSection('bans');
  };

  const loadUsers = async () => {
    const response = await socketManager.getUsers();
    if (response.ok) setRegUsers(response.users || []);
    setActiveSection('users');
  };

  const loadAdmins = () => {
    socketManager.getSocket()?.emit('getAdmins', (response: any) => {
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

  const handleWarn = async () => {
    if (!warnTarget || !actionReason.trim()) return;
    setActionLoading(true);
    const response = await socketManager.warnUser(warnTarget.email, actionReason.trim());
    setActionLoading(false);
    if (response.ok) {
      toast({ title: 'Warning Sent', description: `${warnTarget.username} has been warned` });
      setWarnTarget(null);
      setActionReason('');
    } else {
      toast({ title: 'Error', description: (response as any).message || 'Failed to warn user', variant: 'destructive' });
    }
  };

  const handleBan = async () => {
    if (!banTarget || !actionReason.trim()) return;
    setActionLoading(true);
    const response = await socketManager.banUser(banTarget.email, actionReason.trim());
    setActionLoading(false);
    if (response.ok) {
      toast({ title: 'User Banned', description: `${banTarget.username} has been banned` });
      setBanTarget(null);
      setActionReason('');
      // refresh user list and bans
      loadUsers();
    } else {
      toast({ title: 'Error', description: (response as any).message || 'Failed to ban user', variant: 'destructive' });
    }
  };

  const handleSetAdmin = async (action: 'add' | 'remove') => {
    if (!adminIdentifier.trim()) return;
    setAdminLoading(true);
    socketManager.getSocket()?.emit('setAdmin', { identifier: adminIdentifier.trim(), action }, (response: any) => {
      setAdminLoading(false);
      if (response.ok) {
        setAdmins(response.admins || []);
        setAdminIdentifier('');
        toast({ title: action === 'add' ? 'Admin Added' : 'Admin Removed', description: action === 'add' ? `${adminIdentifier} is now an admin` : `${adminIdentifier} is no longer an admin` });
      } else {
        toast({ title: 'Error', description: response.message || 'Failed to update admin', variant: 'destructive' });
      }
    });
  };

  const canActOn = (targetRole: string) => {
    if (targetRole === 'owner') return false;
    if (targetRole === 'admin' && !isOwner) return false;
    return true;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col">
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
          <div className="w-48 border-r border-border p-4 space-y-1 flex-shrink-0 overflow-y-auto">
            <Button variant={activeSection === 'logs' ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={loadLogs}>
              <List className="h-4 w-4 mr-2" />View Logs
            </Button>
            <Button variant={activeSection === 'bans' ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={loadBans}>
              <Ban className="h-4 w-4 mr-2" />Manage Bans
            </Button>
            <Button variant={activeSection === 'users' ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={loadUsers}>
              <Users className="h-4 w-4 mr-2" />User Management
            </Button>

            {isOwner && (
              <div className="border-t border-border pt-2 mt-2 space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 px-1">Owner Only</p>
                <Button variant="ghost" className="w-full justify-start text-yellow-500 hover:text-yellow-500 hover:bg-yellow-500/10" onClick={() => { onOpenBroadcast(); onClose(); }}>
                  <Megaphone className="h-4 w-4 mr-2" />Broadcast
                </Button>
                <Button variant="ghost" className="w-full justify-start text-yellow-500 hover:text-yellow-500 hover:bg-yellow-500/10" onClick={() => { onOpenPasswords(); onClose(); }}>
                  <Lock className="h-4 w-4 mr-2" />Passwords
                </Button>
                <Button variant={activeSection === 'admins' ? 'secondary' : 'ghost'} className="w-full justify-start text-yellow-500 hover:text-yellow-500 hover:bg-yellow-500/10" onClick={loadAdmins}>
                  <ShieldPlus className="h-4 w-4 mr-2" />Admins
                </Button>
              </div>
            )}
          </div>

          {/* Content area */}
          <div className="flex-1 p-4 overflow-y-auto min-h-0">

            {/* Empty state */}
            {activeSection === null && (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <p className="text-sm">Select an option from the left panel</p>
              </div>
            )}

            {/* LOGS */}
            {activeSection === 'logs' && (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                  <h3 className="font-semibold">
                    {logView === 'all' ? `All Logs (${logs.length})` : `Reported Messages (${reports.length})`}
                  </h3>
                  <div className="flex rounded-md border border-border overflow-hidden text-xs">
                    <button
                      className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${logView === 'all' ? 'bg-secondary text-foreground' : 'bg-transparent text-muted-foreground hover:bg-muted'}`}
                      onClick={() => setLogView('all')}
                    >
                      <List className="h-3 w-3" />All
                    </button>
                    <button
                      className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors border-l border-border ${logView === 'reported' ? 'bg-secondary text-foreground' : 'bg-transparent text-muted-foreground hover:bg-muted'}`}
                      onClick={() => setLogView('reported')}
                    >
                      <Flag className="h-3 w-3 text-red-400" />Reported
                      {reports.length > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-1 rounded-full leading-none">{reports.length}</span>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2">
                  {logView === 'all' && (
                    logs.length === 0
                      ? <p className="text-sm text-muted-foreground">No logs yet</p>
                      : logs.map((log, i) => (
                        <div key={i} className="text-xs bg-muted rounded p-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{(log as any).username || log.email}</span>
                            <span className="text-muted-foreground">{new Date(log.ts).toLocaleString()}</span>
                          </div>
                          <div className="text-muted-foreground">[{log.room}] {log.text}</div>
                        </div>
                      ))
                  )}
                  {logView === 'reported' && (
                    reports.length === 0
                      ? <p className="text-sm text-muted-foreground">No reported messages yet</p>
                      : reports.map((report: any) => (
                        <div key={report.id} className="text-xs bg-red-500/5 border border-red-500/20 rounded p-2">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <Flag className="h-3 w-3 text-red-400" />
                              <span className="font-medium text-red-400">{report.reportedUsername}</span>
                              <span className="text-muted-foreground">reported by {report.reporterUsername}</span>
                            </div>
                            <span className="text-muted-foreground">{new Date(report.ts).toLocaleString()}</span>
                          </div>
                          <div className="text-muted-foreground">[{report.room}] {report.messageText}</div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}

            {/* BANS */}
            {activeSection === 'bans' && (
              <div>
                <h3 className="font-semibold mb-3">Banned Users ({Object.keys(bans).length})</h3>
                {Object.keys(bans).length === 0
                  ? <p className="text-sm text-muted-foreground">No banned users</p>
                  : <div className="space-y-2">
                    {Object.entries(bans).map(([email, ban]) => (
                      <div key={email} className="flex items-center justify-between bg-muted rounded p-3">
                        <div>
                          <div className="text-sm font-medium">{email}</div>
                          <div className="text-xs text-muted-foreground">Reason: {ban.reason}</div>
                          <div className="text-xs text-muted-foreground">By: {ban.issuer}</div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleUnban(email)}>Unban</Button>
                      </div>
                    ))}
                  </div>
                }
              </div>
            )}

            {/* USER MANAGEMENT */}
            {activeSection === 'users' && (
              <div className="h-full flex flex-col">
                <h3 className="font-semibold mb-3 flex-shrink-0">User Management ({regUsers.length})</h3>

                {/* Inline warn confirm */}
                {warnTarget && (
                  <div className="mb-4 p-3 border border-yellow-500/30 bg-yellow-500/5 rounded-lg flex-shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-medium">Warn <span className="text-yellow-500">{warnTarget.username}</span></span>
                    </div>
                    <Input
                      value={actionReason}
                      onChange={e => setActionReason(e.target.value)}
                      placeholder="Reason for warning..."
                      className="mb-2 text-sm"
                      onKeyDown={e => e.key === 'Enter' && handleWarn()}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={actionLoading || !actionReason.trim()} onClick={handleWarn} className="bg-yellow-500 hover:bg-yellow-600 text-black">
                        Send Warning
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setWarnTarget(null); setActionReason(''); }}>Cancel</Button>
                    </div>
                  </div>
                )}

                {/* Inline ban confirm */}
                {banTarget && (
                  <div className="mb-4 p-3 border border-red-500/30 bg-red-500/5 rounded-lg flex-shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Ban className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium">Ban <span className="text-red-500">{banTarget.username}</span></span>
                    </div>
                    <Input
                      value={actionReason}
                      onChange={e => setActionReason(e.target.value)}
                      placeholder="Reason for ban..."
                      className="mb-2 text-sm"
                      onKeyDown={e => e.key === 'Enter' && handleBan()}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" disabled={actionLoading || !actionReason.trim()} onClick={handleBan}>
                        Confirm Ban
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setBanTarget(null); setActionReason(''); }}>Cancel</Button>
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto space-y-1.5">
                  {regUsers.length === 0
                    ? <p className="text-sm text-muted-foreground">No users registered</p>
                    : regUsers
                        .sort((a, b) => {
                          const order = { owner: 0, admin: 1, user: 2 };
                          return (order[a.role as keyof typeof order] ?? 2) - (order[b.role as keyof typeof order] ?? 2);
                        })
                        .map(u => {
                          const isSelf = u.email === user.email;
                          const canAct = canActOn(u.role) && !isSelf;
                          return (
                            <div key={u.email} className="flex items-center justify-between bg-muted rounded px-3 py-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {u.role === 'owner' && <Crown className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />}
                                  {u.role === 'admin' && <Shield className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                                  <span className="text-sm font-medium truncate">{u.username}</span>
                                  {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                              </div>
                              {canAct && (
                                <div className="flex gap-1.5 flex-shrink-0 ml-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs border-yellow-500/40 text-yellow-600 hover:bg-yellow-500/10"
                                    onClick={() => { setWarnTarget({ email: u.email, username: u.username }); setBanTarget(null); setActionReason(''); }}
                                  >
                                    <AlertTriangle className="h-3 w-3 mr-1" />Warn
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs border-red-500/40 text-red-600 hover:bg-red-500/10"
                                    onClick={() => { setBanTarget({ email: u.email, username: u.username }); setWarnTarget(null); setActionReason(''); }}
                                  >
                                    <Ban className="h-3 w-3 mr-1" />Ban
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })
                  }
                </div>
              </div>
            )}

            {/* ADMINS (owner only) */}
            {activeSection === 'admins' && isOwner && (
              <div>
                <h3 className="font-semibold mb-3">Admin Management</h3>
                <div className="bg-muted rounded-lg p-4 mb-4 space-y-3">
                  <Label>Email or Username</Label>
                  <Input value={adminIdentifier} onChange={e => setAdminIdentifier(e.target.value)} placeholder="Enter email or username..." />
                  <div className="flex space-x-2">
                    <Button className="flex-1" size="sm" disabled={adminLoading || !adminIdentifier.trim()} onClick={() => handleSetAdmin('add')}>
                      <ShieldPlus className="h-4 w-4 mr-2" />Give Admin
                    </Button>
                    <Button className="flex-1" size="sm" variant="destructive" disabled={adminLoading || !adminIdentifier.trim()} onClick={() => handleSetAdmin('remove')}>
                      <ShieldMinus className="h-4 w-4 mr-2" />Remove Admin
                    </Button>
                  </div>
                </div>
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Current Admins</h4>
                {admins.length === 0
                  ? <p className="text-sm text-muted-foreground">No admins yet</p>
                  : <div className="space-y-2">
                    {admins.map(admin => (
                      <div key={admin.email} className="flex items-center justify-between bg-muted rounded p-3">
                        <div>
                          <div className="text-sm font-medium flex items-center space-x-2">
                            <Shield className="h-3 w-3 text-red-500" />
                            <span>{admin.username}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">{admin.email}</div>
                        </div>
                        <Button size="sm" variant="outline" className="text-red-500 border-red-500/30 hover:bg-red-500/10"
                          onClick={() => { setAdminIdentifier(admin.email); handleSetAdmin('remove'); }}>
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                }
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
