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
 * Check if we should use mock API (development mode and no API base URL)
 */
export const shouldUseMockApi = (): boolean => {
  const isDevelopment = import.meta.env.DEV || 
    window.location.hostname === "localhost" || 
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.includes('.localhost');
  
  const hasApiBaseUrl = !!import.meta.env.VITE_API_BASE_URL;
  
  // Use mock API if in development and no API base URL is configured
  return isDevelopment && !hasApiBaseUrl;
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

