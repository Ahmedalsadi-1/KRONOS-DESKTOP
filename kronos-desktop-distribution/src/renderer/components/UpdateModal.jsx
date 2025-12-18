import React from 'react';
import { useConfig } from '../components/ConfigProvider';
import '../styles/global.css';

function UpdateModal({ isVisible, onClose, onUpdateInfo, onInstall }) {
  const [isInstalling, setIsInstalling] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (isVisible && onUpdateInfo) {
      setProgress(0);
      setIsInstalling(false);
    }
  }, [isVisible, onUpdateInfo]);

  const handleInstall = async () => {
    setIsInstalling(true);
    setProgress(0);
    
    try {
      await onInstall();
      setProgress(100);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Update installation failed:', error);
      setIsInstalling(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="update-modal">
      <div className="update-modal-content">
        <div className="update-title">
          📦 KRONOS Update Available
        </div>
        
        <div className="update-message">
          {onUpdateInfo ? (
            <div>
              <p><strong>New version: {onUpdateInfo.version}</strong></p>
              <p><strong>Current version: {onUpdateInfo.currentVersion}</strong></p>
              {onUpdateInfo.releaseNotes && (
                <div>
                  <strong>What's new:</strong>
                  <p>{onUpdateInfo.releaseNotes}</p>
                </div>
              )}
            </div>
          ) : (
            <p>Checking for updates...</p>
          )}
        </div>

        {onUpdateInfo && (
          <div className="update-buttons">
            <button
              onClick={handleInstall}
              disabled={isInstalling}
              className="update-btn secondary"
            >
              {isInstalling ? 'Installing...' : 'Install Later'}
            </button>
            <button
              onClick={handleInstall}
              disabled={isInstalling}
              className="update-btn primary"
            >
              {isInstalling ? 'Installing...' : 'Update Now'}
            </button>
          </div>
        )}

        {isInstalling && (
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
            <div className="progress-text">
              Installing update... {progress}%
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UpdateModal;