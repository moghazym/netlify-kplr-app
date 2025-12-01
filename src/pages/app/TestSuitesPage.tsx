import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../components/ui/tooltip";
import { useAuth } from "../../contexts/AuthContext";
import { useProject } from "../../contexts/ProjectContext";
import { getTestSuites, deleteTestSuite, TestSuiteResponse } from "../../lib/api-client";
import { useToast } from "../../hooks/use-toast";

export const TestSuitesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedProject } = useProject();
  const { toast } = useToast();
  const [testSuites, setTestSuites] = useState<TestSuiteResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingSuite, setDeletingSuite] = useState<TestSuiteResponse | null>(null);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    if (user && selectedProject) {
      // Prevent duplicate calls
      if (!isLoadingRef.current) {
        isLoadingRef.current = true;
        loadTestSuites().finally(() => {
          isLoadingRef.current = false;
        });
      }
    } else if (user && !selectedProject) {
      setIsLoading(false);
    }
  }, [user, selectedProject]);

  const loadTestSuites = async () => {
    if (!selectedProject) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const suites = await getTestSuites(selectedProject.id);
      setTestSuites(suites);
    } catch (error) {
      console.error("Error loading test suites:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load test suites",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSuite = async () => {
    if (!deletingSuite) return;

    try {
      await deleteTestSuite(deletingSuite.id);
      
      // Reload test suites after deletion
      await loadTestSuites();
      
      setIsDeleteDialogOpen(false);
      setDeletingSuite(null);

      toast({
        title: "Success",
        description: "Test suite deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting test suite:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete test suite",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Test Suites</h2>
          <p className="text-muted-foreground mt-1">Manage and organize your test scenarios</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Test Suites</h2>
          <p className="text-muted-foreground mt-1">Manage and organize your test scenarios</p>
        </div>
        <Button onClick={() => navigate("/create-suite")} className="bg-orange-500 hover:bg-orange-600 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Create Test Suite
        </Button>
      </div>

      {testSuites.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No test suites yet</p>
              <Button onClick={() => navigate("/create-suite")} className="bg-orange-500 hover:bg-orange-600 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Test Suite
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {testSuites.map((suite) => (
            <Card 
              key={suite.id} 
              className="cursor-pointer hover:shadow-lg transition-shadow relative"
              onClick={() => navigate(`/suite/${suite.id}/runs`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="pr-2">{suite.name}</CardTitle>
                    {suite.description && (
                      <p className="text-sm text-muted-foreground mt-1">{suite.description}</p>
                    )}
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingSuite(suite);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Delete Test Suite</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardHeader>
              <CardContent>
                {suite.application_url && (
                  <p className="text-xs text-muted-foreground truncate">
                    {suite.application_url}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Created {new Date(suite.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Test Suite</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingSuite?.name}"? This action cannot be undone and will delete all associated scenarios and test runs.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setDeletingSuite(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSuite}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

