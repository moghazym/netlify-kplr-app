import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, Calendar, Download } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { getTestSuites, getTestRunsForSuite } from "@/lib/api-client";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, BarChart, Bar } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";

// Pricing configuration
const COST_PER_SCENARIO = 0.05; // $0.05 per scenario execution
const COST_PER_TEST_RUN = 0.10; // $0.10 per test run
const FREE_TIER_SCENARIOS = 100; // 100 free scenarios per month

interface UsageStats {
  totalExecutions: number;
  totalScenarios: number;
  totalCost: number;
  freeScenarios: number;
  paidScenarios: number;
  currentMonthCost: number;
}

interface UsageHistory {
  date: string;
  executions: number;
  scenarios: number;
  cost: number;
}

interface ExecutionDetail {
  id: string;
  suite_name: string;
  scenarios: number;
  cost: number;
  started_at: string;
}

interface DateRange {
  from: Date;
  to: Date;
}

export default function PricingPage() {
  const { user } = useAuth();
  const { selectedProject } = useProject();
  const { toast } = useToast();
  const [stats, setStats] = useState<UsageStats>({
    totalExecutions: 0,
    totalScenarios: 0,
    totalCost: 0,
    freeScenarios: 0,
    paidScenarios: 0,
    currentMonthCost: 0,
  });
  const [usageHistory, setUsageHistory] = useState<UsageHistory[]>([]);
  const [executionDetails, setExecutionDetails] = useState<ExecutionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(subDays(new Date(), 30)),
    to: endOfDay(new Date()),
  });

  useEffect(() => {
    if (user && selectedProject) {
      fetchUsageData();
    } else if (user && !selectedProject) {
      setLoading(false);
    }
  }, [user, selectedProject, dateRange]);

  const fetchUsageData = async () => {
    if (!selectedProject) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Get all test suites for the selected project
      const testSuites = await getTestSuites(selectedProject.id);
      
      // Fetch test runs for all suites
      const allRunsPromises = testSuites.map(suite => 
        getTestRunsForSuite(suite.id).catch(err => {
          console.warn(`Error fetching runs for suite ${suite.id}:`, err);
          return [];
        })
      );
      
      const allRunsArrays = await Promise.all(allRunsPromises);
      const allRuns = allRunsArrays.flat();
      
      // Filter runs by date range
      const dateFrom = dateRange.from.getTime();
      const dateTo = dateRange.to.getTime();
      
      const runs = allRuns.filter(run => {
        const runDate = new Date(run.started_at).getTime();
        return runDate >= dateFrom && runDate <= dateTo;
      });

      // Create a map of suite IDs to suite names for lookup
      const suiteMap = new Map<number, string>();
      testSuites.forEach(suite => {
        suiteMap.set(suite.id, suite.name);
      });

      // Calculate statistics
      const totalExecutions = runs.length;
      const totalScenarios = runs.reduce((sum, run) => sum + run.total_scenarios, 0);
      
      // Calculate free vs paid scenarios
      const freeScenarios = Math.min(totalScenarios, FREE_TIER_SCENARIOS);
      const paidScenarios = Math.max(0, totalScenarios - FREE_TIER_SCENARIOS);
      
      // Calculate total cost
      const totalCost = (totalExecutions * COST_PER_TEST_RUN) + (paidScenarios * COST_PER_SCENARIO);

      // Calculate current month cost
      const currentMonthStart = new Date();
      currentMonthStart.setDate(1);
      currentMonthStart.setHours(0, 0, 0, 0);
      
      const monthRuns = runs.filter(run => {
        const runDate = new Date(run.started_at).getTime();
        return runDate >= currentMonthStart.getTime();
      });

      const monthScenarios = monthRuns.reduce((sum, run) => sum + run.total_scenarios, 0);
      const monthPaidScenarios = Math.max(0, monthScenarios - FREE_TIER_SCENARIOS);
      const currentMonthCost = (monthRuns.length * COST_PER_TEST_RUN) + (monthPaidScenarios * COST_PER_SCENARIO);

      setStats({
        totalExecutions,
        totalScenarios,
        totalCost,
        freeScenarios,
        paidScenarios,
        currentMonthCost,
      });

      // Generate usage history
      const historyMap = new Map<string, { executions: number; scenarios: number }>();
      runs.forEach((run) => {
        const dateKey = format(new Date(run.started_at), "MMM dd");
        const existing = historyMap.get(dateKey) || { executions: 0, scenarios: 0 };
        historyMap.set(dateKey, {
          executions: existing.executions + 1,
          scenarios: existing.scenarios + run.total_scenarios,
        });
      });

      const history: UsageHistory[] = Array.from(historyMap.entries())
        .map(([date, data]) => ({
          date,
          executions: data.executions,
          scenarios: data.scenarios,
          cost: (data.executions * COST_PER_TEST_RUN) + (Math.max(0, data.scenarios - (FREE_TIER_SCENARIOS / 30)) * COST_PER_SCENARIO),
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setUsageHistory(history);

      // Format execution details
      const details: ExecutionDetail[] = runs
        .slice(0, 20)
        .map((run) => ({
          id: String(run.id),
          suite_name: suiteMap.get(run.test_suite_id) || "Unknown Suite",
          scenarios: run.total_scenarios,
          cost: COST_PER_TEST_RUN + (Math.max(0, run.total_scenarios - (FREE_TIER_SCENARIOS / (totalExecutions || 1))) * COST_PER_SCENARIO),
          started_at: new Date(run.started_at).toLocaleString(),
        }));

      setExecutionDetails(details);

    } catch (error) {
      console.error("Error fetching usage data:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load usage data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const chartConfig = {
    cost: {
      label: "Cost ($)",
      color: "hsl(14, 100%, 61%)",
    },
    scenarios: {
      label: "Scenarios",
      color: "hsl(217, 91%, 60%)",
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading usage data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Usage & Billing</h2>
          <p className="text-muted-foreground mt-1">Track your test execution usage and costs</p>
        </div>
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="p-3 space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setDateRange({
                    from: startOfDay(subDays(new Date(), 7)),
                    to: endOfDay(new Date()),
                  })}
                >
                  Last 7 days
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setDateRange({
                    from: startOfDay(subDays(new Date(), 30)),
                    to: endOfDay(new Date()),
                  })}
                >
                  Last 30 days
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setDateRange({
                    from: startOfDay(subDays(new Date(), 90)),
                    to: endOfDay(new Date()),
                  })}
                >
                  Last 90 days
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Pricing Tier Info */}
      <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Current Plan: Pay As You Go
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Free Tier</p>
              <p className="text-2xl font-bold">{FREE_TIER_SCENARIOS} scenarios/month</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Per Test Run</p>
              <p className="text-2xl font-bold">${COST_PER_TEST_RUN}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Per Additional Scenario</p>
              <p className="text-2xl font-bold">${COST_PER_SCENARIO}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
              Total Executions
            </CardTitle>
            <TrendingUp className="h-4 w-4" style={{ color: "hsl(217, 91%, 60%)" }} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalExecutions}</div>
            <p className="text-xs text-muted-foreground mt-1">
              ${(stats.totalExecutions * COST_PER_TEST_RUN).toFixed(2)} in execution fees
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
              Total Scenarios
            </CardTitle>
            <Calendar className="h-4 w-4" style={{ color: "hsl(142, 76%, 36%)" }} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalScenarios}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.freeScenarios} free, {stats.paidScenarios} paid
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
              Total Cost
            </CardTitle>
            <DollarSign className="h-4 w-4" style={{ color: "hsl(14, 100%, 61%)" }} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${stats.totalCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Selected period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
              Current Month
            </CardTitle>
            <DollarSign className="h-4 w-4" style={{ color: "hsl(0, 84%, 60%)" }} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${stats.currentMonthCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Estimated for {format(new Date(), "MMMM")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cost Trends</CardTitle>
          </CardHeader>
          <CardContent>
            {usageHistory.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No usage data for selected date range
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={usageHistory}>
                    <defs>
                      <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(14, 100%, 61%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(14, 100%, 61%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `$${value.toFixed(2)}`}
                    />
                    <ChartTooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const value = payload[0].value;
                          const costValue = typeof value === 'number' ? value : 0;
                          return (
                            <div className="rounded-lg border bg-background p-3 shadow-sm">
                              <div className="grid gap-2">
                                <div className="font-medium">{payload[0].payload.date}</div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-sm text-muted-foreground">Cost:</span>
                                  <span className="text-sm font-bold">${costValue.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-sm text-muted-foreground">Scenarios:</span>
                                  <span className="text-sm">{payload[0].payload.scenarios}</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="cost" 
                      stroke="hsl(14, 100%, 61%)" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorCost)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scenario Usage</CardTitle>
          </CardHeader>
          <CardContent>
            {usageHistory.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No usage data for selected date range
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={usageHistory}>
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar 
                      dataKey="scenarios" 
                      fill="hsl(217, 91%, 60%)" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Execution Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Executions</CardTitle>
        </CardHeader>
        <CardContent>
          {executionDetails.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">No executions found for selected date range</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-sm text-muted-foreground">
                    <th className="text-left py-3 px-2 font-medium">Test Suite</th>
                    <th className="text-center py-3 px-2 font-medium">Scenarios</th>
                    <th className="text-center py-3 px-2 font-medium">Cost</th>
                    <th className="text-right py-3 px-2 font-medium">Executed At</th>
                  </tr>
                </thead>
                <tbody>
                  {executionDetails.map((detail) => (
                    <tr 
                      key={detail.id}
                      className="border-b last:border-0 hover:bg-accent/50 transition-colors"
                    >
                      <td className="py-4 px-2">
                        <div className="font-medium">{detail.suite_name}</div>
                      </td>
                      <td className="py-4 px-2 text-center">
                        <span className="text-sm">{detail.scenarios}</span>
                      </td>
                      <td className="py-4 px-2 text-center">
                        <span className="text-sm font-medium text-primary">
                          ${detail.cost.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-4 px-2 text-right text-sm text-muted-foreground">
                        {detail.started_at}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cost Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <div>
                <p className="font-medium">Execution Fees</p>
                <p className="text-sm text-muted-foreground">
                  {stats.totalExecutions} executions × ${COST_PER_TEST_RUN}
                </p>
              </div>
              <p className="text-lg font-bold">${(stats.totalExecutions * COST_PER_TEST_RUN).toFixed(2)}</p>
            </div>
            <div className="flex items-center justify-between pb-2 border-b">
              <div>
                <p className="font-medium">Scenario Fees</p>
                <p className="text-sm text-muted-foreground">
                  {stats.paidScenarios} paid scenarios × ${COST_PER_SCENARIO}
                </p>
              </div>
              <p className="text-lg font-bold">${(stats.paidScenarios * COST_PER_SCENARIO).toFixed(2)}</p>
            </div>
            <div className="flex items-center justify-between pb-2 border-b">
              <div>
                <p className="font-medium">Free Tier Savings</p>
                <p className="text-sm text-muted-foreground">
                  {stats.freeScenarios} free scenarios
                </p>
              </div>
              <p className="text-lg font-bold text-green-600">
                -${(stats.freeScenarios * COST_PER_SCENARIO).toFixed(2)}
              </p>
            </div>
            <div className="flex items-center justify-between pt-2">
              <p className="text-lg font-semibold">Total Cost</p>
              <p className="text-2xl font-bold text-primary">${stats.totalCost.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

