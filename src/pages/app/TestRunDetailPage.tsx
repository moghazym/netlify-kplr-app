import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../components/ui/accordion";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Share2,
  ArrowLeft,
  Loader2,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Globe,
  Smartphone,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../components/ui/tooltip";
import { useAuth } from "../../contexts/AuthContext";
import { cn } from "../../lib/utils";
import {
  getTestRun,
  getTestSuite,
  getScenarios,
  TestRunWithSessionsResponse
} from "../../lib/api-client";
import { useToast } from "../../hooks/use-toast";

interface Scenario {
  id: string;
  name: string;
  status: "pending" | "running" | "passed" | "failed";
  hasRun: boolean;
  steps: Step[];
}

interface Step {
  id: number;
  action: string;
  status: "pending" | "running" | "passed" | "failed";
  reasoning?: string;
  screenshot?: string;
  beforeScreenshot?: string;
  afterScreenshot?: string;
  consoleLogs?: string[];
  networkLogs?: string[];
}

export const TestRunDetailPage: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [selectedStepIndex, setSelectedStepIndex] = useState(0);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedScenarioId, setExpandedScenarioId] = useState<string | undefined>("");
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [currentScreenshotIndex, setCurrentScreenshotIndex] = useState(0);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const [suiteInfo, setSuiteInfo] = useState<{ name: string; description?: string } | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [testRun, setTestRun] = useState<TestRunWithSessionsResponse | null>(null);

  // Helper function to construct full image URL from filename or path
  const getImageUrl = (imagePath: string | undefined | null): string | undefined => {
    if (!imagePath) return undefined;

    // If it's already a full URL, return it as-is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }

    // If it's just a filename, construct the full Google Cloud Storage URL
    // Remove leading slash if present
    const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;

    // Construct full URL
    return `https://storage.googleapis.com/kplr-images-prod/images/${cleanPath}`;
  };

  useEffect(() => {
    if (runId && user) {
      loadTestRunData();
    }
  }, [runId, user]);

  const loadTestRunData = async () => {
    try {
      setIsLoadingData(true);

      if (!runId) return;

      const runIdNum = parseInt(runId, 10);
      if (isNaN(runIdNum)) {
        console.error("Invalid run ID:", runId);
        toast({
          title: "Error",
          description: "Invalid test run ID",
          variant: "destructive",
        });
        return;
      }

      // Load test run first
      const testRunData = await getTestRun(runIdNum);
      
      // Then load suite and scenarios using the test run's suite ID
      const [suiteData, scenariosData] = await Promise.all([
        getTestSuite(testRunData.test_suite_id).catch(() => null),
        getScenarios(testRunData.test_suite_id).catch(() => []),
      ]);

      setTestRun(testRunData);

      if (suiteData) {
        setSuiteInfo({
          name: suiteData.name,
          description: suiteData.description || undefined,
        });
      } else {
        // Fallback to test run ID if suite not found
        setSuiteInfo({
          name: `Test Run #${runIdNum}`,
        });
      }

      // Map test run to scenarios, ensuring we use backend scenario names
      const mappedScenarios = mapTestRunToScenarios(testRunData, false, scenariosData);
      console.log("Mapped scenarios:", mappedScenarios);
      console.log("Test run data:", testRunData);
      setScenarios(mappedScenarios);

      // Auto-select first scenario if available
      if (mappedScenarios.length > 0) {
        setSelectedScenario(mappedScenarios[0].id);
        setExpandedScenarioId(`scenario-${mappedScenarios[0].id}`);
      }
    } catch (error) {
      console.error("Error loading test run data:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load test run data",
        variant: "destructive",
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  // Map API response to UI state (similar to TestSuiteRunsPage)
  const mapTestRunToScenarios = (testRun: TestRunWithSessionsResponse, isTestRunActive: boolean = false, backendScenarios?: Array<{ id: number; name: string }>): Scenario[] => {
    const mappedScenarios: Scenario[] = [];
    const isTestRunComplete = testRun.status === "completed" || testRun.status === "failed";

    // If scenarios are directly in the response
    if (testRun.scenarios && testRun.scenarios.length > 0) {
      testRun.scenarios.forEach((apiScenario) => {
        const allSteps = apiScenario.steps || [];
        const steps: Step[] = allSteps.map((apiStep, stepIndex) => {
          let stepStatus: "pending" | "running" | "passed" | "failed" = "pending";
          const hasScreenshots = !!(apiStep.before_screenshot_url || apiStep.after_screenshot_url || apiStep.screenshot);
          const hasReasoning = !!apiStep.reasoning;
          const isExecuted = hasScreenshots || hasReasoning;
          const isLastStep = stepIndex === allSteps.length - 1;
          const nextStep = allSteps[stepIndex + 1];
          const nextStepIsExecuted = nextStep && (nextStep.before_screenshot_url || nextStep.after_screenshot_url || nextStep.reasoning);

          if (apiStep.status) {
            const apiStatus = (apiStep.status as string).toUpperCase();
            if (apiStatus === "COMPLETE" || apiStatus === "PASSED" || apiStatus === "SUCCESS") {
              stepStatus = "passed";
            } else if (apiStatus === "FAILED" || apiStatus === "ERROR") {
              stepStatus = "failed";
            } else if (apiStatus === "CONTINUE" || apiStatus === "RUNNING" || apiStatus === "ACTIVE") {
              if (isExecuted) {
                if (isLastStep || nextStepIsExecuted) {
                  stepStatus = "passed";
                } else {
                  stepStatus = "passed";
                }
              } else {
                stepStatus = "running";
              }
            } else {
              stepStatus = apiStep.status as "pending" | "running" | "passed" | "failed";
            }
          } else if (isExecuted) {
            const hasError = apiStep.reasoning?.toLowerCase().includes("failed") ||
              apiStep.reasoning?.toLowerCase().includes("error");
            if (hasError) {
              stepStatus = "failed";
            } else {
              const nextStepPending = nextStep && !nextStep.before_screenshot_url && !nextStep.after_screenshot_url && !nextStep.reasoning;
              if (isLastStep || nextStepPending) {
                stepStatus = "passed";
              } else {
                stepStatus = "running";
              }
            }
          } else {
            const prevStep = stepIndex > 0 ? allSteps[stepIndex - 1] : null;
            const prevStepExecuted = prevStep && (prevStep.before_screenshot_url || prevStep.after_screenshot_url || prevStep.reasoning);
            const prevStepPassed = prevStep && prevStepExecuted && !prevStep.reasoning?.toLowerCase().includes("failed") && !prevStep.reasoning?.toLowerCase().includes("error");

            if (stepIndex === 0) {
              const anyStepExecuted = allSteps.some(s => s.before_screenshot_url || s.after_screenshot_url || s.reasoning);
              stepStatus = anyStepExecuted ? "running" : "pending";
            } else if (prevStepPassed) {
              stepStatus = "running";
            } else {
              stepStatus = "pending";
            }
          }

          return {
            id: apiStep.id,
            action: apiStep.action || apiStep.action_summary || `Step ${apiStep.step_number || apiStep.id}`,
            status: stepStatus,
            reasoning: apiStep.reasoning,
            screenshot: getImageUrl(apiStep.screenshot),
            beforeScreenshot: getImageUrl(apiStep.before_screenshot_url || apiStep.before_screenshot),
            afterScreenshot: getImageUrl(apiStep.after_screenshot_url || apiStep.after_screenshot),
            consoleLogs: apiStep.console_logs || [],
            networkLogs: apiStep.network_logs || [],
          };
        });

        let scenarioStatus: "pending" | "running" | "passed" | "failed" = "running";
        if (steps.length > 0) {
          const lastStep = steps[steps.length - 1];
          const lastStepExecuted = !!(lastStep.beforeScreenshot || lastStep.afterScreenshot || lastStep.reasoning);

          if (isTestRunComplete && lastStepExecuted) {
            if (lastStep.status === "failed") {
              scenarioStatus = "failed";
            } else if (lastStep.status === "passed") {
              scenarioStatus = "passed";
            } else {
              const hasError = lastStep.reasoning?.toLowerCase().includes("failed") ||
                lastStep.reasoning?.toLowerCase().includes("error");
              scenarioStatus = hasError ? "failed" : "passed";
            }
          } else {
            scenarioStatus = "running";
          }
        } else {
          scenarioStatus = isTestRunActive ? "running" : ((apiScenario.status as "pending" | "running" | "passed" | "failed") || "running");
        }

        // If scenario failed, mark the last executed step as failed so it shows an X icon
        if (scenarioStatus === "failed" && steps.length > 0) {
          // Find the last executed step (the step where it failed)
          for (let i = steps.length - 1; i >= 0; i--) {
            const step = steps[i];
            const isExecuted = !!(step.beforeScreenshot || step.afterScreenshot || step.reasoning);
            if (isExecuted) {
              // Mark this step as failed since it's the step where the scenario failed
              step.status = "failed";
              break;
            }
          }
        }

        // Use backend scenario name if available, otherwise use API scenario name
        const backendScenario = backendScenarios?.find(s => s.id === apiScenario.id);
        const scenarioName = backendScenario?.name || apiScenario.name;

        mappedScenarios.push({
          id: apiScenario.id.toString(),
          name: scenarioName,
          status: scenarioStatus,
          hasRun: true,
          steps,
        });
      });
    } else if (testRun.sessions && testRun.sessions.length > 0) {
      testRun.sessions.forEach((session, index) => {
        const scenarioId = session.scenario_id?.toString() || `session-${index}`;
        // Use backend scenario name if available, otherwise use session scenario name or fallback
        const backendScenario = session.scenario_id ? backendScenarios?.find(s => s.id === session.scenario_id) : null;
        const scenarioName = backendScenario?.name || session.scenario?.name || `Scenario ${index + 1}`;

        const allSteps = session.steps || session.scenario?.steps || [];
        const steps: Step[] = allSteps.map((apiStep, stepIndex) => {
          let stepStatus: "pending" | "running" | "passed" | "failed" = "pending";
          const hasScreenshots = !!(apiStep.before_screenshot_url || apiStep.after_screenshot_url || apiStep.screenshot);
          const hasReasoning = !!apiStep.reasoning;
          const isExecuted = hasScreenshots || hasReasoning;
          const isLastStep = stepIndex === allSteps.length - 1;
          const nextStep = allSteps[stepIndex + 1];
          const nextStepIsExecuted = nextStep && (nextStep.before_screenshot_url || nextStep.after_screenshot_url || nextStep.reasoning);

          if (apiStep.status) {
            const apiStatus = (apiStep.status as string).toUpperCase();
            if (apiStatus === "COMPLETE" || apiStatus === "PASSED" || apiStatus === "SUCCESS") {
              stepStatus = "passed";
            } else if (apiStatus === "FAILED" || apiStatus === "ERROR") {
              stepStatus = "failed";
            } else if (apiStatus === "CONTINUE" || apiStatus === "RUNNING" || apiStatus === "ACTIVE") {
              if (isExecuted) {
                if (isLastStep || nextStepIsExecuted) {
                  stepStatus = "passed";
                } else {
                  stepStatus = "passed";
                }
              } else {
                stepStatus = "running";
              }
            } else {
              stepStatus = apiStep.status as "pending" | "running" | "passed" | "failed";
            }
          } else if (isExecuted) {
            const hasError = apiStep.reasoning?.toLowerCase().includes("failed") ||
              apiStep.reasoning?.toLowerCase().includes("error");
            if (hasError) {
              stepStatus = "failed";
            } else {
              const nextStepPending = nextStep && !nextStep.before_screenshot_url && !nextStep.after_screenshot_url && !nextStep.reasoning;
              if (isLastStep || nextStepPending) {
                stepStatus = "passed";
              } else {
                stepStatus = "running";
              }
            }
          } else {
            const prevStep = stepIndex > 0 ? allSteps[stepIndex - 1] : null;
            const prevStepExecuted = prevStep && (prevStep.before_screenshot_url || prevStep.after_screenshot_url || prevStep.reasoning);
            const prevStepPassed = prevStep && prevStepExecuted && !prevStep.reasoning?.toLowerCase().includes("failed") && !prevStep.reasoning?.toLowerCase().includes("error");

            if (stepIndex === 0) {
              const anyStepExecuted = allSteps.some(s => s.before_screenshot_url || s.after_screenshot_url || s.reasoning);
              stepStatus = anyStepExecuted ? "running" : "pending";
            } else if (prevStepPassed) {
              stepStatus = "running";
            } else {
              stepStatus = "pending";
            }
          }

          return {
            id: apiStep.id,
            action: apiStep.action || apiStep.action_summary || `Step ${apiStep.step_number || apiStep.id}`,
            status: stepStatus,
            reasoning: apiStep.reasoning,
            screenshot: getImageUrl(apiStep.screenshot),
            beforeScreenshot: getImageUrl(apiStep.before_screenshot_url || apiStep.before_screenshot),
            afterScreenshot: getImageUrl(apiStep.after_screenshot_url || apiStep.after_screenshot),
            consoleLogs: apiStep.console_logs || session.console_logs || [],
            networkLogs: apiStep.network_logs || session.network_logs || [],
          };
        });

        let scenarioStatus: "pending" | "running" | "passed" | "failed" = "running";
        if (steps.length > 0) {
          const lastStep = steps[steps.length - 1];
          const lastStepExecuted = !!(lastStep.beforeScreenshot || lastStep.afterScreenshot || lastStep.reasoning);

          if (isTestRunComplete && lastStepExecuted) {
            if (lastStep.status === "failed") {
              scenarioStatus = "failed";
            } else if (lastStep.status === "passed") {
              scenarioStatus = "passed";
            } else {
              const hasError = lastStep.reasoning?.toLowerCase().includes("failed") ||
                lastStep.reasoning?.toLowerCase().includes("error");
              scenarioStatus = hasError ? "failed" : "passed";
            }
          } else {
            scenarioStatus = "running";
          }
        } else {
          const defaultStatus = isTestRunActive ? "running" : (testRun.status === "completed" ? "passed" : "running");
          scenarioStatus = (session.scenario?.status || defaultStatus) as "pending" | "running" | "passed" | "failed";
        }

        // If scenario failed, mark the last executed step as failed so it shows an X icon
        if (scenarioStatus === "failed" && steps.length > 0) {
          // Find the last executed step (the step where it failed)
          for (let i = steps.length - 1; i >= 0; i--) {
            const step = steps[i];
            const isExecuted = !!(step.beforeScreenshot || step.afterScreenshot || step.reasoning);
            if (isExecuted) {
              // Mark this step as failed since it's the step where the scenario failed
              step.status = "failed";
              break;
            }
          }
        }

        mappedScenarios.push({
          id: scenarioId,
          name: scenarioName,
          status: scenarioStatus,
          hasRun: true,
          steps,
        });
      });
    }

    return mappedScenarios;
  };

  const handleShare = () => {
    const url = `${window.location.origin}/test-runs/${runId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusIcon = (status: string, size: "default" | "large" = "default") => {
    const iconSize = size === "large" ? "h-7 w-7 flex-shrink-0" : "h-5 w-5 flex-shrink-0";
    switch (status) {
      case "passed":
        return <CheckCircle2 className={`${iconSize} text-green-500`} />;
      case "failed":
        return <XCircle className={`${iconSize} text-red-500`} />;
      case "running":
        return <Loader2 className={`${iconSize} text-primary animate-spin`} />;
      default:
        return <Clock className={`${iconSize} text-muted-foreground`} />;
    }
  };

  const selectedScenarioData = scenarios.find(s => s.id === selectedScenario);

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      {/* Top Bar with Test Title */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/test-runs")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          {suiteInfo && (
            <h2 className="text-2xl font-semibold">{suiteInfo.name}</h2>
          )}
        </div>
        <div className="flex gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block">
                  <Button variant="outline" size="sm" disabled className="opacity-50 cursor-not-allowed">
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>coming soon</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 space-y-6 bg-white">
        {isLoadingData ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !suiteInfo ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">Test run not found</p>
            <Button onClick={() => navigate("/test-runs")} variant="outline">
              Back to Test Runs
            </Button>
          </div>
        ) : (
          <>
            {/* Test Run Info */}
            {testRun && (
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <p className="font-medium capitalize">{testRun.status}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Started:</span>
                      <p className="font-medium">
                        {new Date(testRun.started_at).toLocaleString()}
                      </p>
                    </div>
                    {testRun.completed_at && (
                      <div>
                        <span className="text-muted-foreground">Completed:</span>
                        <p className="font-medium">
                          {new Date(testRun.completed_at).toLocaleString()}
                        </p>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Scenarios:</span>
                      <p className="font-medium">
                        {testRun.passed_scenarios} passed, {testRun.failed_scenarios} failed out of {testRun.total_scenarios}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Platform Badge */}
            {testRun?.platform && (
              <Card className="bg-white rounded-lg">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    {testRun.platform.toLowerCase() === "ios" || testRun.platform.toLowerCase() === "android" ? (
                      <Smartphone className="h-4 w-4 text-primary" />
                    ) : (
                      <Globe className="h-4 w-4 text-primary" />
                    )}
                    <span className="font-medium capitalize">{testRun.platform}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Scenarios Section */}
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-4">Test Scenarios</h3>
              </div>
              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Scenarios List */}
                <div className="space-y-4">
                    {scenarios.length === 0 ? (
                      <Card>
                        <CardContent className="p-6 text-center">
                          <p className="text-muted-foreground">No scenarios found for this test run</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <Accordion
                        type="single"
                        collapsible
                        className="space-y-3"
                        value={expandedScenarioId}
                        onValueChange={setExpandedScenarioId}
                      >
                        {scenarios.map((scenario) => (
                        <AccordionItem
                          key={scenario.id}
                          value={`scenario-${scenario.id}`}
                          className="!border rounded-lg overflow-hidden"
                        >
                          <AccordionTrigger
                            className="px-4 hover:no-underline"
                            onClick={() => {
                              setSelectedScenario(scenario.id);
                              setCurrentScreenshotIndex(0);
                              setSelectedStepIndex(0);
                            }}
                          >
                            <div className="flex items-start gap-3 text-left flex-1 min-w-0 mr-2">
                              <div className="flex-shrink-0 pt-0.5">
                                {getStatusIcon(scenario.status, "large")}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium break-words block">{scenario.name}</span>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4">
                            {scenario.hasRun ? (
                              <div className="space-y-2">
                                {[...scenario.steps].sort((a, b) => a.id - b.id).map((step, index) => (
                                  <div
                                    key={step.id}
                                    className={cn(
                                      "flex items-start gap-3 p-3 rounded transition-all cursor-pointer",
                                      'bg-muted/30 hover:bg-muted/50'
                                    )}
                                    onClick={() => {
                                      setSelectedStepIndex(index);
                                      const sortedSteps = [...scenario.steps].sort((a, b) => a.id - b.id);
                                      const stepsWithScreenshots = sortedSteps.filter(
                                        s => s.status !== "pending" && (s.screenshot || s.beforeScreenshot || s.afterScreenshot)
                                      );
                                      const newIndex = stepsWithScreenshots.findIndex(s => s.id === step.id);
                                      if (newIndex >= 0) {
                                        setCurrentScreenshotIndex(newIndex);
                                      }
                                    }}
                                  >
                                    <div className="flex-shrink-0 mt-0.5">
                                      {getStatusIcon(step.status)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium">
                                        {step.action}
                                      </p>
                                      {step.reasoning && (
                                        <p className="text-xs text-muted-foreground mt-2 italic">
                                          {step.reasoning}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="bg-muted/30 rounded-lg p-6 text-center mt-2">
                                <p className="text-sm text-muted-foreground">
                                  No steps available for this scenario
                                </p>
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                        ))}
                      </Accordion>
                    )}
                  </div>

                  {/* Right Column - Details */}
                  <div className="space-y-4">
                    {selectedScenarioData ? (
                      <>
                        {/* Screenshots */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Screenshots</CardTitle>
                          </CardHeader>
                          <CardContent>
                            {(() => {
                              const stepsWithScreenshots = selectedScenarioData.steps.filter(
                                s => s.status !== "pending" && (s.screenshot || s.beforeScreenshot || s.afterScreenshot)
                              );

                              if (stepsWithScreenshots.length === 0) {
                                return (
                                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                                    No screenshots available yet
                                  </div>
                                );
                              }

                              const currentStep = stepsWithScreenshots[currentScreenshotIndex];

                              return (
                                <div className="space-y-4">
                                  {/* Step Info */}
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm font-medium">
                                      {currentStep.action}
                                    </div>
                                    {stepsWithScreenshots.length > 1 && (
                                      <div className="flex items-center gap-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setCurrentScreenshotIndex(prev =>
                                            prev > 0 ? prev - 1 : stepsWithScreenshots.length - 1
                                          )}
                                          className="h-8 w-8 p-0"
                                        >
                                          <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <span className="text-xs text-muted-foreground">
                                          {currentScreenshotIndex + 1} / {stepsWithScreenshots.length}
                                        </span>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setCurrentScreenshotIndex(prev =>
                                            prev < stepsWithScreenshots.length - 1 ? prev + 1 : 0
                                          )}
                                          className="h-8 w-8 p-0"
                                        >
                                          <ChevronRight className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Screenshot Display */}
                                  <div className="space-y-3">
                                    {currentStep.beforeScreenshot && currentStep.afterScreenshot ? (
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-2">Before</p>
                                          <div className="border rounded-lg overflow-hidden bg-muted/30 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setExpandedImage(currentStep.beforeScreenshot || null)}>
                                            <img
                                              src={currentStep.beforeScreenshot}
                                              alt="Before screenshot"
                                              className="w-full h-48 object-contain bg-white"
                                              onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                                const parent = target.parentElement;
                                                if (parent) {
                                                  parent.innerHTML = '<div class="h-48 flex items-center justify-center text-muted-foreground text-xs">Failed to load image</div>';
                                                }
                                              }}
                                              loading="lazy"
                                            />
                                          </div>
                                        </div>
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-2">After</p>
                                          <div className="border rounded-lg overflow-hidden bg-muted/30 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setExpandedImage(currentStep.afterScreenshot || null)}>
                                            <img
                                              src={currentStep.afterScreenshot}
                                              alt="After screenshot"
                                              className="w-full h-48 object-contain bg-white"
                                              onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                                const parent = target.parentElement;
                                                if (parent) {
                                                  parent.innerHTML = '<div class="h-48 flex items-center justify-center text-muted-foreground text-xs">Failed to load image</div>';
                                                }
                                              }}
                                              loading="lazy"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    ) : currentStep.screenshot ? (
                                      <div className="border rounded-lg overflow-hidden bg-muted/30 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setExpandedImage(currentStep.screenshot || null)}>
                                        <img
                                          src={currentStep.screenshot}
                                          alt="Screenshot"
                                          className="w-full h-96 object-contain bg-white"
                                          onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                            const parent = target.parentElement;
                                            if (parent) {
                                              parent.innerHTML = '<div class="h-96 flex items-center justify-center text-muted-foreground text-xs">Failed to load image</div>';
                                            }
                                          }}
                                          loading="lazy"
                                        />
                                      </div>
                                    ) : (
                                      <div className="h-[300px] flex items-center justify-center text-muted-foreground border rounded-lg">
                                        No screenshot available for this step
                                      </div>
                                    )}
                                  </div>

                                  {/* Step Indicators */}
                                  {stepsWithScreenshots.length > 1 && (
                                    <div className="flex items-center justify-center gap-2">
                                      {stepsWithScreenshots.map((_, idx) => (
                                        <button
                                          key={idx}
                                          onClick={() => setCurrentScreenshotIndex(idx)}
                                          className={cn(
                                            "h-2 rounded-full transition-all",
                                            idx === currentScreenshotIndex
                                              ? "w-8 bg-primary"
                                              : "w-2 bg-muted-foreground/30"
                                          )}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </CardContent>
                        </Card>

                        {/* Console & Network Logs */}
                        <Card>
                          <CardContent className="p-0">
                            <Tabs defaultValue="console" className="w-full">
                              <div className="flex items-center justify-between border-b px-4 py-2">
                                <TabsList className="bg-transparent p-0 h-auto">
                                  <TabsTrigger
                                    value="console"
                                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary bg-transparent"
                                  >
                                    Console
                                  </TabsTrigger>
                                  <TabsTrigger
                                    value="network"
                                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary bg-transparent"
                                  >
                                    Network
                                  </TabsTrigger>
                                </TabsList>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id="show-all-logs"
                                    checked={showAllLogs}
                                    onChange={(e) => setShowAllLogs(e.target.checked)}
                                    className="rounded border-input"
                                  />
                                  <label htmlFor="show-all-logs" className="text-xs text-muted-foreground cursor-pointer">
                                    Show all steps
                                  </label>
                                </div>
                              </div>
                              <div className="p-4">
                                <TabsContent value="console" className="mt-0">
                                  <div className="bg-muted/30 rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto font-mono text-xs">
                                    {(() => {
                                      const stepsToShow = showAllLogs
                                        ? selectedScenarioData.steps.filter(s => s.consoleLogs && Array.isArray(s.consoleLogs) && s.consoleLogs.length > 0)
                                        : selectedScenarioData.steps.filter((s, idx) => idx === selectedStepIndex && s.consoleLogs && Array.isArray(s.consoleLogs) && s.consoleLogs.length > 0);

                                      if (stepsToShow.length === 0) {
                                        return <p className="text-muted-foreground">No console logs available</p>;
                                      }

                                      return stepsToShow.map((step) => {
                                        const actualIndex = selectedScenarioData.steps.findIndex(s => s.id === step.id);
                                        const logs = Array.isArray(step.consoleLogs) ? step.consoleLogs : [];
                                        return (
                                          <div key={step.id} className="mb-3 pb-3 border-b border-border last:border-0">
                                            <p className="text-xs font-semibold mb-2 text-foreground">
                                              Step {actualIndex + 1}: {step.action}
                                            </p>
                                            {logs.length > 0 ? (
                                              logs.map((log, i) => {
                                                if (typeof log === 'object' && log !== null) {
                                                  const logObj = log as any;
                                                  const text = logObj.text || logObj.message || JSON.stringify(logObj);
                                                  const level = logObj.level || logObj.type || '';
                                                  const timestamp = logObj.timestamp || '';
                                                  return (
                                                    <p key={i} className={cn(
                                                      "text-xs leading-relaxed",
                                                      level === 'error' ? "text-red-500" :
                                                        level === 'warning' ? "text-yellow-500" :
                                                          "text-muted-foreground"
                                                    )}>
                                                      {timestamp && `[${new Date(timestamp).toLocaleTimeString()}] `}
                                                      {level && `[${level.toUpperCase()}] `}
                                                      {text}
                                                    </p>
                                                  );
                                                }
                                                return (
                                                  <p key={i} className="text-xs text-muted-foreground leading-relaxed">
                                                    {typeof log === 'string' ? log : JSON.stringify(log)}
                                                  </p>
                                                );
                                              })
                                            ) : (
                                              <p className="text-xs text-muted-foreground italic">No console logs for this step</p>
                                            )}
                                          </div>
                                        );
                                      });
                                    })()}
                                  </div>
                                </TabsContent>
                                <TabsContent value="network" className="mt-0">
                                  <div className="bg-muted/30 rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto font-mono text-xs">
                                    {(() => {
                                      const stepsToShow = showAllLogs
                                        ? selectedScenarioData.steps.filter(s => s.networkLogs && Array.isArray(s.networkLogs) && s.networkLogs.length > 0)
                                        : selectedScenarioData.steps.filter((s, idx) => idx === selectedStepIndex && s.networkLogs && Array.isArray(s.networkLogs) && s.networkLogs.length > 0);

                                      if (stepsToShow.length === 0) {
                                        return <p className="text-muted-foreground">No network activity recorded</p>;
                                      }

                                      return stepsToShow.map((step) => {
                                        const actualIndex = selectedScenarioData.steps.findIndex(s => s.id === step.id);
                                        const logs = Array.isArray(step.networkLogs) ? step.networkLogs : [];
                                        return (
                                          <div key={step.id} className="mb-3 pb-3 border-b border-border last:border-0">
                                            <p className="text-xs font-semibold mb-2 text-foreground">
                                              Step {actualIndex + 1}: {step.action}
                                            </p>
                                            {logs.length > 0 ? (
                                              logs.map((log, i) => {
                                                if (typeof log === 'object' && log !== null) {
                                                  const logObj = log as any;
                                                  const url = logObj.url || logObj.raw?.url || '';
                                                  const method = logObj.method || logObj.raw?.method || '';
                                                  const status = logObj.status || logObj.raw?.status || '';
                                                  const timestamp = logObj.timestamp || logObj.raw?.timestamp || '';
                                                  const statusColor = status >= 400 ? 'text-red-500' : status >= 300 ? 'text-yellow-500' : status >= 200 ? 'text-green-500' : 'text-muted-foreground';

                                                  return (
                                                    <p key={i} className="text-xs text-muted-foreground leading-relaxed">
                                                      {timestamp && `[${new Date(timestamp).toLocaleTimeString()}] `}
                                                      <span className={statusColor}>
                                                        {method} {url} {status ? `- ${status}` : ''}
                                                      </span>
                                                    </p>
                                                  );
                                                }
                                                return (
                                                  <p key={i} className="text-xs text-muted-foreground leading-relaxed">
                                                    {typeof log === 'string' ? log : JSON.stringify(log)}
                                                  </p>
                                                );
                                              })
                                            ) : (
                                              <p className="text-xs text-muted-foreground italic">No network logs for this step</p>
                                            )}
                                          </div>
                                        );
                                      });
                                    })()}
                                  </div>
                                </TabsContent>
                              </div>
                            </Tabs>
                          </CardContent>
                        </Card>
                      </>
                    ) : (
                      <Card>
                        <CardContent className="flex items-center justify-center h-[400px]">
                          <p className="text-muted-foreground text-sm">
                            Select a scenario to view details
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
            </div>

            {/* Share Dialog */}
            <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Share Test Run</DialogTitle>
                  <DialogDescription>
                    Anyone with this link can view the test results and screenshots.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex items-center space-x-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/test-runs/${runId}`}
                    className="font-mono text-sm"
                  />
                  <Button size="sm" className="px-3" onClick={handleShare}>
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <DialogFooter className="sm:justify-start">
                  <Button variant="secondary" onClick={() => setIsShareDialogOpen(false)}>
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Expanded Image Dialog */}
            <Dialog open={!!expandedImage} onOpenChange={() => setExpandedImage(null)}>
              <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-2">
                {expandedImage && (
                  <img
                    src={expandedImage}
                    alt="Expanded screenshot"
                    className="max-w-full max-h-[90vh] object-contain rounded-lg"
                    onClick={(e) => e.stopPropagation()}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = '<div class="h-96 flex items-center justify-center text-muted-foreground">Failed to load image</div>';
                      }
                    }}
                  />
                )}
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </div>
  );
};

