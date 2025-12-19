import axios, { AxiosInstance, AxiosResponse } from 'axios';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { MCPMessage, MCPResponse, MCPError, AgentConfig } from '../types';
import { Logger } from '../utils/logger';

export class MCPClient extends EventEmitter {
  private httpClient: AxiosInstance;
  private wsClient?: WebSocket;
  private config: AgentConfig;
  private logger: Logger;
  private messageId: number = 1;
  private pendingRequests: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();

  constructor(config: AgentConfig) {
    super();
    this.config = config;
    this.logger = new Logger(`MCPClient-${config.name}`);

    // Setup HTTP client
    this.httpClient = axios.create({
      baseURL: config.url,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Setup WebSocket if needed
    if (config.protocol === 'websocket') {
      this.setupWebSocket();
    }
  }

  private setupWebSocket(): void {
    if (!this.config.port) {
      throw new Error('WebSocket protocol requires a port configuration');
    }

    const wsUrl = `ws://localhost:${this.config.port}`;
    this.wsClient = new WebSocket(wsUrl);

    this.wsClient.on('open', () => {
      this.logger.info(`WebSocket connected to ${this.config.name}`);
      this.emit('connected');
    });

    this.wsClient.on('message', (data: Buffer) => {
      try {
        const response: MCPResponse = JSON.parse(data.toString());
        this.handleResponse(response);
      } catch (error) {
        this.logger.error('Failed to parse WebSocket message', error);
      }
    });

    this.wsClient.on('error', (error) => {
      this.logger.error('WebSocket error', error);
      this.emit('error', error);
    });

    this.wsClient.on('close', () => {
      this.logger.info(`WebSocket disconnected from ${this.config.name}`);
      this.emit('disconnected');
    });
  }

  async sendMessage(message: Omit<MCPMessage, 'id' | 'jsonrpc'>): Promise<MCPResponse> {
    const fullMessage: MCPMessage = {
      ...message,
      id: this.generateId(),
      jsonrpc: '2.0'
    };

    this.logger.debug(`Sending message to ${this.config.name}`, fullMessage);

    if (this.config.protocol === 'websocket' && this.wsClient?.readyState === WebSocket.OPEN) {
      return this.sendWebSocketMessage(fullMessage);
    } else {
      return this.sendHttpMessage(fullMessage);
    }
  }

  private async sendHttpMessage(message: MCPMessage): Promise<MCPResponse> {
    try {
      const response: AxiosResponse<MCPResponse> = await this.httpClient.post('', message);
      return response.data;
    } catch (error: any) {
      if (error.response) {
        // Server responded with error status
        const mcpError: MCPError = {
          code: error.response.status,
          message: error.response.data?.error?.message || 'HTTP Error',
          data: error.response.data
        };
        throw mcpError;
      } else if (error.code === 'ECONNREFUSED') {
        throw {
          code: -32000,
          message: 'Connection refused',
          data: { originalError: error.message }
        } as MCPError;
      } else {
        throw {
          code: -32603,
          message: 'Network error',
          data: { originalError: error.message }
        } as MCPError;
      }
    }
  }

  private async sendWebSocketMessage(message: MCPMessage): Promise<MCPResponse> {
    return new Promise((resolve, reject) => {
      if (!this.wsClient || this.wsClient.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(message.id);
        reject({
          code: -32001,
          message: 'Request timeout',
          data: { requestId: message.id }
        } as MCPError);
      }, this.config.timeout);

      this.pendingRequests.set(message.id, { resolve, reject, timeout });

      try {
        this.wsClient.send(JSON.stringify(message));
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(message.id);
        reject(error);
      }
    });
  }

  private handleResponse(response: MCPResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(response.id);

      if (response.error) {
        pending.reject(response.error);
      } else {
        pending.resolve(response);
      }
    } else {
      // Handle unsolicited response or notification
      this.emit('notification', response);
    }
  }

  private generateId(): string {
    return `${this.config.name}-${Date.now()}-${this.messageId++}`;
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (this.config.protocol === 'websocket') {
        return this.wsClient?.readyState === WebSocket.OPEN || false;
      } else {
        const response = await this.httpClient.get('/health');
        return response.status === 200;
      }
    } catch (error) {
      this.logger.warn(`Health check failed for ${this.config.name}`, error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    // Clear all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Client disconnected'));
    }
    this.pendingRequests.clear();

    // Close WebSocket if exists
    if (this.wsClient) {
      this.wsClient.close();
    }

    this.logger.info(`Disconnected from ${this.config.name}`);
  }

  isConnected(): boolean {
    if (this.config.protocol === 'websocket') {
      return this.wsClient?.readyState === WebSocket.OPEN || false;
    }
    return true; // HTTP clients are always "connected"
  }
}