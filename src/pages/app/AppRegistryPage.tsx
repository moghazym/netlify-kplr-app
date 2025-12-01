import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2, Smartphone, Calendar, Hash, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { UploadBuildDialog } from "@/components/UploadBuildDialog";
import { formatDistanceToNow } from "date-fns";
import { 
  getMobileApps, 
  deleteMobileAppBuild,
  MobileAppResponse,
  MobileAppBuildResponse 
} from "@/lib/api-client";

export default function AppRegistryPage() {
  const { user } = useAuth();
  const { selectedProject } = useProject();
  const { toast } = useToast();
  const [apps, setApps] = useState<MobileAppResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

  useEffect(() => {
    if (user && selectedProject) {
      loadApps();
    }
  }, [user, selectedProject]);

  const loadApps = async () => {
    if (!selectedProject) return;
    
    setIsLoading(true);
    try {
      const data = await getMobileApps(selectedProject.id);
      setApps(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load app builds",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (buildId: number) => {
    if (!confirm('Are you sure you want to delete this build?')) return;

    try {
      await deleteMobileAppBuild(buildId);
      toast({
        title: "Success",
        description: "Build deleted successfully"
      });
      loadApps();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete build",
        variant: "destructive"
      });
    }
  };

  const formatFileSize = (bytes: number | null | undefined) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Group builds by app name and platform
  const groupedApps = apps.reduce((acc, app) => {
    const key = app.name;
    if (!acc[key]) {
      acc[key] = { ios: [], android: [] };
    }
    
    if (app.builds && app.builds.length > 0) {
      app.builds.forEach(build => {
        if (app.platform.toLowerCase() === 'ios') {
          acc[key].ios.push({ ...build, app });
        } else if (app.platform.toLowerCase() === 'android') {
          acc[key].android.push({ ...build, app });
        }
      });
    }
    
    return acc;
  }, {} as Record<string, { ios: Array<MobileAppBuildResponse & { app: MobileAppResponse }>, android: Array<MobileAppBuildResponse & { app: MobileAppResponse }> }>);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            App Registry
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your iOS and Android app builds
          </p>
        </div>
        <Button onClick={() => setIsUploadDialogOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Build
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading builds...
        </div>
      ) : Object.keys(groupedApps).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Smartphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No app builds yet</h3>
            <p className="text-muted-foreground mb-4">
              Upload your first iOS or Android build to get started
            </p>
            <Button onClick={() => setIsUploadDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Build
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedApps).map(([appName, platforms]) => (
            <Card key={appName}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  {appName}
                </CardTitle>
                <CardDescription>
                  {platforms.ios.length + platforms.android.length} build(s)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {platforms.ios.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Badge variant="outline">iOS</Badge>
                      {platforms.ios.length} build(s)
                    </h4>
                    <div className="grid gap-3">
                      {platforms.ios.map((build) => (
                        <div
                          key={build.id}
                          className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-1.5 text-sm">
                                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="font-mono">{build.version}</span>
                                </div>
                                {build.channel && (
                                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <FileText className="h-3.5 w-3.5" />
                                    <span>{build.channel}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                  <Calendar className="h-3.5 w-3.5" />
                                  <span>{new Date(build.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatFileSize(build.file_size)} • Uploaded {formatDistanceToNow(new Date(build.created_at), { addSuffix: true })}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(build.id)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {platforms.android.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Badge variant="outline">Android</Badge>
                      {platforms.android.length} build(s)
                    </h4>
                    <div className="grid gap-3">
                      {platforms.android.map((build) => (
                        <div
                          key={build.id}
                          className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-1.5 text-sm">
                                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="font-mono">{build.version}</span>
                                </div>
                                {build.channel && (
                                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <FileText className="h-3.5 w-3.5" />
                                    <span>{build.channel}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                  <Calendar className="h-3.5 w-3.5" />
                                  <span>{new Date(build.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatFileSize(build.file_size)} • Uploaded {formatDistanceToNow(new Date(build.created_at), { addSuffix: true })}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(build.id)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <UploadBuildDialog
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        onSuccess={loadApps}
      />
    </div>
  );
}

