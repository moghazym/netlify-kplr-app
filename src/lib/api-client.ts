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
 * Get the authentication token from storage
 * This can be extended to support different token storage mechanisms
 */
const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  // Try to get token from localStorage
  const token = localStorage.getItem('access_token') || 
                localStorage.getItem('auth_token') ||
                sessionStorage.getItem('access_token') ||
                sessionStorage.getItem('auth_token');
  
  return token;
};

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
  
  const token = getAuthToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  
  // Add Bearer token if available
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      detail: `HTTP ${response.status}: ${response.statusText}`,
    }));
    
    throw new Error(errorData.detail || errorData.message || 'API request failed');
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

/**
 * Get a specific test run
 */
export const getTestRun = async (testRunId: number): Promise<any> => {
  return apiGet(`/api/test-runs/${testRunId}`);
};

/**
 * Create a test run
 */
export const createTestRun = async (data: TestRunCreate): Promise<TestRunResponse> => {
  return apiPost<TestRunResponse>('/api/test-runs/', data);
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

export interface RecentRun {
  id: number;
  test_suite_id: number;
  suite_name?: string;
  total_scenarios: number;
  passed_scenarios: number;
  failed_scenarios: number;
  started_at: string;
  status: string;
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

