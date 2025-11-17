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
  Play,
  Pencil,
  Sparkles,
  ArrowLeft,
  Loader2,
  Bug,
  RotateCcw,
  ExternalLink,
  Terminal,
  Copy,
  Check,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Textarea } from "../../components/ui/textarea";
import { Input } from "../../components/ui/input";
import { useAuth } from "../../contexts/AuthContext";
import { cn } from "../../lib/utils";
import { 
  getTestSuite, 
  getScenarios
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
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [_runAllProgress, setRunAllProgress] = useState<{ current: number; total: number } | null>(null);
  const [showCompletionBanner, setShowCompletionBanner] = useState(false);
  const [lastRunStats, setLastRunStats] = useState<{ passed: number; failed: number; total: number } | null>(null);
  const [_isPlaywrightInstalled, setIsPlaywrightInstalled] = useState(false);
  const [showPlaywrightDialog, setShowPlaywrightDialog] = useState(false);

  const [suiteInfo, setSuiteInfo] = useState<{ name: string; description?: string } | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    if (suiteId && user) {
      loadSuiteData();
    }
  }, [suiteId, user]);

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
    setNewScenario("");
    setIsAddDialogOpen(false);
    await executeScenario(newId, newScenario);
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

  const handleRunFromDraft = async (scenarioId: string) => {
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (!scenario) return;
    await executeScenario(scenarioId, scenario.name);
  };

  const handleRerunScenario = async (scenarioId: string) => {
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (!scenario) return;
    await executeScenario(scenarioId, scenario.name);
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
    await executeScenario(scenarioId, scenarioName);
  };

  const handleRunAll = async () => {
    setIsRunningAll(true);
    setShowCompletionBanner(false);
    
    let passedCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];
      setRunAllProgress({ current: i + 1, total: scenarios.length });
      await executeScenario(scenario.id, scenario.name);
      
      const updatedScenario = scenarios.find(s => s.id === scenario.id);
      if (updatedScenario?.status === "passed") {
        passedCount++;
      } else if (updatedScenario?.status === "failed") {
        failedCount++;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setRunAllProgress(null);
    setLastRunStats({ passed: passedCount, failed: failedCount, total: scenarios.length });
    setShowCompletionBanner(true);
    setIsRunningAll(false);
  };

  const handleShare = () => {
    const url = `${window.location.origin}/share/suite/${suiteId}/run/latest`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "passed":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "running":
        return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const selectedScenarioData = scenarios.find(s => s.id === selectedScenario);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">Kplr</span>
          </div>
          <span className="text-sm font-medium text-gray-700">Your AI QA</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 space-y-6">
        {isLoadingData ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !suiteInfo ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">Test suite not found</p>
            <Button onClick={() => navigate("/documents")} variant="outline">
              Back to Test Suites
            </Button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => navigate("/documents")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <h2 className="text-2xl font-semibold">{suiteInfo.name}</h2>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowPlaywrightDialog(true)}
                >
                  <Terminal className="h-4 w-4 mr-2" />
                  Check Playwright
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsShareDialogOpen(true)}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleRunAll} 
                  disabled={isRunningAll || isRunning || scenarios.length === 0}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {isRunningAll ? (
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
                      className="border rounded-lg"
                    >
                      <AccordionTrigger 
                        className="px-4 hover:no-underline"
                        onClick={() => setSelectedScenario(scenario.id)}
                      >
                        <div className="flex items-center gap-3 flex-1 text-left">
                          {getStatusIcon(scenario.status)}
                          <span className="text-sm font-medium">{scenario.name}</span>
                          <div className="ml-auto mr-4 flex items-center gap-2">
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

                            {scenario.status === 'failed' && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              >
                                <Bug className="h-3 w-3" />
                              </Button>
                            )}

                            {scenario.hasRun ? (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-7 w-7 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRerunScenario(scenario.id);
                                }}
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            ) : (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-7 px-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRunFromDraft(scenario.id);
                                }}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                Run
                              </Button>
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        {scenario.hasRun ? (
                          <div className="space-y-2">
                            {scenario.steps.map((step, index) => {
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
                                  onClick={() => !isCurrentlyExecuting && setSelectedStepIndex(index)}
                                >
                                  <div className="flex-shrink-0 mt-0.5">
                                    {isCurrentlyExecuting ? (
                                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                                    ) : (
                                      getStatusIcon(step.status)
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">Step {index + 1}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
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
                            <Button 
                              size="sm" 
                              variant="default"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRunFromDraft(scenario.id);
                              }}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Run Scenario
                            </Button>
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
                      <CardHeader>
                        <CardTitle className="text-base">Screenshots</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {selectedScenarioData.steps.filter(s => s.status !== "pending").length === 0 ? (
                          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                            No screenshots available yet
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {selectedScenarioData.steps
                              .filter(s => s.status !== "pending")
                              .map((step, index) => (
                                <div key={step.id} className="space-y-3">
                                  <div className="text-sm font-medium">
                                    Step {index + 1}: {step.action}
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-2">Before</p>
                                      <div className="border rounded-lg overflow-hidden bg-muted/30">
                                        <img 
                                          src={step.beforeScreenshot || "/placeholder.svg"} 
                                          alt="Before screenshot"
                                          className="w-full h-48 object-cover"
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-2">After</p>
                                      <div className="border rounded-lg overflow-hidden bg-muted/30">
                                        <img 
                                          src={step.afterScreenshot || "/placeholder.svg"} 
                                          alt="After screenshot"
                                          className="w-full h-48 object-cover"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
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
                                    ? selectedScenarioData.steps.filter(s => s.consoleLogs && s.consoleLogs.length > 0)
                                    : selectedScenarioData.steps.filter((s, idx) => idx === selectedStepIndex && s.consoleLogs && s.consoleLogs.length > 0);
                                  
                                  if (stepsToShow.length === 0) {
                                    return <p className="text-muted-foreground">No console logs available</p>;
                                  }
                                  
                                  return stepsToShow.map((step, index) => {
                                    const actualIndex = selectedScenarioData.steps.indexOf(step);
                                    return (
                                      <div key={index} className="mb-3 pb-3 border-b border-border last:border-0">
                                        <p className="text-xs font-semibold mb-2 text-foreground">
                                          Step {actualIndex + 1}: {step.action}
                                        </p>
                                        {step.consoleLogs?.map((log, i) => (
                                          <p key={i} className="text-xs text-muted-foreground leading-relaxed">
                                            {log}
                                          </p>
                                        ))}
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
                                    ? selectedScenarioData.steps.filter(s => s.networkLogs && s.networkLogs.length > 0)
                                    : selectedScenarioData.steps.filter((s, idx) => idx === selectedStepIndex && s.networkLogs && s.networkLogs.length > 0);
                                  
                                  if (stepsToShow.length === 0) {
                                    return <p className="text-muted-foreground">No network activity recorded</p>;
                                  }
                                  
                                  return stepsToShow.map((step, index) => {
                                    const actualIndex = selectedScenarioData.steps.indexOf(step);
                                    return (
                                      <div key={index} className="mb-3 pb-3 border-b border-border last:border-0">
                                        <p className="text-xs font-semibold mb-2 text-foreground">
                                          Step {actualIndex + 1}: {step.action}
                                        </p>
                                        {step.networkLogs?.map((log, i) => (
                                          <p key={i} className="text-xs text-muted-foreground leading-relaxed">
                                            {log}
                                          </p>
                                        ))}
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
                  <Input
                    readOnly
                    value={`${window.location.origin}/share/suite/${suiteId}/run/latest`}
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

            {/* Playwright Dialog */}
            <Dialog open={showPlaywrightDialog} onOpenChange={setShowPlaywrightDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Playwright Installation</DialogTitle>
                  <DialogDescription>
                    Playwright is required to run test scenarios. Install it to get started.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm font-mono mb-2">npm install -g playwright</p>
                    <p className="text-sm font-mono">npx playwright install</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowPlaywrightDialog(false)}>
                    Close
                  </Button>
                  <Button 
                    onClick={() => {
                      setIsPlaywrightInstalled(true);
                      setShowPlaywrightDialog(false);
                    }}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    Mark as Installed
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </div>
  );
};

