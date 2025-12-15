import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * StreamingMonitor Component
 * Real-time monitoring dashboard for automation tasks and system streams
 */
const StreamingMonitor = ({ apiManager, streamManager, onTaskUpdate }) => {
  const [connections, setConnections] = useState(0);
  const [activeStreams, setActiveStreams] = useState(0);
  const [streamData, setStreamData] = useState([]);
  const [filters, setFilters] = useState({
    taskEvents: true,
    automationUpdates: true,
    systemLogs: true,
    binaryData: false
  });
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef(null);
  const messagesRef = useRef([]);

  useEffect(() => {
    initializeWebSocket();

    // Setup API manager event listeners
    const handleTaskEvent = (event) => {
      addStreamMessage({
        type: 'task',
        eventType: event.event,
        data: event.data,
        timestamp: event.timestamp
      });
    };

    const handleAutomationUpdate = (update) => {
      addStreamMessage({
        type: 'automation',
        data: update,
        timestamp: new Date()
      });
    };

    apiManager.on('taskUpdate', handleTaskEvent);
    apiManager.on('automationUpdate', handleAutomationUpdate);

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      apiManager.off('taskUpdate', handleTaskEvent);
      apiManager.off('automationUpdate', handleAutomationUpdate);
    };
  }, [apiManager]);

  const initializeWebSocket = () => {
    try {
      const ws = new WebSocket('ws://localhost:3001');

      ws.onopen = () => {
        console.log('[StreamingMonitor] WebSocket connected');
        setIsConnected(true);

        // Authenticate with the stream manager
        ws.send(JSON.stringify({
          type: 'AUTHENTICATE',
          data: {
            token: 'demo-token' // In production, use proper auth
          }
        }));

        // Subscribe to all streams
        ws.send(JSON.stringify({
          type: 'SUBSCRIBE',
          data: {
            streamId: 'all_tasks',
            filters: {
              includeTypes: ['task_event', 'automation_update', 'system_log']
            }
          }
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('[StreamingMonitor] Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('[StreamingMonitor] WebSocket disconnected');
        setIsConnected(false);
        // Auto-reconnect after delay
        setTimeout(initializeWebSocket, 5000);
      };

      ws.onerror = (error) => {
        console.error('[StreamingMonitor] WebSocket error:', error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[StreamingMonitor] Failed to initialize WebSocket:', error);
    }
  };

  const handleWebSocketMessage = (message) => {
    switch (message.type) {
      case 'WELCOME':
        console.log('[StreamingMonitor] Connected to streaming server');
        break;

      case 'AUTHENTICATED':
        console.log('[StreamingMonitor] Successfully authenticated');
        break;

      case 'STREAM_DATA':
        handleStreamData(message.data);
        break;

      case 'PONG':
        // Heartbeat response
        break;

      case 'ERROR':
        console.error('[StreamingMonitor] WebSocket error:', message.data);
        break;

      default:
        console.log('[StreamingMonitor] Received unhandled message:', message.type);
    }
  };

  const handleStreamData = (data) => {
    addStreamMessage(data);
  };

  const addStreamMessage = (message) => {
    // Apply filters
    if (shouldFilterMessage(message)) {
      return;
    }

    const messageWithId = {
      ...message,
      id: Date.now() + Math.random(),
      displayTime: new Date().toLocaleTimeString()
    };

    messagesRef.current.unshift(messageWithId);

    // Keep only last 100 messages
    if (messagesRef.current.length > 100) {
      messagesRef.current = messagesRef.current.slice(0, 100);
    }

    setStreamData([...messagesRef.current]);

    // Notify parent component
    if (onTaskUpdate && message.type === 'task') {
      onTaskUpdate(message);
    }
  };

  const shouldFilterMessage = (message) => {
    if (message.type === 'task' && message.eventType && !filters.taskEvents) return true;
    if (message.type === 'automation' && !filters.automationUpdates) return true;
    if (message.type === 'system' && !filters.systemLogs) return true;
    if (message.type === 'binary' && !filters.binaryData) return true;
    return false;
  };

  const toggleFilter = (filterKey) => {
    setFilters(prev => ({
      ...prev,
      [filterKey]: !prev[filterKey]
    }));
  };

  const clearMessages = () => {
    messagesRef.current = [];
    setStreamData([]);
  };

  const getMessageIcon = (message) => {
    switch (message.type) {
      case 'task':
        return '🎯';
      case 'automation':
        return '🤖';
      case 'system':
        return '⚙️';
      case 'binary':
        return '📎';
      default:
        return '📝';
    }
  };

  const getMessageColor = (message) => {
    switch (message.type) {
      case 'task':
        return message.data?.status === 'failed' ? 'text-red-400' : 'text-blue-400';
      case 'automation':
        return 'text-green-400';
      case 'system':
        return 'text-yellow-400';
      case 'binary':
        return 'text-purple-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="streaming-monitor bg-gray-900 text-white rounded-lg p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold">Streaming Monitor</h3>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-400">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-sm text-gray-400">
          <span>🔗 {connections}</span>
          <span>📊 {activeStreams}</span>
          <span>💬 {streamData.length}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => toggleFilter('taskEvents')}
          className={`px-3 py-1 rounded text-xs ${
            filters.taskEvents
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Task Events
        </button>
        <button
          onClick={() => toggleFilter('automationUpdates')}
          className={`px-3 py-1 rounded text-xs ${
            filters.automationUpdates
              ? 'bg-green-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Automation Updates
        </button>
        <button
          onClick={() => toggleFilter('systemLogs')}
          className={`px-3 py-1 rounded text-xs ${
            filters.systemLogs
              ? 'bg-yellow-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          System Logs
        </button>
        <button
          onClick={() => toggleFilter('binaryData')}
          className={`px-3 py-1 rounded text-xs ${
            filters.binaryData
              ? 'bg-purple-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Binary Data
        </button>
        <button
          onClick={clearMessages}
          className="px-3 py-1 rounded text-xs bg-red-600 text-white hover:bg-red-700"
        >
          Clear
        </button>
      </div>

      {/* Stream Data */}
      <div className="flex-1 overflow-y-auto border border-gray-700 rounded">
        {streamData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <div className="text-2xl mb-2">📡</div>
              <div>No stream data received yet</div>
              <div className="text-xs mt-1">Waiting for streaming connections...</div>
            </div>
          </div>
        ) : (
          <div className="space-y-2 p-3">
            {streamData.map((message) => (
              <div
                key={message.id}
                className={`p-3 rounded border-l-4 ${
                  message.type === 'task'
                    ? 'border-blue-500 bg-blue-900/20'
                    : message.type === 'automation'
                    ? 'border-green-500 bg-green-900/20'
                    : message.type === 'system'
                    ? 'border-yellow-500 bg-yellow-900/20'
                    : 'border-purple-500 bg-purple-900/20'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <span className="text-lg">{getMessageIcon(message)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`font-medium ${getMessageColor(message)}`}>
                          {message.type.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">
                          {message.displayTime}
                        </span>
                      </div>

                      {message.type === 'task' && message.data && (
                        <div className="space-y-1">
                          <div className="text-sm">
                            Task: <span className="font-medium">{message.data.id}</span>
                          </div>
                          <div className="text-sm">
                            Event: <span className="font-medium">{message.eventType}</span>
                          </div>
                          {message.data.status && (
                            <div className="text-sm">
                              Status: <span className={`font-medium ${
                                message.data.status === 'completed' ? 'text-green-400' :
                                message.data.status === 'failed' ? 'text-red-400' :
                                'text-yellow-400'
                              }`}>{message.data.status}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {message.type === 'automation' && message.data && (
                        <div className="text-sm text-gray-300">
                          {JSON.stringify(message.data, null, 2)}
                        </div>
                      )}

                      {message.type === 'system' && message.data && (
                        <div className="text-sm text-gray-300">
                          {message.data.message || JSON.stringify(message.data)}
                        </div>
                      )}

                      {message.type === 'binary' && message.data && (
                        <div className="space-y-1">
                          <div className="text-sm">
                            File: <span className="font-medium">{message.data.filename}</span>
                          </div>
                          <div className="text-sm">
                            Size: <span className="font-medium">{message.data.size} bytes</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

StreamingMonitor.propTypes = {
  apiManager: PropTypes.object.isRequired,
  streamManager: PropTypes.object.isRequired,
  onTaskUpdate: PropTypes.func
};

export default StreamingMonitor;
