import { useState, useEffect } from "react";
import { Home, FileText, PlayCircle, Settings, ChevronDown, Key, LogOut, User, Calendar, Plus, Trash2, CreditCard } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import { getAuthBaseUrl } from "@/lib/subdomain";
import {
  Sidebar,
  SidebarContent,
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
  { title: "Integrations", url: "/integrations", icon: Settings },
];

// Project/Workspace interface matching the API response (ProjectResponse schema)
interface Workspace {
  id: number; // Changed from string to number to match API schema
  name: string;
  description: string | null;
  user_id: number; // Changed from string to number to match API schema
  created_at: string; // ISO date-time string
  updated_at: string | null; // ISO date-time string or null
}

export function AppSidebar() {
  const { state } = useSidebar();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const collapsed = state === "collapsed";

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    if (user) {
      fetchWorkspaces();
    }
  }, [user]);

  const fetchWorkspaces = async () => {
    try {
      // Use the API endpoint for getting projects/workspaces
      // The endpoint will be provided later, using a placeholder for now
      const API_ENDPOINT = import.meta.env.VITE_PROJECTS_API_ENDPOINT || '/api/projects/';
      
      const workspaceData = await apiGet<Workspace[]>(API_ENDPOINT);
      
      setWorkspaces(workspaceData || []);
      if (workspaceData && workspaceData.length > 0) {
        setCurrentWorkspace(workspaceData[0]);
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error);
      toast({
        title: "Error",
        description: "Failed to load workspaces",
        variant: "destructive"
      });
    }
  };

  const handleCreateWorkspace = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newWorkspaceName.trim()) {
      try {
        // TODO: Update with the actual create project endpoint when available
        const CREATE_ENDPOINT = import.meta.env.VITE_CREATE_PROJECT_API_ENDPOINT || '/api/projects/';
        
        const workspace = await apiPost<Workspace>(CREATE_ENDPOINT, {
          name: newWorkspaceName.trim(),
        });

        toast({
          title: "Success",
          description: "Workspace created successfully"
        });

        setWorkspaces(prev => [workspace, ...prev]);
        setCurrentWorkspace(workspace);
        setNewWorkspaceName("");
        setIsCreating(false);
      } catch (error) {
        console.error('Error creating workspace:', error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to create workspace",
          variant: "destructive"
        });
      }
    }
  };

  const handleDeleteWorkspace = async (id: number) => {
    try {
      // TODO: Update with the actual delete project endpoint when available
      const DELETE_ENDPOINT = import.meta.env.VITE_DELETE_PROJECT_API_ENDPOINT || `/api/projects/${id}`;
      
      await apiDelete(DELETE_ENDPOINT);

      toast({
        title: "Success",
        description: "Workspace deleted successfully"
      });

      const updatedWorkspaces = workspaces.filter(w => w.id !== id);
      setWorkspaces(updatedWorkspaces);
      
      if (currentWorkspace?.id === id) {
        setCurrentWorkspace(updatedWorkspaces[0] || null);
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
        <SidebarHeader className="border-b border-sidebar-border">
          {!collapsed && (
            <div className="flex items-center gap-2 px-2">
              <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center">
                <span className="text-white font-bold text-sm">Kplr</span>
              </div>
              <span className="text-sm font-medium">Your AI QA</span>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center mx-auto">
              <span className="text-white font-bold text-sm">K</span>
            </div>
          )}
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="px-2 mb-2">
              {!collapsed && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between h-auto py-2">
                      <span className="font-semibold text-sm truncate">
                        {currentWorkspace?.name || "Select Workspace"}
                      </span>
                      <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="start">
                    {workspaces.map((workspace) => (
                      <div key={workspace.id} className="relative group">
                        <DropdownMenuItem
                          onClick={() => setCurrentWorkspace(workspace)}
                          className="pr-8"
                        >
                          {workspace.name}
                        </DropdownMenuItem>
                        {workspaces.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteId(workspace.id);
                            }}
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
                {menuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={collapsed ? item.title : undefined}>
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
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* User Section */}
          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
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
                      const authUrl = getAuthBaseUrl();
                      window.location.href = authUrl;
                    }}
                    tooltip={collapsed ? "Logout" : undefined}
                  >
                    <LogOut className="h-4 w-4" />
                    {!collapsed && <span>Logout</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workspace</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this workspace? This action cannot be undone and will delete all associated data.
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

