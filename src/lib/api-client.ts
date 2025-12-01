/**
 * API Client for making authenticated requests
 */

import {
  shouldUseMockApi,
  mockGetProjects,
  mockCreateProject,
  mockGetProject,
  mockUpdateProject,
  mockDeleteProject,
  mockGetTestSuites,
  mockGetTestSuite,
  mockCreateTestSuite,
  mockUpdateTestSuite,
  mockDeleteTestSuite,
  mockGetTestRunsForSuite,
  mockGetLatestTestRun,
  mockGetTestRun,
  mockCreateTestRun,
  mockGetScenarios,
  mockGetScenario,
  mockGetSchedules,
  mockGetSchedule,
  mockCreateSchedule,
  mockUpdateSchedule,
  mockDeleteSchedule,
  mockGetSecrets,
  mockGetSecret,
  mockCreateSecret,
  mockUpdateSecret,
  mockDeleteSecret,
  mockRevealSecret,
  mockGetDashboardStatistics,
  mockGetRecentTestRuns,
  mockGetMobileApps,
  mockCreateMobileApp,
  mockRequestMobileAppBuildUpload,
  mockCompleteMobileAppBuild,
  mockDeleteMobileAppBuild,
} from './mock-api';
import { clearUserFromStorage } from './auth-storage';
import { redirectToAuth } from './auth-redirect';

// Get the API base URL from environment variable or use a default
// In development, we use the Vite proxy, so we leave this empty to use relative URLs
// In production, this should be set to https://api.usekplr.com
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

  // Add Authorization header if we have a token
  // For localhost, we rely on tokens stored in localStorage/sessionStorage from checkUrlForAuth()
  // For production, we use cookies (which are automatically sent with credentials: 'include')
  // Skip auth token requirement when using mock API
  if (typeof window !== 'undefined' && !shouldUseMockApi()) {
    const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
      if (import.meta.env.DEV) {
        console.log('[API] Using token from storage for Authorization header');
      }
    } else if (import.meta.env.DEV && !token) {
      console.warn('[API] No token found in storage for request to:', endpoint);
    }
  }

  // In development, use the Vite proxy (relative URL)
  // In production, use the full API URL
  const url = endpoint.startsWith('http')
    ? endpoint
    : API_BASE_URL
    ? `${API_BASE_URL}${endpoint}`
    : endpoint; // Use relative URL for Vite proxy in dev

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // For localhost, try to extract tokens from response headers if available
  // Note: JavaScript can't read Set-Cookie headers, but the proxy might expose them differently
  // We rely on checkUrlForAuth() to extract tokens from URL params and store them

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
    
    // Check for credential validation error and trigger re-authentication
    // This handles both the specific error message and 401 Unauthorized status
    // Skip auth redirect when using mock API
    const isCredentialError = (typeof errorMessage === 'string' && 
        errorMessage.toLowerCase().includes('could not validate credentials')) ||
        response.status === 401;
    
    if (isCredentialError && !shouldUseMockApi()) {
      console.warn('[API] Credential validation failed, triggering re-authentication', {
        status: response.status,
        errorMessage,
      });
      
      // Clear auth state
      clearUserFromStorage();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        sessionStorage.removeItem('access_token');
      }
      
      // Only redirect if we're not already on the callback or auth page
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        if (currentPath !== '/callback' && !currentPath.includes('/auth')) {
          // Store the current path to redirect back after auth
          // Default to dashboard if we're on the root
          const redirectPath = currentPath === '/' ? '/dashboard' : currentPath;
          sessionStorage.setItem('auth_redirect_path', redirectPath);
          
          // Trigger authentication flow
          redirectToAuth(redirectPath);
        }
      }
    }
    
    throw new Error(errorMessage);
  }

  // Handle 204 No Content responses
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
};

/**
 * Handle mock API requests for development and production (when authenticated)
 */
const handleMockRequest = async <T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const method = options.method || 'GET';

  // ============================================================================
  // Auth API
  // ============================================================================

  // Handle GET /api/auth/me
  if (method === 'GET' && endpoint.includes('/api/auth/me')) {
    // Return mock user data
    return {
      id: '1',
      name: 'Dev User',
      email: 'dev@example.com',
      picture: undefined,
    } as T;
  }

  // ============================================================================
  // Projects API
  // ============================================================================

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

  // ============================================================================
  // Test Suites API
  // ============================================================================

  // Handle GET /api/test-suites/
  if (method === 'GET' && endpoint.includes('/api/test-suites/')) {
    let parsedProjectId: number | undefined;
    try {
      const url = new URL(endpoint, 'http://dummy');
      const projectId = url.searchParams.get('project_id');
      parsedProjectId = projectId ? parseInt(projectId, 10) : undefined;
    } catch {
      // If URL parsing fails, try manual parsing
      const match = endpoint.match(/[?&]project_id=(\d+)/);
      if (match) {
        parsedProjectId = parseInt(match[1], 10);
      }
    }
    return mockGetTestSuites(parsedProjectId) as Promise<T>;
  }

  // Handle GET /api/test-suites/{id}
  if (method === 'GET' && endpoint.match(/\/api\/test-suites\/\d+$/)) {
    const match = endpoint.match(/\/api\/test-suites\/(\d+)$/);
    if (match) {
      const testSuiteId = parseInt(match[1], 10);
      return mockGetTestSuite(testSuiteId) as Promise<T>;
    }
  }

  // Handle POST /api/test-suites/
  if (method === 'POST' && endpoint.includes('/api/test-suites/')) {
    const body = options.body ? JSON.parse(options.body as string) : {};
    return mockCreateTestSuite(body) as Promise<T>;
  }

  // Handle PUT /api/test-suites/{id}
  if (method === 'PUT' && endpoint.match(/\/api\/test-suites\/\d+$/)) {
    const match = endpoint.match(/\/api\/test-suites\/(\d+)$/);
    if (match) {
      const testSuiteId = parseInt(match[1], 10);
      const body = options.body ? JSON.parse(options.body as string) : {};
      return mockUpdateTestSuite(testSuiteId, body) as Promise<T>;
    }
  }

  // Handle DELETE /api/test-suites/{id}
  if (method === 'DELETE' && endpoint.match(/\/api\/test-suites\/\d+$/)) {
    const match = endpoint.match(/\/api\/test-suites\/(\d+)$/);
    if (match) {
      const testSuiteId = parseInt(match[1], 10);
      await mockDeleteTestSuite(testSuiteId);
      return undefined as T;
    }
  }

  // ============================================================================
  // Test Runs API
  // ============================================================================

  // Handle GET /api/test-runs/suite/{id}/runs
  if (method === 'GET' && endpoint.match(/\/api\/test-runs\/suite\/\d+\/runs/)) {
    const match = endpoint.match(/\/api\/test-runs\/suite\/(\d+)\/runs/);
    if (match) {
      const testSuiteId = parseInt(match[1], 10);
      return mockGetTestRunsForSuite(testSuiteId) as Promise<T>;
    }
  }

  // Handle GET /api/test-runs/suite/{id}/latest
  if (method === 'GET' && endpoint.match(/\/api\/test-runs\/suite\/\d+\/latest/)) {
    const match = endpoint.match(/\/api\/test-runs\/suite\/(\d+)\/latest/);
    if (match) {
      const testSuiteId = parseInt(match[1], 10);
      return mockGetLatestTestRun(testSuiteId) as Promise<T>;
    }
  }

  // Handle GET /api/test-runs/{id}
  if (method === 'GET' && endpoint.match(/\/api\/test-runs\/\d+$/)) {
    const match = endpoint.match(/\/api\/test-runs\/(\d+)$/);
    if (match) {
      const testRunId = parseInt(match[1], 10);
      return mockGetTestRun(testRunId) as Promise<T>;
    }
  }

  // Handle POST /api/test-runs/
  if (method === 'POST' && endpoint.includes('/api/test-runs/')) {
    const body = options.body ? JSON.parse(options.body as string) : {};
    return mockCreateTestRun(body) as Promise<T>;
  }

  // ============================================================================
  // Scenarios API
  // ============================================================================

  // Handle GET /api/scenarios/
  if (method === 'GET' && endpoint.includes('/api/scenarios/')) {
    let parsedTestSuiteId: number | undefined;
    try {
      const url = new URL(endpoint, 'http://dummy');
      const testSuiteId = url.searchParams.get('test_suite_id');
      parsedTestSuiteId = testSuiteId ? parseInt(testSuiteId, 10) : undefined;
    } catch {
      // If URL parsing fails, try manual parsing
      const match = endpoint.match(/[?&]test_suite_id=(\d+)/);
      if (match) {
        parsedTestSuiteId = parseInt(match[1], 10);
      }
    }
    return mockGetScenarios(parsedTestSuiteId) as Promise<T>;
  }

  // Handle GET /api/scenarios/{id}
  if (method === 'GET' && endpoint.match(/\/api\/scenarios\/\d+$/)) {
    const match = endpoint.match(/\/api\/scenarios\/(\d+)$/);
    if (match) {
      const scenarioId = parseInt(match[1], 10);
      return mockGetScenario(scenarioId) as Promise<T>;
    }
  }

  // ============================================================================
  // Schedules API
  // ============================================================================

  // Handle GET /api/schedules/
  if (method === 'GET' && endpoint.includes('/api/schedules/')) {
    const params: any = {};
    try {
      const url = new URL(endpoint, 'http://dummy');
      if (url.searchParams.get('project_id')) {
        params.project_id = parseInt(url.searchParams.get('project_id')!, 10);
      }
      if (url.searchParams.get('test_suite_id')) {
        params.test_suite_id = parseInt(url.searchParams.get('test_suite_id')!, 10);
      }
      if (url.searchParams.get('is_active') !== null) {
        params.is_active = url.searchParams.get('is_active') === 'true';
      }
    } catch {
      // If URL parsing fails, try manual parsing
      const projectIdMatch = endpoint.match(/[?&]project_id=(\d+)/);
      if (projectIdMatch) {
        params.project_id = parseInt(projectIdMatch[1], 10);
      }
      const testSuiteIdMatch = endpoint.match(/[?&]test_suite_id=(\d+)/);
      if (testSuiteIdMatch) {
        params.test_suite_id = parseInt(testSuiteIdMatch[1], 10);
      }
      const isActiveMatch = endpoint.match(/[?&]is_active=(true|false)/);
      if (isActiveMatch) {
        params.is_active = isActiveMatch[1] === 'true';
      }
    }
    return mockGetSchedules(params) as Promise<T>;
  }

  // Handle GET /api/schedules/{id}
  if (method === 'GET' && endpoint.match(/\/api\/schedules\/\d+$/)) {
    const match = endpoint.match(/\/api\/schedules\/(\d+)$/);
    if (match) {
      const scheduleId = parseInt(match[1], 10);
      return mockGetSchedule(scheduleId) as Promise<T>;
    }
  }

  // Handle POST /api/schedules/
  if (method === 'POST' && endpoint.includes('/api/schedules/')) {
    const body = options.body ? JSON.parse(options.body as string) : {};
    return mockCreateSchedule(body) as Promise<T>;
  }

  // Handle PUT /api/schedules/{id}
  if (method === 'PUT' && endpoint.match(/\/api\/schedules\/\d+$/)) {
    const match = endpoint.match(/\/api\/schedules\/(\d+)$/);
    if (match) {
      const scheduleId = parseInt(match[1], 10);
      const body = options.body ? JSON.parse(options.body as string) : {};
      return mockUpdateSchedule(scheduleId, body) as Promise<T>;
    }
  }

  // Handle DELETE /api/schedules/{id}
  if (method === 'DELETE' && endpoint.match(/\/api\/schedules\/\d+$/)) {
    const match = endpoint.match(/\/api\/schedules\/(\d+)$/);
    if (match) {
      const scheduleId = parseInt(match[1], 10);
      await mockDeleteSchedule(scheduleId);
      return undefined as T;
    }
  }

  // ============================================================================
  // Secrets API
  // ============================================================================

  // Handle GET /api/secrets/
  if (method === 'GET' && endpoint.includes('/api/secrets/') && !endpoint.includes('/reveal')) {
    return mockGetSecrets() as Promise<T>;
  }

  // Handle GET /api/secrets/{id}
  if (method === 'GET' && endpoint.match(/\/api\/secrets\/\d+$/) && !endpoint.includes('/reveal')) {
    const match = endpoint.match(/\/api\/secrets\/(\d+)$/);
    if (match) {
      const secretId = parseInt(match[1], 10);
      return mockGetSecret(secretId) as Promise<T>;
    }
  }

  // Handle GET /api/secrets/{id}/reveal
  if (method === 'GET' && endpoint.match(/\/api\/secrets\/\d+\/reveal/)) {
    const match = endpoint.match(/\/api\/secrets\/(\d+)\/reveal/);
    if (match) {
      const secretId = parseInt(match[1], 10);
      return mockRevealSecret(secretId) as Promise<T>;
    }
  }

  // Handle POST /api/secrets/
  if (method === 'POST' && endpoint.includes('/api/secrets/')) {
    const body = options.body ? JSON.parse(options.body as string) : {};
    return mockCreateSecret(body) as Promise<T>;
  }

  // Handle PATCH /api/secrets/{id}
  if (method === 'PATCH' && endpoint.match(/\/api\/secrets\/\d+$/)) {
    const match = endpoint.match(/\/api\/secrets\/(\d+)$/);
    if (match) {
      const secretId = parseInt(match[1], 10);
      const body = options.body ? JSON.parse(options.body as string) : {};
      return mockUpdateSecret(secretId, body) as Promise<T>;
    }
  }

  // Handle DELETE /api/secrets/{id}
  if (method === 'DELETE' && endpoint.match(/\/api\/secrets\/\d+$/)) {
    const match = endpoint.match(/\/api\/secrets\/(\d+)$/);
    if (match) {
      const secretId = parseInt(match[1], 10);
      await mockDeleteSecret(secretId);
      return undefined as T;
    }
  }

  // ============================================================================
  // Dashboard API
  // ============================================================================

  // Handle GET /api/dashboard/statistics
  if (method === 'GET' && endpoint.includes('/api/dashboard/statistics')) {
    const params: any = {};
    try {
      const url = new URL(endpoint, 'http://dummy');
      if (url.searchParams.get('project_id')) {
        params.project_id = parseInt(url.searchParams.get('project_id')!, 10);
      }
      if (url.searchParams.get('start_date')) {
        params.start_date = url.searchParams.get('start_date');
      }
      if (url.searchParams.get('end_date')) {
        params.end_date = url.searchParams.get('end_date');
      }
    } catch {
      // If URL parsing fails, try manual parsing
      const projectIdMatch = endpoint.match(/[?&]project_id=(\d+)/);
      if (projectIdMatch) {
        params.project_id = parseInt(projectIdMatch[1], 10);
      }
      const startDateMatch = endpoint.match(/[?&]start_date=([^&]+)/);
      if (startDateMatch) {
        params.start_date = startDateMatch[1];
      }
      const endDateMatch = endpoint.match(/[?&]end_date=([^&]+)/);
      if (endDateMatch) {
        params.end_date = endDateMatch[1];
      }
    }
    return mockGetDashboardStatistics(params) as Promise<T>;
  }

  // Handle GET /api/dashboard/recent-runs
  if (method === 'GET' && endpoint.includes('/api/dashboard/recent-runs')) {
    const params: any = {};
    try {
      const url = new URL(endpoint, 'http://dummy');
      if (url.searchParams.get('project_id')) {
        params.project_id = parseInt(url.searchParams.get('project_id')!, 10);
      }
      if (url.searchParams.get('limit')) {
        params.limit = parseInt(url.searchParams.get('limit')!, 10);
      }
    } catch {
      // If URL parsing fails, try manual parsing
      const projectIdMatch = endpoint.match(/[?&]project_id=(\d+)/);
      if (projectIdMatch) {
        params.project_id = parseInt(projectIdMatch[1], 10);
      }
      const limitMatch = endpoint.match(/[?&]limit=(\d+)/);
      if (limitMatch) {
        params.limit = parseInt(limitMatch[1], 10);
      }
    }
    return mockGetRecentTestRuns(params) as Promise<T>;
  }

  // ============================================================================
  // App Registry API
  // ============================================================================

  // Handle GET /api/app-registry/apps
  if (method === 'GET' && endpoint.includes('/api/app-registry/apps') && !endpoint.includes('/build-uploads')) {
    let parsedProjectId: number | undefined;
    try {
      const url = new URL(endpoint, 'http://dummy');
      const projectId = url.searchParams.get('project_id');
      parsedProjectId = projectId ? parseInt(projectId, 10) : undefined;
    } catch {
      const match = endpoint.match(/[?&]project_id=(\d+)/);
      if (match) {
        parsedProjectId = parseInt(match[1], 10);
      }
    }
    return mockGetMobileApps(parsedProjectId) as Promise<T>;
  }

  // Handle POST /api/app-registry/apps
  if (method === 'POST' && endpoint.includes('/api/app-registry/apps') && !endpoint.includes('/build-uploads')) {
    const body = options.body ? JSON.parse(options.body as string) : {};
    return mockCreateMobileApp(body) as Promise<T>;
  }

  // Handle POST /api/app-registry/apps/{id}/build-uploads
  if (method === 'POST' && endpoint.match(/\/api\/app-registry\/apps\/\d+\/build-uploads/)) {
    const match = endpoint.match(/\/api\/app-registry\/apps\/(\d+)\/build-uploads/);
    if (match) {
      const appId = parseInt(match[1], 10);
      const body = options.body ? JSON.parse(options.body as string) : {};
      return mockRequestMobileAppBuildUpload(appId, body) as Promise<T>;
    }
  }

  // Handle POST /api/app-registry/builds/{id}/complete
  if (method === 'POST' && endpoint.match(/\/api\/app-registry\/builds\/\d+\/complete/)) {
    const match = endpoint.match(/\/api\/app-registry\/builds\/(\d+)\/complete/);
    if (match) {
      const buildId = parseInt(match[1], 10);
      const body = options.body ? JSON.parse(options.body as string) : {};
      return mockCompleteMobileAppBuild(buildId, body) as Promise<T>;
    }
  }

  // Handle DELETE /api/app-registry/builds/{id}
  if (method === 'DELETE' && endpoint.match(/\/api\/app-registry\/builds\/\d+$/)) {
    const match = endpoint.match(/\/api\/app-registry\/builds\/(\d+)$/);
    if (match) {
      const buildId = parseInt(match[1], 10);
      await mockDeleteMobileAppBuild(buildId);
      return undefined as T;
    }
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
// Authentication API
// ============================================================================

export interface GoogleCallbackResponse {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  user?: {
    id: string;
    email: string;
    name?: string;
    picture?: string;
  };
}

/**
 * Exchange Google OAuth code for tokens
 * This is called when the auth service redirects with just a code
 * The endpoint expects a callback data object with the code
 */
export const exchangeGoogleCode = async (code: string): Promise<GoogleCallbackResponse> => {
  // The endpoint accepts additionalProperties, so we can send the code directly
  // Based on the OpenAPI spec, it accepts a flexible object
  return apiPost<GoogleCallbackResponse>('/api/auth/google/callback', {
    code,
    // Include redirect_uri if needed (some OAuth flows require it)
    redirect_uri: `${window.location.origin}/callback`,
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
export const getTestRunsForSuite = async (testSuiteId: number, limit?: number, offset?: number): Promise<TestRunResponse[]> => {
  const queryParams = new URLSearchParams();
  if (limit !== undefined) {
    queryParams.append('limit', limit.toString());
  }
  if (offset !== undefined) {
    queryParams.append('offset', offset.toString());
  }
  const queryString = queryParams.toString();
  const endpoint = queryString
    ? `/api/test-runs/suite/${testSuiteId}/runs?${queryString}`
    : `/api/test-runs/suite/${testSuiteId}/runs`;
  return apiGet<TestRunResponse[]>(endpoint);
};

/**
 * Get latest test run for a test suite
 */
export const getLatestTestRun = async (testSuiteId: number): Promise<TestRunResponse | null> => {
  return apiGet<TestRunResponse | null>(`/api/test-runs/suite/${testSuiteId}/latest`);
};

export interface TestRunStep {
  id: number;
  step_number?: number;
  action?: string;
  action_summary?: string;
  reasoning?: string;
  status?: string;
  screenshot?: string;
  before_screenshot?: string;
  after_screenshot?: string;
  before_screenshot_url?: string;
  after_screenshot_url?: string;
  console_logs?: any[];
  network_logs?: any[];
  created_at?: string;
}

export interface TestRunScenario {
  id: number;
  name: string;
  status?: string;
  steps?: TestRunStep[];
}

export interface TestRunSession {
  id?: string;
  scenario_id?: number;
  scenario?: TestRunScenario;
  steps?: TestRunStep[];
  console_logs?: string[];
  network_logs?: string[];
  screenshots?: string[];
}

export interface TestRunWithSessionsResponse extends TestRunResponse {
  sessions: TestRunSession[];
  scenarios?: TestRunScenario[];
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
  platform?: string;
  options?: { max_steps?: number };
}

export interface CloudRunTriggerResponse {
  status: string;
  schedule_id: string;
  message_id: string;
  test_run_id: number;
}

export const triggerCloudRun = async (data: CloudRunTriggerRequest): Promise<CloudRunTriggerResponse> => {
  return apiPost<CloudRunTriggerResponse>('/api/cloud-run/trigger', data);
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

/**
 * Delete a mobile app build
 */
export const deleteMobileAppBuild = async (buildId: number): Promise<void> => {
  return apiDelete(`/api/app-registry/builds/${buildId}`);
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
