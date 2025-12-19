import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { MCPMessage, MCPResponse, MCPError, AgentConfig } from '../types';
import { Logger } from '../utils/logger';

export class MCPClient {
  private httpClient: AxiosInstance;
  private config: AgentConfig;
  private logger: Logger;
  private messageId: number = 1;

  constructor(config: AgentConfig) {
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
  }

  async sendMessage(message: Omit<MCPMessage, 'id' | 'jsonrpc'>): Promise<MCPResponse> {
    const fullMessage: MCPMessage = {
      ...message,
      id: this.generateId(),
      jsonrpc: '2.0'
    };

    this.logger.debug(`Sending message to ${this.config.name}`, fullMessage);

    return this.sendHttpMessage(fullMessage);
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

  private generateId(): string {
    return `${this.config.name}-${Date.now()}-${this.messageId++}`;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/health');
      return response.status === 200;
    } catch (error) {
      this.logger.warn(`Health check failed for ${this.config.name}`, error);
      return false;
    }
  }

  isConnected(): boolean {
    return true; // HTTP clients are always "connected"
  }
}