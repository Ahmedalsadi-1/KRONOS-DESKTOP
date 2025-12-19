import { MCPClient } from './MCPClient';
import { AgentConfig, TestResult, TestMetrics } from '../types';
import { Logger } from '../utils/logger';

export abstract class BaseTest {
  protected client: MCPClient;
  protected logger: Logger;
  protected startTime: number = 0;
  protected endTime: number = 0;

  constructor(protected config: AgentConfig, protected testName: string) {
    this.client = new MCPClient(config);
    this.logger = new Logger(`${testName}-${config.name}`);
  }

  async run(): Promise<TestResult> {
    this.startTime = Date.now();

    try {
      this.logger.info(`Starting test: ${this.testName}`);
      const metrics = await this.executeTest();
      this.endTime = Date.now();

      const result: TestResult = {
        testName: this.testName,
        duration: this.endTime - this.startTime,
        success: true,
        metrics
      };

      this.logger.info(`Test completed successfully: ${this.testName}`, {
        duration: result.duration,
        metrics
      });

      return result;
    } catch (error) {
      this.endTime = Date.now();

      const result: TestResult = {
        testName: this.testName,
        duration: this.endTime - this.startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };

      this.logger.error(`Test failed: ${this.testName}`, error);
      return result;
    }
  }

  protected abstract executeTest(): Promise<TestMetrics>;

  protected calculateMetrics(
    totalMessages: number,
    errors: number,
    latencies: number[]
  ): TestMetrics {
    const averageLatency = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;

    const duration = (this.endTime - this.startTime) / 1000; // in seconds
    const messagesPerSecond = totalMessages / duration;

    return {
      messagesPerSecond,
      averageLatency,
      totalMessages,
      errorCount: errors,
      throughput: messagesPerSecond,
      memoryUsage: process.memoryUsage()
    };
  }
}