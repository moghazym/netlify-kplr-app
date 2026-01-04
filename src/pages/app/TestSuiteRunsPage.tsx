import React, { useState, useEffect, useRef, useCallback } from "react";
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
  ExternalLink,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Globe,
  Trash2,
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
  triggerLiveRun,
  getTestRun,
  getLatestTestRun,
  createScenario,
  deleteScenario,
  getWebrtcIceServers,
  TestRunWithSessionsResponse,
  WebrtcIceServer
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
  stepNumber?: number;
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingScenario, setDeletingScenario] = useState<{ id: string; name: string } | null>(null);
  const [newScenario, setNewScenario] = useState("");
  const [editingScenario, setEditingScenario] = useState<{ id: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedScenarioId, setExpandedScenarioId] = useState<string | undefined>("");
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [isRunningAll, setIsRunningAll] = useState<{ web: boolean; ios: boolean; android: boolean }>({
    web: false,
    ios: false,
    android: false,
  });
  const [showCompletionBanner, setShowCompletionBanner] = useState(false);
  const [lastRunStats, setLastRunStats] = useState<{ passed: number; failed: number; total: number } | null>(null);

  const [suiteInfo, setSuiteInfo] = useState<{ name: string; description?: string; application_url?: string | null } | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [runningPlatform, setRunningPlatform] = useState<"web" | "ios" | "android" | null>(null);
  const [currentScreenshotIndex, setCurrentScreenshotIndex] = useState(0);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [expandedImageError, setExpandedImageError] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [selectedPlatform, setSelectedPlatform] = useState<"web" | "ios" | "android">("web");
  const [liveStreamUrl, setLiveStreamUrl] = useState<string | null>(null);
  const [isLaunchingLiveRun, setIsLaunchingLiveRun] = useState(false);
  const [launchingScenarioId, setLaunchingScenarioId] = useState<string | null>(null);
  const [streamState, setStreamState] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [streamError, setStreamError] = useState<string | null>(null);
  const [streamAttempt, setStreamAttempt] = useState(0);
  const streamVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamPcRef = useRef<RTCPeerConnection | null>(null);
  const streamRetryRef = useRef(0);
  const streamSelectedPairRef = useRef<string | null>(null);
  const streamIceServersRef = useRef<{ servers: WebrtcIceServer[]; fetchedAt: number } | null>(null);
  const ICE_SERVERS_TTL_MS = 4 * 60 * 1000;
  const MAX_STREAM_RETRIES = 6;

  // Helper function to construct full image URL from filename or path
  const getImageUrl = (imagePath: string | undefined | null): string | undefined => {
    if (!imagePath) return undefined;

    // If it's already a full URL, return it as-is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }

    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    const normalized = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;

    if (normalized.startsWith('/static/')) {
      return apiBaseUrl ? `${apiBaseUrl}${normalized}` : normalized;
    }

    if (normalized.startsWith('/images/') || normalized.startsWith('/attachments/')) {
      const staticPath = `/static${normalized}`;
      return apiBaseUrl ? `${apiBaseUrl}${staticPath}` : staticPath;
    }

    const cleanPath = normalized.startsWith('/') ? normalized.slice(1) : normalized;
    return `https://storage.googleapis.com/kplr-images-prod/images/${cleanPath}`;
  };

  const logImageLoadError = useCallback(async (src: string, context: Record<string, unknown>) => {
    const resolvedSrc = new URL(src, window.location.href).toString();
    const details: Record<string, unknown> = { ...context, src: resolvedSrc };
    try {
      const response = await fetch(resolvedSrc, { method: "HEAD" });
      details.status = response.status;
      details.statusText = response.statusText;
    } catch (error) {
      details.error = error instanceof Error ? error.message : String(error);
    }
    console.warn("[image-load-failed]", details);
  }, []);

  const recordImageError = useCallback(
    (src: string | undefined, context: Record<string, unknown>) => {
      if (!src) return;
      setImageErrors((prev) => (prev[src] ? prev : { ...prev, [src]: true }));
      void logImageLoadError(src, context);
    },
    [logImageLoadError]
  );

  useEffect(() => {
    if (suiteId && user) {
      loadSuiteData();
    }
  }, [suiteId, user]);

  useEffect(() => {
    setExpandedImageError(false);
  }, [expandedImage]);

  // Reset to web if iOS/Android is selected (not available yet)
  useEffect(() => {
    if (selectedPlatform === "ios" || selectedPlatform === "android") {
      setSelectedPlatform("web");
    }
  }, [selectedPlatform]);

  // Cleanup polling on unmount or when suiteId changes
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (streamPcRef.current) {
        streamPcRef.current.close();
        streamPcRef.current = null;
      }
    };
  }, []);

  // Stop polling if suiteId changes
  useEffect(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      setIsRunningAll({ web: false, ios: false, android: false });
      setRunningPlatform(null);
    }
  }, [suiteId]);

  useEffect(() => {
    streamRetryRef.current = 0;
    streamIceServersRef.current = null;
    streamSelectedPairRef.current = null;
  }, [liveStreamUrl]);

  const waitForIceGatheringComplete = (pc: RTCPeerConnection, timeoutMs = 5000) => {
    if (pc.iceGatheringState === "complete") {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const timer = window.setTimeout(() => {
        cleanup();
        resolve();
      }, timeoutMs);
      const check = () => {
        if (pc.iceGatheringState === "complete") {
          cleanup();
          resolve();
        }
      };
      const cleanup = () => {
        pc.removeEventListener("icegatheringstatechange", check);
        window.clearTimeout(timer);
      };
      pc.addEventListener("icegatheringstatechange", check);
    });
  };

  useEffect(() => {
    let isActive = true;
    let retryTimer: number | null = null;
    let statsTimer: number | null = null;

    const cleanupVideo = () => {
      const video = streamVideoRef.current;
      if (!video) return;
      const stream = video.srcObject as MediaStream | null;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      video.srcObject = null;
    };

    const cleanupPeer = () => {
      if (streamPcRef.current) {
        streamPcRef.current.close();
        streamPcRef.current = null;
      }
      if (statsTimer) {
        window.clearInterval(statsTimer);
        statsTimer = null;
      }
    };

    const connect = async () => {
      cleanupPeer();
      cleanupVideo();
      setStreamError(null);

      if (!liveStreamUrl) {
        setStreamState("idle");
        return;
      }

      const baseUrl = liveStreamUrl.replace(/\/$/, "");
      const streamLogPrefix = "[stream]";
      setStreamState("connecting");
      const attemptId = streamAttempt + 1;
      const connectStartedAt = performance.now();
      console.log(streamLogPrefix, "attempt", attemptId, "url", baseUrl);

      let iceServers: WebrtcIceServer[] = [];
      const now = Date.now();
      if (
        streamIceServersRef.current
        && now - streamIceServersRef.current.fetchedAt < ICE_SERVERS_TTL_MS
      ) {
        iceServers = streamIceServersRef.current.servers;
      } else {
        try {
          const response = await getWebrtcIceServers();
          iceServers = response.iceServers || [];
          streamIceServersRef.current = { servers: iceServers, fetchedAt: now };
        } catch (err) {
          console.log(streamLogPrefix, "ice servers fetch failed", err);
        }
      }
      console.log(streamLogPrefix, "ice servers", iceServers.length);

      const pc = new RTCPeerConnection({ iceServers });
      streamPcRef.current = pc;
      pc.addTransceiver("video", { direction: "recvonly" });

      pc.ontrack = (event) => {
        if (!isActive) return;
        console.log(streamLogPrefix, "track received", event.track.kind, event.streams);
        if (streamVideoRef.current) {
          streamVideoRef.current.srcObject = event.streams[0];
        }
      };

      pc.onicecandidate = (event) => {
        if (!isActive) return;
        if (event.candidate) {
          console.log(streamLogPrefix, "ice candidate", event.candidate.candidate);
        } else {
          console.log(streamLogPrefix, "ice gathering complete");
        }
      };

      pc.onicegatheringstatechange = () => {
        if (!isActive) return;
        console.log(streamLogPrefix, "iceGatheringState", pc.iceGatheringState);
      };

      pc.oniceconnectionstatechange = () => {
        if (!isActive) return;
        console.log(streamLogPrefix, "iceConnectionState", pc.iceConnectionState);
      };

      pc.onsignalingstatechange = () => {
        if (!isActive) return;
        console.log(streamLogPrefix, "signalingState", pc.signalingState);
      };

      statsTimer = window.setInterval(async () => {
        if (!isActive) return;
        try {
          const stats = await pc.getStats();
          let selectedPairId: string | null = null;
          stats.forEach((report) => {
            if (report.type === "transport" && report.selectedCandidatePairId) {
              selectedPairId = report.selectedCandidatePairId as string;
            }
            if (report.type === "inbound-rtp" && report.kind === "video") {
              console.log(streamLogPrefix, "stats", {
                framesDecoded: report.framesDecoded,
                framesReceived: report.framesReceived,
                packetsReceived: report.packetsReceived,
                jitter: report.jitter,
              });
            }
          });
          if (selectedPairId && streamSelectedPairRef.current !== selectedPairId) {
            streamSelectedPairRef.current = selectedPairId;
            const selected = stats.get(selectedPairId);
            if (selected && selected.type === "candidate-pair") {
              const local = stats.get(selected.localCandidateId);
              const remote = stats.get(selected.remoteCandidateId);
              console.log(streamLogPrefix, "selected pair", {
                local: local ? `${local.protocol} ${local.candidateType} ${local.ip}:${local.port}` : null,
                remote: remote ? `${remote.protocol} ${remote.candidateType} ${remote.ip}:${remote.port}` : null,
                state: selected.state,
              });
            }
          }
        } catch (err) {
          console.log(streamLogPrefix, "stats error", err);
        }
      }, 5000);

      pc.onconnectionstatechange = () => {
        if (!isActive) return;
        console.log(streamLogPrefix, "connectionState", pc.connectionState);
        if (pc.connectionState === "connected") {
          setStreamState("live");
          const connectedMs = Math.round(performance.now() - connectStartedAt);
          console.log(streamLogPrefix, "connected in", connectedMs, "ms");
        } else if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
          setStreamState("error");
        }
      };

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await waitForIceGatheringComplete(pc, 5000);
        const localDesc = pc.localDescription;
        const offerUrl = `${baseUrl}/offer`;
        const response = await fetch(offerUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sdp: localDesc?.sdp, type: localDesc?.type }),
        });
        if (!response.ok) {
          let responseBody = "";
          try {
            responseBody = await response.text();
          } catch (err) {
            responseBody = "failed to read body";
          }
          console.log(streamLogPrefix, "offer failed", response.status, responseBody);
          throw new Error(`Offer failed (${response.status})`);
        }
        const answer = await response.json();
        if (!isActive) return;
        await pc.setRemoteDescription(answer);
      } catch (error) {
        if (!isActive) return;
        const message = error instanceof Error ? error.message : "Failed to connect";
        if (streamRetryRef.current < MAX_STREAM_RETRIES) {
          streamRetryRef.current += 1;
          const backoffMs = Math.min(1000 * 2 ** (streamRetryRef.current - 1), 10000);
          setStreamState("connecting");
          setStreamError(null);
          console.log(streamLogPrefix, "retrying in", backoffMs, "ms", "reason", message);
          retryTimer = window.setTimeout(() => {
            if (isActive) {
              setStreamAttempt((prev) => prev + 1);
            }
          }, backoffMs);
          return;
        }
        setStreamState("error");
        setStreamError(message);
        cleanupPeer();
        cleanupVideo();
      }
    };

    connect();

    return () => {
      isActive = false;
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
      cleanupPeer();
      cleanupVideo();
    };
  }, [liveStreamUrl, streamAttempt]);

  const loadSuiteData = async () => {
    try {
      setIsLoadingData(true);

      if (!suiteId) return;

      const suiteIdNum = parseInt(suiteId, 10);
      if (isNaN(suiteIdNum)) {
        console.error("Invalid suite ID:", suiteId);
        return;
      }

      // Load suite, scenarios, and latest test run in parallel
      const [suiteData, scenariosData, latestTestRunResponse] = await Promise.all([
        getTestSuite(suiteIdNum),
        getScenarios(suiteIdNum),
        getLatestTestRun(suiteIdNum).catch(() => null), // Don't fail if no test run exists
      ]);

      setSuiteInfo({
        name: suiteData.name,
        description: suiteData.description || undefined,
        application_url: suiteData.application_url || undefined,
      });

      // If there's a latest test run, load its full details and map to scenarios
      if (latestTestRunResponse) {
        try {
          const fullTestRun = await getTestRun(latestTestRunResponse.id);
          
          // Set platform if available in test run
          if (fullTestRun.platform) {
            const platformLower = fullTestRun.platform.toLowerCase();
            if (platformLower === "web" || platformLower === "ios" || platformLower === "android") {
              setSelectedPlatform(platformLower as "web" | "ios" | "android");
            }
          }
          
          const mappedScenarios = mapTestRunToScenarios(fullTestRun, false);
          
          // Merge with scenarios from API to preserve scenario names
          const mergedScenarios = mappedScenarios.map(mapped => {
            const apiScenario = scenariosData.find(s => s.id.toString() === mapped.id);
            return {
              ...mapped,
              name: apiScenario?.name || mapped.name, // Use API scenario name if available
            };
          });

          // Add any scenarios that don't have test run data yet
          const scenarioIdsWithRun = new Set(mappedScenarios.map(s => s.id));
          const scenariosWithoutRun = scenariosData
            .filter(s => !scenarioIdsWithRun.has(s.id.toString()))
            .map(scenario => ({
        id: scenario.id.toString(),
        name: scenario.name,
        status: "pending" as const,
        hasRun: false,
        steps: [],
      }));

          setScenarios([...mergedScenarios, ...scenariosWithoutRun]);

          // Auto-select first scenario if available
          if (mergedScenarios.length > 0) {
            setSelectedScenario(mergedScenarios[0].id);
            setExpandedScenarioId(`scenario-${mergedScenarios[0].id}`);
            setCurrentScreenshotIndex(0);
            setSelectedStepIndex(0);
          }
        } catch (error) {
          console.error("Error loading latest test run details:", error);
          // Fall back to showing scenarios without test run data
          const transformedScenarios: Scenario[] = scenariosData.map(scenario => ({
            id: scenario.id.toString(),
            name: scenario.name,
            status: "pending" as const,
            hasRun: false,
            steps: [],
          }));
      setScenarios(transformedScenarios);
        }
      } else {
        // No test run exists, just show scenarios
        const transformedScenarios: Scenario[] = scenariosData.map(scenario => ({
          id: scenario.id.toString(),
          name: scenario.name,
          status: "pending" as const,
          hasRun: false,
          steps: [],
        }));
        setScenarios(transformedScenarios);
      }
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


  const handleAddScenario = async () => {
    if (!newScenario.trim() || !suiteId) return;

    const suiteIdNum = parseInt(suiteId, 10);
    if (isNaN(suiteIdNum)) {
      toast({
        title: "Error",
        description: "Invalid test suite ID",
        variant: "destructive",
      });
      return;
    }

    try {
      if (!selectedProject) {
        toast({
          title: "Error",
          description: "Project is missing",
          variant: "destructive",
        });
        return;
      }

      const createdScenario = await createScenario({
        test_suite_id: suiteIdNum,
        name: newScenario.trim(),
        description: null,
      });

      const scenariosData = await getScenarios(suiteIdNum);
      const transformedScenarios: Scenario[] = scenariosData.map(scenario => ({
        id: scenario.id.toString(),
        name: scenario.name,
        status: "pending" as const,
        hasRun: false,
        steps: [],
      }));

      setScenarios(transformedScenarios);
      setNewScenario("");
      setIsAddDialogOpen(false);
      setSelectedScenario(createdScenario.id.toString());
      setExpandedScenarioId(`scenario-${createdScenario.id}`);
      setSelectedStepIndex(0);
      setCurrentScreenshotIndex(0);

      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      setIsLaunchingLiveRun(true);
      setLaunchingScenarioId(createdScenario.id.toString());
      setRunningPlatform(selectedPlatform);
      setShowCompletionBanner(false);

      const liveRun = await triggerLiveRun({
        project_id: selectedProject.id,
        suite_id: suiteIdNum,
        scenario_id: createdScenario.id,
        platform: selectedPlatform === "android" ? "android" : "web",
        options: {
          max_steps: 8,
        },
      });

      setLiveStreamUrl(liveRun.stream_url);
      setScenarios(prevScenarios =>
        prevScenarios.map(s =>
          s.id === createdScenario.id.toString()
            ? { ...s, status: "running" as const, hasRun: true }
            : s
        )
      );

      await pollTestRun(liveRun.test_run_id);
      const interval = setInterval(() => {
        pollTestRun(liveRun.test_run_id);
      }, 5000);
      pollingIntervalRef.current = interval;

      toast({
        title: "Scenario saved",
        description: "Live run started",
      });
    } catch (error) {
      console.error("Error adding scenario:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save scenario",
        variant: "destructive",
      });
      setLiveStreamUrl(null);
      setRunningPlatform(null);
    } finally {
      setIsLaunchingLiveRun(false);
      setLaunchingScenarioId(null);
    }
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

  const handleRunEditedScenario = async () => {
    if (!editingScenario || !editingScenario.name.trim()) return;
    const scenarioId = editingScenario.id;
    const scenarioName = editingScenario.name;
    setScenarios(prev => prev.map(s =>
      s.id === scenarioId ? { ...s, name: scenarioName } : s
    ));
    setIsEditDialogOpen(false);
    setEditingScenario(null);
    const scenarioToRun = scenarios.find(s => s.id === scenarioId) || {
      id: scenarioId,
      name: scenarioName,
      status: "pending" as const,
      hasRun: false,
      steps: [],
    };
    await handleRunScenario(scenarioToRun);
  };

  const handleDeleteScenario = async () => {
    if (!deletingScenario || !suiteId) return;

    const suiteIdNum = parseInt(suiteId, 10);
    const scenarioIdNum = parseInt(deletingScenario.id, 10);
    
    if (isNaN(suiteIdNum) || isNaN(scenarioIdNum)) {
      toast({
        title: "Error",
        description: "Invalid test suite or scenario ID",
        variant: "destructive",
      });
      return;
    }

    try {
      // Delete scenario via API
      await deleteScenario(scenarioIdNum);

      // Reload scenarios from API to get the latest data
      const scenariosData = await getScenarios(suiteIdNum);
      const transformedScenarios: Scenario[] = scenariosData.map(scenario => ({
        id: scenario.id.toString(),
        name: scenario.name,
        status: "pending" as const,
        hasRun: false,
        steps: [],
      }));

      setScenarios(transformedScenarios);
      setIsDeleteDialogOpen(false);
      setDeletingScenario(null);

      // Clear selected scenario if it was deleted
      if (selectedScenario === deletingScenario.id) {
        setSelectedScenario(null);
      }

      toast({
        title: "Success",
        description: "Scenario deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting scenario:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete scenario",
        variant: "destructive",
      });
    }
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
            stepNumber: apiStep.step_number ?? undefined,
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
        
        // First check test run status and scenario status if test run is complete
        if (isTestRunComplete) {
          // Check test run status first
          if (testRun.status) {
            const testRunStatus = (testRun.status as string).toLowerCase();
            if (testRunStatus === "failed" || testRunStatus === "error") {
              scenarioStatus = "failed";
            }
          }
          
          // Also check scenario status
          if (scenarioStatus === "running" && apiScenario.status) {
            const apiStatus = (apiScenario.status as string).toLowerCase();
            if (apiStatus === "failed" || apiStatus === "error") {
              scenarioStatus = "failed";
            } else if (apiStatus === "passed" || apiStatus === "complete" || apiStatus === "success") {
              scenarioStatus = "passed";
            }
          }
        }
        
        // If status not determined from API, check steps
        if (scenarioStatus === "running" && steps.length > 0) {
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
          } else if (isTestRunComplete && !lastStepExecuted) {
            // Test run is complete but last step not executed - check if any step executed and scenario failed
            const anyStepExecuted = steps.some(s => !!(s.beforeScreenshot || s.afterScreenshot || s.reasoning));
            if (anyStepExecuted) {
              // Check test run status first
              if (testRun.status) {
                const testRunStatus = (testRun.status as string).toLowerCase();
                if (testRunStatus === "failed" || testRunStatus === "error") {
                  scenarioStatus = "failed";
                }
              }
              
              // If still running, check scenario API status
              if (scenarioStatus === "running" && apiScenario.status) {
                const apiStatus = (apiScenario.status as string).toLowerCase();
                if (apiStatus === "failed" || apiStatus === "error") {
                  scenarioStatus = "failed";
                }
              }
              
              // If still running, check executed steps for errors
              if (scenarioStatus === "running") {
                const executedStep = steps.find(s => !!(s.beforeScreenshot || s.afterScreenshot || s.reasoning));
                if (executedStep) {
                  const hasError = executedStep.reasoning?.toLowerCase().includes("failed") ||
                    executedStep.reasoning?.toLowerCase().includes("error");
                  scenarioStatus = hasError ? "failed" : "running";
                }
              }
            }
          }
        } else if (scenarioStatus === "running" && steps.length === 0) {
          // No steps yet - show running if test is active, otherwise use API status
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
            stepNumber: apiStep.step_number ?? undefined,
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
        
        // First check session status and test run status if test run is complete
        if (isTestRunComplete) {
          // Check session status first (this is the primary indicator)
          if (session.status) {
            const sessionStatus = (session.status as string).toUpperCase();
            if (sessionStatus === "FAILED" || sessionStatus === "ERROR") {
              scenarioStatus = "failed";
            } else if (sessionStatus === "PASSED" || sessionStatus === "COMPLETE" || sessionStatus === "SUCCESS") {
              scenarioStatus = "passed";
            }
          }
          
          // Also check test run status as fallback
          if (scenarioStatus === "running" && testRun.status) {
            const testRunStatus = (testRun.status as string).toLowerCase();
            if (testRunStatus === "failed" || testRunStatus === "error") {
              scenarioStatus = "failed";
            } else if (testRunStatus === "completed") {
              // If test run is completed but session status wasn't set, check scenario status
              if (session.scenario?.status) {
                const apiStatus = (session.scenario.status as string).toLowerCase();
                if (apiStatus === "failed" || apiStatus === "error") {
                  scenarioStatus = "failed";
                } else if (apiStatus === "passed" || apiStatus === "complete" || apiStatus === "success") {
                  scenarioStatus = "passed";
                }
              }
            }
          }
        }
        
        // If status not determined from API, check steps
        if (scenarioStatus === "running" && steps.length > 0) {
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
          } else if (isTestRunComplete && !lastStepExecuted) {
            // Test run is complete but last step not executed - check if any step executed and scenario failed
            const anyStepExecuted = steps.some(s => !!(s.beforeScreenshot || s.afterScreenshot || s.reasoning));
            if (anyStepExecuted) {
              // Check session status first
              if (session.status) {
                const sessionStatus = (session.status as string).toUpperCase();
                if (sessionStatus === "FAILED" || sessionStatus === "ERROR") {
                  scenarioStatus = "failed";
                } else if (sessionStatus === "PASSED" || sessionStatus === "COMPLETE" || sessionStatus === "SUCCESS") {
                  scenarioStatus = "passed";
                }
              }
              
              // If still running, check test run status
              if (scenarioStatus === "running" && testRun.status) {
                const testRunStatus = (testRun.status as string).toLowerCase();
                if (testRunStatus === "failed" || testRunStatus === "error") {
                  scenarioStatus = "failed";
                }
              }
              
              // If still running, check scenario status
              if (scenarioStatus === "running" && session.scenario?.status) {
                const apiStatus = (session.scenario.status as string).toLowerCase();
                if (apiStatus === "failed" || apiStatus === "error") {
                  scenarioStatus = "failed";
                }
              }
              
              // If still running, check executed steps for errors
              if (scenarioStatus === "running") {
                const executedStep = steps.find(s => !!(s.beforeScreenshot || s.afterScreenshot || s.reasoning));
                if (executedStep) {
                  const hasError = executedStep.reasoning?.toLowerCase().includes("failed") ||
                    executedStep.reasoning?.toLowerCase().includes("error");
                  scenarioStatus = hasError ? "failed" : "running";
                }
              }
            }
          }
        } else if (scenarioStatus === "running" && steps.length === 0) {
          // No steps yet - show running if test is active, otherwise use API status
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

  const handleRunScenario = async (scenario: Scenario) => {
    if (!selectedProject || !suiteId) {
      toast({
        title: "Error",
        description: "Project or suite ID is missing",
        variant: "destructive",
      });
      return;
    }

    const suiteIdNum = parseInt(suiteId, 10);
    if (isNaN(suiteIdNum)) {
      toast({
        title: "Error",
        description: "Invalid test suite ID",
        variant: "destructive",
      });
      return;
    }

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    try {
      setIsLaunchingLiveRun(true);
      setLaunchingScenarioId(scenario.id);
      setRunningPlatform(selectedPlatform);
      setShowCompletionBanner(false);

      const liveRun = await triggerLiveRun({
        project_id: selectedProject.id,
        suite_id: suiteIdNum,
        scenario_id: Number(scenario.id),
        platform: selectedPlatform === "android" ? "android" : "web",
        options: {
          max_steps: 8,
        },
      });

      setLiveStreamUrl(liveRun.stream_url);
      setSelectedScenario(scenario.id);
      setExpandedScenarioId(`scenario-${scenario.id}`);
      setSelectedStepIndex(0);
      setCurrentScreenshotIndex(0);

      setScenarios(prevScenarios =>
        prevScenarios.map(s =>
          s.id === scenario.id
            ? { ...s, status: "running" as const, hasRun: true }
            : s
        )
      );

      await pollTestRun(liveRun.test_run_id);
      const interval = setInterval(() => {
        pollTestRun(liveRun.test_run_id);
      }, 5000);
      pollingIntervalRef.current = interval;
    } catch (error) {
      console.error("Error running scenario:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to run scenario",
        variant: "destructive",
      });
      setLiveStreamUrl(null);
      setRunningPlatform(null);
    } finally {
      setIsLaunchingLiveRun(false);
      setLaunchingScenarioId(null);
    }
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
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        
        // Always reset running state when test run completes
        if (runningPlatform) {
          setIsRunningAll(prev => ({ ...prev, [runningPlatform]: false }));
          setRunningPlatform(null);
        } else {
          // Fallback: reset all platforms if runningPlatform is not set
          setIsRunningAll({ web: false, ios: false, android: false });
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
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
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
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    setIsLaunchingLiveRun(true);
    setIsRunningAll(prev => ({ ...prev, [selectedPlatform]: true }));
    setRunningPlatform(selectedPlatform);
    setShowCompletionBanner(false);

    try {
      const suiteIdNum = parseInt(suiteId, 10);
      if (isNaN(suiteIdNum)) {
        throw new Error("Invalid suite ID");
      }

      // Call trigger API
      const triggerResponse = await triggerLiveRun({
        project_id: selectedProject.id,
        suite_id: suiteIdNum,
        platform: selectedPlatform === "web" ? "web" : selectedPlatform,
        options: {
          max_steps: 8,
        },
      });

      const testRunId = triggerResponse.test_run_id;
      setLiveStreamUrl(triggerResponse.stream_url);

      // Initial poll
      await pollTestRun(testRunId);

      // Set up polling interval (poll every 5 seconds)
      const interval = setInterval(() => {
        pollTestRun(testRunId);
      }, 5000);

      pollingIntervalRef.current = interval;

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
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setLiveStreamUrl(null);
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
    } finally {
      setIsLaunchingLiveRun(false);
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
            <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" onClick={() => navigate("/test-suites")} className="text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                <div className="flex flex-col">
                  <h2 className="text-2xl font-bold">{suiteInfo.name}</h2>
                  {suiteInfo.application_url && (
                    <a 
                      href={suiteInfo.application_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground mt-1 flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {suiteInfo.application_url}
                    </a>
                  )}
                </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" size="sm" onClick={() => setIsShareDialogOpen(true)} className="rounded-lg">
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleRunAll}
                    disabled={
                      isRunningAll[selectedPlatform] ||
                      runningPlatform === selectedPlatform ||
                      scenarios.length === 0 ||
                      selectedPlatform === "ios" ||
                      selectedPlatform === "android"
                    }
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
                  {scenarios.map((scenario) => {
                    const isScenarioLaunching = launchingScenarioId === scenario.id;
                    const isScenarioRunning = scenario.status === "running" || isScenarioLaunching;
                    const isScenarioDisabled =
                      isRunningAll[selectedPlatform] ||
                      (runningPlatform === selectedPlatform && !isScenarioRunning) ||
                      (isLaunchingLiveRun && !isScenarioLaunching);

                    return (
                      <AccordionItem
                        key={scenario.id}
                        value={`scenario-${scenario.id}`}
                        className="!border rounded-lg overflow-hidden"
                      >
                        <div className="flex items-center gap-2">
                          <AccordionTrigger
                            className="px-4 hover:no-underline flex-1"
                            onClick={() => {
                              setSelectedScenario(scenario.id);
                              // Reset screenshot carousel when selecting a scenario
                              setCurrentScreenshotIndex(0);
                              setSelectedStepIndex(0);
                            }}
                          >
                            <div className="flex items-start gap-3 text-left flex-1 min-w-0">
                              <div className="flex-shrink-0 pt-0.5">
                                {getStatusIcon(scenario.status, "large")}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium break-words block">{scenario.name}</span>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <div className="flex items-center gap-2 pr-4">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    onClick={() => {
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

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => {
                                      setDeletingScenario({ id: scenario.id, name: scenario.name });
                                      setIsDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Delete Scenario</p>
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

                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                              disabled={isScenarioDisabled}
                              onClick={() => {
                                handleRunScenario(scenario);
                              }}
                            >
                              {isScenarioRunning ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <Play className="h-3 w-3 mr-1" />
                              )}
                              {isScenarioRunning ? "Running" : "Run"}
                            </Button>
                          </div>
                        </div>
                        <AccordionContent className="px-4 pb-4">
                          {scenario.hasRun ? (
                            <div className="space-y-2">
                              {[...scenario.steps].sort((a, b) => a.id - b.id).map((step, index) => (
                                  <div
                                    key={step.id}
                                    className={cn(
                                      "flex items-start gap-3 p-3 rounded transition-all cursor-pointer",
                                      selectedStepIndex === index ? 'bg-muted/50' : 'bg-muted/30 hover:bg-muted/50'
                                    )}
                                    onClick={() => {
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
                              <p className="text-sm text-muted-foreground mb-3">
                                This scenario hasn't been executed yet
                              </p>
                              <Button
                                size="sm"
                                variant="default"
                                disabled={isScenarioDisabled}
                                onClick={() => handleRunScenario(scenario)}
                              >
                                {isScenarioRunning ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4 mr-2" />
                                )}
                                {isScenarioRunning ? "Running" : "Run Scenario"}
                              </Button>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
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
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Live Execution</CardTitle>
                    {streamState === "live" ? (
                      <Badge variant="outline" className="flex items-center gap-1 text-green-600">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        Live
                      </Badge>
                    ) : streamState === "connecting" ? (
                      <Badge variant="outline" className="text-amber-600">Connecting</Badge>
                    ) : liveStreamUrl ? (
                      <Badge variant="outline" className="text-red-600">Disconnected</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Idle</Badge>
                    )}
                  </CardHeader>
                  <CardContent>
                    {isLaunchingLiveRun ? (
                      <div className="h-[220px] flex items-center justify-center text-muted-foreground gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Launching live run...
                      </div>
                    ) : liveStreamUrl ? (
                      <div className="space-y-3">
                        <div className="border rounded-lg overflow-hidden bg-black/90 relative">
                          <video
                            ref={streamVideoRef}
                            className="w-full h-[260px] object-contain"
                            autoPlay
                            playsInline
                            muted
                          />
                          {streamState !== "live" && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-sm gap-2">
                              {streamState === "connecting" ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  {streamRetryRef.current > 0
                                    ? `Starting stream... (${streamRetryRef.current}/${MAX_STREAM_RETRIES})`
                                    : "Connecting to WebRTC..."}
                                </>
                              ) : (
                                <>
                                  <span>{streamError || "Stream disconnected"}</span>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => {
                                      streamRetryRef.current = 0;
                                      setStreamAttempt((prev) => prev + 1);
                                    }}
                                  >
                                    Retry
                                  </Button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(liveStreamUrl, "_blank")}
                          >
                            Open in new tab
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              streamRetryRef.current = 0;
                              setStreamAttempt((prev) => prev + 1);
                            }}
                          >
                            Reconnect
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="h-[220px] flex items-center justify-center text-muted-foreground">
                        Run a scenario to start a live session.
                      </div>
                    )}
                  </CardContent>
                </Card>
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
                                      onClick={() => {
                                        const newIndex = currentScreenshotIndex > 0 ? currentScreenshotIndex - 1 : stepsWithScreenshots.length - 1;
                                        setCurrentScreenshotIndex(newIndex);
                                        // Sync selectedStepIndex with the current screenshot step
                                        const currentStep = stepsWithScreenshots[newIndex];
                                        if (currentStep) {
                                          const actualStepIndex = selectedScenarioData.steps.findIndex(s => s.id === currentStep.id);
                                          if (actualStepIndex >= 0) {
                                            setSelectedStepIndex(actualStepIndex);
                                          }
                                        }
                                      }}
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
                                      onClick={() => {
                                        const newIndex = currentScreenshotIndex < stepsWithScreenshots.length - 1 ? currentScreenshotIndex + 1 : 0;
                                        setCurrentScreenshotIndex(newIndex);
                                        // Sync selectedStepIndex with the current screenshot step
                                        const currentStep = stepsWithScreenshots[newIndex];
                                        if (currentStep) {
                                          const actualStepIndex = selectedScenarioData.steps.findIndex(s => s.id === currentStep.id);
                                          if (actualStepIndex >= 0) {
                                            setSelectedStepIndex(actualStepIndex);
                                          }
                                        }
                                      }}
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
                                        {currentStep.beforeScreenshot && imageErrors[currentStep.beforeScreenshot] ? (
                                          <div className="h-48 flex items-center justify-center text-muted-foreground text-xs">
                                            Failed to load image
                                          </div>
                                        ) : (
                                          <img
                                            src={currentStep.beforeScreenshot}
                                            alt="Before screenshot"
                                            className="w-full h-48 object-contain bg-white"
                                            onError={() => recordImageError(currentStep.beforeScreenshot, {
                                              location: "before",
                                              scenarioId: selectedScenarioData.id,
                                              stepId: currentStep.id,
                                              stepNumber: currentStep.stepNumber,
                                            })}
                                            loading="lazy"
                                          />
                                        )}
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-2">After</p>
                                      <div className="border rounded-lg overflow-hidden bg-muted/30 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setExpandedImage(currentStep.afterScreenshot || null)}>
                                        {currentStep.afterScreenshot && imageErrors[currentStep.afterScreenshot] ? (
                                          <div className="h-48 flex items-center justify-center text-muted-foreground text-xs">
                                            Failed to load image
                                          </div>
                                        ) : (
                                          <img
                                            src={currentStep.afterScreenshot}
                                            alt="After screenshot"
                                            className="w-full h-48 object-contain bg-white"
                                            onError={() => recordImageError(currentStep.afterScreenshot, {
                                              location: "after",
                                              scenarioId: selectedScenarioData.id,
                                              stepId: currentStep.id,
                                              stepNumber: currentStep.stepNumber,
                                            })}
                                            loading="lazy"
                                          />
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ) : currentStep.screenshot ? (
                                  <div className="border rounded-lg overflow-hidden bg-muted/30 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setExpandedImage(currentStep.screenshot || null)}>
                                    {currentStep.screenshot && imageErrors[currentStep.screenshot] ? (
                                      <div className="h-96 flex items-center justify-center text-muted-foreground text-xs">
                                        Failed to load image
                                      </div>
                                    ) : (
                                      <img
                                        src={currentStep.screenshot}
                                        alt="Screenshot"
                                        className="w-full h-96 object-contain bg-white"
                                        onError={() => recordImageError(currentStep.screenshot, {
                                          location: "single",
                                          scenarioId: selectedScenarioData.id,
                                          stepId: currentStep.id,
                                          stepNumber: currentStep.stepNumber,
                                        })}
                                        loading="lazy"
                                      />
                                    )}
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
                                      onClick={() => {
                                        setCurrentScreenshotIndex(idx);
                                        // Sync selectedStepIndex with the current screenshot step
                                        const currentStep = stepsWithScreenshots[idx];
                                        if (currentStep) {
                                          const actualStepIndex = selectedScenarioData.steps.findIndex(s => s.id === currentStep.id);
                                          if (actualStepIndex >= 0) {
                                            setSelectedStepIndex(actualStepIndex);
                                          }
                                        }
                                      }}
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
                                  const stepsWithScreenshots = selectedScenarioData.steps.filter(
                                    s => s.status !== "pending" && (s.screenshot || s.beforeScreenshot || s.afterScreenshot)
                                  );
                                  
                                  let stepsToShow: Step[];
                                  if (showAllLogs) {
                                    stepsToShow = selectedScenarioData.steps.filter(s => s.consoleLogs && Array.isArray(s.consoleLogs) && s.consoleLogs.length > 0);
                                  } else {
                                    // Show logs for the step corresponding to the current screenshot
                                    const currentStep = stepsWithScreenshots[currentScreenshotIndex];
                                    if (currentStep) {
                                      const actualStepIndex = selectedScenarioData.steps.findIndex(s => s.id === currentStep.id);
                                      stepsToShow = actualStepIndex >= 0 && selectedScenarioData.steps[actualStepIndex].consoleLogs && Array.isArray(selectedScenarioData.steps[actualStepIndex].consoleLogs) && selectedScenarioData.steps[actualStepIndex].consoleLogs!.length > 0
                                        ? [selectedScenarioData.steps[actualStepIndex]]
                                        : [];
                                    } else {
                                      stepsToShow = [];
                                    }
                                  }

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
                                          logs.map((log: any, i: number) => {
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
                                  const stepsWithScreenshots = selectedScenarioData.steps.filter(
                                    s => s.status !== "pending" && (s.screenshot || s.beforeScreenshot || s.afterScreenshot)
                                  );
                                  
                                  let stepsToShow: Step[];
                                  if (showAllLogs) {
                                    stepsToShow = selectedScenarioData.steps.filter(s => s.networkLogs && Array.isArray(s.networkLogs) && s.networkLogs.length > 0);
                                  } else {
                                    // Show logs for the step corresponding to the current screenshot
                                    const currentStep = stepsWithScreenshots[currentScreenshotIndex];
                                    if (currentStep) {
                                      const actualStepIndex = selectedScenarioData.steps.findIndex(s => s.id === currentStep.id);
                                      stepsToShow = actualStepIndex >= 0 && selectedScenarioData.steps[actualStepIndex].networkLogs && Array.isArray(selectedScenarioData.steps[actualStepIndex].networkLogs) && selectedScenarioData.steps[actualStepIndex].networkLogs!.length > 0
                                        ? [selectedScenarioData.steps[actualStepIndex]]
                                        : [];
                                    } else {
                                      stepsToShow = [];
                                    }
                                  }

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
                                          logs.map((log: any, i: number) => {
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
                    Describe the test scenario. We'll save it and start a live run so you can watch it execute.
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
                    onClick={handleAddScenario}
                    disabled={!newScenario.trim() || isLaunchingLiveRun}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {isLaunchingLiveRun ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Save Scenario
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
                    Update the scenario description or run it immediately.
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
                    Save Scenario
                  </Button>
                  <Button
                    onClick={handleRunEditedScenario}
                    disabled={!editingScenario?.name.trim()}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Run Now
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Delete Scenario Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Scenario</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete "{deletingScenario?.name}"? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDeleteDialogOpen(false);
                      setDeletingScenario(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteScenario}
                  >
                    Delete
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
                <DialogHeader>
                  <DialogTitle className="sr-only">Expanded screenshot</DialogTitle>
                  <DialogDescription className="sr-only">
                    Full-size preview of the selected step screenshot.
                  </DialogDescription>
                </DialogHeader>
                {expandedImage && !expandedImageError && (
                  <img
                    src={expandedImage}
                    alt="Expanded screenshot"
                    className="max-w-full max-h-[90vh] object-contain rounded-lg"
                    onClick={(e) => e.stopPropagation()}
                    onError={() => {
                      setExpandedImageError(true);
                      recordImageError(expandedImage, { location: "expanded" });
                    }}
                  />
                )}
                {expandedImage && expandedImageError && (
                  <div className="h-96 flex items-center justify-center text-muted-foreground">
                    Failed to load image
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </>
        )}
    </div>
  );
};
