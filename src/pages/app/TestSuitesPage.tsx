import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useProject } from "../../contexts/ProjectContext";
import { getTestSuites, TestSuiteResponse } from "../../lib/api-client";
import { useToast } from "../../hooks/use-toast";

export const TestSuitesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedProject } = useProject();
  const { toast } = useToast();
  const [testSuites, setTestSuites] = useState<TestSuiteResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user && selectedProject) {
      loadTestSuites();
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Test Suites</h2>
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
          <h2 className="text-3xl font-bold tracking-tight">Test Suites</h2>
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
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/suite/${suite.id}/runs`)}
            >
              <CardHeader>
                <CardTitle>{suite.name}</CardTitle>
                {suite.description && (
                  <p className="text-sm text-muted-foreground mt-1">{suite.description}</p>
                )}
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
    </div>
  );
};

