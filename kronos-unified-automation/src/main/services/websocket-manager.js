const { EventEmitter } = require('events');
const WebSocket = require('ws');
const http = require('http');
const url = require('url');

class WebSocketManager extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map(); // taskId -> connection
    this.servers = new Map(); // projectId -> WebSocket server
    this.clients = new Map(); // connectionId -> client info
    
    this.portRange = {
      start: 9000,
      end: 9999
    };
    
    this.setupCleanup();
  }

  setupCleanup() {
    // Clean up connections on app exit
    process.on('exit', () => {
      this.disconnectAll();
    });
    
    process.on('SIGINT', () => {
      this.disconnectAll();
      process.exit();
    });
  }

  async connectToTaskStream(projectId, taskId) {
    try {
      // Determine WebSocket URL based on project
      const streamUrl = await this.getStreamUrlForProject(projectId, taskId);
      
      if (!streamUrl) {
        throw new Error(`No stream URL available for project ${projectId}`);
      }

      // Create WebSocket connection
      const ws = new WebSocket(streamUrl);
      
      const connectionId = `${taskId}_${Date.now()}`;
      const connection = {
        id: connectionId,
        projectId,
        taskId,
        ws,
        url: streamUrl,
        connected: false,
        reconnectAttempts: 0,
        maxReconnectAttempts: 5,
        reconnectDelay: 1000
      };

      this.connections.set(taskId, connection);

      // Handle connection events
      ws.on('open', () => {
        console.log(`[WebSocket] Connected to ${streamUrl} for task ${taskId}`);
        connection.connected = true;
        connection.reconnectAttempts = 0;
        this.emit('stream-connected', { projectId, taskId, connectionId });
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleStreamMessage(projectId, taskId, message);
        } catch (error) {
          console.error(`[WebSocket] Failed to parse message for task ${taskId}:`, error);
        }
      });

      ws.on('close', () => {
        console.log(`[WebSocket] Disconnected from ${streamUrl} for task ${taskId}`);
        connection.connected = false;
        this.emit('stream-disconnected', { projectId, taskId, connectionId });
        
        // Attempt reconnection
        this.attemptReconnection(connection);
      });

      ws.on('error', (error) => {
        console.error(`[WebSocket] Error for task ${taskId}:`, error);
        connection.error = error.message;
        this.emit('stream-error', { projectId, taskId, connectionId, error: error.message });
      });

      // Wait for connection or timeout
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        ws.once('open', () => {
          clearTimeout(timeout);
          resolve();
        });

        ws.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      return {
        connectionId,
        url: streamUrl
      };

    } catch (error) {
      console.error(`[WebSocket] Failed to connect to stream for task ${taskId}:`, error);
      this.connections.delete(taskId);
      throw error;
    }
  }

  async getStreamUrlForProject(projectId, taskId) {
    // Mock implementation - in real implementation, this would query the actual project service
    const projectStreamUrls = {
      'open-computer-use': `ws://localhost:8001/ws/tasks/${taskId}`,
      'ui-tars-desktop': `ws://localhost:9001/stream/${taskId}`,
      'gbox': `ws://localhost:8080/ws/execution/${taskId}`,
      'bytebot': `ws://localhost:3001/ws/tasks/${taskId}`
    };

    return projectStreamUrls[projectId] || null;
  }

  async startMockWebSocketServer(projectId, port) {
    // Create a mock WebSocket server for testing
    const server = http.createServer();
    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws, req) => {
      const pathname = url.parse(req.url).pathname;
      const taskId = pathname.split('/').pop();
      
      console.log(`[MockWebSocket] Client connected for task ${taskId}`);
      
      // Store connection
      const connectionId = `${taskId}_${Date.now()}`;
      this.clients.set(connectionId, {
        ws,
        taskId,
        projectId
      });

      // Send initial message
      ws.send(JSON.stringify({
        type: 'connected',
        taskId,
        timestamp: new Date().toISOString()
      }));

      // Mock task progress updates
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 10;
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'progress',
            taskId,
            progress,
            message: `Processing... ${progress}%`,
            timestamp: new Date().toISOString()
          }));
        }
        
        if (progress >= 100) {
          clearInterval(progressInterval);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'completed',
              result: {
                taskId,
              message: 'Task completed successfully',
                output: 'Mock output data',
                timestamp: new Date().toISOString()
              }
            }));
          }
        }
      }, 2000);

      ws.on('close', () => {
        console.log(`[MockWebSocket] Client disconnected for task ${taskId}`);
        clearInterval(progressInterval);
        this.clients.delete(connectionId);
      });

      ws.on('error', (error) => {
        console.error(`[MockWebSocket] Error for task ${taskId}:`, error);
        clearInterval(progressInterval);
      });
    });

    return new Promise((resolve, reject) => {
      server.listen(port, () => {
        console.log(`[MockWebSocket] Server started on port ${port} for ${projectId}`);
        this.servers.set(projectId, server);
        resolve(server);
      });

      server.on('error', reject);
    });
  }

  handleStreamMessage(projectId, taskId, message) {
    // Emit message to renderer process
    this.emit('stream-message', {
      projectId,
      taskId,
      message
    });

    // Handle specific message types
    switch (message.type) {
      case 'progress':
        this.emit('task-progress', { projectId, taskId, progress: message.progress });
        break;
      case 'output':
        this.emit('task-output', { projectId, taskId, output: message.data });
        break;
      case 'error':
        this.emit('task-error', { projectId, taskId, error: message.error });
        break;
      case 'completed':
        this.emit('task-completed', { projectId, taskId, result: message.result });
        break;
    }
  }

  attemptReconnection(connection) {
    if (connection.reconnectAttempts >= connection.maxReconnectAttempts) {
      console.log(`[WebSocket] Max reconnection attempts reached for task ${connection.taskId}`);
      this.connections.delete(connection.taskId);
      return;
    }

    connection.reconnectAttempts++;
    const delay = connection.reconnectDelay * Math.pow(2, connection.reconnectAttempts - 1);
    
    console.log(`[WebSocket] Reconnecting to ${connection.url} in ${delay}ms (attempt ${connection.reconnectAttempts})`);
    
    setTimeout(async () => {
      try {
        const ws = new WebSocket(connection.url);
        connection.ws = ws;
        
        ws.on('open', () => {
          console.log(`[WebSocket] Reconnected to ${connection.url} for task ${connection.taskId}`);
          connection.connected = true;
          connection.reconnectAttempts = 0;
        });
        
        ws.on('error', (error) => {
          console.error(`[WebSocket] Reconnection error for task ${connection.taskId}:`, error);
          this.attemptReconnection(connection);
        });
        
        // Copy event handlers
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleStreamMessage(connection.projectId, connection.taskId, message);
          } catch (error) {
            console.error(`[WebSocket] Failed to parse reconnection message:`, error);
          }
        });
        
        ws.on('close', () => {
          connection.connected = false;
          this.attemptReconnection(connection);
        });
        
      } catch (error) {
        console.error(`[WebSocket] Reconnection failed for task ${connection.taskId}:`, error);
        this.attemptReconnection(connection);
      }
    }, delay);
  }

  disconnectTaskStream(taskId) {
    const connection = this.connections.get(taskId);
    if (!connection) {
      return;
    }

    try {
      if (connection.ws && connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.close();
      }
    } catch (error) {
      console.warn(`[WebSocket] Error closing connection for task ${taskId}:`, error);
    }

    this.connections.delete(taskId);
    this.emit('stream-disconnected', { taskId });
  }

  sendMessageToTask(taskId, message) {
    const connection = this.connections.get(taskId);
    if (!connection || !connection.connected) {
      throw new Error(`No active connection for task ${taskId}`);
    }

    try {
      connection.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`[WebSocket] Failed to send message to task ${taskId}:`, error);
      throw error;
    }
  }

  getConnectionStatus(taskId) {
    const connection = this.connections.get(taskId);
    if (!connection) {
      return { connected: false, reason: 'No connection' };
    }

    return {
      connected: connection.connected,
      url: connection.url,
      projectId: connection.projectId,
      reconnectAttempts: connection.reconnectAttempts,
      error: connection.error
    };
  }

  getAllConnections() {
    const connections = [];
    for (const [taskId, connection] of this.connections) {
      connections.push({
        taskId,
        projectId: connection.projectId,
        connected: connection.connected,
        url: connection.url,
        reconnectAttempts: connection.reconnectAttempts
      });
    }
    return connections;
  }

  disconnectAll() {
    // Close all task connections
    for (const [taskId, connection] of this.connections) {
      try {
        if (connection.ws && connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.close();
        }
      } catch (error) {
        console.warn(`[WebSocket] Error closing connection for task ${taskId}:`, error);
      }
    }
    this.connections.clear();

    // Close all servers
    for (const [projectId, server] of this.servers) {
      try {
        server.close();
      } catch (error) {
        console.warn(`[WebSocket] Error closing server for ${projectId}:`, error);
      }
    }
    this.servers.clear();

    this.clients.clear();
  }

  // Utility method to find available port
  async findAvailablePort(startPort = 9000) {
    const net = require('net');
    
    for (let port = startPort; port < startPort + 100; port++) {
      const available = await new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, () => {
          server.once('close', () => resolve(true));
          server.close();
        });
        server.on('error', () => resolve(false));
      });
      
      if (available) {
        return port;
      }
    }
    
    throw new Error('No available ports found');
  }
}

module.exports = WebSocketManager;
