import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  X, List, Ban, Megaphone, Lock, ShieldPlus, ShieldMinus, Crown, Shield, Users,
  Flag, AlertTriangle, Clock, MicOff, Mic, UserCog, ChevronDown, EyeOff, Eye, Monitor,
} from 'lucide-react';
import type { User, MessageLog, Ban as BanType } from '@/types/chat';

const TIMEOUT_OPTIONS = [
  { label: '5 minutes',  value: 5 * 60 * 1000 },
  { label: '10 minutes', value: 10 * 60 * 1000 },
  { label: '30 minutes', value: 30 * 60 * 1000 },
  { label: '1 hour',     value: 60 * 60 * 1000 },
  { label: '5 hours',    value: 5 * 60 * 60 * 1000 },
  { label: '12 hours',   value: 12 * 60 * 60 * 1000 },
  { label: '1 day',      value: 24 * 60 * 60 * 1000 },
  { label: '1 week',     value: 7 * 24 * 60 * 60 * 1000 },
  { label: '1 month',    value: 30 * 24 * 60 * 60 * 1000 },
];

type Section = 'logs' | 'bans' | 'users' | 'roles' | 'blackout' | 'userinfo' | null;

interface RegUser {
  email: string;
  username: string;
  role: string;
  timedOut?: boolean;
  timedOutUntil?: number | null;
  voiceBanned?: boolean;
}

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
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [logView, setLogView] = useState<'all' | 'reported'>('all');
  const [bans, setBans] = useState<Record<string, BanType>>({});
  const [regUsers, setRegUsers] = useState<RegUser[]>([]);
  const [roleIdentifier, setRoleIdentifier] = useState('');
  const [roleLoading, setRoleLoading] = useState(false);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [blackoutLoading, setBlackoutLoading] = useState(false);
  const [userInfoData, setUserInfoData] = useState<any[]>([]);

  // Inline action states
  const [warnTarget, setWarnTarget] = useState<RegUser | null>(null);
  const [banTarget, setBanTarget] = useState<RegUser | null>(null);
  const [timeoutTarget, setTimeoutTarget] = useState<RegUser | null>(null);
  const [timeoutDuration, setTimeoutDuration] = useState<number>(TIMEOUT_OPTIONS[0].value);
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const { toast } = useToast();
  const isOwner = user.role === 'owner';
  const sock = () => socketManager.getSocket();

  const clearActions = () => { setWarnTarget(null); setBanTarget(null); setTimeoutTarget(null); setActionReason(''); };

  const canActOn = (u: RegUser) => {
    if (u.email === user.email) return false;
    if (u.role === 'owner') return false;
    if (u.role === 'admin' && !isOwner) return false;
    return true;
  };

  const loadLogs = async () => {
    const [logsRes, reportsRes] = await Promise.all([socketManager.getLogs(), socketManager.getReports()]);
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
    clearActions();
    setActiveSection('users');
  };

  const loadRoles = async () => {
    const response = await socketManager.getUsers();
    if (response.ok) setRegUsers(response.users || []);
    setActiveSection('roles');
  };

  const loadBlacklist = async () => {
    const [blRes, usersRes] = await Promise.all([socketManager.getEmailBlacklist(), socketManager.getUsers()]);
    if (blRes.ok) setBlacklist(blRes.blacklist || []);
    if (usersRes.ok) setRegUsers(usersRes.users || []);
    setActiveSection('blackout');
  };

  const loadUserInfo = async () => {
    const res = await socketManager.getUserInfo();
    if (res.ok) setUserInfoData(res.users || []);
    setActiveSection('userinfo');
  };

  const handleAddBlacklist = async (email: string) => {
    setBlackoutLoading(true);
    const res = await socketManager.addEmailBlacklist(email);
    setBlackoutLoading(false);
    if (res.ok) {
      setBlacklist(prev => prev.includes(email) ? prev : [...prev, email]);
      toast({ title: 'Email Blacked Out', description: `${email} is now hidden from admins` });
    } else {
      toast({ title: 'Error', description: (res as any).err || 'Failed', variant: 'destructive' });
    }
  };

  const handleRemoveBlacklist = async (email: string) => {
    setBlackoutLoading(true);
    const res = await socketManager.removeEmailBlacklist(email);
    setBlackoutLoading(false);
    if (res.ok) {
      setBlacklist(prev => prev.filter(e => e !== email));
      toast({ title: 'Email Visible', description: `${email} is now visible to admins again` });
    } else {
      toast({ title: 'Error', description: (res as any).err || 'Failed', variant: 'destructive' });
    }
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
      clearActions();
    } else {
      toast({ title: 'Error', description: (response as any).message || 'Failed to warn', variant: 'destructive' });
    }
  };

  const handleBan = async () => {
    if (!banTarget || !actionReason.trim()) return;
    setActionLoading(true);
    const response = await socketManager.banUser(banTarget.email, actionReason.trim());
    setActionLoading(false);
    if (response.ok) {
      toast({ title: 'User Banned', description: `${banTarget.username} has been banned` });
      clearActions();
      loadUsers();
    } else {
      toast({ title: 'Error', description: (response as any).message || 'Failed to ban', variant: 'destructive' });
    }
  };

  const handleTimeout = () => {
    if (!timeoutTarget) return;
    setActionLoading(true);
    sock()?.emit('timeoutUser', { email: timeoutTarget.email, duration: timeoutDuration }, (res: any) => {
      setActionLoading(false);
      if (res?.ok) {
        toast({ title: 'User Timed Out', description: `${timeoutTarget.username} timed out until ${new Date(res.until).toLocaleString()}` });
        clearActions();
        loadUsers();
      } else {
        toast({ title: 'Error', description: res?.err || 'Failed to timeout', variant: 'destructive' });
      }
    });
  };

  const handleRemoveTimeout = (email: string, username: string) => {
    sock()?.emit('removeTimeout', { email }, (res: any) => {
      if (res?.ok) {
        toast({ title: 'Timeout Removed', description: `${username} can send messages again` });
        loadUsers();
      } else {
        toast({ title: 'Error', description: res?.err || 'Failed to remove timeout', variant: 'destructive' });
      }
    });
  };

  const handleVoiceBan = (email: string, username: string) => {
    sock()?.emit('voiceBanUser', { email }, (res: any) => {
      if (res?.ok) {
        toast({ title: 'Voice Banned', description: `${username} can no longer join voice channels` });
        loadUsers();
      } else {
        toast({ title: 'Error', description: res?.err || 'Failed to voice ban', variant: 'destructive' });
      }
    });
  };

  const handleVoiceUnban = (email: string, username: string) => {
    sock()?.emit('voiceUnbanUser', { email }, (res: any) => {
      if (res?.ok) {
        toast({ title: 'Voice Unban', description: `${username} can join voice channels again` });
        loadUsers();
      } else {
        toast({ title: 'Error', description: res?.err || 'Failed to voice unban', variant: 'destructive' });
      }
    });
  };

  const handleSetRole = (email: string, username: string, role: 'user' | 'admin' | 'owner') => {
    setRoleLoading(true);
    sock()?.emit('setRole', { email, role }, (res: any) => {
      setRoleLoading(false);
      if (res?.ok) {
        const label = role === 'user' ? 'regular user' : role;
        toast({ title: 'Role Updated', description: `${username} is now a ${label}` });
        loadUsers();
      } else {
        toast({ title: 'Error', description: res?.err || 'Failed to update role', variant: 'destructive' });
      }
    });
  };

  const sortedUsers = [...regUsers].sort((a, b) => {
    const order: Record<string, number> = { owner: 0, admin: 1, user: 2 };
    return (order[a.role] ?? 2) - (order[b.role] ?? 2);
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
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
                <Button variant={activeSection === 'roles' ? 'secondary' : 'ghost'} className="w-full justify-start text-yellow-500 hover:text-yellow-500 hover:bg-yellow-500/10" onClick={loadRoles}>
                  <UserCog className="h-4 w-4 mr-2" />Role Management
                </Button>
                <Button variant={activeSection === 'blackout' ? 'secondary' : 'ghost'} className="w-full justify-start text-yellow-500 hover:text-yellow-500 hover:bg-yellow-500/10" onClick={loadBlacklist}>
                  <EyeOff className="h-4 w-4 mr-2" />Email Blackout
                </Button>
                <Button variant={activeSection === 'userinfo' ? 'secondary' : 'ghost'} className="w-full justify-start text-yellow-500 hover:text-yellow-500 hover:bg-yellow-500/10" onClick={loadUserInfo}>
                  <Monitor className="h-4 w-4 mr-2" />User Info
                </Button>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 p-4 overflow-y-auto min-h-0">
            {activeSection === null && (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <p className="text-sm">Select an option from the left panel</p>
              </div>
            )}

            {/* ── LOGS ── */}
            {activeSection === 'logs' && (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                  <h3 className="font-semibold">{logView === 'all' ? `All Logs (${logs.length})` : `Reported (${reports.length})`}</h3>
                  <div className="flex rounded-md border border-border overflow-hidden text-xs">
                    <button className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${logView === 'all' ? 'bg-secondary text-foreground' : 'bg-transparent text-muted-foreground hover:bg-muted'}`} onClick={() => setLogView('all')}>
                      <List className="h-3 w-3" />All
                    </button>
                    <button className={`px-3 py-1.5 flex items-center gap-1.5 border-l border-border transition-colors ${logView === 'reported' ? 'bg-secondary text-foreground' : 'bg-transparent text-muted-foreground hover:bg-muted'}`} onClick={() => setLogView('reported')}>
                      <Flag className="h-3 w-3 text-red-400" />Reported
                      {reports.length > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-1 rounded-full leading-none">{reports.length}</span>}
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {logView === 'all' && (logs.length === 0 ? <p className="text-sm text-muted-foreground">No logs yet</p> : logs.map((log, i) => (
                    <div key={i} className="text-xs bg-muted rounded p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{(log as any).username || log.email}</span>
                        <span className="text-muted-foreground">{new Date(log.ts).toLocaleString()}</span>
                      </div>
                      <div className="text-muted-foreground">[{log.room}] {log.text}</div>
                    </div>
                  )))}
                  {logView === 'reported' && (reports.length === 0 ? <p className="text-sm text-muted-foreground">No reported messages yet</p> : reports.map((r: any) => (
                    <div key={r.id} className="text-xs bg-red-500/5 border border-red-500/20 rounded p-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <Flag className="h-3 w-3 text-red-400" />
                          <span className="font-medium text-red-400">{r.reportedUsername}</span>
                          <span className="text-muted-foreground">by {r.reporterUsername}</span>
                        </div>
                        <span className="text-muted-foreground">{new Date(r.ts).toLocaleString()}</span>
                      </div>
                      <div className="text-muted-foreground">[{r.room}] {r.messageText}</div>
                    </div>
                  )))}
                </div>
              </div>
            )}

            {/* ── BANS ── */}
            {activeSection === 'bans' && (
              <div>
                <h3 className="font-semibold mb-3">Banned Users ({Object.keys(bans).length})</h3>
                {Object.keys(bans).length === 0 ? <p className="text-sm text-muted-foreground">No banned users</p> : (
                  <div className="space-y-2">
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
                )}
              </div>
            )}

            {/* ── USER MANAGEMENT ── */}
            {activeSection === 'users' && (
              <div className="h-full flex flex-col">
                <h3 className="font-semibold mb-3 flex-shrink-0">User Management ({regUsers.length})</h3>

                {/* Warn confirm */}
                {warnTarget && (
                  <div className="mb-4 p-3 border border-yellow-500/30 bg-yellow-500/5 rounded-lg flex-shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-medium">Warn <span className="text-yellow-500">{warnTarget.username}</span></span>
                    </div>
                    <Input value={actionReason} onChange={e => setActionReason(e.target.value)} placeholder="Reason for warning..." className="mb-2 text-sm" onKeyDown={e => e.key === 'Enter' && handleWarn()} />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={actionLoading || !actionReason.trim()} onClick={handleWarn} className="bg-yellow-500 hover:bg-yellow-600 text-black">Send Warning</Button>
                      <Button size="sm" variant="ghost" onClick={clearActions}>Cancel</Button>
                    </div>
                  </div>
                )}

                {/* Ban confirm */}
                {banTarget && (
                  <div className="mb-4 p-3 border border-red-500/30 bg-red-500/5 rounded-lg flex-shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Ban className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium">Ban <span className="text-red-500">{banTarget.username}</span></span>
                    </div>
                    <Input value={actionReason} onChange={e => setActionReason(e.target.value)} placeholder="Reason for ban..." className="mb-2 text-sm" onKeyDown={e => e.key === 'Enter' && handleBan()} />
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" disabled={actionLoading || !actionReason.trim()} onClick={handleBan}>Confirm Ban</Button>
                      <Button size="sm" variant="ghost" onClick={clearActions}>Cancel</Button>
                    </div>
                  </div>
                )}

                {/* Timeout confirm */}
                {timeoutTarget && (
                  <div className="mb-4 p-3 border border-orange-500/30 bg-orange-500/5 rounded-lg flex-shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium">Timeout <span className="text-orange-500">{timeoutTarget.username}</span></span>
                    </div>
                    <Select value={String(timeoutDuration)} onValueChange={v => setTimeoutDuration(Number(v))}>
                      <SelectTrigger className="mb-2 text-sm">
                        <SelectValue placeholder="Select duration..." />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEOUT_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button size="sm" disabled={actionLoading} onClick={handleTimeout} className="bg-orange-500 hover:bg-orange-600 text-white">Apply Timeout</Button>
                      <Button size="sm" variant="ghost" onClick={clearActions}>Cancel</Button>
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto space-y-1.5">
                  {regUsers.length === 0 ? <p className="text-sm text-muted-foreground">No users registered</p> : sortedUsers.map(u => {
                    const canAct = canActOn(u);
                    const isSelf = u.email === user.email;
                    return (
                      <div key={u.email} className={`bg-muted rounded px-3 py-2 border-l-2 ${u.timedOut ? 'border-orange-500' : u.voiceBanned ? 'border-purple-500' : 'border-transparent'}`}>
                        <div className="flex items-start justify-between gap-2">
                          {/* User info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {u.role === 'owner' && <Crown className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />}
                              {u.role === 'admin' && <Shield className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                              <span className="text-sm font-medium">{u.username}</span>
                              {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                              {u.timedOut && u.timedOutUntil && (
                                <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full font-medium" title={`Until ${new Date(u.timedOutUntil).toLocaleString()}`}>
                                  TIMED OUT
                                </span>
                              )}
                              {u.voiceBanned && (
                                <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full font-medium">
                                  VC BANNED
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                          </div>

                          {/* Action buttons */}
                          {canAct && (
                            <div className="flex flex-wrap gap-1 flex-shrink-0 justify-end">
                              <Button size="sm" variant="outline" className="h-6 px-2 text-[11px] border-yellow-500/40 text-yellow-600 hover:bg-yellow-500/10"
                                onClick={() => { clearActions(); setWarnTarget(u); }}>
                                <AlertTriangle className="h-2.5 w-2.5 mr-1" />Warn
                              </Button>
                              <Button size="sm" variant="outline" className="h-6 px-2 text-[11px] border-red-500/40 text-red-600 hover:bg-red-500/10"
                                onClick={() => { clearActions(); setBanTarget(u); }}>
                                <Ban className="h-2.5 w-2.5 mr-1" />Ban
                              </Button>
                              {u.timedOut ? (
                                <Button size="sm" variant="outline" className="h-6 px-2 text-[11px] border-orange-500/40 text-orange-500 hover:bg-orange-500/10"
                                  onClick={() => handleRemoveTimeout(u.email, u.username)}>
                                  <Clock className="h-2.5 w-2.5 mr-1" />Untimeout
                                </Button>
                              ) : (
                                <Button size="sm" variant="outline" className="h-6 px-2 text-[11px] border-orange-500/40 text-orange-500 hover:bg-orange-500/10"
                                  onClick={() => { clearActions(); setTimeoutTarget(u); setTimeoutDuration(TIMEOUT_OPTIONS[0].value); }}>
                                  <Clock className="h-2.5 w-2.5 mr-1" />Timeout
                                </Button>
                              )}
                              {u.voiceBanned ? (
                                <Button size="sm" variant="outline" className="h-6 px-2 text-[11px] border-purple-500/40 text-purple-500 hover:bg-purple-500/10"
                                  onClick={() => handleVoiceUnban(u.email, u.username)}>
                                  <Mic className="h-2.5 w-2.5 mr-1" />VC Unban
                                </Button>
                              ) : (
                                <Button size="sm" variant="outline" className="h-6 px-2 text-[11px] border-purple-500/40 text-purple-500 hover:bg-purple-500/10"
                                  onClick={() => handleVoiceBan(u.email, u.username)}>
                                  <MicOff className="h-2.5 w-2.5 mr-1" />VC Ban
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* ── EMAIL BLACKOUT ── */}
            {activeSection === 'blackout' && (
              <div className="h-full flex flex-col">
                <h3 className="font-semibold mb-1 flex-shrink-0">Email Blackout</h3>
                <p className="text-xs text-muted-foreground mb-4 flex-shrink-0">
                  Blacked-out emails appear as <span className="font-mono bg-muted px-1 rounded text-foreground">[hidden]</span> for admins in User Management, Manage Bans, and Logs. You (owner) always see real emails.
                </p>
                <div className="flex-1 overflow-y-auto space-y-1.5">
                  {sortedUsers.map(u => {
                    const isBlackedOut = blacklist.includes(u.email.toLowerCase());
                    const isSelf = u.email === user.email;
                    return (
                      <div key={u.email} className={`bg-muted rounded px-3 py-2.5 flex items-center justify-between gap-3 border-l-2 ${isBlackedOut ? 'border-yellow-500' : 'border-transparent'}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {u.role === 'owner' && <Crown className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />}
                            {u.role === 'admin' && <Shield className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                            <span className="text-sm font-medium">{u.username}</span>
                            {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                            {isBlackedOut && (
                              <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                                <EyeOff className="h-2.5 w-2.5" />BLACKED OUT
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono truncate">{u.email}</div>
                        </div>
                        {!isSelf && (
                          isBlackedOut ? (
                            <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11px] border-green-500/40 text-green-500 hover:bg-green-500/10 flex-shrink-0"
                              disabled={blackoutLoading} onClick={() => handleRemoveBlacklist(u.email.toLowerCase())}>
                              <Eye className="h-3 w-3 mr-1" />Unblackout
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11px] border-yellow-500/40 text-yellow-500 hover:bg-yellow-500/10 flex-shrink-0"
                              disabled={blackoutLoading} onClick={() => handleAddBlacklist(u.email.toLowerCase())}>
                              <EyeOff className="h-3 w-3 mr-1" />Blackout
                            </Button>
                          )
                        )}
                        {isSelf && <span className="text-[11px] text-muted-foreground italic flex-shrink-0">Cannot hide self</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── ROLE MANAGEMENT ── */}
            {activeSection === 'roles' && (
              <div className="h-full flex flex-col">
                <h3 className="font-semibold mb-1 flex-shrink-0">Role Management ({regUsers.length})</h3>
                <p className="text-xs text-muted-foreground mb-3 flex-shrink-0">Assign or remove admin and owner roles. Owners cannot be demoted by other owners except yourself.</p>
                <div className="flex-1 overflow-y-auto space-y-1.5">
                  {sortedUsers.map(u => {
                    const isSelf = u.email === user.email;
                    const isTargetOwner = u.role === 'owner';
                    const canChangeRole = !isSelf && !isTargetOwner;
                    return (
                      <div key={u.email} className={`bg-muted rounded px-3 py-2.5 flex items-center justify-between gap-2 border-l-2 ${u.role === 'owner' ? 'border-yellow-500' : u.role === 'admin' ? 'border-red-500' : 'border-transparent'}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {u.role === 'owner' && <Crown className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />}
                            {u.role === 'admin' && <Shield className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                            <span className="text-sm font-medium">{u.username}</span>
                            {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${u.role === 'owner' ? 'bg-yellow-500/20 text-yellow-400' : u.role === 'admin' ? 'bg-red-500/20 text-red-400' : 'bg-muted-foreground/20 text-muted-foreground'}`}>
                              {u.role}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                        </div>
                        {canChangeRole && (
                          <div className="flex flex-wrap gap-1 flex-shrink-0 justify-end">
                            {u.role === 'admin' ? (
                              <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11px] border-red-500/40 text-red-500 hover:bg-red-500/10"
                                disabled={roleLoading} onClick={() => handleSetRole(u.email, u.username, 'user')}>
                                <ShieldMinus className="h-3 w-3 mr-1" />Remove Admin
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11px] border-red-500/40 text-red-500 hover:bg-red-500/10"
                                disabled={roleLoading} onClick={() => handleSetRole(u.email, u.username, 'admin')}>
                                <ShieldPlus className="h-3 w-3 mr-1" />Make Admin
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11px] border-yellow-500/40 text-yellow-500 hover:bg-yellow-500/10"
                              disabled={roleLoading} onClick={() => handleSetRole(u.email, u.username, 'owner')}>
                              <Crown className="h-3 w-3 mr-1" />Make Owner
                            </Button>
                          </div>
                        )}
                        {(isSelf || isTargetOwner) && (
                          <span className="text-[11px] text-muted-foreground italic flex-shrink-0">
                            {isSelf ? 'Cannot change self' : 'Protected'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── USER INFO ── */}
            {activeSection === 'userinfo' && (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                  <h3 className="font-semibold">User Info ({userInfoData.length})</h3>
                  <Button size="sm" variant="outline" onClick={loadUserInfo}>Refresh</Button>
                </div>
                {userInfoData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No user data collected yet. Users appear here after they log in.</p>
                ) : (
                  <div className="space-y-3 overflow-y-auto">
                    {userInfoData.map((u) => (
                      <div key={u.email} className="bg-muted rounded-lg p-3 border border-border text-xs space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-sm">{u.username}</span>
                          <span className="text-muted-foreground">{u.email}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-1 font-mono">
                          <div className="flex gap-2">
                            <span className="text-muted-foreground w-24 flex-shrink-0">IP Address</span>
                            <span className="text-yellow-400 font-semibold select-text">{u.ip}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-muted-foreground w-24 flex-shrink-0">Platform</span>
                            <span className="select-text">{u.platform}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-muted-foreground w-24 flex-shrink-0">Language</span>
                            <span className="select-text">{u.language}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-muted-foreground w-24 flex-shrink-0">Screen</span>
                            <span className="select-text">{u.screenWidth && u.screenHeight ? `${u.screenWidth}×${u.screenHeight}` : 'Unknown'}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-muted-foreground w-24 flex-shrink-0">Timezone</span>
                            <span className="select-text">{u.timezone}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-muted-foreground w-24 flex-shrink-0">Browser</span>
                            <span className="select-text break-all text-[10px] leading-tight">{u.userAgent}</span>
                          </div>
                          <div className="flex gap-2 pt-1 border-t border-border mt-1">
                            <span className="text-muted-foreground w-24 flex-shrink-0">First seen</span>
                            <span>{new Date(u.firstSeen).toLocaleString()}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-muted-foreground w-24 flex-shrink-0">Last seen</span>
                            <span>{new Date(u.lastSeen).toLocaleString()}</span>
                          </div>
                        </div>
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
