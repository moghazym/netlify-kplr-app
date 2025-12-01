import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { ChevronLeft, Sparkles, Upload, X, FileText, Image as ImageIcon, PenTool, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import { useToast } from "@/hooks/use-toast";
import { 
  createTestSuite, 
  createScenario,
  uploadTestSuiteAttachments,
  generateScenarios,
  type TestSuiteCreate
} from "@/lib/api-client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function CreateTestSuitePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedProject } = useProject();
  const { toast } = useToast();
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

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
    project_id: 0, // Will be set from selectedProject
  });

  // Set project_id from selectedProject when available
  useEffect(() => {
    if (selectedProject && formData.project_id === 0) {
      setFormData(prev => ({ ...prev, project_id: selectedProject.id }));
    }
  }, [selectedProject]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Validate file types
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/csv'
    ];
    
    const validFiles = files.filter(file => {
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not a supported file type`,
          variant: "destructive"
        });
        return false;
      }
      return true;
    });
    
    setAttachments(prev => [...prev, ...validFiles]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleSaveDraft = async () => {
    if (!user || !formData.name.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide at least a test suite name",
        variant: "destructive"
      });
      return;
    }

    if (!formData.application_url?.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide an application URL",
        variant: "destructive"
      });
      return;
    }

    if (!formData.description?.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide a test suite description",
        variant: "destructive"
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

    try {
      setUploadingFiles(true);
      
      // Create test suite
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

      // Upload attachments if any
      if (attachments.length > 0 && newSuite) {
        try {
          await uploadTestSuiteAttachments(newSuite.id, attachments);
        } catch (error) {
          console.error('Error uploading attachments:', error);
          // Don't fail the whole operation if attachments fail
        }
      }

      toast({
        title: "Draft saved",
        description: "Test suite saved as draft successfully"
      });

      navigate(`/suite/${newSuite.id}/runs`);
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save test suite",
        variant: "destructive"
      });
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleGenerate = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide a test suite name",
        variant: "destructive"
      });
      return;
    }

    if (!formData.application_url?.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide an application URL",
        variant: "destructive"
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

    if (!formData.description?.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide a test suite description for AI generation",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsGenerating(true);
      
      // Generate scenarios using AI
      const response = await generateScenarios({
        test_suite_name: formData.name.trim(),
        application_url: formData.application_url.trim(),
        test_description: formData.description.trim(),
        ai_testing_instructions: formData.ai_testing_instructions?.trim() || undefined,
      });

      // Create test suite with generated scenarios
      await handleApplyScenarios(
        response.scenarios.map((scenario, index) => ({
          id: `scenario-${index}`,
          name: scenario,
          description: scenario,
        }))
      );
    } catch (error) {
      console.error("Error generating scenarios:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate scenarios",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyScenarios = async (scenarios: Array<{ id: string; name: string; description: string }>) => {
    if (!user) return;

    if (!formData.project_id || formData.project_id === 0) {
      toast({
        title: "Error",
        description: "Please select a project/workspace",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploadingFiles(true);
      
      // Create test suite
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

      // Upload attachments if any
      if (attachments.length > 0 && newSuite) {
        try {
          await uploadTestSuiteAttachments(newSuite.id, attachments);
        } catch (error) {
          console.error('Error uploading attachments:', error);
          // Don't fail the whole operation if attachments fail
        }
      }

      // Insert scenarios
      if (scenarios.length > 0 && newSuite) {
        for (const scenario of scenarios) {
          try {
            await createScenario({
              test_suite_id: newSuite.id,
              name: scenario.name,
              description: scenario.description,
            });
          } catch (error) {
            console.error('Error creating scenario:', error);
            // Continue with other scenarios even if one fails
          }
        }
      }

      toast({
        title: "Success",
        description: `Test suite created with ${scenarios.length} scenarios`
      });

      navigate(`/suite/${newSuite.id}/runs`);
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save test suite",
        variant: "destructive"
      });
    } finally {
      setUploadingFiles(false);
    }
  };


  const handleCreateTestSuite = async () => {
    if (!user || !formData.name.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide at least a test suite name",
        variant: "destructive"
      });
      return;
    }

    if (!formData.application_url?.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide an application URL",
        variant: "destructive"
      });
      return;
    }

    if (!formData.description?.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide a test suite description",
        variant: "destructive"
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

    try {
      setUploadingFiles(true);
      
      // Create test suite
      const createData: TestSuiteCreate = {
        name: formData.name.trim(),
        project_id: formData.project_id,
        description: formData.description?.trim() || null,
        application_url: formData.application_url?.trim() || null,
        ai_testing_instructions: null, // Manual mode doesn't use AI instructions
        resolution: formData.resolution || "Desktop Standard",
        creation_mode: "manual",
        preconditions_enabled: formData.preconditions_enabled ?? false,
        preconditions: formData.preconditions || null,
        has_persistent_context: formData.has_persistent_context ?? false,
        exploration_enabled: false, // Manual mode doesn't use exploration
        exploration_step_limit: null,
      };

      const newSuite = await createTestSuite(createData);

      toast({
        title: "Success",
        description: "Test suite created successfully"
      });

      navigate(`/suite/${newSuite.id}/runs`);
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create test suite",
        variant: "destructive"
      });
    } finally {
      setUploadingFiles(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/test-suites">
            <Button variant="ghost" size="sm" className="gap-2">
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Create Test Suite</h2>
            <p className="text-muted-foreground mt-1">
              Create a new test suite to organize your test scenarios
            </p>
          </div>
        </div>

        <Card className="p-6">
          <div className="space-y-6">
            <Tabs 
              value={formData.creation_mode || "manual"} 
              onValueChange={(value) => 
                setFormData({ ...formData, creation_mode: value as "manual" | "ai" })
              }
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual" className="gap-2">
                  <PenTool className="w-4 h-4" />
                  Manual Creation
                </TabsTrigger>
                <TabsTrigger value="ai" className="gap-2">
                  <Sparkles className="w-4 h-4" />
                  AI Generated
                </TabsTrigger>
              </TabsList>

              <TabsContent value="manual" className="space-y-6 mt-6">

                <div>
                  <Label htmlFor="suite-name">
                    Test Suite Name <span className="text-destructive">*</span>
                  </Label>
                  <Input 
                    id="suite-name" 
                    placeholder="e.g., User Authentication Flow"
                    className="mt-2"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="url">
                    Application URL <span className="text-destructive">*</span>
                  </Label>
                  <Input 
                    id="url" 
                    type="url"
                    placeholder="https://example.com"
                    className="mt-2"
                    value={formData.application_url || ""}
                    onChange={(e) => setFormData({ ...formData, application_url: e.target.value || null })}
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    The URL of the application or feature you want to test
                  </p>
                </div>

                <div>
                  <Label htmlFor="description">
                    Test Description <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="Describe what you want to test. For example: Test the login flow including email validation, password requirements, forgot password, and session management..."
                    className="mt-2 min-h-[150px]"
                    value={formData.description || ""}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value || null })}
                    required
                  />
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <Label htmlFor="resolution">Screen Resolution</Label>
                    <Select
                      value={formData.resolution || "Desktop Standard"}
                      onValueChange={(value) => 
                        setFormData({ ...formData, resolution: value })
                      }
                    >
                      <SelectTrigger className="mt-2">
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

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="preconditions_enabled_manual"
                      checked={formData.preconditions_enabled || false}
                      onChange={(e) => 
                        setFormData({ ...formData, preconditions_enabled: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="preconditions_enabled_manual" className="cursor-pointer">
                      Enable Preconditions
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    Set up preconditions that must be met before test execution
                  </p>
                  {formData.preconditions_enabled && (
                    <div className="space-y-2 ml-6">
                      <Label htmlFor="preconditions_manual">Preconditions</Label>
                      <Textarea
                        id="preconditions_manual"
                        placeholder="Describe the preconditions that must be met before test execution..."
                        className="mt-2 min-h-[100px]"
                        value={typeof formData.preconditions === 'string' ? formData.preconditions : ''}
                        onChange={(e) => 
                          setFormData({ 
                            ...formData, 
                            preconditions: e.target.value || null 
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Specify any setup steps or conditions required before running tests
                      </p>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="has_persistent_context_manual"
                      checked={formData.has_persistent_context || false}
                      onChange={(e) => 
                        setFormData({ ...formData, has_persistent_context: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="has_persistent_context_manual" className="cursor-pointer">
                      Persistent Context
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    Maintain browser context across test scenarios
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    className="gap-2 flex-1"
                    onClick={handleCreateTestSuite}
                    disabled={uploadingFiles || !formData.name.trim() || !formData.application_url?.trim() || !formData.description?.trim()}
                  >
                    {uploadingFiles ? "Creating..." : "Create Test Suite"}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="ai" className="space-y-6 mt-6">
                <div>
                  <Label htmlFor="suite-name-ai">
                    Test Suite Name <span className="text-destructive">*</span>
                  </Label>
                  <Input 
                    id="suite-name-ai" 
                    placeholder="e.g., User Authentication Flow"
                    className="mt-2"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="url-ai">
                    Application URL <span className="text-destructive">*</span>
                  </Label>
                  <Input 
                    id="url-ai" 
                    type="url"
                    placeholder="https://example.com"
                    className="mt-2"
                    value={formData.application_url || ""}
                    onChange={(e) => setFormData({ ...formData, application_url: e.target.value || null })}
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    The URL of the application or feature you want to test
                  </p>
                </div>

                <div>
                  <Label htmlFor="description-ai">
                    Test Description <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="description-ai"
                    placeholder="Describe what you want to test. For example: Test the login flow including email validation, password requirements, forgot password, and session management..."
                    className="mt-2 min-h-[150px]"
                    value={formData.description || ""}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value || null })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="ai-instructions">AI Testing Instructions (Optional)</Label>
                  <Textarea
                    id="ai-instructions"
                    placeholder="Provide specific instructions for the AI tester. For example: Focus on edge cases, test with invalid inputs, verify error messages are user-friendly..."
                    className="mt-2 min-h-[100px]"
                    value={formData.ai_testing_instructions || ""}
                    onChange={(e) => setFormData({ ...formData, ai_testing_instructions: e.target.value || null })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Additional context or specific testing requirements for the AI
                  </p>
                </div>

                <div>
                  <Label>Attachments (Optional)</Label>
                  <p className="text-xs text-muted-foreground mt-1 mb-2">
                    Upload images, documents, or previous test cases to provide context
                  </p>
                  
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.txt,.csv"
                    onChange={handleFileSelect}
                  />
                  
                  <label
                    htmlFor="file-upload"
                    className="block border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                  >
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Click to upload files
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Supports: Images (JPG, PNG, GIF, WEBP), PDF, DOC, DOCX, TXT, CSV
                    </p>
                  </label>

                  {attachments.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {attachments.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-muted rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {getFileIcon(file.type)}
                            <div>
                              <p className="text-sm font-medium">{file.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(file.size)}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAttachment(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <Label htmlFor="resolution">Screen Resolution</Label>
                    <Select
                      value={formData.resolution || "Desktop Standard"}
                      onValueChange={(value) => 
                        setFormData({ ...formData, resolution: value })
                      }
                    >
                      <SelectTrigger className="mt-2">
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
                  {formData.preconditions_enabled && (
                    <div className="space-y-2 ml-6">
                      <Label htmlFor="preconditions">Preconditions</Label>
                      <Textarea
                        id="preconditions"
                        placeholder="Describe the preconditions that must be met before test execution..."
                        className="mt-2 min-h-[100px]"
                        value={typeof formData.preconditions === 'string' ? formData.preconditions : ''}
                        onChange={(e) => 
                          setFormData({ 
                            ...formData, 
                            preconditions: e.target.value || null 
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Specify any setup steps or conditions required before running tests
                      </p>
                    </div>
                  )}

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
                        className="mt-2"
                      />
                      <p className="text-xs text-muted-foreground">
                        Maximum number of steps the AI can take during exploration
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    className="gap-2 flex-1"
                    onClick={handleGenerate}
                    disabled={uploadingFiles || isGenerating || !formData.name.trim() || !formData.application_url?.trim() || !formData.description?.trim()}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generate Scenarios
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleSaveDraft}
                    disabled={uploadingFiles || !formData.name.trim() || !formData.application_url?.trim() || !formData.description?.trim()}
                  >
                    {uploadingFiles ? "Saving..." : "Save as Draft"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </Card>

      </div>
    </div>
  );
}

