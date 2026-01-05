import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock3,
  Cpu,
  Download,
  Layers,
  Plus,
  Smartphone,
  UploadCloud,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/contexts/ProjectContext";
import { cn } from "@/lib/utils";
import {
  completeMobileAppBuild,
  createMobileApp,
  getMobileApps,
  requestMobileAppBuildUpload,
  MobileAppResponse,
  MobileAppBuildResponse,
} from "@/lib/api-client";

type MobilePlatform = "android" | "ios";

const StatCard = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) => (
  <Card className="border-none bg-white shadow-sm">
    <CardContent className="p-5 flex items-center justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold mt-1">{value}</p>
      </div>
      <div className="h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
        <Icon className="h-5 w-5" />
      </div>
    </CardContent>
  </Card>
);

const formatBytes = (size?: number | null) => {
  if (!size || size <= 0) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

const platformLabel = (platform?: string) => {
  if (!platform) return "";
  return platform === "ios" ? "iOS" : "Android";
};

const platformGradient = (platform?: string) =>
  platform === "ios" ? "from-indigo-500 via-sky-500 to-cyan-400" : "from-orange-500 via-amber-500 to-rose-500";

export default function AppRegistryPage() {
  const { selectedProject } = useProject();
  const { toast } = useToast();

  const [apps, setApps] = useState<MobileAppResponse[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadingBuild, setUploadingBuild] = useState(false);
  const [creatingApp, setCreatingApp] = useState(false);

  const [createForm, setCreateForm] = useState({
    name: "",
    packageId: "",
    platform: "android" as MobilePlatform,
    description: "",
  });

  const [uploadForm, setUploadForm] = useState({
    version: "",
    channel: "",
    notes: "",
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const selectedApp = useMemo(() => {
    if (!apps.length) {
      return undefined;
    }
    if (selectedAppId) {
      return apps.find((app) => app.id.toString() === selectedAppId) ?? apps[0];
    }
    return apps[0];
  }, [apps, selectedAppId]);

  const totalBuilds = useMemo(
    () => apps.reduce((sum, app) => sum + (app.builds?.length || 0), 0),
    [apps]
  );

  const recentUploads = useMemo(() => {
    const entries: Array<{ appName: string; build: MobileAppBuildResponse }> = [];
    apps.forEach((app) => {
      (app.builds || []).forEach((build) => {
        entries.push({ appName: app.name, build });
      });
    });
    return entries
      .sort((a, b) => new Date(b.build.created_at).getTime() - new Date(a.build.created_at).getTime())
      .slice(0, 5);
  }, [apps]);

  const loadApps = useCallback(async () => {
    if (!selectedProject) {
      setApps([]);
      setSelectedAppId(null);
      return;
    }
    setIsLoading(true);
    try {
      const data = await getMobileApps(selectedProject.id);
      const normalized = data || [];
      setApps(normalized);
      if (normalized.length && !selectedAppId) {
        setSelectedAppId(normalized[0].id.toString());
      } else if (
        normalized.length &&
        selectedAppId &&
        !normalized.some((app) => app.id.toString() === selectedAppId)
      ) {
        setSelectedAppId(normalized[0].id.toString());
      }
    } catch (error: any) {
      console.error("Failed to load mobile apps", error);
      toast({
        title: "Unable to load apps",
        description: error?.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedProject, toast, selectedAppId]);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  const handleCreateApp = async () => {
    if (!selectedProject || !createForm.name.trim() || !createForm.packageId.trim()) {
      return;
    }
    setCreatingApp(true);
    try {
      await createMobileApp({
        project_id: selectedProject.id,
        name: createForm.name.trim(),
        package_id: createForm.packageId.trim(),
        platform: createForm.platform,
        description: createForm.description.trim() || undefined,
      });
      setIsCreateModalOpen(false);
      setCreateForm({ name: "", packageId: "", platform: "android", description: "" });
      toast({ title: "App registered", description: "You can now upload builds for this app." });
      loadApps();
    } catch (error: any) {
      console.error("Failed to create app", error);
      toast({
        title: "Failed to create app",
        description: error?.message || "Please verify your inputs and try again.",
        variant: "destructive",
      });
    } finally {
      setCreatingApp(false);
    }
  };

  const handleUploadBuild = async () => {
    if (!selectedApp || !uploadFile || !uploadForm.version.trim()) {
      return;
    }
    setUploadingBuild(true);
    try {
      const uploadMeta = await requestMobileAppBuildUpload(selectedApp.id, {
        file_name: uploadFile.name,
        content_type: uploadFile.type || "application/octet-stream",
        version: uploadForm.version.trim(),
        channel: uploadForm.channel.trim() || undefined,
        notes: uploadForm.notes.trim() || undefined,
      });

      await fetch(uploadMeta.signed_url, {
        method: "PUT",
        headers: {
          "Content-Type": uploadFile.type || "application/octet-stream",
        },
        body: uploadFile,
      });

      await completeMobileAppBuild(uploadMeta.build_id, {
        file_size: uploadFile.size,
        status: "ready",
      });

      toast({ title: "Build uploaded", description: `${uploadFile.name} is ready for cloud runs.` });
      setIsUploadModalOpen(false);
      setUploadForm({ version: "", channel: "", notes: "" });
      setUploadFile(null);
      loadApps();
    } catch (error: any) {
      console.error("Failed to upload build", error);
      toast({
        title: "Upload failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingBuild(false);
    }
  };

  if (!selectedProject) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Select a project to manage mobile apps.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-orange-500 font-semibold">App Registry</p>
            <h1 className="text-3xl font-semibold text-slate-900 mt-2">
              Upload mobile builds and keep them ready for cloud emulators
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Every APK or IPA is versioned, auditable, and ready to spin up a mobile workspace. Drag, drop, and keep
              every build traceable.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" className="border-dashed" onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add App
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-500"
              onClick={() => setIsUploadModalOpen(true)}
              disabled={!selectedApp || !apps.length}
            >
              <UploadCloud className="h-4 w-4 mr-2" />
              Upload new build
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Managed apps" value={`${apps.length}`} icon={Smartphone} />
          <StatCard label="Total builds" value={`${totalBuilds}`} icon={Cpu} />
          <StatCard
            label="Latest upload"
            value={
              recentUploads[0]
                ? formatDistanceToNow(new Date(recentUploads[0].build.created_at), { addSuffix: true })
                : "—"
            }
            icon={Clock3}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[2.1fr,1fr]">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Applications</CardTitle>
              <CardDescription>Choose which binary to run in cloud emulators</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading && <p className="text-sm text-muted-foreground">Loading apps…</p>}
              {!isLoading && apps.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-muted-foreground">
                  No mobile apps yet. Create one to start uploading builds.
                </div>
              )}
              {!isLoading &&
                apps.map((app) => {
                  const isActive = selectedApp?.id === app.id;
                  return (
                    <button
                      key={app.id}
                      onClick={() => setSelectedAppId(app.id.toString())}
                      className={cn(
                        "w-full text-left rounded-2xl border p-4 transition hover:border-orange-200 hover:bg-orange-50/40",
                        isActive ? "border-orange-300 bg-orange-50 shadow-sm" : "border-slate-100 bg-white"
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={cn(
                            "h-12 w-12 rounded-xl bg-gradient-to-br text-white flex items-center justify-center font-semibold uppercase tracking-wide text-sm",
                            platformGradient(app.platform)
                          )}
                        >
                          {app.name
                            .split(" ")
                            .map((word) => word[0])
                            .join("")
                            .slice(0, 2)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-900">{app.name}</p>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 uppercase tracking-wide">
                              {platformLabel(app.platform)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{app.package_id}</p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-3">
                            <span className="inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                              {app.builds?.length ? `${app.builds.length} builds` : "No builds"}
                            </span>
                            {app.builds?.[0] && (
                              <span className="inline-flex items-center gap-1">
                                <Clock3 className="h-3 w-3 text-orange-500" />
                                {formatDistanceToNow(new Date(app.builds[0].created_at), { addSuffix: true })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="text-base">Selected build</CardTitle>
              <CardDescription>What we’ll install before a mobile cloud run</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedApp && <p className="text-sm text-muted-foreground">Select an app to see details.</p>}
              {selectedApp && (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">App</p>
                    <p className="text-lg font-semibold">{selectedApp.name}</p>
                    <p className="text-xs text-slate-500">{selectedApp.package_id}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Latest build</span>
                      <span className="font-semibold">
                        {selectedApp.builds?.[0]?.version ?? "No builds yet"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {selectedApp.builds?.[0]
                          ? formatDistanceToNow(new Date(selectedApp.builds[0].created_at), { addSuffix: true })
                          : "—"}
                      </span>
                      <span>{selectedApp.builds?.[0]?.status ?? "—"}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Recent versions</p>
                    <div className="space-y-2">
                      {(selectedApp.builds || []).slice(0, 3).map((build) => (
                        <div key={build.id} className="flex items-center justify-between text-sm">
                          <span>{build.version}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(build.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      ))}
                      {!selectedApp.builds?.length && (
                        <p className="text-xs text-muted-foreground">No builds yet.</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr,1fr]">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Build history</CardTitle>
              <CardDescription>Every artifact stays immutable and tracked</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="timeline" className="space-y-4">
                <TabsList className="bg-slate-100">
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="devices" disabled>
                    Device presets
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="timeline" className="space-y-4">
                  {selectedApp?.builds?.length ? (
                    selectedApp.builds.map((build) => (
                      <div key={build.id} className="rounded-2xl border border-slate-100 p-4 bg-slate-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-900">{build.version}</p>
                            <p className="text-xs text-muted-foreground">
                              {build.channel || "default"} • {platformLabel(selectedApp.platform)}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "text-xs px-2 py-0.5 rounded-full capitalize",
                              build.status === "ready"
                                ? "bg-emerald-100 text-emerald-700"
                                : build.status === "uploading"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-700"
                            )}
                          >
                            {build.status}
                          </span>
                        </div>
                        {build.notes && <p className="text-sm text-slate-600 mt-3">{build.notes}</p>}
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-4 flex-wrap">
                          <Clock3 className="h-3 w-3" />
                          {formatDistanceToNow(new Date(build.created_at), { addSuffix: true })}
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <Layers className="h-3 w-3" />
                          {formatBytes(build.file_size)}
                          {build.download_url && (
                            <>
                              <span className="h-1 w-1 rounded-full bg-slate-300" />
                              <a
                                href={build.download_url}
                                target="_blank"
                                className="inline-flex items-center gap-1 text-orange-600 hover:underline"
                                rel="noreferrer"
                              >
                                <Download className="h-3 w-3" />
                                Download
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center">
                      <Activity className="h-6 w-6 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No build history yet.</p>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="devices">
                  <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center">
                    <Cpu className="h-8 w-8 text-slate-400 mx-auto mb-3" />
                    <p className="font-medium text-slate-800">Device matrices coming soon</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Define Pixel, Samsung, and tablet presets once and reuse them across suites.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent uploads</CardTitle>
              <CardDescription>Everything is linked to your audit log</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentUploads.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-muted-foreground">
                  No uploads yet. Upload a build to see activity here.
                </div>
              )}
              {recentUploads.map((item) => (
                <div key={`${item.appName}-${item.build.id}`} className="flex gap-3">
                  <div className="w-10">
                    <div className="h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
                      <Download className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{item.appName}</p>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(item.build.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">
                      {item.build.version} · {item.build.channel || "default"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.build.notes || "No release notes provided."}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Add app to registry</DialogTitle>
            <DialogDescription>Register once and upload builds any time.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="app-name">App name</Label>
              <Input
                id="app-name"
                placeholder="KPLR Mobile"
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-package">Package ID</Label>
              <Input
                id="app-package"
                placeholder="com.usekplr.mobile"
                value={createForm.packageId}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, packageId: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-platform">Platform</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["android", "ios"] as MobilePlatform[]).map((platform) => (
                  <button
                    key={platform}
                    onClick={() => setCreateForm((prev) => ({ ...prev, platform }))}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition",
                      createForm.platform === platform
                        ? "border-orange-400 bg-orange-50 text-orange-700"
                        : "border-slate-200 hover:border-orange-200 hover:bg-orange-50/40"
                    )}
                  >
                    {platform === "ios" ? "iOS" : "Android"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-description">Description</Label>
              <Textarea
                id="app-description"
                placeholder="Short summary of the app and environment."
                value={createForm.description}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateApp} disabled={creatingApp}>
              {creatingApp ? "Saving..." : "Create app"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Upload new build</DialogTitle>
            <DialogDescription>Attach a build so the emulator pulls it instantly.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="build-version">Version</Label>
              <Input
                id="build-version"
                placeholder="1.4.0 (235)"
                value={uploadForm.version}
                onChange={(event) => setUploadForm((prev) => ({ ...prev, version: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="build-channel">Channel</Label>
              <Input
                id="build-channel"
                placeholder="staging, nightly, hotfix"
                value={uploadForm.channel}
                onChange={(event) => setUploadForm((prev) => ({ ...prev, channel: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="build-notes">Release notes</Label>
              <Textarea
                id="build-notes"
                placeholder="What changed in this build?"
                value={uploadForm.notes}
                onChange={(event) => setUploadForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="build-file">Build file</Label>
              <Input
                id="build-file"
                type="file"
                accept={selectedApp?.platform === "ios" ? ".ipa,.zip" : ".apk,.aab"}
                onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
              />
              {uploadFile && (
                <p className="text-xs text-muted-foreground">
                  {uploadFile.name} • {(uploadFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsUploadModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUploadBuild} disabled={uploadingBuild || !selectedApp}>
              {uploadingBuild ? "Uploading..." : "Upload build"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
