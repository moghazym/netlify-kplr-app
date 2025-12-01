/**
 * Mock API responses for development/testing
 * These match the actual API schema from the backend
 */

export interface ProjectResponse {
  id: number;
  name: string;
  description: string | null;
  user_id: number;
  created_at: string; // ISO date-time string
  updated_at: string | null; // ISO date-time string or null
}

// Mock projects data matching ProjectResponse schema
const mockProjects: ProjectResponse[] = [
  {
    id: 1,
    name: "Default Workspace",
    description: "My default workspace for testing",
    user_id: 1,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
  },
  {
    id: 2,
    name: "Production Workspace",
    description: "Production environment workspace",
    user_id: 1,
    created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), // 20 days ago
    updated_at: null,
  },
  {
    id: 3,
    name: "Development Workspace",
    description: null,
    user_id: 1,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
  },
];

/**
 * Check if we should use mock API
 * Set to false to always use production APIs
 */
export const shouldUseMockApi = (): boolean => {
  // Always use production APIs - set to false
  return false;
};

/**
 * Mock GET /api/projects/
 * Returns all projects for the current user
 */
export const mockGetProjects = async (): Promise<ProjectResponse[]> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));

  // Return a copy of mock projects
  return [...mockProjects];
};

/**
 * Mock POST /api/projects/
 * Creates a new project
 */
export const mockCreateProject = async (data: { name: string; description?: string | null }): Promise<ProjectResponse> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 400));

  const newProject: ProjectResponse = {
    id: Math.max(...mockProjects.map(p => p.id)) + 1,
    name: data.name,
    description: data.description || null,
    user_id: 1, // Mock user ID
    created_at: new Date().toISOString(),
    updated_at: null,
  };

  // Add to mock data
  mockProjects.push(newProject);

  return newProject;
};

/**
 * Mock GET /api/projects/{project_id}
 * Returns a specific project by ID
 */
export const mockGetProject = async (projectId: number): Promise<ProjectResponse> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 200));

  const project = mockProjects.find(p => p.id === projectId);

  if (!project) {
    throw new Error(`Project with id ${projectId} not found`);
  }

  return { ...project };
};

/**
 * Mock PUT /api/projects/{project_id}
 * Updates a project
 */
export const mockUpdateProject = async (
  projectId: number,
  data: { name?: string; description?: string | null }
): Promise<ProjectResponse> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));

  const projectIndex = mockProjects.findIndex(p => p.id === projectId);

  if (projectIndex === -1) {
    throw new Error(`Project with id ${projectId} not found`);
  }

  // Update project
  const updatedProject: ProjectResponse = {
    ...mockProjects[projectIndex],
    ...data,
    updated_at: new Date().toISOString(),
  };

  mockProjects[projectIndex] = updatedProject;

  return { ...updatedProject };
};

/**
 * Mock DELETE /api/projects/{project_id}
 * Deletes a project
 */
export const mockDeleteProject = async (projectId: number): Promise<void> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 250));

  const projectIndex = mockProjects.findIndex(p => p.id === projectId);

  if (projectIndex === -1) {
    throw new Error(`Project with id ${projectId} not found`);
  }

  // Remove project
  mockProjects.splice(projectIndex, 1);
};

// ============================================================================
// Test Suites Mock Data
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

const mockTestSuites: TestSuiteResponse[] = [
  {
    id: 1,
    name: "E-commerce Checkout Flow",
    description: "Tests the complete checkout process from cart to payment",
    application_url: "https://demo-store.example.com",
    ai_testing_instructions: "Test the checkout flow with various payment methods",
    resolution: "1920x1080",
    creation_mode: "ai",
    preconditions_enabled: true,
    preconditions: { login_required: true },
    has_persistent_context: true,
    exploration_enabled: false,
    exploration_step_limit: null,
    project_id: 1,
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 2,
    name: "User Authentication",
    description: "Tests login, logout, and password reset flows",
    application_url: "https://app.example.com",
    ai_testing_instructions: "Verify all authentication scenarios work correctly",
    resolution: "1920x1080",
    creation_mode: "ai",
    preconditions_enabled: false,
    preconditions: null,
    has_persistent_context: false,
    exploration_enabled: true,
    exploration_step_limit: 10,
    project_id: 1,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: null,
  },
  {
    id: 3,
    name: "Product Search & Filter",
    description: "Tests search functionality and filtering options",
    application_url: "https://demo-store.example.com",
    ai_testing_instructions: "Test search with various queries and filter combinations",
    resolution: "1920x1080",
    creation_mode: "manual",
    preconditions_enabled: false,
    preconditions: null,
    has_persistent_context: false,
    exploration_enabled: false,
    exploration_step_limit: null,
    project_id: 1,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const mockGetTestSuites = async (projectId?: number): Promise<TestSuiteResponse[]> => {
  await new Promise(resolve => setTimeout(resolve, 300));

  if (projectId) {
    return mockTestSuites.filter(suite => suite.project_id === projectId);
  }
  return [...mockTestSuites];
};

export const mockGetTestSuite = async (testSuiteId: number): Promise<TestSuiteResponse> => {
  await new Promise(resolve => setTimeout(resolve, 200));

  const suite = mockTestSuites.find(s => s.id === testSuiteId);
  if (!suite) {
    throw new Error(`Test suite with id ${testSuiteId} not found`);
  }
  return { ...suite };
};

export const mockCreateTestSuite = async (data: any): Promise<TestSuiteResponse> => {
  await new Promise(resolve => setTimeout(resolve, 400));

  const newSuite: TestSuiteResponse = {
    id: Math.max(...mockTestSuites.map(s => s.id), 0) + 1,
    name: data.name,
    description: data.description || null,
    application_url: data.application_url || null,
    ai_testing_instructions: data.ai_testing_instructions || null,
    resolution: data.resolution || "1920x1080",
    creation_mode: data.creation_mode || "ai",
    preconditions_enabled: data.preconditions_enabled || false,
    preconditions: data.preconditions || null,
    has_persistent_context: data.has_persistent_context || false,
    exploration_enabled: data.exploration_enabled || false,
    exploration_step_limit: data.exploration_step_limit || null,
    project_id: data.project_id,
    created_at: new Date().toISOString(),
    updated_at: null,
  };

  mockTestSuites.push(newSuite);
  return newSuite;
};

export const mockUpdateTestSuite = async (testSuiteId: number, data: any): Promise<TestSuiteResponse> => {
  await new Promise(resolve => setTimeout(resolve, 300));

  const suiteIndex = mockTestSuites.findIndex(s => s.id === testSuiteId);
  if (suiteIndex === -1) {
    throw new Error(`Test suite with id ${testSuiteId} not found`);
  }

  const updatedSuite: TestSuiteResponse = {
    ...mockTestSuites[suiteIndex],
    ...data,
    updated_at: new Date().toISOString(),
  };

  mockTestSuites[suiteIndex] = updatedSuite;
  return { ...updatedSuite };
};

export const mockDeleteTestSuite = async (testSuiteId: number): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 250));

  const suiteIndex = mockTestSuites.findIndex(s => s.id === testSuiteId);
  if (suiteIndex === -1) {
    throw new Error(`Test suite with id ${testSuiteId} not found`);
  }

  mockTestSuites.splice(suiteIndex, 1);
};

// ============================================================================
// Test Runs Mock Data
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

const mockTestRuns: TestRunResponse[] = [
  {
    id: 1,
    test_suite_id: 1,
    user_id: 1,
    run_type: "scheduled",
    status: "completed",
    total_scenarios: 5,
    passed_scenarios: 4,
    failed_scenarios: 1,
    started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    completed_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 2,
    test_suite_id: 1,
    user_id: 1,
    run_type: "manual",
    status: "completed",
    total_scenarios: 5,
    passed_scenarios: 5,
    failed_scenarios: 0,
    started_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    completed_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 3,
    test_suite_id: 2,
    user_id: 1,
    run_type: "manual",
    status: "completed",
    total_scenarios: 3,
    passed_scenarios: 3,
    failed_scenarios: 0,
    started_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    completed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
  },
  {
    id: 4,
    test_suite_id: 2,
    user_id: 1,
    run_type: "scheduled",
    status: "running",
    total_scenarios: 3,
    passed_scenarios: 1,
    failed_scenarios: 0,
    started_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    completed_at: null,
  },
  {
    id: 5,
    test_suite_id: 3,
    user_id: 1,
    run_type: "manual",
    status: "completed",
    total_scenarios: 4,
    passed_scenarios: 2,
    failed_scenarios: 2,
    started_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    completed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString(),
  },
];

export const mockGetTestRunsForSuite = async (testSuiteId: number): Promise<TestRunResponse[]> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockTestRuns.filter(run => run.test_suite_id === testSuiteId);
};

export const mockGetLatestTestRun = async (testSuiteId: number): Promise<TestRunResponse | null> => {
  await new Promise(resolve => setTimeout(resolve, 200));
  const runs = mockTestRuns
    .filter(run => run.test_suite_id === testSuiteId)
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  return runs[0] || null;
};

export const mockGetTestRun = async (testRunId: number): Promise<any> => {
  await new Promise(resolve => setTimeout(resolve, 200));
  const run = mockTestRuns.find(r => r.id === testRunId);
  if (!run) {
    throw new Error(`Test run with id ${testRunId} not found`);
  }
  return {
    ...run,
    sessions: [], // Mock sessions array
  };
};

export const mockCreateTestRun = async (data: any): Promise<TestRunResponse> => {
  await new Promise(resolve => setTimeout(resolve, 400));

  const newRun: TestRunResponse = {
    id: Math.max(...mockTestRuns.map(r => r.id), 0) + 1,
    test_suite_id: data.test_suite_id,
    user_id: 1,
    run_type: data.run_type || "manual",
    status: "running",
    total_scenarios: data.total_scenarios || 0,
    passed_scenarios: 0,
    failed_scenarios: 0,
    started_at: new Date().toISOString(),
    completed_at: null,
  };

  mockTestRuns.push(newRun);
  return newRun;
};

// ============================================================================
// Scenarios Mock Data
// ============================================================================

export interface ScenarioResponse {
  id: number;
  name: string;
  description: string | null;
  test_suite_id: number;
  created_at: string;
  updated_at: string | null;
}

const mockScenarios: ScenarioResponse[] = [
  {
    id: 1,
    name: "Navigate to checkout page and complete purchase",
    description: "Test the full checkout flow",
    test_suite_id: 1,
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: null,
  },
  {
    id: 2,
    name: "Add items to cart and verify total",
    description: "Test cart functionality",
    test_suite_id: 1,
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: null,
  },
  {
    id: 3,
    name: "Login with valid credentials",
    description: "Test successful login",
    test_suite_id: 2,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: null,
  },
  {
    id: 4,
    name: "Search for products and apply filters",
    description: "Test search and filter functionality",
    test_suite_id: 3,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: null,
  },
];

export const mockGetScenarios = async (testSuiteId?: number): Promise<ScenarioResponse[]> => {
  await new Promise(resolve => setTimeout(resolve, 300));

  if (testSuiteId) {
    return mockScenarios.filter(s => s.test_suite_id === testSuiteId);
  }
  return [...mockScenarios];
};

export const mockGetScenario = async (scenarioId: number): Promise<ScenarioResponse> => {
  await new Promise(resolve => setTimeout(resolve, 200));

  const scenario = mockScenarios.find(s => s.id === scenarioId);
  if (!scenario) {
    throw new Error(`Scenario with id ${scenarioId} not found`);
  }
  return { ...scenario };
};

// ============================================================================
// Schedules Mock Data
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

const mockSchedules: ScheduleResponse[] = [
  {
    id: 1,
    project_id: 1,
    test_suite_id: 1,
    name: "Daily Checkout Tests",
    description: "Run checkout tests every day",
    frequency: "daily",
    time_of_day: "09:00:00",
    timezone: "America/New_York",
    days_of_week: null,
    day_of_month: null,
    start_date: null,
    end_date: null,
    is_active: true,
    last_run_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    next_run_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: null,
    test_suite: {
      id: 1,
      name: "E-commerce Checkout Flow",
      project_id: 1,
    },
  },
  {
    id: 2,
    project_id: 1,
    test_suite_id: 2,
    name: "Weekly Auth Tests",
    description: "Run authentication tests weekly",
    frequency: "weekly",
    time_of_day: "10:00:00",
    timezone: "America/New_York",
    days_of_week: [1, 3, 5], // Monday, Wednesday, Friday
    day_of_month: null,
    start_date: null,
    end_date: null,
    is_active: true,
    last_run_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    next_run_at: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: null,
    test_suite: {
      id: 2,
      name: "User Authentication",
      project_id: 1,
    },
  },
];

export const mockGetSchedules = async (params?: any): Promise<ScheduleResponse[]> => {
  await new Promise(resolve => setTimeout(resolve, 300));

  let filtered = [...mockSchedules];

  if (params?.project_id) {
    filtered = filtered.filter(s => s.project_id === params.project_id);
  }
  if (params?.test_suite_id) {
    filtered = filtered.filter(s => s.test_suite_id === params.test_suite_id);
  }
  if (params?.is_active !== undefined) {
    filtered = filtered.filter(s => s.is_active === params.is_active);
  }

  return filtered;
};

export const mockGetSchedule = async (scheduleId: number): Promise<ScheduleResponse> => {
  await new Promise(resolve => setTimeout(resolve, 200));

  const schedule = mockSchedules.find(s => s.id === scheduleId);
  if (!schedule) {
    throw new Error(`Schedule with id ${scheduleId} not found`);
  }
  return { ...schedule };
};

export const mockCreateSchedule = async (data: any): Promise<ScheduleResponse> => {
  await new Promise(resolve => setTimeout(resolve, 400));

  const newSchedule: ScheduleResponse = {
    id: Math.max(...mockSchedules.map(s => s.id), 0) + 1,
    project_id: data.project_id,
    test_suite_id: data.test_suite_id,
    name: data.name,
    description: data.description || null,
    frequency: data.frequency,
    time_of_day: data.time_of_day,
    timezone: data.timezone || "UTC",
    days_of_week: data.days_of_week || null,
    day_of_month: data.day_of_month || null,
    start_date: data.start_date || null,
    end_date: data.end_date || null,
    is_active: data.is_active !== undefined ? data.is_active : true,
    last_run_at: null,
    next_run_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: null,
    test_suite: mockTestSuites.find(s => s.id === data.test_suite_id) ? {
      id: data.test_suite_id,
      name: mockTestSuites.find(s => s.id === data.test_suite_id)!.name,
      project_id: data.project_id,
    } : null,
  };

  mockSchedules.push(newSchedule);
  return newSchedule;
};

export const mockUpdateSchedule = async (scheduleId: number, data: any): Promise<ScheduleResponse> => {
  await new Promise(resolve => setTimeout(resolve, 300));

  const scheduleIndex = mockSchedules.findIndex(s => s.id === scheduleId);
  if (scheduleIndex === -1) {
    throw new Error(`Schedule with id ${scheduleId} not found`);
  }

  const updatedSchedule: ScheduleResponse = {
    ...mockSchedules[scheduleIndex],
    ...data,
    updated_at: new Date().toISOString(),
  };

  mockSchedules[scheduleIndex] = updatedSchedule;
  return { ...updatedSchedule };
};

export const mockDeleteSchedule = async (scheduleId: number): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 250));

  const scheduleIndex = mockSchedules.findIndex(s => s.id === scheduleId);
  if (scheduleIndex === -1) {
    throw new Error(`Schedule with id ${scheduleId} not found`);
  }

  mockSchedules.splice(scheduleIndex, 1);
};

// ============================================================================
// Secrets Mock Data
// ============================================================================

export interface SecretResponse {
  id: number;
  name: string;
  value_masked: string;
  description: string | null;
  created_at: string;
  updated_at: string | null;
}

const mockSecrets: SecretResponse[] = [
  {
    id: 1,
    name: "api_key",
    value_masked: "sk-*****1234",
    description: "API key for external service",
    created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: null,
  },
  {
    id: 2,
    name: "test_username",
    value_masked: "*****",
    description: "Test account username",
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: null,
  },
  {
    id: 3,
    name: "test_password",
    value_masked: "*****",
    description: "Test account password",
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: null,
  },
];

export const mockGetSecrets = async (): Promise<SecretResponse[]> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return [...mockSecrets];
};

export const mockGetSecret = async (secretId: number): Promise<SecretResponse> => {
  await new Promise(resolve => setTimeout(resolve, 200));

  const secret = mockSecrets.find(s => s.id === secretId);
  if (!secret) {
    throw new Error(`Secret with id ${secretId} not found`);
  }
  return { ...secret };
};

export const mockCreateSecret = async (data: any): Promise<SecretResponse> => {
  await new Promise(resolve => setTimeout(resolve, 400));

  const maskedValue = data.value.length > 4
    ? `${data.value.substring(0, 2)}*****${data.value.substring(data.value.length - 2)}`
    : "*****";

  const newSecret: SecretResponse = {
    id: Math.max(...mockSecrets.map(s => s.id), 0) + 1,
    name: data.name,
    value_masked: maskedValue,
    description: data.description || null,
    created_at: new Date().toISOString(),
    updated_at: null,
  };

  mockSecrets.push(newSecret);
  return newSecret;
};

export const mockUpdateSecret = async (secretId: number, data: any): Promise<SecretResponse> => {
  await new Promise(resolve => setTimeout(resolve, 300));

  const secretIndex = mockSecrets.findIndex(s => s.id === secretId);
  if (secretIndex === -1) {
    throw new Error(`Secret with id ${secretId} not found`);
  }

  const updatedSecret: SecretResponse = {
    ...mockSecrets[secretIndex],
    ...data,
    updated_at: new Date().toISOString(),
  };

  if (data.value) {
    updatedSecret.value_masked = data.value.length > 4
      ? `${data.value.substring(0, 2)}*****${data.value.substring(data.value.length - 2)}`
      : "*****";
  }

  mockSecrets[secretIndex] = updatedSecret;
  return { ...updatedSecret };
};

export const mockDeleteSecret = async (secretId: number): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 250));

  const secretIndex = mockSecrets.findIndex(s => s.id === secretId);
  if (secretIndex === -1) {
    throw new Error(`Secret with id ${secretId} not found`);
  }

  mockSecrets.splice(secretIndex, 1);
};

export const mockRevealSecret = async (secretId: number): Promise<{ value: string }> => {
  await new Promise(resolve => setTimeout(resolve, 200));

  const secret = mockSecrets.find(s => s.id === secretId);
  if (!secret) {
    throw new Error(`Secret with id ${secretId} not found`);
  }

  // Return mock revealed value
  const revealedValues: Record<number, string> = {
    1: "sk-live-abc123xyz789",
    2: "testuser@example.com",
    3: "SecurePassword123!",
  };

  return { value: revealedValues[secretId] || "mock-value" };
};

// ============================================================================
// Dashboard Mock Data
// ============================================================================

export interface DashboardStatistics {
  total_test_runs: number;
  passed_scenarios: number;
  failed_scenarios: number;
  success_rate: number;
}

export const mockGetDashboardStatistics = async (params?: any): Promise<DashboardStatistics> => {
  await new Promise(resolve => setTimeout(resolve, 300));

  // Calculate from mock test runs
  const allRuns = mockTestRuns.filter(run => {
    if (params?.project_id) {
      const suite = mockTestSuites.find(s => s.id === run.test_suite_id);
      return suite?.project_id === params.project_id;
    }
    return true;
  });

  const totalRuns = allRuns.length;
  const passedScenarios = allRuns.reduce((sum, run) => sum + run.passed_scenarios, 0);
  const failedScenarios = allRuns.reduce((sum, run) => sum + run.failed_scenarios, 0);
  const totalScenarios = passedScenarios + failedScenarios;
  const successRate = totalScenarios > 0 ? (passedScenarios / totalScenarios) * 100 : 0;

  return {
    total_test_runs: totalRuns,
    passed_scenarios: passedScenarios,
    failed_scenarios: failedScenarios,
    success_rate: Math.round(successRate * 10) / 10,
  };
};

export const mockGetRecentTestRuns = async (params?: any): Promise<TestRunResponse[]> => {
  await new Promise(resolve => setTimeout(resolve, 300));

  let runs = [...mockTestRuns];

  if (params?.project_id) {
    const suiteIds = mockTestSuites
      .filter(s => s.project_id === params.project_id)
      .map(s => s.id);
    runs = runs.filter(r => suiteIds.includes(r.test_suite_id));
  }

  // Sort by started_at descending
  runs.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

  // Apply limit
  const limit = params?.limit || 10;
  return runs.slice(0, limit);
};

// ============================================================================
// App Registry API Mocks
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

const mockMobileApps: MobileAppResponse[] = [
  {
    id: 1,
    project_id: 1,
    name: "My iOS App",
    package_id: "com.example.iosapp",
    platform: "ios",
    description: "Main iOS application",
    icon_url: null,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    builds: [
      {
        id: 1,
        app_id: 1,
        version: "1.2.0",
        channel: "production",
        notes: "Latest stable release",
        status: "completed",
        storage_path: "builds/ios/1.2.0.ipa",
        download_url: "https://example.com/builds/ios/1.2.0.ipa",
        file_name: "MyApp-1.2.0.ipa",
        file_size: 45 * 1024 * 1024, // 45 MB
        content_type: "application/octet-stream",
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 2,
        app_id: 1,
        version: "1.1.0",
        channel: "production",
        notes: null,
        status: "completed",
        storage_path: "builds/ios/1.1.0.ipa",
        download_url: "https://example.com/builds/ios/1.1.0.ipa",
        file_name: "MyApp-1.1.0.ipa",
        file_size: 44 * 1024 * 1024, // 44 MB
        content_type: "application/octet-stream",
        created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: 2,
    project_id: 1,
    name: "My Android App",
    package_id: "com.example.androidapp",
    platform: "android",
    description: "Main Android application",
    icon_url: null,
    created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    builds: [
      {
        id: 3,
        app_id: 2,
        version: "2.0.0",
        channel: "beta",
        notes: "Beta release with new features",
        status: "completed",
        storage_path: "builds/android/2.0.0.apk",
        download_url: "https://example.com/builds/android/2.0.0.apk",
        file_name: "MyApp-2.0.0.apk",
        file_size: 38 * 1024 * 1024, // 38 MB
        content_type: "application/vnd.android.package-archive",
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },
];

let nextAppId = 3;
let nextBuildId = 4;

// Store pending uploads to retrieve data when completing
const pendingUploads = new Map<number, {
  app_id: number;
  file_name: string;
  content_type?: string;
  version: string;
  channel?: string;
  notes?: string;
  storage_path: string;
  download_url: string;
}>();

export const mockGetMobileApps = async (projectId?: number): Promise<MobileAppResponse[]> => {
  await new Promise(resolve => setTimeout(resolve, 300));

  let apps = [...mockMobileApps];

  if (projectId) {
    apps = apps.filter(app => app.project_id === projectId);
  }

  return apps;
};

export const mockCreateMobileApp = async (data: {
  project_id: number;
  name: string;
  package_id: string;
  platform: string;
  description?: string;
  icon_url?: string;
}): Promise<MobileAppResponse> => {
  await new Promise(resolve => setTimeout(resolve, 400));

  const newApp: MobileAppResponse = {
    id: nextAppId++,
    project_id: data.project_id,
    name: data.name,
    package_id: data.package_id,
    platform: data.platform,
    description: data.description || null,
    icon_url: data.icon_url || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    builds: [],
  };

  mockMobileApps.push(newApp);
  return newApp;
};

export const mockRequestMobileAppBuildUpload = async (
  appId: number,
  data: {
    file_name: string;
    content_type?: string;
    version: string;
    channel?: string;
    notes?: string;
  }
): Promise<{
  build_id: number;
  signed_url: string;
  storage_path: string;
  download_url: string;
}> => {
  await new Promise(resolve => setTimeout(resolve, 300));

  const app = mockMobileApps.find(a => a.id === appId);
  if (!app) {
    throw new Error(`App with id ${appId} not found`);
  }

  const buildId = nextBuildId++;
  const storagePath = `builds/${app.platform}/${data.version}/${data.file_name}`;
  const downloadUrl = `https://example.com/${storagePath}`;

  // Store upload request data for when we complete the build
  pendingUploads.set(buildId, {
    app_id: appId,
    file_name: data.file_name,
    content_type: data.content_type,
    version: data.version,
    channel: data.channel,
    notes: data.notes,
    storage_path: storagePath,
    download_url: downloadUrl,
  });

  return {
    build_id: buildId,
    signed_url: `https://storage.example.com/upload/${buildId}?signature=mock`,
    storage_path: storagePath,
    download_url: downloadUrl,
  };
};

export const mockCompleteMobileAppBuild = async (
  buildId: number,
  data: {
    file_size?: number;
    status?: string;
  }
): Promise<MobileAppBuildResponse> => {
  await new Promise(resolve => setTimeout(resolve, 200));

  // Retrieve upload request data
  const uploadData = pendingUploads.get(buildId);
  if (!uploadData) {
    throw new Error(`Upload request for build ${buildId} not found`);
  }

  // Find the app
  const app = mockMobileApps.find(a => a.id === uploadData.app_id);
  if (!app) {
    throw new Error(`App with id ${uploadData.app_id} not found`);
  }

  const build: MobileAppBuildResponse = {
    id: buildId,
    app_id: uploadData.app_id,
    version: uploadData.version,
    channel: uploadData.channel || null,
    notes: uploadData.notes || null,
    status: data.status || "completed",
    storage_path: uploadData.storage_path,
    download_url: uploadData.download_url,
    file_name: uploadData.file_name,
    file_size: data.file_size || null,
    content_type: uploadData.content_type || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Add build to app
  if (!app.builds) {
    app.builds = [];
  }
  app.builds.push(build);

  // Remove from pending uploads
  pendingUploads.delete(buildId);

  return build;
};

export const mockDeleteMobileAppBuild = async (buildId: number): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 200));

  // Also remove from pending uploads if it exists there
  pendingUploads.delete(buildId);

  for (const app of mockMobileApps) {
    if (app.builds) {
      const index = app.builds.findIndex(b => b.id === buildId);
      if (index !== -1) {
        app.builds.splice(index, 1);
        return;
      }
    }
  }

  throw new Error(`Build with id ${buildId} not found`);
};

