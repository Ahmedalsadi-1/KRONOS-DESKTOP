import { BaseTest } from '../../core/BaseTest';
import { TestMetrics, AgentConfig, StreamingTestConfig } from '../../types';

export class StreamingTest extends BaseTest {
  private streamingConfig: StreamingTestConfig;

  constructor(agentConfig: AgentConfig, streamingConfig: StreamingTestConfig) {
    super(agentConfig, 'StreamingTest');
    this.streamingConfig = streamingConfig;
  }

  protected async executeTest(): Promise<TestMetrics> {
    const latencies: number[] = [];
    let totalMessages = 0;
    let errorCount = 0;

    // Test concurrent streaming connections
    const streamPromises = Array.from({ length: this.streamingConfig.concurrentStreams }, async (_, streamId) => {
      return this.runStreamingSession(streamId);
    });

    const results = await Promise.all(streamPromises);

    // Aggregate results
    results.forEach(result => {
      latencies.push(...result.latencies);
      totalMessages += result.messageCount;
      errorCount += result.errorCount;
    });

    return this.calculateMetrics(totalMessages, errorCount, latencies);
  }

  private async runStreamingSession(streamId: number): Promise<{
    latencies: number[];
    messageCount: number;
    errorCount: number;
  }> {
    const latencies: number[] = [];
    let messageCount = 0;
    let errorCount = 0;

    const startTime = Date.now();
    const endTime = startTime + (this.streamingConfig.streamDuration * 1000);

    this.logger.info(`Starting streaming session ${streamId}`);

    while (Date.now() < endTime) {
      try {
        const chunk = this.generateDataChunk();
        const startTime = Date.now();

        await this.client.sendMessage({
          method: 'stream_data',
          params: {
            streamId,
            data: chunk,
            sequence: messageCount
          }
        });

        const endTime = Date.now();
        latencies.push(endTime - startTime);
        messageCount++;

        // Simulate streaming delay
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        errorCount++;
        this.logger.warn(`Streaming error in session ${streamId}`, error);

        // Break on too many consecutive errors
        if (errorCount > 5) {
          this.logger.error(`Too many errors in streaming session ${streamId}, aborting`);
          break;
        }
      }
    }

    this.logger.info(`Completed streaming session ${streamId}: ${messageCount} messages, ${errorCount} errors`);
    return { latencies, messageCount, errorCount };
  }

  private generateDataChunk(): string {
    // Generate a chunk of data of specified size
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < this.streamingConfig.chunkSize; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

export class RealTimeStreamingTest extends BaseTest {
  private streamingConfig: StreamingTestConfig;

  constructor(agentConfig: AgentConfig, streamingConfig: StreamingTestConfig) {
    super(agentConfig, 'RealTimeStreamingTest');
    this.streamingConfig = streamingConfig;
  }

  protected async executeTest(): Promise<TestMetrics> {
    const latencies: number[] = [];
    let totalMessages = 0;
    let errorCount = 0;

    // Test real-time streaming with continuous data flow
    const startTime = Date.now();
    const endTime = startTime + (this.streamingConfig.streamDuration * 1000);

    let sequenceNumber = 0;

    while (Date.now() < endTime) {
      try {
        const messageStart = Date.now();

        // Send real-time data stream
        await this.client.sendMessage({
          method: 'realtime_stream',
          params: {
            timestamp: new Date().toISOString(),
            sequence: sequenceNumber++,
            data: this.generateRealTimeData()
          }
        });

        const messageEnd = Date.now();
        latencies.push(messageEnd - messageStart);
        totalMessages++;

        // Minimal delay for real-time simulation
        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (error) {
        errorCount++;
        this.logger.warn('Real-time streaming error', error);
      }
    }

    return this.calculateMetrics(totalMessages, errorCount, latencies);
  }

  private generateRealTimeData(): any {
    return {
      sensorData: {
        temperature: 20 + Math.random() * 10,
        humidity: 30 + Math.random() * 40,
        pressure: 1000 + Math.random() * 50
      },
      timestamp: Date.now(),
      quality: Math.random() > 0.1 ? 'good' : 'poor' // 90% good quality
    };
  }
}