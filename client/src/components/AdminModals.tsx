import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Ban, X, TriangleAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { MessageLog, Ban as BanType, Warning } from '@/types/chat';

interface AdminModalsProps {
  logs: MessageLog[];
  bans: Record<string, BanType>;
  showLogs: boolean;
  showBans: boolean;
  showWarning: Warning | null;
  showBanned: BanType | null;
  onCloseLogs: () => void;
  onCloseBans: () => void;
  onCloseWarning: () => void;
  onCloseBanned: () => void;
  onWarnUser: (email: string, reason: string) => Promise<void>;
  onBanUser: (email: string, reason: string) => Promise<void>;
  onUnbanUser: (email: string) => Promise<void>;
  onAckWarning: () => Promise<void>;
}

export function AdminModals({
  logs,
  bans,
  showLogs,
  showBans,
  showWarning,
  showBanned,
  onCloseLogs,
  onCloseBans,
  onCloseWarning,
  onCloseBanned,
  onWarnUser,
  onBanUser,
  onUnbanUser,
  onAckWarning
}: AdminModalsProps) {
  const [warnEmail, setWarnEmail] = useState('');
  const [warnReason, setWarnReason] = useState('');
  const [banEmail, setBanEmail] = useState('');
  const [banReason, setBanReason] = useState('');
  const { toast } = useToast();

  const handleWarn = async (email: string) => {
    setWarnEmail(email);
    setWarnReason('');
  };

  const submitWarn = async () => {
    if (!warnEmail || !warnReason) return;
    
    try {
      await onWarnUser(warnEmail, warnReason);
      setWarnEmail('');
      setWarnReason('');
      toast({
        title: "Warning Sent",
        description: `Warning sent to ${warnEmail}`
      });
    } catch (error: any) {
      let errorMessage = "Failed to send warning";
      if (error.message && error.message.includes('cannot-warn-owner')) {
        errorMessage = "Cannot warn the owner";
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const handleBan = async (email: string) => {
    setBanEmail(email);
    setBanReason('');
  };

  const submitBan = async () => {
    if (!banEmail || !banReason) return;
    
    try {
      await onBanUser(banEmail, banReason);
      setBanEmail('');
      setBanReason('');
      toast({
        title: "User Banned",
        description: `${banEmail} has been banned`
      });
    } catch (error: any) {
      let errorMessage = "Failed to ban user";
      if (error.message && error.message.includes('cannot-ban-owner')) {
        errorMessage = "Cannot ban the owner";
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <>
      {/* Logs Modal */}
      <Dialog open={showLogs} onOpenChange={onCloseLogs}>
        <DialogContent className="max-w-4xl max-h-[80vh]" data-testid="modal-logs">
          <DialogHeader>
            <DialogTitle>Message Logs</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-96">
            <div className="space-y-2">
              {logs.map((log, index) => (
                <div 
                  key={index} 
                  className="flex items-center space-x-4 p-3 rounded-lg border border-border hover:bg-muted/30"
                  data-testid={`log-entry-${index}`}
                >
                  <div className="text-xs text-muted-foreground w-20 flex-shrink-0">
                    {formatTime(log.ts)}
                  </div>
                  <div className="text-xs text-muted-foreground w-16 flex-shrink-0">
                    #{log.room}
                  </div>
                  <div className="text-xs font-mono w-24 flex-shrink-0">{log.display}</div>
                  <div 
                    className="flex-1 overflow-x-auto border border-gray-600 rounded-md p-2" 
                    style={{ 
                      maxWidth: '300px',
                      scrollbarWidth: 'thin',
                      scrollbarColor: '#9ca3af #f3f4f6'
                    }}
                  >
                    <div className="text-sm whitespace-nowrap min-w-max text-foreground">{log.text}</div>
                  </div>
                  <div className="flex space-x-2 flex-shrink-0">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleWarn(log.email)}
                      disabled={log.role === 'owner'}
                      data-testid={`button-warn-${index}`}
                      className={log.role === 'owner' ? 'opacity-50 cursor-not-allowed' : ''}
                    >
                      <AlertTriangle className="h-3 w-3 text-yellow-500" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleBan(log.email)}
                      disabled={log.role === 'owner'}
                      data-testid={`button-ban-${index}`}
                      className={log.role === 'owner' ? 'opacity-50 cursor-not-allowed' : ''}
                    >
                      <Ban className="h-3 w-3 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Bans Modal */}
      <Dialog open={showBans} onOpenChange={onCloseBans}>
        <DialogContent className="max-w-3xl max-h-[80vh]" data-testid="modal-bans">
          <DialogHeader>
            <DialogTitle>Banned Users</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-96">
            <div className="space-y-2">
              {Object.entries(bans).map(([email, ban], index) => (
                <div 
                  key={email} 
                  className="flex items-center justify-between p-3 rounded-lg border border-border"
                  data-testid={`ban-entry-${index}`}
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{email}</div>
                    <div className="text-xs text-muted-foreground">Reason: {ban.reason}</div>
                    <div className="text-xs text-muted-foreground">Banned by: {ban.issuer}</div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onUnbanUser(email)}
                    className="text-green-500 border-green-500 hover:bg-green-500/10"
                    data-testid={`button-unban-${index}`}
                  >
                    Unban
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Warning Modal */}
      {showWarning && (
        <Dialog open={!!showWarning} onOpenChange={onCloseWarning}>
          <DialogContent data-testid="modal-warning">
            <DialogHeader>
              <div className="text-center">
                <div className="bg-yellow-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TriangleAlert className="text-yellow-500 h-8 w-8" />
                </div>
                <DialogTitle className="text-yellow-500">Warning Received</DialogTitle>
              </div>
            </DialogHeader>
            <div className="text-center">
              <p className="text-muted-foreground mb-4" data-testid="text-warning-reason">
                {showWarning.reason}
              </p>
              <div className="text-xs text-muted-foreground mb-6">
                <p>Issued by: {showWarning.issuer}</p>
                <p>Time: {new Date(showWarning.ts).toLocaleString()}</p>
              </div>
            </div>
            <DialogFooter>
              <Button 
                onClick={onAckWarning} 
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-black"
                data-testid="button-acknowledge-warning"
              >
                I Understand
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Banned Modal */}
      {showBanned && (
        <Dialog open={!!showBanned} onOpenChange={onCloseBanned}>
          <DialogContent data-testid="modal-banned">
            <DialogHeader>
              <div className="text-center">
                <div className="bg-red-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Ban className="text-red-500 h-8 w-8" />
                </div>
                <DialogTitle className="text-red-500">Account Banned</DialogTitle>
              </div>
            </DialogHeader>
            <div className="text-center">
              <p className="text-muted-foreground mb-4" data-testid="text-ban-reason">
                {showBanned.reason}
              </p>
              <div className="text-xs text-muted-foreground mb-6">
                <p>Issued by: {showBanned.issuer}</p>
                <p>Time: {new Date(showBanned.ts).toLocaleString()}</p>
              </div>
            </div>
            <DialogFooter>
              <Button 
                onClick={() => window.location.reload()} 
                variant="secondary"
                className="w-full"
              >
                Refresh Page
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Warn User Modal */}
      <Dialog open={!!warnEmail} onOpenChange={() => setWarnEmail('')}>
        <DialogContent data-testid="modal-warn-user">
          <DialogHeader>
            <DialogTitle>Warn User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input value={warnEmail} readOnly />
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea
                value={warnReason}
                onChange={(e) => setWarnReason(e.target.value)}
                placeholder="Enter warning reason..."
                data-testid="textarea-warn-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWarnEmail('')}>
              Cancel
            </Button>
            <Button 
              onClick={submitWarn} 
              disabled={!warnReason}
              data-testid="button-submit-warn"
            >
              Send Warning
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban User Modal */}
      <Dialog open={!!banEmail} onOpenChange={() => setBanEmail('')}>
        <DialogContent data-testid="modal-ban-user">
          <DialogHeader>
            <DialogTitle>Ban User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input value={banEmail} readOnly />
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Enter ban reason..."
                data-testid="textarea-ban-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanEmail('')}>
              Cancel
            </Button>
            <Button 
              onClick={submitBan} 
              disabled={!banReason}
              variant="destructive"
              data-testid="button-submit-ban"
            >
              Ban User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
