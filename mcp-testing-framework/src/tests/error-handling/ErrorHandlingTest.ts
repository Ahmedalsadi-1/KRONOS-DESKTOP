import { BaseTest } from '../../core/BaseTest';
import { TestMetrics, AgentConfig, ErrorType, ErrorTestCase } from '../../types';

export class ErrorHandlingTest extends BaseTest {
  private testCases: ErrorTestCase[];

  constructor(config: AgentConfig) {
    super(config, 'ErrorHandlingTest');
    this.testCases = this.defineTestCases();
  }

  protected async executeTest(): Promise<TestMetrics> {
    const latencies: number[] = [];
    let totalMessages = 0;
    let errorCount = 0;

    for (const testCase of this.testCases) {
      try {
        this.logger.info(`Running error test case: ${testCase.type}`);

        const startTime = Date.now();
        await this.executeErrorTest(testCase);
        const endTime = Date.now();

        latencies.push(endTime - startTime);
        totalMessages++;

        // Verify expected behavior after triggering error
        await this.verifyErrorBehavior(testCase);

      } catch (error) {
        errorCount++;
        this.logger.warn(`Error test case ${testCase.type} failed as expected`, error);
      }
    }

    return this.calculateMetrics(totalMessages, errorCount, latencies);
  }

  private defineTestCases(): ErrorTestCase[] {
    return [
      {
        type: ErrorType.TIMEOUT,
        trigger: async () => {
          // Send a request with a very short timeout
          await this.client.sendMessage({
            method: 'slow_operation',
            params: { delay: 10000 } // 10 seconds
          });
        },
        expectedBehavior: 'Should timeout and handle gracefully'
      },
      {
        type: ErrorType.CONNECTION_REFUSED,
        trigger: async () => {
          // Try to connect to a non-existent port
          const tempClient = new (require('../../core/MCPClient')).MCPClient({
            ...this.config,
            url: 'http://localhost:99999' // Non-existent port
          });
          await tempClient.sendMessage({ method: 'status' });
        },
        expectedBehavior: 'Should handle connection refused error'
      },
      {
        type: ErrorType.INVALID_RESPONSE,
        trigger: async () => {
          // This would require mocking the server response
          // For now, we'll test with malformed parameters
          await this.client.sendMessage({
            method: 'invalid_method',
            params: { malformed: true }
          });
        },
        expectedBehavior: 'Should handle invalid method gracefully'
      },
      {
        type: ErrorType.SERVER_ERROR,
        trigger: async () => {
          // Send request that causes server error
          await this.client.sendMessage({
            method: 'cause_error',
            params: { errorType: 'server_error' }
          });
        },
        expectedBehavior: 'Should handle server errors appropriately'
      }
    ];
  }

  private async executeErrorTest(testCase: ErrorTestCase): Promise<void> {
    await testCase.trigger();
  }

  private async verifyErrorBehavior(testCase: ErrorTestCase): Promise<void> {
    // Verify the system behaves as expected after the error
    // This could include checking logs, health status, etc.
    this.logger.info(`Verifying behavior for ${testCase.type}: ${testCase.expectedBehavior}`);

    // Check if the agent is still healthy after the error
    const isHealthy = await this.client.healthCheck();
    if (!isHealthy) {
      this.logger.warn(`Agent became unhealthy after ${testCase.type} test`);
    }
  }
}

export class RecoveryTest extends BaseTest {
  constructor(config: AgentConfig) {
    super(config, 'RecoveryTest');
  }

  protected async executeTest(): Promise<TestMetrics> {
    const latencies: number[] = [];
    let totalMessages = 0;
    let errorCount = 0;

    // Phase 1: Normal operation
    this.logger.info('Phase 1: Testing normal operation');
    for (let i = 0; i < 10; i++) {
      try {
        const startTime = Date.now();
        await this.client.sendMessage({ method: 'status' });
        const endTime = Date.now();
        latencies.push(endTime - startTime);
        totalMessages++;
      } catch (error) {
        errorCount++;
      }
    }

    // Phase 2: Induce failure
    this.logger.info('Phase 2: Inducing failure');
    try {
      await this.client.sendMessage({
        method: 'cause_failure',
        params: { temporary: true }
      });
    } catch (error) {
      this.logger.info('Failure induced successfully');
    }

    // Phase 3: Test recovery
    this.logger.info('Phase 3: Testing recovery');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for recovery

    for (let i = 0; i < 10; i++) {
      try {
        const startTime = Date.now();
        await this.client.sendMessage({ method: 'status' });
        const endTime = Date.now();
        latencies.push(endTime - startTime);
        totalMessages++;
      } catch (error) {
        errorCount++;
      }
    }

    return this.calculateMetrics(totalMessages, errorCount, latencies);
  }
}