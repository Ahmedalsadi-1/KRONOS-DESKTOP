import { BaseTest } from '../../core/BaseTest';
import { TestMetrics, AgentConfig, AgentInteraction } from '../../types';
import { MCPClient } from '../../core/MCPClient';

export class AgentInteractionTest extends BaseTest {
  private targetAgents: AgentConfig[];
  private interactionScenarios: AgentInteraction[];

  constructor(
    sourceAgent: AgentConfig,
    targetAgents: AgentConfig[],
    scenarios?: AgentInteraction[]
  ) {
    super(sourceAgent, 'AgentInteractionTest');
    this.targetAgents = targetAgents;
    this.interactionScenarios = scenarios || this.getDefaultScenarios();
  }

  protected async executeTest(): Promise<TestMetrics> {
    const latencies: number[] = [];
    let totalMessages = 0;
    let errorCount = 0;

    // Create clients for target agents
    const targetClients = this.targetAgents.map(config => new MCPClient(config));

    // Test each interaction scenario
    for (const scenario of this.interactionScenarios) {
      try {
        this.logger.info(`Testing interaction: ${scenario.fromAgent} -> ${scenario.toAgent}`);

        const startTime = Date.now();

        // Find the appropriate client
        const targetClient = targetClients.find(client =>
          client['config'].name === scenario.toAgent
        );

        if (!targetClient) {
          throw new Error(`No client found for target agent ${scenario.toAgent}`);
        }

        // Execute the interaction
        const response = await targetClient.sendMessage(scenario.message);

        const endTime = Date.now();
        latencies.push(endTime - startTime);
        totalMessages++;

        // Verify expected response if specified
        if (scenario.expectedResponse) {
          this.verifyResponse(response, scenario.expectedResponse);
        }

        this.logger.info(`Interaction successful: ${scenario.fromAgent} -> ${scenario.toAgent}`);

      } catch (error) {
        errorCount++;
        this.logger.error(`Interaction failed: ${scenario.fromAgent} -> ${scenario.toAgent}`, error);
      }
    }

    return this.calculateMetrics(totalMessages, errorCount, latencies);
  }

  private getDefaultScenarios(): AgentInteraction[] {
    return [
      {
        fromAgent: 'agent-orchestrator',
        toAgent: 'onlysnarf',
        message: {
          method: 'get_status',
          params: {}
        },
        expectedResponse: { status: 'ready' }
      },
      {
        fromAgent: 'agent-orchestrator',
        toAgent: 'instapy',
        message: {
          method: 'health_check',
          params: {}
        }
      },
      {
        fromAgent: 'onlysnarf',
        toAgent: 'agent-orchestrator',
        message: {
          method: 'report_status',
          params: { agent: 'onlysnarf', status: 'active' }
        }
      },
      {
        fromAgent: 'agent-orchestrator',
        toAgent: 'tiktok_api',
        message: {
          method: 'get_inventory',
          params: {}
        }
      }
    ];
  }

  private verifyResponse(actualResponse: any, expectedResponse: any): void {
    // Simple response verification
    if (typeof expectedResponse === 'object') {
      for (const [key, value] of Object.entries(expectedResponse)) {
        if (actualResponse.result && actualResponse.result[key] !== value) {
          this.logger.warn(`Response verification failed for key ${key}`, {
            expected: value,
            actual: actualResponse.result[key]
          });
        }
      }
    }
  }
}

export class MultiAgentWorkflowTest extends BaseTest {
  private workflowSteps: AgentInteraction[];

  constructor(
    orchestrator: AgentConfig,
    workflowSteps: AgentInteraction[]
  ) {
    super(orchestrator, 'MultiAgentWorkflowTest');
    this.workflowSteps = workflowSteps;
  }

  protected async executeTest(): Promise<TestMetrics> {
    const latencies: number[] = [];
    let totalMessages = 0;
    let errorCount = 0;

    this.logger.info('Starting multi-agent workflow test');

    // Execute workflow steps in sequence
    for (let i = 0; i < this.workflowSteps.length; i++) {
      const step = this.workflowSteps[i];

      try {
        this.logger.info(`Executing workflow step ${i + 1}/${this.workflowSteps.length}: ${step.fromAgent} -> ${step.toAgent}`);

        const startTime = Date.now();

        // For this test, we'll simulate the interaction
        // In a real implementation, you'd have clients for each agent
        await this.simulateAgentInteraction(step);

        const endTime = Date.now();
        latencies.push(endTime - startTime);
        totalMessages++;

        // Add delay between steps to simulate processing time
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        errorCount++;
        this.logger.error(`Workflow step ${i + 1} failed`, error);

        // Decide whether to continue or fail the entire workflow
        if (step.message.params?.continueOnError !== true) {
          throw error;
        }
      }
    }

    this.logger.info('Multi-agent workflow test completed');
    return this.calculateMetrics(totalMessages, errorCount, latencies);
  }

  private async simulateAgentInteraction(step: AgentInteraction): Promise<void> {
    // Simulate agent interaction with timeout
    const timeout = step.timeout || 5000;

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Agent interaction timeout: ${step.fromAgent} -> ${step.toAgent}`));
      }, timeout);

      // Simulate successful interaction
      setTimeout(() => {
        clearTimeout(timer);
        resolve(undefined);
      }, Math.random() * 1000 + 500); // Random delay between 500-1500ms
    });
  }
}