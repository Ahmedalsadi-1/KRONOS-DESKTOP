import React, { useState, useEffect } from 'react';
import { useKronosAPI } from '../hooks/useKronosAPI';
import '../App.css';

function ProjectManager({ config }) {
  const { getAppInfo } = useKronosAPI();
  const [projects, setProjects] = useState([
    {
      id: 'web-automation-1',
      name: 'Web Scraper',
      description: 'Automated web data extraction using Puppeteer',
      status: 'running',
      lastRun: '2024-01-15T10:30:00Z',
      schedule: '0 6 * * * *',
      nextRun: '2024-01-16T10:30:00Z'
    },
    {
      id: 'android-control-1',
      name: 'Android Bot Controller',
      description: 'Automated Android device control and monitoring',
      status: 'stopped',
      lastRun: '2024-01-14T15:45:00Z',
      schedule: '0 8 * * * *',
      nextRun: '2024-01-16T08:45:00Z'
    },
    {
      id: 'ocr-processing-1',
      name: 'Document OCR',
      description: 'Text extraction from images and documents',
      status: 'completed',
      lastRun: '2024-01-13T22:15:00Z',
      schedule: '0 2 * * * *',
      nextRun: null
    }
  ]);
  
  const [selectedProject, setSelectedProject] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    schedule: '',
    type: 'web-automation'
  });

  useEffect(() => {
    // Simulate real-time updates
    const interval = setInterval(() => {
      setProjects(prevProjects => 
        prevProjects.map(project => {
          // Simulate status changes
          if (Math.random() > 0.7) {
            const newStatus = project.status === 'running' ? 'stopped' : 'running';
            return { ...project, status: newStatus };
          }
          return project;
        })
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'text-green-400';
      case 'completed': return 'text-blue-400';
      case 'stopped': return 'text-red-400';
      case 'error': return 'text-red-600';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running': return '🟢';
      case 'completed': return '🔵';
      case 'stopped': return '🔴';
      case 'error': return '⚠️';
      default: return '⚪';
    }
  };

  const handleCreateProject = () => {
    if (!newProject.name.trim()) return;

    const project = {
      id: `project-${Date.now()}`,
      name: newProject.name,
      description: newProject.description,
      type: newProject.type,
      status: 'created',
      schedule: newProject.schedule,
      createdAt: new Date().toISOString(),
      lastRun: null,
      nextRun: null
    };

    setProjects(prev => [...prev, project]);
    setShowCreateModal(false);
    setNewProject({ name: '', description: '', schedule: '', type: 'web-automation' });
  };

  const handleStartProject = async (projectId) => {
    try {
      setProjects(prev => 
        prevProjects.map(p => 
          p.id === projectId ? { ...p, status: 'starting' } : p
        )
      );
      
      // Simulate project start
      setTimeout(() => {
        setProjects(prev => 
          prevProjects.map(p => 
            p.id === projectId ? { ...p, status: 'running' } : p
          )
        );
      }, 2000);
    } catch (error) {
      console.error('Failed to start project:', error);
    }
  };

  const handleStopProject = async (projectId) => {
    try {
      setProjects(prev => 
        prevProjects.map(p => 
          p.id === projectId ? { ...p, status: 'stopping' } : p
        )
      );
      
      // Simulate project stop
      setTimeout(() => {
        setProjects(prev => 
          prevProjects.map(p => 
            p.id === projectId ? { ...p, status: 'stopped' } : p
          )
        );
      }, 1000);
    } catch (error) {
      console.error('Failed to stop project:', error);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      setProjects(prev => prev.filter(p => p.id !== projectId));
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-blue-400 mb-4">Project Manager</h3>
      
      <div className="mb-6">
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
        >
          + Create New Project
        </button>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <div
            key={project.id}
            className={`bg-gray-700 rounded-lg p-4 border-2 cursor-pointer transition-all duration-200 ${
              selectedProject === project.id ? 'border-blue-400' : 'border-gray-600 hover:border-blue-400'
            }`}
            onClick={() => setSelectedProject(project.id)}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="font-medium text-white">{project.name}</h4>
                <p className="text-sm text-gray-300 mt-1">
                  {project.description}
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className={`text-xs font-medium px-2 py-1 rounded ${
                  getStatusColor(project.status)
                }`}>
                  {project.status.toUpperCase()}
                </span>
                <span className="text-xl ml-2">
                  {getStatusIcon(project.status)}
                </span>
              </div>
            </div>
            
            <div className="text-sm text-gray-400 mt-3">
              <div className="flex justify-between">
                <span>Last run: {new Date(project.lastRun).toLocaleDateString()}</span>
                <span>Created: {new Date(project.createdAt).toLocaleDateString()}</span>
              </div>
              
              {project.nextRun && (
                <div className="text-green-400">
                  Next run: {new Date(project.nextRun).toLocaleDateString()}
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-2 mt-4">
              {project.status === 'running' ? (
                <button
                  onClick={() => handleStopProject(project.id)}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors duration-200"
                >
                  Stop
                </button>
              ) : project.status === 'stopped' ? (
                <button
                  onClick={() => handleStartProject(project.id)}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors duration-200"
                >
                  Start
                </button>
              ) : (
                <button
                  disabled
                  className="bg-gray-600 text-gray-400 px-3 py-1 rounded text-sm cursor-not-allowed"
                >
                  {project.status}
                </button>
              )}
              
              <button
                onClick={() => handleDeleteProject(project.id)}
                className="bg-gray-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors duration-200"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Project Details Modal */}
      {selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-2xl w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Project Details</h3>
              <button
                onClick={() => setSelectedProject(null)}
                className="text-gray-400 hover:text-gray-300 text-2xl"
              >
                ×
              </button>
            </div>
            
            {(() => {
              const project = projects.find(p => p.id === selectedProject);
              if (!project) return null;
              
              return (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-blue-400">{project.name}</h4>
                    <p className="text-gray-300 mt-1">{project.description}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Type:</span>
                      <span className="text-gray-300">{project.type}</span>
                    </div>
                    
                    <div>
                      <span className="text-gray-400">Status:</span>
                      <span className={getStatusColor(project.status)}>
                        {project.status}
                      </span>
                    </div>
                    
                    <div>
                      <span className="text-gray-400">Schedule:</span>
                      <span className="text-gray-300">{project.schedule}</span>
                    </div>
                  </div>
                  
                  {project.status === 'running' && (
                    <div className="mt-4">
                      <button
                        onClick={() => handleStopProject(project.id)}
                        className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors duration-200"
                      >
                        Stop Project
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Create New Project</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-300 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter project name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Describe the project"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Type
                </label>
                <select
                  value={newProject.type}
                  onChange={(e) => setNewProject(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="web-automation">Web Automation</option>
                  <option value="android-control">Android Control</option>
                  <option value="ocr-processing">OCR Processing</option>
                  <option value="data-analysis">Data Analysis</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Schedule (Cron Format)
                </label>
                <input
                  type="text"
                  value={newProject.schedule}
                  onChange={(e) => setNewProject(prev => ({ ...prev, schedule: e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0 */6 * * * (daily at 6 AM)"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors duration-200"
              >
                Cancel
              </button>
              
              <button
                onClick={handleCreateProject}
                disabled={!newProject.name.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded transition-colors duration-200"
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectManager;