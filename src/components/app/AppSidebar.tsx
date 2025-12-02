import { useState, useRef } from "react";
import { Home, FileText, PlayCircle, Settings, ChevronDown, Key, LogOut, User, Calendar, Plus, Trash2, CreditCard, Smartphone } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import { useToast } from "@/hooks/use-toast";
import { createProject, deleteProject } from "@/lib/api-client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Test Suites", url: "/test-suites", icon: FileText },
  { title: "Test Runs", url: "/test-runs", icon: PlayCircle },
  { title: "Scheduler", url: "/scheduler", icon: Calendar },
  { title: "Usage & Billing", url: "/pricing", icon: CreditCard },
  { title: "Secrets & Variables", url: "/secrets", icon: Key },
  { title: "App Registry", url: "/app-registry", icon: Smartphone, comingSoon: true },
  { title: "Integrations", url: "/integrations", icon: Settings, comingSoon: true },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { user, logout } = useAuth();
  const { projects, selectedProject, setSelectedProject, refreshProjects } = useProject();
  const { toast } = useToast();
  const collapsed = state === "collapsed";

  const [isCreating, setIsCreating] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const isCreatingWorkspaceRef = useRef(false);

  const handleCreateWorkspace = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newWorkspaceName.trim()) {
      // Prevent duplicate submissions
      if (isCreatingWorkspaceRef.current) {
        return;
      }

      const workspaceName = newWorkspaceName.trim();
      
      try {
        isCreatingWorkspaceRef.current = true;
        const workspace = await createProject({
          name: workspaceName,
        });

        toast({
          title: "Success",
          description: "Workspace created successfully"
        });

        // Refresh projects list and select the new one
        await refreshProjects(workspace);
        setNewWorkspaceName("");
        setIsCreating(false);
      } catch (error) {
        console.error('Error creating workspace:', error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to create workspace",
          variant: "destructive"
        });
      } finally {
        isCreatingWorkspaceRef.current = false;
      }
    }
  };

  const handleDeleteWorkspace = async (id: number) => {
    try {
      await deleteProject(id);

      toast({
        title: "Success",
        description: "Workspace deleted successfully"
      });

      // Refresh projects list
      await refreshProjects();

      // If the deleted project was selected, select the first available project
      if (selectedProject?.id === id) {
        const remainingProjects = projects.filter(p => p.id !== id);
        if (remainingProjects.length > 0) {
          setSelectedProject(remainingProjects[0]);
        } else {
          setSelectedProject(null);
        }
      }
    } catch (error) {
      console.error('Error deleting workspace:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete workspace",
        variant: "destructive"
      });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="px-2 mb-2">
              {!collapsed && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between h-auto py-2 border border-primary/50 hover:border-primary transition-colors">
                      <span className="font-semibold text-sm truncate">
                        {selectedProject?.name || "Select Workspace"}
                      </span>
                      <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="start">
                    {projects.map((workspace) => (
                      <div key={workspace.id} className="relative group">
                        <DropdownMenuItem
                          onClick={() => setSelectedProject(workspace)}
                          className={projects.length > 1 ? "pr-8" : ""}
                        >
                          {workspace.name}
                        </DropdownMenuItem>
                        {projects.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 h-6 w-6 p-0 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteId(workspace.id);
                            }}
                            title="Delete workspace"
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}

                    <DropdownMenuSeparator />

                    {isCreating ? (
                      <div className="px-2 py-1.5" onPointerDown={(e) => e.stopPropagation()}>
                        <Input
                          autoFocus
                          placeholder="Workspace name..."
                          value={newWorkspaceName}
                          onChange={(e) => setNewWorkspaceName(e.target.value)}
                          onKeyDown={handleCreateWorkspace}
                          onBlur={() => {
                            setIsCreating(false);
                            setNewWorkspaceName("");
                          }}
                          className="h-8 text-sm"
                        />
                      </div>
                    ) : (
                      <DropdownMenuItem onSelect={(e) => {
                        e.preventDefault();
                        setIsCreating(true);
                      }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create New Workspace
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems.filter(item => !item.comingSoon).map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild
                      tooltip={collapsed ? item.title : undefined}
                    >
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className={({ isActive }) =>
                          isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : ""
                        }
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {menuItems.filter(item => item.comingSoon).length > 0 && (
                  <>
                    {menuItems.filter(item => item.comingSoon).map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton 
                          asChild={false}
                          tooltip={collapsed ? item.title : undefined}
                          disabled={true}
                          className="opacity-50 cursor-not-allowed"
                        >
                          <div className="flex items-center gap-2 w-full">
                            <item.icon className="h-4 w-4" />
                            {!collapsed && (
                              <span className="flex items-center gap-2">
                                <span>{item.title}</span>
                                <span className="text-xs text-muted-foreground">(Coming Soon)</span>
                              </span>
                            )}
                          </div>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* User Section - Now in Footer */}
        <SidebarFooter className="mt-auto">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip={collapsed ? "Profile" : undefined}>
                <div className="flex items-center">
                  <User className="h-4 w-4" />
                  {!collapsed && (
                    <span className="truncate">{user?.email}</span>
                  )}
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  logout();
                }}
                tooltip={collapsed ? "Logout" : undefined}
              >
                <LogOut className="h-4 w-4" />
                {!collapsed && <span>Logout</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workspace</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the workspace "{projects.find(p => p.id === deleteId)?.name}"? This action cannot be undone and will delete all associated data including test suites, test runs, and schedules.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDeleteWorkspace(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

