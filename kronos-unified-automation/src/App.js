import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import ProjectManager from './components/ProjectManager';
import TaskMonitor from './components/TaskMonitor';
import AuthManager from './components/AuthManager';
import SystemMonitor from './components/SystemMonitor';
import StatusBar from './components/StatusBar';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState('projects');
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [systemStatus, setSystemStatus] = useState({
    cpu: 0,
    memory: 0,
    disk: 0,
    network: 'connected'
  });
  const [authStatus, setAuthStatus] = useState({ isAuthenticated: false, platforms: [] });
  const [wsStatus, setWsStatus] = useState('disconnected');

  useEffect(() => {
    initializeApp();
    setupEventListeners();
    return () => {
      cleanup();
    };
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize authentication status
      const auth = await window.electronAPI.getAuthStatus();
      setAuthStatus(auth);

      // Load existing projects
      const projectsList = await window.electronAPI.getProjects();
      setProjects(projectsList);

      // Load system status
      const status = await window.electronAPI.getSystemStatus();
      setSystemStatus(status);

      setIsLoading(false);
    } catch (error) {
      console.error('Failed to initialize app:', error);
      setIsLoading(false);
    }
  };

  const setupEventListeners = () => {
    // WebSocket status updates
    window.electronAPI.onWsStatusChange((event, status) => {
      setWsStatus(status);
    });

    // Project updates
    window.electronAPI.onProjectUpdate((event, project) => {
      setProjects(prev => {
        const index = prev.findIndex(p => p.id === project.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = project;
          return updated;
        }
        return [...prev, project];
      });
    });

    // Task updates
    window.electronAPI.onTaskUpdate((event, task) => {
      setTasks(prev => {
        const index = prev.findIndex(t => t.id === task.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = task;
          return updated;
        }
        return [...prev, task];
      });
    });

    // System status updates
    window.electronAPI.onSystemStatusUpdate((event, status) => {
      setSystemStatus(status);
    });
  };

  const cleanup = () => {
    // Cleanup event listeners if needed
  };

  const handleProjectAction = async (action, projectData) => {
    try {
      switch (action) {
        case 'create':
          const newProject = await window.electronAPI.createProject(projectData);
          setProjects(prev => [...prev, newProject]);
          break;
        case 'update':
          const updatedProject = await window.electronAPI.updateProject(projectData);
          setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
          break;
        case 'delete':
          await window.electronAPI.deleteProject(projectData.id);
          setProjects(prev => prev.filter(p => p.id !== projectData.id));
          break;
        case 'start':
          await window.electronAPI.startProject(projectData.id);
          break;
        case 'stop':
          await window.electronAPI.stopProject(projectData.id);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Project action failed:', error);
    }
  };

  const handleTaskAction = async (action, taskData) => {
    try {
      switch (action) {
        case 'create':
          const newTask = await window.electronAPI.createTask(taskData);
          setTasks(prev => [...prev, newTask]);
          break;
        case 'update':
          const updatedTask = await window.electronAPI.updateTask(taskData);
          setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
          break;
        case 'delete':
          await window.electronAPI.deleteTask(taskData.id);
          setTasks(prev => prev.filter(t => t.id !== taskData.id));
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Task action failed:', error);
    }
  };

  const handleAuthAction = async (action, authData) => {
    try {
      switch (action) {
        case 'login':
          await window.electronAPI.login(authData);
          break;
        case 'logout':
          await window.electronAPI.logout(authData.platform);
          break;
        case 'refresh':
          const status = await window.electronAPI.refreshAuth(authData.platform);
          setAuthStatus(prev => ({
            ...prev,
            platforms: prev.platforms.map(p => 
              p.name === authData.platform ? status : p
            )
          }));
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Auth action failed:', error);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <ErrorBoundary>
      <div className="app">
        <Header 
          currentView={currentView}
          onViewChange={setCurrentView}
          wsStatus={wsStatus}
          systemStatus={systemStatus}
        />
        
        <main className="main-content">
          {currentView === 'projects' && (
            <ProjectManager
              projects={projects}
              onProjectAction={handleProjectAction}
            />
          )}
          
          {currentView === 'tasks' && (
            <TaskMonitor
              tasks={tasks}
              projects={projects}
              onTaskAction={handleTaskAction}
            />
          )}
          
          {currentView === 'auth' && (
            <AuthManager
              authStatus={authStatus}
              onAuthAction={handleAuthAction}
            />
          )}
          
          {currentView === 'system' && (
            <SystemMonitor
              systemStatus={systemStatus}
            />
          )}
        </main>
        
        <StatusBar
          wsStatus={wsStatus}
          systemStatus={systemStatus}
          authStatus={authStatus}
          projectCount={projects.length}
          taskCount={tasks.length}
        />
      </div>
    </ErrorBoundary>
  );
}

export default App;
