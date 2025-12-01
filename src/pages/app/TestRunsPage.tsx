import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { CheckCircle, XCircle, Loader2, Filter, ChevronLeft, ChevronRight, Globe, Smartphone } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useProject } from "../../contexts/ProjectContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { cn } from "../../lib/utils";
import { 
  getTestSuites, 
  getTestRunsForSuite,
  TestSuiteResponse,
  TestRunResponse
} from "../../lib/api-client";

interface TestRun {
  id: string;
  suite_id: string;
  status: string;
  total_scenarios: number;
  passed_scenarios: number;
  failed_scenarios: number;
  started_at: string;
  completed_at: string | null;
  platform?: string;
  test_suites: {
    id: string;
    name: string;
  } | null;
}

export const TestRunsPage: React.FC = () => {
  const { user } = useAuth();
  const { selectedProject } = useProject();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [suites, setSuites] = useState<TestSuiteResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [suitesLoaded, setSuitesLoaded] = useState(false);
  const [selectedSuite, setSelectedSuite] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const runsPerPage = 20;

  useEffect(() => {
    if (user && selectedProject) {
      fetchSuites();
    } else if (user && !selectedProject) {
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  }, [user, selectedProject]);

  useEffect(() => {
    if (user && selectedProject && suitesLoaded) {
      setCurrentPage(1); // Reset to first page when filters change
      fetchTestRuns();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedProject, suitesLoaded, selectedSuite, selectedStatus, startDate, endDate]);

  useEffect(() => {
    if (user && selectedProject && suitesLoaded) {
      fetchTestRuns();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const fetchSuites = async () => {
    if (!selectedProject) {
      setIsLoading(false);
      return;
    }

    try {
      const suitesData = await getTestSuites(selectedProject.id);
      setSuites(suitesData);
      setSuitesLoaded(true);
      // If no suites, stop loading
      if (suitesData.length === 0) {
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error fetching suites:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load test suites",
        variant: "destructive",
      });
      setSuitesLoaded(true);
      setIsLoading(false);
    }
  };

  const fetchTestRuns = async () => {
    try {
      setIsLoading(true);
      
      // Calculate offset for pagination
      const offset = (currentPage - 1) * runsPerPage;
      
      // If a specific suite is selected, get runs for that suite with server-side pagination
      // Otherwise, get runs for all suites (with limit per suite, then paginate client-side)
      let allRuns: TestRunResponse[] = [];
      
      if (selectedSuite !== "all") {
        const suiteId = parseInt(selectedSuite, 10);
        if (isNaN(suiteId)) {
          setTestRuns([]);
          setTotalCount(0);
          setIsLoading(false);
          return;
        }
        // For single suite, use server-side pagination with limit=20 and offset
        // When filters are active, fetch a larger batch to ensure we have data after filtering
        const hasFilters = selectedStatus !== "all" || startDate || endDate;
        if (hasFilters) {
          // Fetch a larger batch when filters are active, then filter and paginate client-side
          const runs = await getTestRunsForSuite(suiteId, 500, 0).catch(err => {
            console.error("Error fetching test runs for suite:", err);
            toast({
              title: "Error",
              description: err instanceof Error ? err.message : "Failed to load test runs",
              variant: "destructive",
            });
            return [];
          });
          allRuns = runs;
        } else {
          // No filters: use server-side pagination with limit=20 and offset
          const runs = await getTestRunsForSuite(suiteId, runsPerPage, offset).catch(err => {
            console.error("Error fetching test runs for suite:", err);
            toast({
              title: "Error",
              description: err instanceof Error ? err.message : "Failed to load test runs",
              variant: "destructive",
            });
            return [];
          });
          allRuns = runs;
        }
      } else {
        // Get runs for all suites with limit per suite
        if (suites.length === 0) {
          setTestRuns([]);
          setTotalCount(0);
          setIsLoading(false);
          return;
        }
        // Fetch runsPerPage runs from each suite to get a good sample
        const runsPromises = suites.map(suite => 
          getTestRunsForSuite(suite.id, runsPerPage, 0).catch(err => {
            console.error(`Error fetching test runs for suite ${suite.id}:`, err);
            // Don't show toast for each individual error, just log it
            return [];
          })
        );
        const runsArrays = await Promise.all(runsPromises);
        allRuns = runsArrays.flat();
      }
      
      // Transform to local format and apply filters
      let filteredRuns: TestRun[] = allRuns.map(run => {
        const suite = suites.find(s => s.id === run.test_suite_id);
        return {
          id: run.id.toString(),
          suite_id: run.test_suite_id.toString(),
          status: run.status,
          total_scenarios: run.total_scenarios,
          passed_scenarios: run.passed_scenarios,
          failed_scenarios: run.failed_scenarios,
          started_at: run.started_at,
          completed_at: run.completed_at,
          platform: run.platform,
          test_suites: suite ? {
            id: suite.id.toString(),
            name: suite.name,
          } : null,
        };
      });
      
      // Apply status filter
      if (selectedStatus !== "all") {
        filteredRuns = filteredRuns.filter(run => run.status === selectedStatus);
      }
      
      // Apply date filters
      if (startDate) {
        const startDateTime = new Date(startDate);
        filteredRuns = filteredRuns.filter(run => 
          new Date(run.started_at) >= startDateTime
        );
      }
      
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        filteredRuns = filteredRuns.filter(run => 
          new Date(run.started_at) <= endDateTime
        );
      }
      
      // Sort by started_at descending
      filteredRuns.sort((a, b) => 
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      );
      
      // Set total count before pagination
      setTotalCount(filteredRuns.length);
      
      // Apply client-side pagination only if filters are active or "all suites" is selected
      // Otherwise, server-side pagination is already applied
      const hasFilters = selectedStatus !== "all" || startDate || endDate;
      const needsClientPagination = selectedSuite === "all" || hasFilters;
      const paginatedRuns = needsClientPagination 
        ? filteredRuns.slice(offset, offset + runsPerPage)
        : filteredRuns;
      
      setTestRuns(paginatedRuns);
    } catch (error) {
      console.error("Error fetching test runs:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load test runs",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateDuration = (startedAt: string, completedAt: string | null) => {
    if (!completedAt) return "In progress";
    const start = new Date(startedAt);
    const end = new Date(completedAt);
    const durationMs = end.getTime() - start.getTime();
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };

  const getSuccessRate = (passed: number, total: number) => {
    if (total === 0) return "0%";
    return `${Math.round((passed / total) * 100)}%`;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive"; label: string }> = {
      running: { variant: "default", label: "Running" },
      completed: { variant: "secondary", label: "Completed" },
      failed: { variant: "destructive", label: "Failed" }
    };
    const config = variants[status] || variants.completed;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPlatformBadge = (platform?: string) => {
    if (!platform) {
      // Default to web if platform is not specified
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <Globe className="h-3 w-3" />
          Web
        </Badge>
      );
    }
    
    const platformLower = platform.toLowerCase();
    if (platformLower === "ios") {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <Smartphone className="h-3 w-3" />
          iOS
        </Badge>
      );
    } else if (platformLower === "android") {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <Smartphone className="h-3 w-3" />
          Android
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <Globe className="h-3 w-3" />
          Web
        </Badge>
      );
    }
  };

  const clearFilters = () => {
    setSelectedSuite("all");
    setSelectedStatus("all");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalCount / runsPerPage);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Test Runs</h2>
          <p className="text-muted-foreground mt-1">View and analyze all test execution history</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Test Suite</Label>
                <Select value={selectedSuite} onValueChange={setSelectedSuite}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Suites" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Suites</SelectItem>
                    {suites.map((suite) => (
                      <SelectItem key={suite.id} value={suite.id.toString()}>
                        {suite.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="running">Running</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {(selectedSuite !== "all" || selectedStatus !== "all" || startDate || endDate) && (
              <div className="mt-4">
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Run History ({totalCount} runs)</CardTitle>
          </CardHeader>
          <CardContent>
            {testRuns.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No test runs found
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {testRuns.map((run) => (
                    <div
                      key={run.id}
                      className={cn(
                        "border border-border rounded-lg p-4 hover:bg-accent/50 cursor-pointer transition-colors",
                        run.status === "running" && "bg-orange-50 border-orange-200"
                      )}
                      onClick={() => navigate(`/test-runs/${run.id}`)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-lg">
                              {run.test_suites?.name || "Unknown Suite"}
                            </h3>
                            {getStatusBadge(run.status)}
                            {getPlatformBadge(run.platform)}
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Started:</span>
                              <p className="font-medium">
                                {new Date(run.started_at).toLocaleString()}
                              </p>
                            </div>
                            
                            <div>
                              <span className="text-muted-foreground">Duration:</span>
                              <p className="font-medium">
                                {calculateDuration(run.started_at, run.completed_at)}
                              </p>
                            </div>
                            
                            <div>
                              <span className="text-muted-foreground">Scenarios:</span>
                              <p className="font-medium">
                                {run.total_scenarios} total
                              </p>
                            </div>
                            
                            <div>
                              <span className="text-muted-foreground">Success Rate:</span>
                              <p className="font-medium">
                                {getSuccessRate(run.passed_scenarios, run.total_scenarios)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span className="font-semibold">{run.passed_scenarios}</span> passed
                            </span>
                            <span className="flex items-center gap-1 text-red-600">
                              <XCircle className="h-4 w-4" />
                              <span className="font-semibold">{run.failed_scenarios}</span> failed
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * runsPerPage + 1} to {Math.min(currentPage * runsPerPage, totalCount)} of {totalCount} runs
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum: number;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => goToPage(pageNum)}
                              className="w-10"
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
    </div>
  );
};

