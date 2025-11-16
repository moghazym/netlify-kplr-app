import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { CheckCircle, XCircle, Loader2, Filter } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
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
  test_suites: {
    id: string;
    name: string;
  } | null;
}

export const TestRunsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [suites, setSuites] = useState<TestSuiteResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [suitesLoaded, setSuitesLoaded] = useState(false);
  const [selectedSuite, setSelectedSuite] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  useEffect(() => {
    if (user) {
      fetchSuites();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && suitesLoaded) {
      fetchTestRuns();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, suitesLoaded, selectedSuite, selectedStatus, startDate, endDate]);

  const fetchSuites = async () => {
    try {
      const suitesData = await getTestSuites();
      setSuites(suitesData);
      setSuitesLoaded(true);
      // If no suites, stop loading
      if (suitesData.length === 0) {
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error fetching suites:", error);
      setSuitesLoaded(true);
      setIsLoading(false);
    }
  };

  const fetchTestRuns = async () => {
    try {
      setIsLoading(true);
      
      // If a specific suite is selected, get runs for that suite
      // Otherwise, get runs for all suites
      let allRuns: TestRunResponse[] = [];
      
      if (selectedSuite !== "all") {
        const suiteId = parseInt(selectedSuite, 10);
        if (isNaN(suiteId)) {
          setTestRuns([]);
          setIsLoading(false);
          return;
        }
        const runs = await getTestRunsForSuite(suiteId).catch(err => {
          console.error("Error fetching test runs for suite:", err);
          return [];
        });
        allRuns = runs;
      } else {
        // Get runs for all suites
        if (suites.length === 0) {
          setTestRuns([]);
          setIsLoading(false);
          return;
        }
        const runsPromises = suites.map(suite => 
          getTestRunsForSuite(suite.id).catch(err => {
            console.error(`Error fetching test runs for suite ${suite.id}:`, err);
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
      
      setTestRuns(filteredRuns);
    } catch (error) {
      console.error("Error fetching test runs:", error);
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

  const clearFilters = () => {
    setSelectedSuite("all");
    setSelectedStatus("all");
    setStartDate("");
    setEndDate("");
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
          <h2 className="text-3xl font-bold tracking-tight">Test Runs</h2>
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
            <CardTitle>Test Run History ({testRuns.length} runs)</CardTitle>
          </CardHeader>
          <CardContent>
            {testRuns.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No test runs found
              </div>
            ) : (
              <div className="space-y-4">
                {testRuns.map((run) => (
                  <div
                    key={run.id}
                    className={cn(
                      "border border-border rounded-lg p-4 hover:bg-accent/50 cursor-pointer transition-colors",
                      run.status === "running" && "bg-orange-50 border-orange-200"
                    )}
                    onClick={() => navigate(`/suite/${run.suite_id}/runs`)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg">
                            {run.test_suites?.name || "Unknown Suite"}
                          </h3>
                          {getStatusBadge(run.status)}
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
            )}
          </CardContent>
        </Card>
    </div>
  );
};

