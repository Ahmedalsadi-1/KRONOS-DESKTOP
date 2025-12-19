import { BaseTest } from '../../core/BaseTest';
import { TestMetrics, AgentConfig } from '../../types';

export class ThroughputTest extends BaseTest {
  private messageCount: number;
  private duration: number; // in seconds

  constructor(config: AgentConfig, messageCount: number = 1000, duration: number = 60) {
    super(config, `ThroughputTest-${messageCount}msg-${duration}s`);
    this.messageCount = messageCount;
    this.duration = duration;
  }

  protected async executeTest(): Promise<TestMetrics> {
    const latencies: number[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Health check first
    const isHealthy = await this.client.healthCheck();
    if (!isHealthy) {
      throw new Error(`Agent ${this.config.name} is not healthy`);
    }

    const startTime = Date.now();
    const endTime = startTime + (this.duration * 1000);

    for (let i = 0; i < this.messageCount && Date.now() < endTime; i++) {
      try {
        const messageStart = Date.now();
        await this.client.sendMessage({
          method: 'status', // Generic status check
          params: {}
        });
        const messageEnd = Date.now();

        latencies.push(messageEnd - messageStart);
        successCount++;

        // Small delay to prevent overwhelming the agent
        await new Promise(resolve => setTimeout(resolve, 10));
      } catch (error) {
        errorCount++;
        this.logger.warn(`Message ${i} failed`, error);
      }
    }

    return this.calculateMetrics(successCount + errorCount, errorCount, latencies);
  }
}

export class LoadTest extends BaseTest {
  private concurrentConnections: number;
  private messageRate: number; // messages per second per connection
  private duration: number; // in seconds

  constructor(
    config: AgentConfig,
    concurrentConnections: number = 10,
    messageRate: number = 10,
    duration: number = 30
  ) {
    super(config, `LoadTest-${concurrentConnections}conn-${messageRate}msgps-${duration}s`);
    this.concurrentConnections = concurrentConnections;
    this.messageRate = messageRate;
    this.duration = duration;
  }

  protected async executeTest(): Promise<TestMetrics> {
    const allLatencies: number[] = [];
    let totalSuccessCount = 0;
    let totalErrorCount = 0;

    // Health check first
    const isHealthy = await this.client.healthCheck();
    if (!isHealthy) {
      throw new Error(`Agent ${this.config.name} is not healthy`);
    }

    // Create multiple concurrent connections
    const promises = Array.from({ length: this.concurrentConnections }, async (_, index) => {
      const latencies: number[] = [];
      let successCount = 0;
      let errorCount = 0;

      const startTime = Date.now();
      const endTime = startTime + (this.duration * 1000);
      const interval = 1000 / this.messageRate; // milliseconds between messages

      let nextMessageTime = startTime;

      while (Date.now() < endTime) {
        const now = Date.now();
        if (now >= nextMessageTime) {
          try {
            const messageStart = now;
            await this.client.sendMessage({
              method: 'status',
              params: { connectionId: index }
            });
            const messageEnd = Date.now();

            latencies.push(messageEnd - messageStart);
            successCount++;
          } catch (error) {
            errorCount++;
            this.logger.warn(`Connection ${index} message failed`, error);
          }

          nextMessageTime += interval;
        } else {
          // Wait until next message time
          await new Promise(resolve => setTimeout(resolve, nextMessageTime - now));
        }
      }

      return { latencies, successCount, errorCount };
    });

    const results = await Promise.all(promises);

    // Aggregate results
    results.forEach(result => {
      allLatencies.push(...result.latencies);
      totalSuccessCount += result.successCount;
      totalErrorCount += result.errorCount;
    });

    return this.calculateMetrics(totalSuccessCount + totalErrorCount, totalErrorCount, allLatencies);
  }
}