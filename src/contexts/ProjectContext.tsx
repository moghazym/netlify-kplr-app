import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getProjects, ProjectResponse } from '../lib/api-client';

interface ProjectContextType {
  projects: ProjectResponse[];
  selectedProject: ProjectResponse | null;
  setSelectedProject: (project: ProjectResponse | null) => void;
  loading: boolean;
  refreshProjects: (selectProject?: ProjectResponse | null) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};

interface ProjectProviderProps {
  children: ReactNode;
}

export const ProjectProvider: React.FC<ProjectProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const isFetchingProjectsRef = useRef(false);
  const lastUserIdRef = useRef<number | null>(null);

  const fetchProjects = async (selectProject?: ProjectResponse | null) => {
    // Prevent duplicate calls
    if (isFetchingProjectsRef.current) {
      return;
    }

    if (!user) {
      setProjects([]);
      setSelectedProject(null);
      setLoading(false);
      return;
    }

    try {
      isFetchingProjectsRef.current = true;
      setLoading(true);
      const projectsData = await getProjects();
      setProjects(projectsData || []);
      
      // If a project is explicitly provided to select, use it
      if (selectProject) {
        const foundProject = projectsData.find(p => p.id === selectProject.id);
        if (foundProject) {
          setSelectedProject(foundProject);
          localStorage.setItem('selected_project_id', foundProject.id.toString());
        }
      } else if (projectsData && projectsData.length > 0) {
        // Select first project by default if available
        // Check if there's a previously selected project in localStorage
        const savedProjectId = localStorage.getItem('selected_project_id');
        const savedProject = savedProjectId 
          ? projectsData.find(p => p.id.toString() === savedProjectId)
          : null;
        
        const projectToSelect = savedProject || projectsData[0];
        setSelectedProject(projectToSelect);
        localStorage.setItem('selected_project_id', projectToSelect.id.toString());
      } else {
        setSelectedProject(null);
        localStorage.removeItem('selected_project_id');
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects([]);
      setSelectedProject(null);
    } finally {
      setLoading(false);
      isFetchingProjectsRef.current = false;
    }
  };

  useEffect(() => {
    // Only fetch if user changed (not on every render)
    const userId = user?.id || null;
    if (userId !== lastUserIdRef.current) {
      lastUserIdRef.current = userId;
      fetchProjects();
    }
  }, [user]);

  // Update localStorage when selected project changes
  const handleSetSelectedProject = (project: ProjectResponse | null) => {
    setSelectedProject(project);
    if (project) {
      localStorage.setItem('selected_project_id', project.id.toString());
    } else {
      localStorage.removeItem('selected_project_id');
    }
  };

  const value: ProjectContextType = {
    projects,
    selectedProject,
    setSelectedProject: handleSetSelectedProject,
    loading,
    refreshProjects: fetchProjects,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};
