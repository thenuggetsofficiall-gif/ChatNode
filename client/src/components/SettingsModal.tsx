import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { X, Upload } from "lucide-react";

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
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if it's a PNG file
    if (!file.type.includes('png')) {
      toast({
        title: "Invalid File Type",
        description: "Please select a PNG image file",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    try {
      // Get upload URL
      const response = await fetch('/api/objects/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadURL } = await response.json();

      // Upload file
      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      // Convert upload URL to object storage path
      const objectPath = uploadURL.split('/').pop(); // Get the object ID
      const profileImagePath = `/objects/uploads/${objectPath}`;
      setProfileImageUrl(profileImagePath);
      
      toast({
        title: "Image Uploaded",
        description: "Profile picture uploaded successfully"
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      // Clear the input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
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
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,image/png"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="input-profile-image"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-2"
                  data-testid="button-upload-image"
                >
                  <Upload className="h-4 w-4" />
                  <span>{isUploading ? "Uploading..." : "Upload PNG"}</span>
                </Button>
              </div>
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