import React, { useState } from 'react';

const TaskMonitor = ({ tasks, projects, onTaskAction }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [newTask, setNewTask] = useState({
    name: '',
    description: '',
    projectId: '',
    type: 'automation',
    priority: 'medium'
  });

  const taskTypes = [
    { id: 'automation', label: 'Automation', description: 'General automation task' },
    { id: 'web-scraping', label: 'Web Scraping', description: 'Data extraction from websites' },
    { id: 'file-processing', label: 'File Processing', description: 'File manipulation tasks' },
    { id: 'monitoring', label: 'Monitoring', description: 'System monitoring task' }
  ];

  const priorityLevels = [
    { id: 'low', label: 'Low', color: '#6c757d' },
    { id: 'medium', label: 'Medium', color: '#ffc107' },
    { id: 'high', label: 'High', color: '#fd7e14' },
    { id: 'critical', label: 'Critical', color: '#dc3545' }
  ];

  const handleCreateTask = async () => {
    if (!newTask.name.trim() || !newTask.projectId) return;
    
    await onTaskAction('create', newTask);
    setNewTask({
      name: '',
      description: '',
      projectId: '',
      type: 'automation',
      priority: 'medium'
    });
    setShowCreateModal(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#28a745';
      case 'running':
        return '#007bff';
      case 'failed':
        return '#dc3545';
      case 'cancelled':
        return '#6c757d';
      default:
        return '#ffc107';
    }
  };

  const getPriorityColor = (priority) => {
    const level = priorityLevels.find(p => p.id === priority);
    return level ? level.color : '#6c757d';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'running':
        return '🔄';
      case 'failed':
        return '❌';
      case 'cancelled':
        return '⏹️';
      default:
        return '⏳';
    }
  };

  const filteredTasks = selectedProject 
    ? tasks.filter(task => task.projectId === selectedProject)
    : tasks;

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
  });

  return (
    <div>
      <div className="form-section">
        <div className="form-section-title">
          Task Monitor
          <div style={{ float: 'right', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              className="form-control"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              style={{ width: 'auto', minWidth: '200px' }}
            >
              <option value="">All Projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              ➕ New Task
            </button>
          </div>
        </div>
      </div>

      {sortedTasks.length === 0 ? (
        <div className="card text-center" style={{ padding: '40px' }}>
          <h3>No tasks found</h3>
          <p style={{ color: '#666', margin: '16px 0' }}>
            {selectedProject 
              ? 'No tasks for the selected project.'
              : 'Create your first task to get started.'
            }
          </p>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            Create Task
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Project</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Type</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedTasks.map((task) => {
                const project = projects.find(p => p.id === task.projectId);
                return (
                  <tr key={task.id}>
                    <td>
                      <div>
                        <strong>{task.name}</strong>
                        {task.description && (
                          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                            {task.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>{project?.name || 'Unknown Project'}</td>
                    <td>
                      <span 
                        className="status-indicator"
                        style={{ 
                          backgroundColor: getStatusColor(task.status),
                          color: 'white'
                        }}
                      >
                        {getStatusIcon(task.status)} {task.status}
                      </span>
                    </td>
                    <td>
                      <span 
                        style={{ 
                          color: getPriorityColor(task.priority),
                          fontWeight: 'bold',
                          textTransform: 'capitalize'
                        }}
                      >
                        {task.priority}
                      </span>
                    </td>
                    <td>
                      {taskTypes.find(t => t.id === task.type)?.label || task.type}
                    </td>
                    <td>{new Date(task.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => onTaskAction('update', task)}
                        >
                          ✏️
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => onTaskAction('delete', task)}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Create New Task</h3>
              <button
                className="modal-close"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="form-section">
              <div className="form-group">
                <label className="form-label">Task Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={newTask.name}
                  onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                  placeholder="Enter task name"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Enter task description"
                  rows="3"
                />
              </div>
              
              <div className="form-row">
                <div className="form-col">
                  <div className="form-group">
                    <label className="form-label">Project</label>
                    <select
                      className="form-control"
                      value={newTask.projectId}
                      onChange={(e) => setNewTask({ ...newTask, projectId: e.target.value })}
                    >
                      <option value="">Select a project</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="form-col">
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select
                      className="form-control"
                      value={newTask.priority}
                      onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                    >
                      {priorityLevels.map((level) => (
                        <option key={level.id} value={level.id}>
                          {level.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Task Type</label>
                <select
                  className="form-control"
                  value={newTask.type}
                  onChange={(e) => setNewTask({ ...newTask, type: e.target.value })}
                >
                  {taskTypes.map((type) => (
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
                onClick={handleCreateTask}
                disabled={!newTask.name.trim() || !newTask.projectId}
              >
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskMonitor;
