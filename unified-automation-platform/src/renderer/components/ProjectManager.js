import React, { useState } from 'react';

const ProjectManager = ({ projects, onProjectAction }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    type: 'open-computer-use',
    config: {}
  });

  const projectTypes = [
    { id: 'open-computer-use', label: 'Open Computer Use', description: 'AI-powered computer automation' },
    { id: 'ui-tars-desktop', label: 'UI-TARS Desktop', description: 'Task automation and reporting system' },
    { id: 'gbox', label: 'GBox', description: 'Android automation platform' },
    { id: 'bytebot', label: 'ByteBot', description: 'Bot automation service' }
  ];

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) return;
    
    await onProjectAction('create', newProject);
    setNewProject({
      name: '',
      description: '',
      type: 'open-computer-use',
      config: {}
    });
    setShowCreateModal(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running':
        return '#28a745';
      case 'stopped':
        return '#6c757d';
      case 'error':
        return '#dc3545';
      default:
        return '#ffc107';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running':
        return '▶️';
      case 'stopped':
        return '⏹️';
      case 'error':
        return '❌';
      default:
        return '⏸️';
    }
  };

  return (
    <div>
      <div className="form-section">
        <div className="form-section-title">
          Project Manager
          <button
            className="btn btn-primary"
            style={{ float: 'right' }}
            onClick={() => setShowCreateModal(true)}
          >
            ➕ New Project
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="card text-center" style={{ padding: '40px' }}>
          <h3>No projects found</h3>
          <p style={{ color: '#666', margin: '16px 0' }}>
            Create your first automation project to get started.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            Create Project
          </button>
        </div>
      ) : (
        <div>
          {projects.map((project) => (
            <div key={project.id} className="project-card">
              <div className="project-header">
                <div>
                  <h3 className="project-title">{project.name}</h3>
                  <p className="project-description">{project.description}</p>
                  <div className="project-meta">
                    <span>Type: {projectTypes.find(t => t.id === project.type)?.label || project.type}</span>
                    <span>Created: {new Date(project.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="project-actions">
                  <span 
                    className="status-indicator"
                    style={{ backgroundColor: getStatusColor(project.status), color: 'white' }}
                  >
                    {getStatusIcon(project.status)} {project.status}
                  </span>
                  
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => onProjectAction('update', project)}
                  >
                    ✏️ Edit
                  </button>
                  
                  {project.status === 'running' ? (
                    <button
                      className="btn btn-sm btn-warning"
                      onClick={() => onProjectAction('stop', project)}
                    >
                      ⏹️ Stop
                    </button>
                  ) : (
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => onProjectAction('start', project)}
                    >
                      ▶️ Start
                    </button>
                  )}
                  
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => onProjectAction('delete', project)}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
              
              {project.tasks && project.tasks.length > 0 && (
                <div className="task-list">
                  <h4>Recent Tasks</h4>
                  {project.tasks.slice(0, 3).map((task) => (
                    <div key={task.id} className="task-item">
                      <span className="task-title">{task.name}</span>
                      <span className={`task-status ${task.status}`}>
                        {task.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Create New Project</h3>
              <button
                className="modal-close"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="form-section">
              <div className="form-group">
                <label className="form-label">Project Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="Enter project name"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  placeholder="Enter project description"
                  rows="3"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Project Type</label>
                <select
                  className="form-control"
                  value={newProject.type}
                  onChange={(e) => setNewProject({ ...newProject, type: e.target.value })}
                >
                  {projectTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label} - {type.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateProject}
                disabled={!newProject.name.trim()}
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectManager;
