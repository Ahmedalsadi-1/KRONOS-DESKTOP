import React, { useState } from 'react';

const AuthManager = ({ authStatus, onAuthAction }) => {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
    apiKey: '',
    token: ''
  });

  const platforms = [
    { 
      id: 'openai', 
      label: 'OpenAI', 
      description: 'GPT models and API access',
      fields: ['apiKey'],
      helpText: 'Get your API key from OpenAI platform'
    },
    { 
      id: 'anthropic', 
      label: 'Anthropic', 
      description: 'Claude models and API access',
      fields: ['apiKey'],
      helpText: 'Get your API key from Anthropic console'
    },
    { 
      id: 'google', 
      label: 'Google AI', 
      description: 'Gemini models and API access',
      fields: ['apiKey'],
      helpText: 'Get your API key from Google AI Studio'
    },
    { 
      id: 'github', 
      label: 'GitHub', 
      description: 'Repository access and API',
      fields: ['token'],
      helpText: 'Generate a personal access token'
    },
    { 
      id: 'open-computer-use', 
      label: 'Open Computer Use', 
      description: 'AI automation platform',
      fields: ['username', 'password'],
      helpText: 'Login credentials for the platform'
    },
    { 
      id: 'bytebot', 
      label: 'ByteBot', 
      description: 'Bot automation service',
      fields: ['apiKey'],
      helpText: 'API key for ByteBot service'
    }
  ];

  const handleLogin = async () => {
    if (!selectedPlatform) return;
    
    const platformConfig = {
      platform: selectedPlatform,
      credentials: credentials
    };
    
    await onAuthAction('login', platformConfig);
    
    setCredentials({
      username: '',
      password: '',
      apiKey: '',
      token: ''
    });
    setShowLoginModal(false);
  };

  const handleLogout = async (platform) => {
    await onAuthAction('logout', { platform });
  };

  const handleRefresh = async (platform) => {
    await onAuthAction('refresh', { platform });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected':
      case 'authenticated':
        return '#28a745';
      case 'error':
        return '#dc3545';
      case 'expired':
        return '#ffc107';
      default:
        return '#6c757d';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'connected':
      case 'authenticated':
        return '✅';
      case 'error':
        return '❌';
      case 'expired':
        return '⏰';
      default:
        return '⏳';
    }
  };

  const selectedPlatformInfo = platforms.find(p => p.id === selectedPlatform);

  return (
    <div>
      <div className="form-section">
        <div className="form-section-title">
          Authentication Manager
          <button
            className="btn btn-primary"
            style={{ float: 'right' }}
            onClick={() => setShowLoginModal(true)}
          >
            🔐 Add Platform
          </button>
        </div>
      </div>

      {authStatus.platforms.length === 0 ? (
        <div className="card text-center" style={{ padding: '40px' }}>
          <h3>No platforms connected</h3>
          <p style={{ color: '#666', margin: '16px 0' }}>
            Connect your first platform to start managing automation projects.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => setShowLoginModal(true)}
          >
            Connect Platform
          </button>
        </div>
      ) : (
        <div>
          {authStatus.platforms.map((platform) => {
            const platformInfo = platforms.find(p => p.id === platform.name);
            return (
              <div key={platform.name} className="project-card">
                <div className="project-header">
                  <div>
                    <h3 className="project-title">
                      {platformInfo?.label || platform.name}
                    </h3>
                    <p className="project-description">
                      {platformInfo?.description || 'Platform authentication'}
                    </p>
                    <div className="project-meta">
                      <span>Status: {platform.status}</span>
                      {platform.lastUsed && (
                        <span>Last used: {new Date(platform.lastUsed).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="project-actions">
                    <span 
                      className="status-indicator"
                      style={{ backgroundColor: getStatusColor(platform.status), color: 'white' }}
                    >
                      {getStatusIcon(platform.status)} {platform.status}
                    </span>
                    
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleRefresh(platform.name)}
                    >
                      🔄 Refresh
                    </button>
                    
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleLogout(platform.name)}
                    >
                      🚪 Logout
                    </button>
                  </div>
                </div>
                
                {platform.error && (
                  <div style={{ 
                    backgroundColor: '#f8d7da', 
                    color: '#721c24', 
                    padding: '12px', 
                    borderRadius: '4px', 
                    marginTop: '12px' 
                  }}>
                    <strong>Error:</strong> {platform.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Login Modal */}
      {showLoginModal && (
        <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Connect Platform</h3>
              <button
                className="modal-close"
                onClick={() => setShowLoginModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="form-section">
              <div className="form-group">
                <label className="form-label">Platform</label>
                <select
                  className="form-control"
                  value={selectedPlatform}
                  onChange={(e) => {
                    setSelectedPlatform(e.target.value);
                    setCredentials({
                      username: '',
                      password: '',
                      apiKey: '',
                      token: ''
                    });
                  }}
                >
                  <option value="">Select a platform</option>
                  {platforms.map((platform) => (
                    <option key={platform.id} value={platform.id}>
                      {platform.label} - {platform.description}
                    </option>
                  ))}
                </select>
              </div>
              
              {selectedPlatformInfo && (
                <>
                  {selectedPlatformInfo.fields.includes('username') && (
                    <div className="form-group">
                      <label className="form-label">Username</label>
                      <input
                        type="text"
                        className="form-control"
                        value={credentials.username}
                        onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                        placeholder="Enter username"
                      />
                    </div>
                  )}
                  
                  {selectedPlatformInfo.fields.includes('password') && (
                    <div className="form-group">
                      <label className="form-label">Password</label>
                      <input
                        type="password"
                        className="form-control"
                        value={credentials.password}
                        onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                        placeholder="Enter password"
                      />
                    </div>
                  )}
                  
                  {selectedPlatformInfo.fields.includes('apiKey') && (
                    <div className="form-group">
                      <label className="form-label">API Key</label>
                      <input
                        type="password"
                        className="form-control"
                        value={credentials.apiKey}
                        onChange={(e) => setCredentials({ ...credentials, apiKey: e.target.value })}
                        placeholder="Enter API key"
                      />
                    </div>
                  )}
                  
                  {selectedPlatformInfo.fields.includes('token') && (
                    <div className="form-group">
                      <label className="form-label">Access Token</label>
                      <input
                        type="password"
                        className="form-control"
                        value={credentials.token}
                        onChange={(e) => setCredentials({ ...credentials, token: e.target.value })}
                        placeholder="Enter access token"
                      />
                    </div>
                  )}
                  
                  <div className="form-help">
                    <strong>Help:</strong> {selectedPlatformInfo.helpText}
                  </div>
                </>
              )}
            </div>
            
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowLoginModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleLogin}
                disabled={!selectedPlatform}
              >
                Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthManager;
