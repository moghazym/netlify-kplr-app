import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { 
  createTestSuite, 
  getProjects,
  type TestSuiteCreate,
  type ProjectResponse 
} from "@/lib/api-client";

export default function CreateTestSuitePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [formData, setFormData] = useState<TestSuiteCreate>({
    name: "",
    description: null,
    application_url: null,
    ai_testing_instructions: null,
    resolution: "Desktop Standard",
    creation_mode: "manual",
    preconditions_enabled: false,
    preconditions: null,
    has_persistent_context: false,
    exploration_enabled: false,
    exploration_step_limit: null,
    project_id: 0, // Will be set when projects load
  });

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const projectsData = await getProjects();
      setProjects(projectsData);
      
      // Auto-select first project if available
      if (projectsData.length > 0) {
        setFormData(prev => ({ ...prev, project_id: projectsData[0].id }));
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load projects/workspaces",
        variant: "destructive",
      });
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Test suite name is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.project_id || formData.project_id === 0) {
      toast({
        title: "Error",
        description: "Please select a project/workspace",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Prepare the data according to TestSuiteCreate schema
      const createData: TestSuiteCreate = {
        name: formData.name.trim(),
        project_id: formData.project_id,
        description: formData.description?.trim() || null,
        application_url: formData.application_url?.trim() || null,
        ai_testing_instructions: formData.ai_testing_instructions?.trim() || null,
        resolution: formData.resolution || "Desktop Standard",
        creation_mode: formData.creation_mode || "manual",
        preconditions_enabled: formData.preconditions_enabled ?? false,
        preconditions: formData.preconditions || null,
        has_persistent_context: formData.has_persistent_context ?? false,
        exploration_enabled: formData.exploration_enabled ?? false,
        exploration_step_limit: formData.exploration_step_limit || null,
      };

      const newSuite = await createTestSuite(createData);

      toast({
        title: "Success",
        description: "Test suite created successfully",
      });

      // Navigate to the test suite runs page
      navigate(`/suite/${newSuite.id}/runs`);
    } catch (error) {
      console.error('Error creating test suite:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create test suite",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loadingProjects) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/test-suites")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Test Suites
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>No Projects Available</CardTitle>
            <CardDescription>
              You need to create a project/workspace before creating a test suite.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Please create a project/workspace first from the sidebar, then try again.
            </p>
            <Button onClick={() => navigate("/test-suites")}>
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/test-suites")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Create Test Suite</h2>
          <p className="text-muted-foreground mt-1">
            Create a new test suite to organize your test scenarios
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Provide basic details about your test suite
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project_id">Project / Workspace *</Label>
              <Select
                value={formData.project_id?.toString() || ""}
                onValueChange={(value) => 
                  setFormData({ ...formData, project_id: parseInt(value, 10) })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a project/workspace" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Test Suite Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., E-commerce Regression Tests"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) => 
                  setFormData({ ...formData, description: e.target.value || null })
                }
                placeholder="Describe what this test suite covers..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="application_url">Application URL</Label>
              <Input
                id="application_url"
                type="url"
                value={formData.application_url || ""}
                onChange={(e) => 
                  setFormData({ ...formData, application_url: e.target.value || null })
                }
                placeholder="https://example.com"
              />
              <p className="text-xs text-muted-foreground">
                The base URL of the application to test
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Testing Configuration</CardTitle>
            <CardDescription>
              Configure AI-powered testing options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ai_testing_instructions">AI Testing Instructions</Label>
              <Textarea
                id="ai_testing_instructions"
                value={formData.ai_testing_instructions || ""}
                onChange={(e) => 
                  setFormData({ ...formData, ai_testing_instructions: e.target.value || null })
                }
                placeholder="Provide specific instructions for AI-driven test execution..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Instructions that guide the AI agent during test execution
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="resolution">Screen Resolution</Label>
              <Select
                value={formData.resolution || "Desktop Standard"}
                onValueChange={(value) => 
                  setFormData({ ...formData, resolution: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Desktop Standard">Desktop Standard (1920x1080)</SelectItem>
                  <SelectItem value="Desktop Large">Desktop Large (2560x1440)</SelectItem>
                  <SelectItem value="Laptop">Laptop (1366x768)</SelectItem>
                  <SelectItem value="Tablet">Tablet (768x1024)</SelectItem>
                  <SelectItem value="Mobile">Mobile (375x667)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="creation_mode">Creation Mode</Label>
              <Select
                value={formData.creation_mode || "manual"}
                onValueChange={(value: "manual" | "ai") => 
                  setFormData({ ...formData, creation_mode: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="ai">AI Generated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Advanced Options</CardTitle>
            <CardDescription>
              Configure advanced testing features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="preconditions_enabled"
                checked={formData.preconditions_enabled || false}
                onChange={(e) => 
                  setFormData({ ...formData, preconditions_enabled: e.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="preconditions_enabled" className="cursor-pointer">
                Enable Preconditions
              </Label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Set up preconditions that must be met before test execution
            </p>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="has_persistent_context"
                checked={formData.has_persistent_context || false}
                onChange={(e) => 
                  setFormData({ ...formData, has_persistent_context: e.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="has_persistent_context" className="cursor-pointer">
                Persistent Context
              </Label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Maintain browser context across test scenarios
            </p>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="exploration_enabled"
                checked={formData.exploration_enabled || false}
                onChange={(e) => 
                  setFormData({ ...formData, exploration_enabled: e.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="exploration_enabled" className="cursor-pointer">
                Enable Exploration
              </Label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Allow AI to explore the application beyond defined scenarios
            </p>

            {formData.exploration_enabled && (
              <div className="space-y-2 ml-6">
                <Label htmlFor="exploration_step_limit">Exploration Step Limit</Label>
                <Input
                  id="exploration_step_limit"
                  type="number"
                  min="1"
                  value={formData.exploration_step_limit || ""}
                  onChange={(e) => 
                    setFormData({ 
                      ...formData, 
                      exploration_step_limit: e.target.value ? parseInt(e.target.value, 10) : null 
                    })
                  }
                  placeholder="Maximum exploration steps"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of steps the AI can take during exploration
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/test-suites")}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Test Suite"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

