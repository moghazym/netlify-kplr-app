/**
 * API Client for making authenticated requests
 */

import { 
  shouldUseMockApi, 
  mockGetProjects, 
  mockCreateProject, 
  mockGetProject, 
  mockUpdateProject, 
  mockDeleteProject
} from './mock-api';

// Get the API base URL from environment variable or use a default
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Make an authenticated API request
 */
export const apiRequest = async <T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  // Check if we should use mock API
  if (shouldUseMockApi()) {
    return handleMockRequest<T>(endpoint, options);
  }
  
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (!isFormData && options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  
  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
  
  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = {
        detail: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
    
    // Handle HTTPValidationError format from OpenAPI spec
    if (errorData.detail && Array.isArray(errorData.detail)) {
      // Validation error with multiple field errors
      const errorMessages = errorData.detail.map((err: any) => {
        const field = err.loc?.slice(1).join('.') || 'field';
        return `${field}: ${err.msg}`;
      }).join(', ');
      throw new Error(errorMessages || 'Validation error');
    }
    
    // Handle single detail string or message
    const errorMessage = errorData.detail || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(errorMessage);
  }
  
  // Handle 204 No Content responses
  if (response.status === 204) {
    return undefined as T;
  }
  
  return response.json();
};

/**
 * Handle mock API requests for development
 */
const handleMockRequest = async <T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const method = options.method || 'GET';
  
  // Handle GET /api/projects/
  if (method === 'GET' && endpoint.includes('/api/projects/') && !endpoint.match(/\/api\/projects\/\d+$/)) {
    return mockGetProjects() as Promise<T>;
  }
  
  // Handle GET /api/projects/{id}
  if (method === 'GET' && endpoint.match(/\/api\/projects\/\d+$/)) {
    const match = endpoint.match(/\/api\/projects\/(\d+)$/);
    if (match) {
      const projectId = parseInt(match[1], 10);
      return mockGetProject(projectId) as Promise<T>;
    }
  }
  
  // Handle POST /api/projects/
  if (method === 'POST' && endpoint.includes('/api/projects/') && !endpoint.match(/\/api\/projects\/\d+$/)) {
    const body = options.body ? JSON.parse(options.body as string) : {};
    return mockCreateProject(body) as Promise<T>;
  }
  
  // Handle PUT /api/projects/{id}
  if (method === 'PUT' && endpoint.match(/\/api\/projects\/\d+$/)) {
    const match = endpoint.match(/\/api\/projects\/(\d+)$/);
    if (match) {
      const projectId = parseInt(match[1], 10);
      const body = options.body ? JSON.parse(options.body as string) : {};
      return mockUpdateProject(projectId, body) as Promise<T>;
    }
  }
  
  // Handle DELETE /api/projects/{id}
  if (method === 'DELETE' && endpoint.match(/\/api\/projects\/\d+$/)) {
    const match = endpoint.match(/\/api\/projects\/(\d+)$/);
    if (match) {
      const projectId = parseInt(match[1], 10);
      await mockDeleteProject(projectId);
      return undefined as T;
    }
  }
  
  // Handle GET /api/dashboard/statistics
  if (method === 'GET' && endpoint.includes('/api/dashboard/statistics')) {
    return {
      total_test_runs: 0,
      passed_scenarios: 0,
      failed_scenarios: 0,
      success_rate: 0,
    } as T;
  }
  
  // Handle GET /api/dashboard/recent-runs
  if (method === 'GET' && endpoint.includes('/api/dashboard/recent-runs')) {
    return [] as T;
  }
  
  // Handle GET /api/test-suites/
  if (method === 'GET' && endpoint.includes('/api/test-suites/')) {
    return [] as T;
  }
  
  // Handle GET /api/schedules/
  if (method === 'GET' && endpoint.includes('/api/schedules/')) {
    return [] as T;
  }
  
  // Handle GET /api/test-runs/
  if (method === 'GET' && endpoint.includes('/api/test-runs/')) {
    return [] as T;
  }
  
  // Handle GET /api/scenarios/
  if (method === 'GET' && endpoint.includes('/api/scenarios/')) {
    return [] as T;
  }
  
  // Fallback: return empty array or throw error
  console.warn(`Mock API: Unhandled endpoint ${method} ${endpoint}`);
  return [] as T;
};

/**
 * GET request helper
 */
export const apiGet = <T = any>(endpoint: string): Promise<T> => {
  return apiRequest<T>(endpoint, { method: 'GET' });
};

/**
 * POST request helper
 */
export const apiPost = <T = any>(endpoint: string, data?: any): Promise<T> => {
  return apiRequest<T>(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
};

/**
 * PUT request helper
 */
export const apiPut = <T = any>(endpoint: string, data?: any): Promise<T> => {
  return apiRequest<T>(endpoint, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
};

/**
 * DELETE request helper
 */
export const apiDelete = <T = any>(endpoint: string): Promise<T> => {
  return apiRequest<T>(endpoint, { method: 'DELETE' });
};

/**
 * PATCH request helper
 */
export const apiPatch = <T = any>(endpoint: string, data?: any): Promise<T> => {
  return apiRequest<T>(endpoint, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });
};

// ============================================================================
// Projects API (Projects = Workspaces)
// ============================================================================

export interface ProjectResponse {
  id: number;
  name: string;
  description: string | null;
  user_id: number;
  created_at: string;
  updated_at: string | null;
}

export interface ProjectCreate {
  name: string;
  description?: string | null;
}

export interface ProjectUpdate {
  name?: string | null;
  description?: string | null;
}

/**
 * Get all projects for the current user
 */
export const getProjects = async (): Promise<ProjectResponse[]> => {
  return apiGet<ProjectResponse[]>('/api/projects/');
};

/**
 * Get a specific project
 */
export const getProject = async (projectId: number): Promise<ProjectResponse> => {
  return apiGet<ProjectResponse>(`/api/projects/${projectId}`);
};

/**
 * Create a new project
 */
export const createProject = async (data: ProjectCreate): Promise<ProjectResponse> => {
  return apiPost<ProjectResponse>('/api/projects/', data);
};

/**
 * Update a project
 */
export const updateProject = async (projectId: number, data: ProjectUpdate): Promise<ProjectResponse> => {
  return apiPut<ProjectResponse>(`/api/projects/${projectId}`, data);
};

/**
 * Delete a project
 */
export const deleteProject = async (projectId: number): Promise<void> => {
  return apiDelete(`/api/projects/${projectId}`);
};

// ============================================================================
// Test Suites API
// ============================================================================

export interface TestSuiteResponse {
  id: number;
  name: string;
  description: string | null;
  application_url: string | null;
  ai_testing_instructions: string | null;
  resolution: string | null;
  creation_mode: string;
  preconditions_enabled: boolean;
  preconditions: any;
  has_persistent_context: boolean;
  exploration_enabled: boolean;
  exploration_step_limit: number | null;
  project_id: number;
  created_at: string;
  updated_at: string | null;
  attachments?: any[];
}

export interface TestSuiteCreate {
  name: string;
  description?: string | null;
  application_url?: string | null;
  ai_testing_instructions?: string | null;
  resolution?: string;
  creation_mode?: string;
  preconditions_enabled?: boolean;
  preconditions?: any;
  has_persistent_context?: boolean;
  exploration_enabled?: boolean;
  exploration_step_limit?: number | null;
  project_id: number;
}

export interface TestSuiteUpdate {
  name?: string | null;
  description?: string | null;
  application_url?: string | null;
  ai_testing_instructions?: string | null;
  resolution?: string | null;
  preconditions_enabled?: boolean | null;
  preconditions?: any;
  has_persistent_context?: boolean | null;
  exploration_enabled?: boolean | null;
  exploration_step_limit?: number | null;
}

/**
 * Get all test suites
 */
export const getTestSuites = async (projectId?: number): Promise<TestSuiteResponse[]> => {
  const endpoint = projectId 
    ? `/api/test-suites/?project_id=${projectId}`
    : '/api/test-suites/';
  return apiGet<TestSuiteResponse[]>(endpoint);
};

/**
 * Get a specific test suite
 */
export const getTestSuite = async (testSuiteId: number): Promise<TestSuiteResponse> => {
  return apiGet<TestSuiteResponse>(`/api/test-suites/${testSuiteId}`);
};

/**
 * Create a test suite
 */
export const createTestSuite = async (data: TestSuiteCreate): Promise<TestSuiteResponse> => {
  return apiPost<TestSuiteResponse>('/api/test-suites/', data);
};

/**
 * Update a test suite
 */
export const updateTestSuite = async (testSuiteId: number, data: TestSuiteUpdate): Promise<TestSuiteResponse> => {
  return apiPut<TestSuiteResponse>(`/api/test-suites/${testSuiteId}`, data);
};

/**
 * Delete a test suite
 */
export const deleteTestSuite = async (testSuiteId: number): Promise<void> => {
  return apiDelete(`/api/test-suites/${testSuiteId}`);
};

/**
 * Upload attachments for a test suite
 */
export const uploadTestSuiteAttachments = async (
  testSuiteId: number,
  files: File[]
): Promise<any[]> => {
  if (!files.length) {
    return [];
  }
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  return apiRequest<any[]>(`/api/test-suites/${testSuiteId}/attachments`, {
    method: 'POST',
    body: formData,
  });
};

export interface ScenarioGenerationRequest {
  test_suite_id?: number;
  test_suite_name: string;
  application_url: string;
  test_description: string;
  ai_testing_instructions?: string;
  setup_instructions?: string;
  setup_screenshot_base64?: string;
  setup_final_url?: string;
  exploration_screenshots_base64?: string[];
}

export interface ScenarioGenerationResponse {
  scenarios: string[];
}

/**
 * Generate scenarios using AI
 */
export const generateScenarios = async (
  data: ScenarioGenerationRequest
): Promise<ScenarioGenerationResponse> => {
  return apiPost<ScenarioGenerationResponse>(
    '/api/scenario-generation/generate',
    data
  );
};

export interface ExplorationActionsRequest {
  screenshot_base64: string;
  current_url: string;
  max_actions?: number;
  guidance?: string;
}

export interface ExplorationAction {
  name: string;
  args: Record<string, any>;
  description?: string;
}

export interface ExplorationActionsResponse {
  actions: ExplorationAction[];
}

/**
 * Request exploration actions for a screenshot
 */
export const getExplorationActions = async (
  data: ExplorationActionsRequest
): Promise<ExplorationActionsResponse> => {
  return apiPost<ExplorationActionsResponse>(
    '/api/computer-use/exploration-actions',
    data
  );
};

// ============================================================================
// Test Runs API
// ============================================================================

export interface TestRunResponse {
  id: number;
  test_suite_id: number;
  user_id: number;
  run_type: string;
  status: string;
  total_scenarios: number;
  passed_scenarios: number;
  failed_scenarios: number;
  started_at: string;
  completed_at: string | null;
}

export interface TestRunCreate {
  test_suite_id: number;
  run_type: string;
  total_scenarios?: number;
}

export interface TestRunUpdate {
  status?: string | null;
  passed_scenarios?: number | null;
  failed_scenarios?: number | null;
}

/**
 * Get test runs for a specific test suite
 */
export const getTestRunsForSuite = async (testSuiteId: number, limit?: number): Promise<TestRunResponse[]> => {
  const endpoint = limit 
    ? `/api/test-runs/suite/${testSuiteId}/runs?limit=${limit}`
    : `/api/test-runs/suite/${testSuiteId}/runs`;
  return apiGet<TestRunResponse[]>(endpoint);
};

/**
 * Get latest test run for a test suite
 */
export const getLatestTestRun = async (testSuiteId: number): Promise<TestRunResponse | null> => {
  return apiGet<TestRunResponse | null>(`/api/test-runs/suite/${testSuiteId}/latest`);
};

export interface TestRunWithSessionsResponse extends TestRunResponse {
  sessions: any[]; // Sessions array from the API
}

/**
 * Get a specific test run
 */
export const getTestRun = async (testRunId: number): Promise<TestRunWithSessionsResponse> => {
  return apiGet<TestRunWithSessionsResponse>(`/api/test-runs/${testRunId}`);
};

/**
 * Create a test run
 */
export const createTestRun = async (data: TestRunCreate): Promise<TestRunResponse> => {
  return apiPost<TestRunResponse>('/api/test-runs/', data);
};

export interface CloudRunTriggerRequest {
  project_id: number;
  suite_id: number;
  scenario_id?: number;
  schedule_id?: string;
  options?: { max_steps?: number };
}

export const triggerCloudRun = async (data: CloudRunTriggerRequest): Promise<any> => {
  return apiPost('/api/cloud-run/trigger', data);
};

/**
 * Update a test run
 */
export const updateTestRun = async (testRunId: number, data: TestRunUpdate): Promise<TestRunResponse> => {
  return apiPatch<TestRunResponse>(`/api/test-runs/${testRunId}`, data);
};

/**
 * Delete a test run
 */
export const deleteTestRun = async (testRunId: number): Promise<void> => {
  return apiDelete(`/api/test-runs/${testRunId}`);
};

// ============================================================================
// Scenarios API
// ============================================================================

export interface ScenarioResponse {
  id: number;
  name: string;
  description: string | null;
  test_suite_id: number;
  created_at: string;
  updated_at: string | null;
}

export interface ScenarioCreate {
  name: string;
  description?: string | null;
  test_suite_id: number;
}

export interface ScenarioUpdate {
  name?: string | null;
  description?: string | null;
}

/**
 * Get scenarios for a test suite
 */
export const getScenarios = async (testSuiteId?: number): Promise<ScenarioResponse[]> => {
  const endpoint = testSuiteId 
    ? `/api/scenarios/?test_suite_id=${testSuiteId}`
    : '/api/scenarios/';
  return apiGet<ScenarioResponse[]>(endpoint);
};

/**
 * Get a specific scenario
 */
export const getScenario = async (scenarioId: number): Promise<ScenarioResponse> => {
  return apiGet<ScenarioResponse>(`/api/scenarios/${scenarioId}`);
};

/**
 * Create a scenario
 */
export const createScenario = async (data: ScenarioCreate): Promise<ScenarioResponse> => {
  return apiPost<ScenarioResponse>('/api/scenarios/', data);
};

/**
 * Update a scenario
 */
export const updateScenario = async (scenarioId: number, data: ScenarioUpdate): Promise<ScenarioResponse> => {
  return apiPut<ScenarioResponse>(`/api/scenarios/${scenarioId}`, data);
};

/**
 * Delete a scenario
 */
export const deleteScenario = async (scenarioId: number): Promise<void> => {
  return apiDelete(`/api/scenarios/${scenarioId}`);
};

// ============================================================================
// App Registry API
// ============================================================================

export interface MobileAppBuildResponse {
  id: number;
  app_id: number;
  version: string;
  channel?: string | null;
  notes?: string | null;
  status: string;
  storage_path: string;
  download_url: string;
  file_name?: string | null;
  file_size?: number | null;
  content_type?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MobileAppResponse {
  id: number;
  project_id: number;
  name: string;
  package_id: string;
  platform: string;
  description?: string | null;
  icon_url?: string | null;
  created_at: string;
  updated_at: string;
  builds?: MobileAppBuildResponse[];
}

export interface CreateMobileAppRequest {
  project_id: number;
  name: string;
  package_id: string;
  platform: string;
  description?: string;
  icon_url?: string;
}

export interface BuildUploadRequest {
  file_name: string;
  content_type?: string;
  version: string;
  channel?: string;
  notes?: string;
}

export interface BuildUploadResponse {
  build_id: number;
  signed_url: string;
  storage_path: string;
  download_url: string;
}

export interface CompleteBuildRequest {
  file_size?: number;
  status?: string;
}

export const getMobileApps = async (projectId?: number): Promise<MobileAppResponse[]> => {
  const suffix = projectId ? `?project_id=${projectId}` : '';
  return apiGet<MobileAppResponse[]>(`/api/app-registry/apps${suffix}`);
};

export const createMobileApp = async (data: CreateMobileAppRequest): Promise<MobileAppResponse> => {
  return apiPost<MobileAppResponse>('/api/app-registry/apps', data);
};

export const requestMobileAppBuildUpload = async (
  appId: number,
  data: BuildUploadRequest
): Promise<BuildUploadResponse> => {
  return apiPost<BuildUploadResponse>(`/api/app-registry/apps/${appId}/build-uploads`, data);
};

export const completeMobileAppBuild = async (
  buildId: number,
  data: CompleteBuildRequest
): Promise<MobileAppBuildResponse> => {
  return apiPost<MobileAppBuildResponse>(`/api/app-registry/builds/${buildId}/complete`, data);
};

// ============================================================================
// Agent Session API
// ============================================================================

export interface CreateAgentSessionRequest {
  query: string;
  model_name?: string;
  initial_url: string;
  screen_size: [number, number];
  test_run_id?: number;
  scenario_id?: number;
}

export interface ExecuteAgentStepRequest {
  screenshot_base64: string;
  current_url: string;
  context: Record<string, any>;
}

export interface CompleteAgentStepRequest {
  url: string;
  context: any;
  screenshot_base64?: string;
  console_logs?: any[];
  network_logs?: any[];
}

export const createAgentSession = async (data: CreateAgentSessionRequest): Promise<any> => {
  return apiPost('/api/computer-use/sessions', data);
};

export const executeAgentStep = async (
  sessionUuid: string,
  data: ExecuteAgentStepRequest
): Promise<any> => {
  return apiPost(`/api/computer-use/sessions/${sessionUuid}/steps`, data);
};

export const completeAgentStep = async (
  sessionUuid: string,
  stepId: number,
  data: CompleteAgentStepRequest
): Promise<any> => {
  return apiPost(`/api/computer-use/sessions/${sessionUuid}/steps/${stepId}/complete`, data);
};

export const getAgentSessionStatus = async (sessionUuid: string): Promise<any> => {
  return apiGet(`/api/computer-use/sessions/${sessionUuid}/status`);
};

export const getLatestSessionScreenshot = async (sessionUuid: string): Promise<any> => {
  return apiGet(`/api/computer-use/sessions/${sessionUuid}/latest-screenshot`);
};

// ============================================================================
// Schedules API
// ============================================================================

export interface ScheduleResponse {
  id: number;
  project_id: number;
  test_suite_id: number;
  name: string;
  description: string | null;
  frequency: 'daily' | 'weekly' | 'monthly';
  time_of_day: string;
  timezone: string;
  days_of_week: number[] | null;
  day_of_month: number | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  test_suite?: {
    id: number;
    name: string;
    project_id: number;
  } | null;
}

export interface ScheduleCreate {
  name: string;
  description?: string | null;
  project_id: number;
  test_suite_id: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  time_of_day: string;
  timezone?: string;
  days_of_week?: number[] | null;
  day_of_month?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean;
}

export interface ScheduleUpdate {
  name?: string | null;
  description?: string | null;
  project_id?: number | null;
  test_suite_id?: number | null;
  frequency?: 'daily' | 'weekly' | 'monthly' | null;
  time_of_day?: string | null;
  timezone?: string | null;
  days_of_week?: number[] | null;
  day_of_month?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean | null;
}

/**
 * Get all schedules
 */
export const getSchedules = async (params?: {
  project_id?: number;
  test_suite_id?: number;
  is_active?: boolean;
}): Promise<ScheduleResponse[]> => {
  const queryParams = new URLSearchParams();
  if (params?.project_id) queryParams.append('project_id', params.project_id.toString());
  if (params?.test_suite_id) queryParams.append('test_suite_id', params.test_suite_id.toString());
  if (params?.is_active !== undefined) queryParams.append('is_active', params.is_active.toString());
  
  const endpoint = queryParams.toString() 
    ? `/api/schedules/?${queryParams.toString()}`
    : '/api/schedules/';
  return apiGet<ScheduleResponse[]>(endpoint);
};

/**
 * Get a specific schedule
 */
export const getSchedule = async (scheduleId: number): Promise<ScheduleResponse> => {
  return apiGet<ScheduleResponse>(`/api/schedules/${scheduleId}`);
};

/**
 * Create a schedule
 */
export const createSchedule = async (data: ScheduleCreate): Promise<ScheduleResponse> => {
  return apiPost<ScheduleResponse>('/api/schedules/', data);
};

/**
 * Update a schedule
 */
export const updateSchedule = async (scheduleId: number, data: ScheduleUpdate): Promise<ScheduleResponse> => {
  return apiPut<ScheduleResponse>(`/api/schedules/${scheduleId}`, data);
};

/**
 * Delete a schedule
 */
export const deleteSchedule = async (scheduleId: number, hard?: boolean): Promise<void> => {
  const endpoint = hard 
    ? `/api/schedules/${scheduleId}?hard=true`
    : `/api/schedules/${scheduleId}`;
  return apiDelete(endpoint);
};

// ============================================================================
// Dashboard API
// ============================================================================

export interface DashboardStatistics {
  total_test_runs: number;
  passed_scenarios: number;
  failed_scenarios: number;
  success_rate: number;
}

// RecentRun matches TestRunResponse structure (recent-runs endpoint returns test runs)
export interface RecentRun {
  id: number;
  test_suite_id: number;
  user_id: number;
  run_type: string;
  status: string;
  total_scenarios: number;
  passed_scenarios: number;
  failed_scenarios: number;
  started_at: string;
  completed_at: string | null;
}

/**
 * Get dashboard statistics
 */
export const getDashboardStatistics = async (params?: {
  project_id?: number;
  start_date?: string;
  end_date?: string;
}): Promise<DashboardStatistics> => {
  const queryParams = new URLSearchParams();
  if (params?.project_id) queryParams.append('project_id', params.project_id.toString());
  if (params?.start_date) queryParams.append('start_date', params.start_date);
  if (params?.end_date) queryParams.append('end_date', params.end_date);
  
  const endpoint = queryParams.toString() 
    ? `/api/dashboard/statistics?${queryParams.toString()}`
    : '/api/dashboard/statistics';
  return apiGet<DashboardStatistics>(endpoint);
};

/**
 * Get recent test runs for dashboard
 */
export const getRecentTestRuns = async (params?: {
  project_id?: number;
  limit?: number;
}): Promise<RecentRun[]> => {
  const queryParams = new URLSearchParams();
  if (params?.project_id) queryParams.append('project_id', params.project_id.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  
  const endpoint = queryParams.toString() 
    ? `/api/dashboard/recent-runs?${queryParams.toString()}`
    : '/api/dashboard/recent-runs';
  return apiGet<RecentRun[]>(endpoint);
};

// ============================================================================
// Secrets API
// ============================================================================

export interface SecretResponse {
  id: number;
  name: string;
  value_masked: string;
  description: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface SecretCreate {
  name: string;
  value: string;
  description?: string | null;
}

export interface SecretUpdate {
  name?: string | null;
  value?: string | null;
  description?: string | null;
}

export interface SecretRevealResponse {
  value: string;
}

/**
 * Get all secrets for the current user
 */
export const getSecrets = async (): Promise<SecretResponse[]> => {
  return apiGet<SecretResponse[]>('/api/secrets/');
};

/**
 * Get a specific secret
 */
export const getSecret = async (secretId: number): Promise<SecretResponse> => {
  return apiGet<SecretResponse>(`/api/secrets/${secretId}`);
};

/**
 * Create a new secret
 */
export const createSecret = async (data: SecretCreate): Promise<SecretResponse> => {
  return apiPost<SecretResponse>('/api/secrets/', data);
};

/**
 * Update a secret
 */
export const updateSecret = async (secretId: number, data: SecretUpdate): Promise<SecretResponse> => {
  return apiPatch<SecretResponse>(`/api/secrets/${secretId}`, data);
};

/**
 * Delete a secret
 */
export const deleteSecret = async (secretId: number): Promise<void> => {
  return apiDelete(`/api/secrets/${secretId}`);
};

/**
 * Reveal the actual value of a secret
 */
export const revealSecret = async (secretId: number): Promise<SecretRevealResponse> => {
  return apiGet<SecretRevealResponse>(`/api/secrets/${secretId}/reveal`);
};
