import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logoImage from "../../assets/logo-D_k9ADKT.png";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  TrendingUp, 
  PlayCircle, 
  Calendar as CalendarIcon, 
  Plus,
  Loader2
} from "lucide-react";
import { cn } from "../../lib/utils";
import { 
  getDashboardStatistics, 
  getRecentTestRuns, 
  getSchedules, 
  getTestSuites,
  RecentRun as ApiRecentRun,
  TestSuiteResponse
} from "../../lib/api-client";
import { useAuth } from "../../contexts/AuthContext";
import { useProject } from "../../contexts/ProjectContext";
import { useToast } from "../../hooks/use-toast";

interface DashboardStats {
  totalRuns: number;
  passedScenarios: number;
  failedScenarios: number;
  successRate: string;
  totalScenarios: number;
}

interface RecentRun {
  id: string;
  suite_name: string;
  total_scenarios: number;
  passed_scenarios: number;
  failed_scenarios: number;
  started_at: string;
  suite_id: string;
  status: string;
}

interface UpcomingSchedule {
  id: string;
  name: string;
  suite_name: string;
  next_run_at: string;
  schedule_type: string;
}

interface TrendData {
  date: string;
  passed: number;
  failed: number;
  total: number;
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedProject } = useProject();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    totalRuns: 0,
    passedScenarios: 0,
    failedScenarios: 0,
    successRate: "0%",
    totalScenarios: 0,
  });
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);
  const [upcomingSchedules, setUpcomingSchedules] = useState<UpcomingSchedule[]>([]);
  const [testSuites, setTestSuites] = useState<TestSuiteResponse[]>([]);
  const [selectedSuite, setSelectedSuite] = useState<string>("");
  const [dateRange] = useState({ from: "Oct 16, 2025", to: "Nov 15, 2025" });
  const [isLoading, setIsLoading] = useState(true);
  const [trendData, setTrendData] = useState<TrendData[]>([]);

  useEffect(() => {
    if (user && selectedProject) {
      loadDashboardData();
    } else if (user && !selectedProject) {
      // User is authenticated but no project selected yet
      setIsLoading(false);
    } else {
      // If no user, stop loading
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedProject]);

  const loadDashboardData = async () => {
    if (!selectedProject) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      const projectId = selectedProject.id;
      
      // Load all data in parallel with project_id
      const [statsData, recentRunsData, schedulesData, suitesData] = await Promise.all([
        getDashboardStatistics({ project_id: projectId }).catch(err => {
          console.error("Error fetching dashboard statistics:", err);
          toast({
            title: "Error",
            description: err instanceof Error ? err.message : "Failed to load dashboard statistics",
            variant: "destructive",
          });
          return {
            total_test_runs: 0,
            passed_scenarios: 0,
            failed_scenarios: 0,
            success_rate: 0,
          };
        }),
        getRecentTestRuns({ project_id: projectId, limit: 5 }).catch(err => {
          console.error("Error fetching recent test runs:", err);
          toast({
            title: "Error",
            description: err instanceof Error ? err.message : "Failed to load recent test runs",
            variant: "destructive",
          });
          return [];
        }),
        getSchedules({ project_id: projectId, is_active: true }).catch(err => {
          console.error("Error fetching schedules:", err);
          toast({
            title: "Error",
            description: err instanceof Error ? err.message : "Failed to load schedules",
            variant: "destructive",
          });
          return [];
        }),
        getTestSuites(projectId).catch(err => {
          console.error("Error fetching test suites:", err);
          toast({
            title: "Error",
            description: err instanceof Error ? err.message : "Failed to load test suites",
            variant: "destructive",
          });
          return [];
        }),
      ]);

      // Transform stats
      const totalScenarios = statsData.passed_scenarios + statsData.failed_scenarios;
      const successRate = totalScenarios > 0 
        ? `${((statsData.passed_scenarios / totalScenarios) * 100).toFixed(1)}%`
        : "0%";
      
      setStats({
        totalRuns: statsData.total_test_runs,
        passedScenarios: statsData.passed_scenarios,
        failedScenarios: statsData.failed_scenarios,
        successRate,
        totalScenarios,
      });

      // Transform recent runs - need to get suite names
      const runsWithSuiteNames: RecentRun[] = recentRunsData.map((run) => {
        // Find suite name from test suites data
        const suite = suitesData.find(s => s.id === run.test_suite_id);
        return {
          id: run.id.toString(),
          suite_name: suite?.name || `Suite ${run.test_suite_id}`,
          total_scenarios: run.total_scenarios,
          passed_scenarios: run.passed_scenarios,
          failed_scenarios: run.failed_scenarios,
          started_at: new Date(run.started_at).toLocaleString(),
          suite_id: run.test_suite_id.toString(),
          status: run.status,
        };
      });
      setRecentRuns(runsWithSuiteNames);

      // Transform schedules
      const transformedSchedules: UpcomingSchedule[] = schedulesData
        .filter(s => s.next_run_at)
        .map(schedule => ({
          id: schedule.id.toString(),
          name: schedule.name,
          suite_name: schedule.test_suite?.name || `Suite ${schedule.test_suite_id}`,
          next_run_at: schedule.next_run_at 
            ? new Date(schedule.next_run_at).toLocaleString()
            : "",
          schedule_type: schedule.frequency.charAt(0).toUpperCase() + schedule.frequency.slice(1),
        }))
        .sort((a, b) => {
          if (!a.next_run_at) return 1;
          if (!b.next_run_at) return -1;
          return new Date(a.next_run_at).getTime() - new Date(b.next_run_at).getTime();
        });
      setUpcomingSchedules(transformedSchedules);

      setTestSuites(suitesData);

      // Generate trend data from recent runs (last 7 days)
      generateTrendData(recentRunsData);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateTrendData = (runs: ApiRecentRun[]) => {
    // Group runs by date
    const runsByDate = new Map<string, { passed: number; failed: number }>();
    
    runs.forEach(run => {
      const date = new Date(run.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const existing = runsByDate.get(date) || { passed: 0, failed: 0 };
      existing.passed += run.passed_scenarios;
      existing.failed += run.failed_scenarios;
      runsByDate.set(date, existing);
    });

    const trend: TrendData[] = Array.from(runsByDate.entries())
      .map(([date, data]) => ({
        date,
        passed: data.passed,
        failed: data.failed,
        total: data.passed + data.failed,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-7); // Last 7 days

    setTrendData(trend);
  };

  const handleQuickRun = () => {
    if (!selectedSuite) {
      // toast.error("Please select a test suite to run");
      return;
    }
    navigate(`/suite/${selectedSuite}/runs`);
  };

  const pieChartData = [
    { name: "Passed", value: stats.passedScenarios, color: "hsl(142, 76%, 36%)" },
    { name: "Failed", value: stats.failedScenarios, color: "hsl(0, 84%, 60%)" },
  ];

  const statsCards = [
    { 
      label: "Total Test Runs", 
      value: stats.totalRuns.toString(), 
      subtitle: `${stats.totalScenarios} scenarios`,
      icon: Clock, 
      color: "hsl(217, 91%, 60%)" 
    },
    { 
      label: "Passed Scenarios", 
      value: stats.passedScenarios.toString(), 
      subtitle: `${stats.successRate} success`,
      icon: CheckCircle, 
      color: "hsl(142, 76%, 36%)" 
    },
    { 
      label: "Failed Scenarios", 
      value: stats.failedScenarios.toString(), 
      subtitle: stats.failedScenarios > 0 ? "Click to view" : "No failures",
      icon: XCircle, 
      color: "hsl(0, 84%, 60%)",
      clickable: stats.failedScenarios > 0,
      onClick: () => navigate("/failed-scenarios")
    },
    { 
      label: "Success Rate", 
      value: stats.successRate, 
      subtitle: "Overall quality",
      icon: TrendingUp, 
      color: "hsl(14, 100%, 61%)" 
    },
  ];

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="flex-1 overflow-y-auto bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-muted-foreground mb-2">No project selected</p>
          <p className="text-sm text-muted-foreground">Please select a project from the sidebar to view dashboard data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logoImage} alt="Kplr" className="w-8 h-8 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange.from} - {dateRange.to}
          </Button>
          <Button onClick={() => navigate("/create-suite")} className="bg-orange-500 hover:bg-orange-600 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Create Test Suite
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground mt-1">Overview of your test automation metrics</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statsCards.map((stat) => (
            <Card 
              key={stat.label}
              className={cn(
                "transition-all",
                stat.clickable && "cursor-pointer hover:shadow-lg hover:scale-[1.02]"
              )}
              onClick={stat.onClick}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Test Trends Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Test Trends</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : trendData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No data available for selected date range
                </div>
              ) : (
                <div className="h-[300px] flex items-end justify-between gap-4">
                  {trendData.map((trend, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full flex flex-col gap-1 items-center h-full justify-end">
                        <div
                          className="w-full bg-green-500 rounded-t transition-all"
                          style={{ height: `${(trend.passed / 20) * 100}%` }}
                        />
                        <div
                          className="w-full bg-red-500 rounded-t transition-all"
                          style={{ height: `${(trend.failed / 20) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{trend.date}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-4 mt-4 justify-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span className="text-xs text-muted-foreground">Passed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span className="text-xs text-muted-foreground">Failed</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.totalScenarios === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No scenarios executed yet
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-center h-[250px]">
                    <div className="relative w-48 h-48">
                      <svg className="w-48 h-48 transform -rotate-90">
                        <circle
                          cx="96"
                          cy="96"
                          r="80"
                          fill="none"
                          stroke="hsl(var(--muted))"
                          strokeWidth="32"
                        />
                        <circle
                          cx="96"
                          cy="96"
                          r="80"
                          fill="none"
                          stroke="hsl(142, 76%, 36%)"
                          strokeWidth="32"
                          strokeDasharray={`${(stats.passedScenarios / stats.totalScenarios) * 502.65} 502.65`}
                        />
                        <circle
                          cx="96"
                          cy="96"
                          r="80"
                          fill="none"
                          stroke="hsl(0, 84%, 60%)"
                          strokeWidth="32"
                          strokeDasharray={`${(stats.failedScenarios / stats.totalScenarios) * 502.65} 502.65`}
                          strokeDashoffset={`-${(stats.passedScenarios / stats.totalScenarios) * 502.65}`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-2xl font-bold">{stats.totalScenarios}</p>
                          <p className="text-xs text-muted-foreground">Total</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 mt-4">
                    {pieChartData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }}></div>
                          <span className="text-sm text-foreground">{item.name}</span>
                        </div>
                        <span className="text-sm font-semibold">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Run and Scheduled Runs */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlayCircle className="h-5 w-5" />
                Quick Run
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <select
                value={selectedSuite}
                onChange={(e) => setSelectedSuite(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select a test suite</option>
                {testSuites.map((suite) => (
                  <option key={suite.id} value={suite.id.toString()}>
                    {suite.name}
                  </option>
                ))}
              </select>
              <Button onClick={handleQuickRun} className="w-full bg-orange-500 hover:bg-orange-600 text-white" disabled={!selectedSuite}>
                <PlayCircle className="h-4 w-4 mr-2" />
                Run Test Suite
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Upcoming Scheduled Runs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingSchedules.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming scheduled runs</p>
              ) : (
                <div className="space-y-3">
                  {upcomingSchedules.map((schedule) => (
                    <div key={schedule.id} className="flex justify-between items-start text-sm">
                      <div>
                        <p className="font-medium">{schedule.name}</p>
                        <p className="text-muted-foreground text-xs">{schedule.suite_name}</p>
                      </div>
                      {schedule.next_run_at && (
                        <div className="text-right text-xs text-muted-foreground">
                          <p>{schedule.next_run_at}</p>
                          <p className="capitalize">{schedule.schedule_type}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Testing Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Testing Activity</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/test-runs")}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {recentRuns.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground mb-4">No test runs yet</p>
                <Button onClick={() => navigate("/create-suite")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Test Suite
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-sm text-muted-foreground">
                      <th className="text-left py-3 px-2 font-medium">Title</th>
                      <th className="text-center py-3 px-2 font-medium">Status</th>
                      <th className="text-center py-3 px-2 font-medium">Issues</th>
                      <th className="text-right py-3 px-2 font-medium">Started</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRuns.map((run) => (
                      <tr 
                        key={run.id}
                        className="border-b last:border-0 hover:bg-accent/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/test-runs/${run.id}`)}
                      >
                        <td className="py-4 px-2">
                          <div className="font-medium">{run.suite_name}</div>
                        </td>
                        <td className="py-4 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {run.status === "completed" ? (
                              <>
                                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                                <span className="text-sm">Completed</span>
                              </>
                            ) : (
                              <>
                                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                                <span className="text-sm capitalize">{run.status}</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-2">
                          <div className="flex items-center justify-center gap-3 text-sm">
                            <span className="text-muted-foreground">{run.total_scenarios}</span>
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-green-500"></span>
                                <span className="text-green-600 font-medium">{run.passed_scenarios}</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-red-500"></span>
                                <span className="text-red-600 font-medium">{run.failed_scenarios}</span>
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-2 text-right text-sm text-muted-foreground">
                          {run.started_at}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
