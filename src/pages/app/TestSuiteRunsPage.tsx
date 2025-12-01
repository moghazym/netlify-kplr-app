import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../components/ui/accordion";
import { Separator } from "../../components/ui/separator";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Share2,
  Play,
  Pencil,
  Sparkles,
  ArrowLeft,
  Loader2,
  Bug,
  RotateCcw,
  ExternalLink,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Globe,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Textarea } from "../../components/ui/textarea";
import { Input } from "../../components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../components/ui/tooltip";
import { useAuth } from "../../contexts/AuthContext";
import { useProject } from "../../contexts/ProjectContext";
import { cn } from "../../lib/utils";
import {
  getTestSuite,
  getScenarios,
  triggerCloudRun,
  getTestRun,
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


export const TestSuiteRunsPage: React.FC = () => {
  const { suiteId } = useParams<{ suiteId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedProject } = useProject();
  const { toast } = useToast();
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [selectedStepIndex, setSelectedStepIndex] = useState(0);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [newScenario, setNewScenario] = useState("");
  const [editingScenario, setEditingScenario] = useState<{ id: string; name: string } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [executingStepIndex, setExecutingStepIndex] = useState<number | null>(null);
  const [currentStepReasoning, setCurrentStepReasoning] = useState("");
  const [executingScenarioId, setExecutingScenarioId] = useState<string | null>(null);
  const [expandedScenarioId, setExpandedScenarioId] = useState<string | undefined>("");
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [isRunningAll, setIsRunningAll] = useState<{ web: boolean; ios: boolean; android: boolean }>({
    web: false,
    ios: false,
    android: false,
  });
  const [showCompletionBanner, setShowCompletionBanner] = useState(false);
  const [lastRunStats, setLastRunStats] = useState<{ passed: number; failed: number; total: number } | null>(null);

  const [suiteInfo, setSuiteInfo] = useState<{ name: string; description?: string } | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [runningPlatform, setRunningPlatform] = useState<"web" | "ios" | "android" | null>(null);
  const [currentScreenshotIndex, setCurrentScreenshotIndex] = useState(0);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<"web" | "ios" | "android">("web");

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
    if (suiteId && user) {
      loadSuiteData();
    }
  }, [suiteId, user]);

  // Reset to web if iOS/Android is selected (they're coming soon)
  useEffect(() => {
    if (selectedPlatform === "ios" || selectedPlatform === "android") {
      setSelectedPlatform("web");
    }
  }, [selectedPlatform]);

  // Cleanup polling on unmount or when suiteId changes
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    };
  }, [pollingInterval]);

  // Stop polling if suiteId changes
  useEffect(() => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
      setIsRunningAll({ web: false, ios: false, android: false });
      setRunningPlatform(null);
    }
  }, [suiteId]);

  const loadSuiteData = async () => {
    try {
      setIsLoadingData(true);

      if (!suiteId) return;

      const suiteIdNum = parseInt(suiteId, 10);
      if (isNaN(suiteIdNum)) {
        console.error("Invalid suite ID:", suiteId);
        return;
      }

      // Load suite and scenarios in parallel
      const [suiteData, scenariosData] = await Promise.all([
        getTestSuite(suiteIdNum),
        getScenarios(suiteIdNum),
      ]);

      setSuiteInfo({
        name: suiteData.name,
        description: suiteData.description || undefined,
      });

      // Transform scenarios to local format
      const transformedScenarios: Scenario[] = scenariosData.map(scenario => ({
        id: scenario.id.toString(),
        name: scenario.name,
        status: "pending" as const,
        hasRun: false,
        steps: [],
      }));

      setScenarios(transformedScenarios);
    } catch (error) {
      console.error("Error loading suite data:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load test suite data",
        variant: "destructive",
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  const generateStepsFromScenario = (scenarioName: string): Step[] => {
    const name = scenarioName.toLowerCase();
    const steps: Step[] = [];

    if (name.includes("navigate") || name.includes("go to")) {
      steps.push({ id: 1, action: "🌐 Navigate to target URL", status: "pending" });
    }
    if (name.includes("click")) {
      steps.push({ id: 2, action: "👆 Locate and click target element", status: "pending" });
    }
    if (name.includes("search") || name.includes("type") || name.includes("write")) {
      steps.push({ id: 3, action: "⌨️ Find input field and enter text", status: "pending" });
    }
    if (name.includes("verify") || name.includes("check") || name.includes("see")) {
      steps.push({ id: 4, action: "👁️ Verify expected content is visible", status: "pending" });
    }
    if (name.includes("complete") || name.includes("purchase")) {
      steps.push({ id: 5, action: "✅ Complete the transaction", status: "pending" });
    }

    if (steps.length === 0) {
      steps.push(
        { id: 1, action: "🌐 Navigate to page", status: "pending" },
        { id: 2, action: "⚡ Perform action", status: "pending" },
        { id: 3, action: "✅ Verify result", status: "pending" }
      );
    }

    return steps;
  };

  const simulateStepExecution = async (step: Step, stepIndex: number): Promise<Step> => {
    const reasoningPhases = [
      { text: "🔍 Analyzing page structure and element selectors...", duration: 800 },
      { text: "🎯 Locating target element on the page...", duration: 600 },
      { text: "✅ Element found, validating state...", duration: 700 },
      { text: "⚡ Executing action on element...", duration: 900 },
      { text: "📸 Capturing screenshots and validating changes...", duration: 800 },
    ];

    for (const phase of reasoningPhases) {
      setCurrentStepReasoning("");
      for (let i = 0; i <= phase.text.length; i++) {
        setCurrentStepReasoning(phase.text.substring(0, i));
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      await new Promise(resolve => setTimeout(resolve, phase.duration));
    }

    const isSuccess = Math.random() > 0.25;

    const consoleLogs = isSuccess
      ? [
        `[${new Date().toISOString()}] Step ${stepIndex + 1}: Starting execution`,
        `[${new Date().toISOString()}] Element selector found: .target-element-${stepIndex}`,
        `[${new Date().toISOString()}] Action executed successfully`,
        `[${new Date().toISOString()}] Validation passed: Expected state confirmed`
      ]
      : [
        `[${new Date().toISOString()}] Step ${stepIndex + 1}: Starting execution`,
        `[${new Date().toISOString()}] ERROR: Element not found`,
        `[${new Date().toISOString()}] Timeout waiting for element (5000ms)`,
        `[${new Date().toISOString()}] Test step failed`
      ];

    const networkLogs = isSuccess
      ? [
        `GET https://api.example.com/page-data - 200 OK (124ms)`,
        `POST https://api.example.com/analytics - 204 No Content (45ms)`,
      ]
      : [
        `GET https://api.example.com/page-data - 200 OK (124ms)`,
        `GET https://api.example.com/element-check - 404 Not Found (67ms)`,
      ];

    return {
      ...step,
      status: isSuccess ? "passed" : "failed",
      reasoning: isSuccess
        ? `✓ Successfully executed: ${step.action}`
        : `✗ Failed to execute: Element not found or selector changed`,
      consoleLogs,
      networkLogs,
      beforeScreenshot: "/placeholder.svg",
      afterScreenshot: "/placeholder.svg",
    };
  };

  const executeScenario = async (scenarioId: string, scenarioName: string) => {
    setScenarios(prev => {
      const exists = prev.find(s => s.id === scenarioId);
      if (exists) {
        return prev.map(s =>
          s.id === scenarioId
            ? { ...s, status: "running", hasRun: true, steps: [] }
            : s
        );
      } else {
        return [...prev, {
          id: scenarioId,
          name: scenarioName,
          status: "running",
          hasRun: true,
          steps: []
        }];
      }
    });

    setIsRunning(true);
    setExecutingStepIndex(0);
    setExecutingScenarioId(scenarioId);
    setSelectedScenario(scenarioId);
    setSelectedStepIndex(0);
    setExpandedScenarioId(`scenario-${scenarioId}`);

    try {
      const stepsToExecute = generateStepsFromScenario(scenarioName);
      const executedSteps: Step[] = [];
      let allPassed = true;

      for (let i = 0; i < stepsToExecute.length; i++) {
        const currentStep = stepsToExecute[i];
        setScenarios(prev => prev.map(s =>
          s.id === scenarioId
            ? { ...s, steps: [...executedSteps, { ...currentStep, status: "running" }] }
            : s
        ));

        setSelectedStepIndex(i);
        setExecutingStepIndex(i);

        const executedStep = await simulateStepExecution(currentStep, i);
        executedSteps.push(executedStep);

        if (executedStep.status === "failed") {
          allPassed = false;
        }

        setScenarios(prev => prev.map(s =>
          s.id === scenarioId
            ? { ...s, steps: executedSteps }
            : s
        ));

        if (!allPassed) break;
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const finalStatus = allPassed ? "passed" : "failed";
      setScenarios(prev => prev.map(s =>
        s.id === scenarioId
          ? { ...s, status: finalStatus, steps: executedSteps }
          : s
      ));

    } catch (error: any) {
      console.error("Execution failed:", error);
    } finally {
      setIsRunning(false);
      setExecutingStepIndex(null);
      setCurrentStepReasoning("");
      setExecutingScenarioId(null);
    }
  };

  const handleAddScenario = async () => {
    if (!newScenario.trim()) return;
    const newId = crypto.randomUUID();
    setScenarios([...scenarios, {
      id: newId,
      name: newScenario,
      status: "pending",
      hasRun: false,
      steps: [],
    }]);
    setNewScenario("");
    setIsAddDialogOpen(false);
    // Run all scenarios when adding a new one
    await handleRunAll();
  };

  const handleSaveAsDraft = () => {
    if (!newScenario.trim()) return;
    const newId = crypto.randomUUID();
    setScenarios([...scenarios, {
      id: newId,
      name: newScenario,
      status: "pending",
      hasRun: false,
      steps: [],
    }]);
    setNewScenario("");
    setIsAddDialogOpen(false);
  };


  const handleEditScenario = () => {
    if (!editingScenario || !editingScenario.name.trim()) return;
    setScenarios(scenarios.map(s =>
      s.id === editingScenario.id
        ? { ...s, name: editingScenario.name, status: "pending", hasRun: false }
        : s
    ));
    setIsEditDialogOpen(false);
    setEditingScenario(null);
  };

  const handleRunScenario = async () => {
    if (!editingScenario || !editingScenario.name.trim()) return;
    const scenarioId = editingScenario.id;
    const scenarioName = editingScenario.name;
    setScenarios(prev => prev.map(s =>
      s.id === scenarioId ? { ...s, name: scenarioName } : s
    ));
    setIsEditDialogOpen(false);
    setEditingScenario(null);
    // Run all scenarios when editing and clicking Run Now
    await handleRunAll();
  };

  // Map API response to UI state
  const mapTestRunToScenarios = (testRun: TestRunWithSessionsResponse, isTestRunActive: boolean = true): Scenario[] => {
    const mappedScenarios: Scenario[] = [];
    const isTestRunComplete = testRun.status === "completed" || testRun.status === "failed";

    // If scenarios are directly in the response
    if (testRun.scenarios && testRun.scenarios.length > 0) {
      testRun.scenarios.forEach((apiScenario) => {
        const allSteps = apiScenario.steps || [];
        const steps: Step[] = allSteps.map((apiStep, stepIndex) => {
          // Determine step status - map API status values to UI statuses
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
              // If it has screenshots/reasoning, it's been executed
              if (isExecuted) {
                // If next step exists and is executed, or if it's the last step, mark as passed
                if (isLastStep || nextStepIsExecuted) {
                  stepStatus = "passed";
                } else {
                  // Executed but next step hasn't started yet - mark as passed (next step will show as running)
                  stepStatus = "passed";
                }
              } else {
                // Currently executing
                stepStatus = "running";
              }
            } else {
              stepStatus = apiStep.status as "pending" | "running" | "passed" | "failed";
            }
          } else if (isExecuted) {
            // Step has been executed - check if it passed or failed
            const hasError = apiStep.reasoning?.toLowerCase().includes("failed") ||
              apiStep.reasoning?.toLowerCase().includes("error");
            if (hasError) {
              stepStatus = "failed";
            } else {
              // Step executed successfully - mark as passed
              // Only show checkmark if next step is pending (hasn't started) or if it's the last step
              const nextStepPending = nextStep && !nextStep.before_screenshot_url && !nextStep.after_screenshot_url && !nextStep.reasoning;
              if (isLastStep || nextStepPending) {
                stepStatus = "passed";
              } else {
                // Next step is running, but this step is still executing
                stepStatus = "running";
              }
            }
          } else {
            // Step hasn't been executed yet
            // Check if this is the first step or if previous step is passed - if so, this step should be running
            const prevStep = stepIndex > 0 ? allSteps[stepIndex - 1] : null;
            const prevStepExecuted = prevStep && (prevStep.before_screenshot_url || prevStep.after_screenshot_url || prevStep.reasoning);
            const prevStepPassed = prevStep && prevStepExecuted && !prevStep.reasoning?.toLowerCase().includes("failed") && !prevStep.reasoning?.toLowerCase().includes("error");

            if (stepIndex === 0) {
              // First step - show as running if scenario has started (has any step data)
              const anyStepExecuted = allSteps.some(s => s.before_screenshot_url || s.after_screenshot_url || s.reasoning);
              stepStatus = anyStepExecuted ? "running" : "pending";
            } else if (prevStepPassed) {
              // Previous step is done and passed, this step should be running
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

        // Determine scenario status based on steps
        // Scenario stays "running" while test is active, only show final status when test run is complete
        let scenarioStatus: "pending" | "running" | "passed" | "failed" = "running";
        if (steps.length > 0) {
          const lastStep = steps[steps.length - 1];
          const lastStepExecuted = !!(lastStep.beforeScreenshot || lastStep.afterScreenshot || lastStep.reasoning);

          // Only determine final status when test run is complete AND last step is executed
          if (isTestRunComplete && lastStepExecuted) {
            if (lastStep.status === "failed") {
              scenarioStatus = "failed";
            } else if (lastStep.status === "passed") {
              scenarioStatus = "passed";
            } else {
              // Last step executed but status unclear, check for errors
              const hasError = lastStep.reasoning?.toLowerCase().includes("failed") ||
                lastStep.reasoning?.toLowerCase().includes("error");
              scenarioStatus = hasError ? "failed" : "passed";
            }
          } else {
            // Test is still running or last step not executed yet, scenario is still running
            scenarioStatus = "running";
          }
        } else {
          // No steps yet - show running if test is active, otherwise use API status
          scenarioStatus = isTestRunActive ? "running" : ((apiScenario.status as "pending" | "running" | "passed" | "failed") || "running");
        }

        mappedScenarios.push({
          id: apiScenario.id.toString(),
          name: apiScenario.name,
          status: scenarioStatus,
          hasRun: true,
          steps,
        });
      });
    } else if (testRun.sessions && testRun.sessions.length > 0) {
      // Map from sessions if scenarios not directly available
      testRun.sessions.forEach((session, index) => {
        const scenarioId = session.scenario_id?.toString() || `session-${index}`;
        const scenarioName = session.scenario?.name || `Scenario ${index + 1}`;

        const allSteps = session.steps || session.scenario?.steps || [];
        const steps: Step[] = allSteps.map((apiStep, stepIndex) => {
          // Determine step status - map API status values to UI statuses
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
              // If it has screenshots/reasoning, it's been executed
              if (isExecuted) {
                // If next step exists and is executed, or if it's the last step, mark as passed
                if (isLastStep || nextStepIsExecuted) {
                  stepStatus = "passed";
                } else {
                  // Executed but next step hasn't started yet - mark as passed (next step will show as running)
                  stepStatus = "passed";
                }
              } else {
                // Currently executing
                stepStatus = "running";
              }
            } else {
              stepStatus = apiStep.status as "pending" | "running" | "passed" | "failed";
            }
          } else if (isExecuted) {
            // Step has been executed - check if it passed or failed
            const hasError = apiStep.reasoning?.toLowerCase().includes("failed") ||
              apiStep.reasoning?.toLowerCase().includes("error");
            if (hasError) {
              stepStatus = "failed";
            } else {
              // Step executed successfully - mark as passed
              // Only show checkmark if next step is pending (hasn't started) or if it's the last step
              const nextStepPending = nextStep && !nextStep.before_screenshot_url && !nextStep.after_screenshot_url && !nextStep.reasoning;
              if (isLastStep || nextStepPending) {
                stepStatus = "passed";
              } else {
                // Next step is running, but this step is still executing
                stepStatus = "running";
              }
            }
          } else {
            // Step hasn't been executed yet
            // Check if this is the first step or if previous step is passed - if so, this step should be running
            const prevStep = stepIndex > 0 ? allSteps[stepIndex - 1] : null;
            const prevStepExecuted = prevStep && (prevStep.before_screenshot_url || prevStep.after_screenshot_url || prevStep.reasoning);
            const prevStepPassed = prevStep && prevStepExecuted && !prevStep.reasoning?.toLowerCase().includes("failed") && !prevStep.reasoning?.toLowerCase().includes("error");

            if (stepIndex === 0) {
              // First step - show as running if scenario has started (has any step data)
              const anyStepExecuted = allSteps.some(s => s.before_screenshot_url || s.after_screenshot_url || s.reasoning);
              stepStatus = anyStepExecuted ? "running" : "pending";
            } else if (prevStepPassed) {
              // Previous step is done and passed, this step should be running
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

        // Determine scenario status based on steps
        // Scenario stays "running" while test is active, only show final status when test run is complete
        let scenarioStatus: "pending" | "running" | "passed" | "failed" = "running";
        if (steps.length > 0) {
          const lastStep = steps[steps.length - 1];
          const lastStepExecuted = !!(lastStep.beforeScreenshot || lastStep.afterScreenshot || lastStep.reasoning);

          // Only determine final status when test run is complete AND last step is executed
          if (isTestRunComplete && lastStepExecuted) {
            if (lastStep.status === "failed") {
              scenarioStatus = "failed";
            } else if (lastStep.status === "passed") {
              scenarioStatus = "passed";
            } else {
              // Last step executed but status unclear, check for errors
              const hasError = lastStep.reasoning?.toLowerCase().includes("failed") ||
                lastStep.reasoning?.toLowerCase().includes("error");
              scenarioStatus = hasError ? "failed" : "passed";
            }
          } else {
            // Test is still running or last step not executed yet, scenario is still running
            scenarioStatus = "running";
          }
        } else {
          // No steps yet - show running if test is active, otherwise use API status
          const defaultStatus = isTestRunActive ? "running" : (testRun.status === "completed" ? "passed" : "running");
          scenarioStatus = (session.scenario?.status || defaultStatus) as "pending" | "running" | "passed" | "failed";
        }

        mappedScenarios.push({
          id: scenarioId,
          name: scenarioName,
          status: scenarioStatus,
          hasRun: true,
          steps,
        });
      });
    } else {
      // If no scenarios or sessions, create placeholder scenarios based on existing ones
      // This maintains the UI structure while waiting for data
      return scenarios.map(s => ({
        ...s,
        status: s.status === "pending" ? "running" : s.status,
      }));
    }

    return mappedScenarios;
  };

  // Poll test run status
  const pollTestRun = async (testRunId: number) => {
    try {
      const testRun = await getTestRun(testRunId);
      const isTestRunActive = testRun.status !== "completed" && testRun.status !== "failed";
      const mappedScenarios = mapTestRunToScenarios(testRun, isTestRunActive);

      // Update scenarios state - merge with existing scenarios to preserve structure
      setScenarios(prevScenarios => {
        // If we have mapped scenarios, use them
        if (mappedScenarios.length > 0) {
          // Merge: update existing scenarios if they match, otherwise add new ones
          const merged = [...prevScenarios];
          mappedScenarios.forEach(mapped => {
            const existingIndex = merged.findIndex(s => s.id === mapped.id);
            if (existingIndex >= 0) {
              // Preserve the original scenario name but use all other data from API
              const existingScenario = merged[existingIndex];
              merged[existingIndex] = {
                ...mapped, // Use all data from API (steps, status, etc.)
                name: existingScenario.name || mapped.name, // Preserve original name only
                // Ensure steps have all their data including images
                steps: mapped.steps.map(step => ({
                  ...step,
                  screenshot: step.screenshot,
                  beforeScreenshot: step.beforeScreenshot,
                  afterScreenshot: step.afterScreenshot,
                  consoleLogs: step.consoleLogs || [],
                  networkLogs: step.networkLogs || [],
                })),
              };
            } else {
              merged.push(mapped);
            }
          });
          return merged;
        }
        // Otherwise, update status of existing scenarios
        return prevScenarios.map(s => ({
          ...s,
          status: s.status === "pending" ? "running" : s.status,
        }));
      });

      // Check if test run is complete
      if (testRun.status === "completed" || testRun.status === "failed") {
        // Stop polling
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        
        // Do one final poll after a short delay to ensure all data is available
        setTimeout(async () => {
          try {
            const finalTestRun = await getTestRun(testRunId);
            const finalMappedScenarios = mapTestRunToScenarios(finalTestRun, false);
            
            // Update with final complete data
            setScenarios(prevScenarios => {
              const finalScenarios = finalMappedScenarios.map(mapped => {
                const existing = prevScenarios.find(s => s.id === mapped.id);
                return {
                  ...mapped,
                  name: existing?.name || mapped.name, // Preserve original name
                };
              });
              
              const existingIds = new Set(finalMappedScenarios.map(m => m.id));
              const additional = prevScenarios.filter(s => !existingIds.has(s.id));
              
              return [...finalScenarios, ...additional];
            });
          } catch (error) {
            console.error("Error fetching final test run data:", error);
            // Fall back to current data if final poll fails
          }
        }, 1000);
        
        // Only stop running state if this is the current platform's run
        if (runningPlatform) {
          setIsRunningAll(prev => ({ ...prev, [runningPlatform]: false }));
          setRunningPlatform(null);
        }

        const passedCount = testRun.passed_scenarios || 0;
        const failedCount = testRun.failed_scenarios || 0;
        const totalCount = testRun.total_scenarios || mappedScenarios.length;

        setLastRunStats({ passed: passedCount, failed: failedCount, total: totalCount });
        setShowCompletionBanner(true);

        // Immediate update with current data
        setScenarios(prevScenarios => {
          const updatedScenarios = mappedScenarios.map(mapped => {
            const existing = prevScenarios.find(s => s.id === mapped.id);
            return {
              ...mapped,
              name: existing?.name || mapped.name, // Preserve original name
            };
          });
          
          const existingIds = new Set(mappedScenarios.map(m => m.id));
          const additional = prevScenarios.filter(s => !existingIds.has(s.id));
          
          return [...updatedScenarios, ...additional];
        });
      }
    } catch (error) {
      console.error("Error polling test run:", error);

      // If we get a 404 or the test run doesn't exist, stop polling
      if (error instanceof Error && error.message.includes("404")) {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        if (runningPlatform) {
          setIsRunningAll(prev => ({ ...prev, [runningPlatform]: false }));
          setRunningPlatform(null);
        }
        toast({
          title: "Error",
          description: "Test run not found",
          variant: "destructive",
        });
      }
      // For other errors, continue polling but log them
      // The polling will continue and might recover
    }
  };

  const handleRunAll = async () => {
    if (!selectedProject || !suiteId) {
      toast({
        title: "Error",
        description: "Project or suite ID is missing",
        variant: "destructive",
      });
      return;
    }

    // Stop any existing polling for other platforms
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }

    setIsRunningAll(prev => ({ ...prev, [selectedPlatform]: true }));
    setRunningPlatform(selectedPlatform);
    setShowCompletionBanner(false);

    try {
      const suiteIdNum = parseInt(suiteId, 10);
      if (isNaN(suiteIdNum)) {
        throw new Error("Invalid suite ID");
      }

      // Call trigger API
      const triggerResponse = await triggerCloudRun({
        project_id: selectedProject.id,
        suite_id: suiteIdNum,
        platform: selectedPlatform === "web" ? "web" : selectedPlatform,
        options: {
          max_steps: 8,
        },
      });

      const testRunId = triggerResponse.test_run_id;

      // Initial poll
      await pollTestRun(testRunId);

      // Set up polling interval (poll every 2 seconds)
      const interval = setInterval(() => {
        pollTestRun(testRunId);
      }, 2000);

      setPollingInterval(interval);

      // Also update scenarios to show running state immediately
      setScenarios(prevScenarios => {
        const updated = prevScenarios.map(s => ({
          ...s,
          status: "running" as const,
          hasRun: true,
        }));

        // Expand and select the first scenario automatically
        if (updated.length > 0) {
          const firstScenario = updated[0];
          setExpandedScenarioId(`scenario-${firstScenario.id}`);
          setSelectedScenario(firstScenario.id);
          setSelectedStepIndex(0);
          setCurrentScreenshotIndex(0);
        }

        return updated;
      });

      toast({
        title: "Test run started",
        description: `Test run ${testRunId} has been queued and is running`,
      });
    } catch (error) {
      console.error("Error triggering test run:", error);

      // Clean up on error
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to trigger test run",
        variant: "destructive",
      });
      setIsRunningAll(prev => ({ ...prev, [selectedPlatform]: false }));
      setRunningPlatform(null);

      // Reset scenarios to pending state
      setScenarios(prevScenarios =>
        prevScenarios.map(s => ({
          ...s,
          status: s.hasRun ? s.status : "pending" as const,
        }))
      );
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/share/suite/${suiteId}/run/latest`;
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
    <div className="space-y-6">
        {isLoadingData ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !suiteInfo ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">Test suite not found</p>
            <Button onClick={() => navigate("/test-suites")} variant="outline">
              Back to Test Suites
            </Button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="space-y-3">
              <h2 className="text-2xl font-bold">{suiteInfo.name}</h2>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" onClick={() => navigate("/test-suites")} className="text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" size="sm" onClick={() => setIsShareDialogOpen(true)} className="rounded-lg">
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleRunAll}
                    disabled={isRunningAll[selectedPlatform] || isRunning || scenarios.length === 0 || selectedPlatform === "ios" || selectedPlatform === "android"}
                    className="bg-orange-500 hover:bg-orange-600 text-white rounded-lg"
                  >
                    {isRunningAll[selectedPlatform] ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Running All...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Run All
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <Separator className="mt-6 mb-4" />

            {/* Platform Tabs */}
            <Card className="bg-white rounded-lg">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 w-full">
                  <button
                    onClick={() => setSelectedPlatform("web")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg transition-all text-sm font-medium flex-1",
                      selectedPlatform === "web"
                        ? "bg-muted text-foreground"
                        : "bg-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Globe className={cn("h-3.5 w-3.5", selectedPlatform === "web" ? "text-blue-500" : "text-muted-foreground")} />
                    <span>Web</span>
                  </button>
                  <button
                    onClick={() => setSelectedPlatform("ios")}
                    disabled={true}
                    className={cn(
                      "flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg transition-all text-sm font-medium flex-1",
                      selectedPlatform === "ios"
                        ? "bg-muted text-foreground"
                        : "bg-transparent text-muted-foreground hover:text-foreground",
                      "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Smartphone className={cn("h-3.5 w-3.5", selectedPlatform === "ios" ? "text-blue-500" : "text-muted-foreground")} />
                    <span>iOS (Coming Soon)</span>
                  </button>
                  <button
                    onClick={() => setSelectedPlatform("android")}
                    disabled={true}
                    className={cn(
                      "flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg transition-all text-sm font-medium flex-1",
                      selectedPlatform === "android"
                        ? "bg-muted text-foreground"
                        : "bg-transparent text-muted-foreground hover:text-foreground",
                      "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Smartphone className={cn("h-3.5 w-3.5", selectedPlatform === "android" ? "text-blue-500" : "text-muted-foreground")} />
                    <span>Android (Coming Soon)</span>
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Completion Banner */}
            {showCompletionBanner && lastRunStats && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">Test Run Complete!</p>
                        <p className="text-sm text-muted-foreground">
                          {lastRunStats.passed} passed, {lastRunStats.failed} failed out of {lastRunStats.total} scenarios
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => navigate('/test-runs')}
                    >
                      View Test Runs
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Scenarios List */}
              <div className="space-y-4">
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
                          // Reset screenshot carousel when selecting a scenario
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
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingScenario({ id: scenario.id, name: scenario.name });
                                      setIsEditDialogOpen(true);
                                    }}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Edit Scenario</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            {scenario.status === 'failed' && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                    >
                                      <Bug className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Create Bug Ticket</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            {scenario.hasRun ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger className="inline-flex">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 opacity-50 cursor-not-allowed"
                                      disabled
                                    >
                                      <RotateCcw className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Coming Soon</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger className="inline-flex">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 opacity-50 cursor-not-allowed"
                                      disabled
                                    >
                                      <Play className="h-3 w-3 mr-1" />
                                      Run
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Coming Soon</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        {scenario.hasRun ? (
                          <div className="space-y-2">
                            {[...scenario.steps].sort((a, b) => a.id - b.id).map((step, index) => {
                              const isCurrentlyExecuting = executingScenarioId === scenario.id && executingStepIndex === index;

                              return (
                                <div
                                  key={step.id}
                                  className={cn(
                                    "flex items-start gap-3 p-3 rounded transition-all cursor-pointer",
                                    isCurrentlyExecuting
                                      ? 'bg-primary/10 border-2 border-primary shadow-md'
                                      : 'bg-muted/30 hover:bg-muted/50'
                                  )}
                                  onClick={() => {
                                    if (!isCurrentlyExecuting) {
                                      setSelectedStepIndex(index);
                                      // Reset screenshot carousel when selecting a new step
                                      const sortedSteps = [...scenario.steps].sort((a, b) => a.id - b.id);
                                      const stepsWithScreenshots = sortedSteps.filter(
                                        s => s.status !== "pending" && (s.screenshot || s.beforeScreenshot || s.afterScreenshot)
                                      );
                                      const newIndex = stepsWithScreenshots.findIndex(s => s.id === step.id);
                                      if (newIndex >= 0) {
                                        setCurrentScreenshotIndex(newIndex);
                                      }
                                    }
                                  }}
                                >
                                  <div className="flex-shrink-0 mt-0.5">
                                    {isCurrentlyExecuting ? (
                                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                                    ) : (
                                      getStatusIcon(step.status)
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">
                                      {step.action}
                                    </p>

                                    {isCurrentlyExecuting && currentStepReasoning && (
                                      <div className="mt-2 p-2 bg-background/50 rounded border border-primary/20">
                                        <p className="text-xs font-mono text-primary">
                                          {currentStepReasoning}
                                          <span className="animate-pulse ml-1">|</span>
                                        </p>
                                      </div>
                                    )}

                                    {!isCurrentlyExecuting && step.reasoning && (
                                      <p className="text-xs text-muted-foreground mt-2 italic">
                                        {step.reasoning}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="bg-muted/30 rounded-lg p-6 text-center mt-2">
                            <p className="text-sm text-muted-foreground mb-3">
                              This scenario hasn't been executed yet
                            </p>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    disabled
                                    className="opacity-50 cursor-not-allowed"
                                  >
                                    <Play className="h-4 w-4 mr-2" />
                                    Run Scenario
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Coming Soon</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsAddDialogOpen(true)}
                >
                  Add Test Scenarios
                </Button>
              </div>

              {/* Right Column - Details */}
              <div className="space-y-4">
                {selectedScenarioData ? (
                  <>
                    {/* Screenshots */}
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-base">Screenshots</CardTitle>
                        {selectedPlatform && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            {selectedPlatform === 'web' ? (
                              <Globe className="w-3 h-3" />
                            ) : (
                              <Smartphone className="w-3 h-3" />
                            )}
                            {selectedPlatform === 'web' ? 'Web' : selectedPlatform === 'ios' ? 'iOS' : 'Android'}
                          </Badge>
                        )}
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
                                            // Handle structured log objects
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
                                            // Handle structured network log objects
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
                      <div className="text-center space-y-2">
                        <Globe className="w-12 h-12 mx-auto text-muted-foreground/50" />
                        <p className="text-muted-foreground text-sm">
                          Select a scenario to view details
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Add Scenario Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Test Scenario</DialogTitle>
                  <DialogDescription>
                    Describe the test scenario. Save as draft to run later, or run immediately to see AI execute steps in real-time.
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  placeholder="e.g., Navigate to checkout page, fill in shipping details, and complete purchase"
                  value={newScenario}
                  onChange={(e) => setNewScenario(e.target.value)}
                  className="min-h-[100px]"
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleSaveAsDraft}
                    disabled={!newScenario.trim()}
                  >
                    Save as Draft
                  </Button>
                  <Button onClick={handleAddScenario} disabled={!newScenario.trim()} className="bg-orange-500 hover:bg-orange-600 text-white">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Run Now
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Edit Scenario Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Test Scenario</DialogTitle>
                  <DialogDescription>
                    Update the scenario description and choose to save as draft or run immediately.
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  placeholder="Scenario description..."
                  value={editingScenario?.name || ""}
                  onChange={(e) => setEditingScenario(editingScenario ? { ...editingScenario, name: e.target.value } : null)}
                  className="min-h-[100px]"
                />
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditDialogOpen(false);
                      setEditingScenario(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleEditScenario}
                    disabled={!editingScenario?.name.trim()}
                  >
                    Save as Draft
                  </Button>
                  <Button
                    onClick={handleRunScenario}
                    disabled={!editingScenario?.name.trim()}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Run Now
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Share Dialog */}
            <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Share Test Suite Run</DialogTitle>
                  <DialogDescription>
                    Anyone with this link can view the test results and screenshots.
                  </DialogDescription>
                </DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="grid flex-1 gap-2">
              <Input
                readOnly
                value={`${window.location.origin}/share/suite/${suiteId}/run/latest`}
                className="font-mono text-sm"
              />
            </div>
            <Button size="sm" className="px-3" onClick={handleShare}>
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <p className="text-sm font-medium">Live Updates Enabled</p>
            </div>
            <p className="text-xs text-muted-foreground">
              This link always shows the latest test run results. Perfect for sharing with your team or embedding in dashboards.
            </p>
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
  );
};

