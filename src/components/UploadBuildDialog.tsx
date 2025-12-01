import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface UploadBuildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function UploadBuildDialog({ open, onOpenChange, onSuccess }: UploadBuildDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    builderId: "",
    platform: "ios" as "ios" | "android",
    appName: "",
  });
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file || !user) {
      toast({
        title: "Error",
        description: "Please select a file to upload",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);

    try {
      // TODO: Implement upload logic here
      // This is just the UI - backend integration to be added
      
      toast({
        title: "Success",
        description: "Build uploaded successfully"
      });

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload build",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      builderId: "",
      platform: "ios",
      appName: "",
    });
    setFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload App Build</DialogTitle>
          <DialogDescription>
            Upload a new iOS or Android build for testing
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="platform">Platform</Label>
            <Select
              value={formData.platform}
              onValueChange={(value: "ios" | "android") =>
                setFormData({ ...formData, platform: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ios">iOS (.ipa or .zip)</SelectItem>
                <SelectItem value="android">Android (.apk)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="appName">App Name</Label>
            <Input
              id="appName"
              value={formData.appName}
              onChange={(e) => setFormData({ ...formData, appName: e.target.value })}
              placeholder="My App"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="builderId">Builder ID</Label>
            <Input
              id="builderId"
              value={formData.builderId}
              onChange={(e) => setFormData({ ...formData, builderId: e.target.value })}
              placeholder="com.example.myapp"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Build File</Label>
            <Input
              id="file"
              type="file"
              accept={formData.platform === 'ios' ? '.ipa,.zip' : '.apk'}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />
            {file && (
              <p className="text-sm text-muted-foreground">
                Selected: {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Build number and date will be auto-generated
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isUploading}>
              {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

