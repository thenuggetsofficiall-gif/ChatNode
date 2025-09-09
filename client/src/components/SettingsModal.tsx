import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { X, Upload } from "lucide-react";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { UploadResult } from '@uppy/core';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onUpdateProfile: (updates: { username?: string; profileImageUrl?: string }) => Promise<void>;
}

export function SettingsModal({ isOpen, onClose, currentUser, onUpdateProfile }: SettingsModalProps) {
  const [username, setUsername] = useState(currentUser?.username || "");
  const [profileImageUrl, setProfileImageUrl] = useState(currentUser?.profileImageUrl || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const handleGetUploadParameters = async () => {
    const response = await fetch('/api/objects/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    return {
      method: 'PUT' as const,
      url: data.uploadURL,
    };
  };

  const handleUploadComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      if (uploadedFile.uploadURL) {
        setProfileImageUrl(uploadedFile.uploadURL);
        toast({
          title: "Image Uploaded",
          description: "Profile picture uploaded successfully"
        });
      }
    }
  };

  const handleSave = async () => {
    if (!username.trim()) {
      toast({
        title: "Error",
        description: "Username cannot be empty",
        variant: "destructive"
      });
      return;
    }

    setIsUpdating(true);
    try {
      const updates: { username?: string; profileImageUrl?: string } = {};
      
      if (username !== currentUser?.username) {
        updates.username = username.trim();
      }
      
      if (profileImageUrl !== currentUser?.profileImageUrl) {
        updates.profileImageUrl = profileImageUrl;
      }

      await onUpdateProfile(updates);
      
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully"
      });
      
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <div className="flex justify-between items-center">
          <DialogTitle>Settings</DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
            data-testid="button-close-settings"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-6 pt-4">
          {/* Profile Picture */}
          <div className="space-y-2">
            <Label>Profile Picture</Label>
            <div className="flex items-center space-x-4">
              {profileImageUrl && (
                <img 
                  src={profileImageUrl} 
                  alt="Profile" 
                  className="w-16 h-16 rounded-full object-cover border-2 border-border"
                />
              )}
              <ObjectUploader
                maxNumberOfFiles={1}
                maxFileSize={5242880} // 5MB
                onGetUploadParameters={handleGetUploadParameters}
                onComplete={handleUploadComplete}
                buttonClassName="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                <span>Upload Image</span>
              </ObjectUploader>
            </div>
          </div>

          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              data-testid="input-username"
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={onClose}
              data-testid="button-cancel-settings"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isUpdating}
              data-testid="button-save-settings"
            >
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}