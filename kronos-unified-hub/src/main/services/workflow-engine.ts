import { v4 as uuidv4 } from 'uuid';

export interface WorkflowStep {
  id: string;
  app: string;
  action: string;
  params?: Record<string, any>;
  condition?: string;
  retryCount?: number;
  timeout?: number;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  schedule?: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  stepResults: Map<string, any>;
  error?: string;
}

export class WorkflowEngine {
  private workflows: Map<string, Workflow> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private executionSchedules: Map<string, NodeJS.Timeout> = new Map();

  async createWorkflow(workflowData: Partial<Workflow>): Promise<Workflow> {
    const workflow: Workflow = {
      id: uuidv4(),
      name: workflowData.name || 'Untitled Workflow',
      description: workflowData.description,
      steps: workflowData.steps || [],
      schedule: workflowData.schedule,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.workflows.set(workflow.id, workflow);

    // Schedule workflow if schedule is provided
    if (workflow.schedule) {
      this.scheduleWorkflow(workflow.id);
    }

    return workflow;
  }

  async executeWorkflow(workflowId: string): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow '${workflowId}' not found`);
    }

    const execution: WorkflowExecution = {
      id: uuidv4(),
      workflowId,
      status: 'running',
      startTime: new Date(),
      stepResults: new Map(),
    };

    this.executions.set(execution.id, execution);

    try {
      // Execute each step
      for (const step of workflow.steps) {
        try {
          const result = await this.executeStep(step, execution);
          execution.stepResults.set(step.id, result);
        } catch (error) {
          if (step.retryCount && step.retryCount > 0) {
            // Retry logic
            for (let i = 0; i < step.retryCount; i++) {
              try {
                const result = await this.executeStep(step, execution);
                execution.stepResults.set(step.id, result);
                break;
              } catch (retryError) {
                if (i === step.retryCount - 1) {
                  throw retryError;
                }
                // Wait before retry
                await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
              }
            }
          } else {
            throw error;
          }
        }
      }

      execution.status = 'completed';
      execution.endTime = new Date();
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : String(error);
      execution.endTime = new Date();
    }

    return execution;
  }

  private async executeStep(step: WorkflowStep, execution: WorkflowExecution): Promise<any> {
    // This would integrate with the app launcher to execute actions
    // For now, return a mock result
    return {
      stepId: step.id,
      app: step.app,
      action: step.action,
      timestamp: new Date(),
      success: true,
    };
  }

  private scheduleWorkflow(workflowId: string): void {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || !workflow.schedule) {
      return;
    }

    // Parse schedule (simplified - supports 'daily-HHmm' format)
    const scheduleMatch = workflow.schedule.match(/daily-(\d{2})(\d{2})/);
    if (!scheduleMatch) {
      return;
    }

    const [, hours, minutes] = scheduleMatch;
    const scheduledTime = `${hours}:${minutes}`;

    // Schedule workflow execution
    const timeout = this.calculateNextExecutionTime(scheduledTime);
    const interval = setInterval(() => {
      this.executeWorkflow(workflowId).catch((error) => {
        console.error(`Failed to execute scheduled workflow '${workflowId}':`, error);
      });
    }, 24 * 60 * 60 * 1000); // Daily

    this.executionSchedules.set(workflowId, interval);

    // Execute first time after calculated delay
    setTimeout(() => {
      this.executeWorkflow(workflowId).catch((error) => {
        console.error(`Failed to execute scheduled workflow '${workflowId}':`, error);
      });
    }, timeout);
  }

  private calculateNextExecutionTime(scheduledTime: string): number {
    const [hours, minutes] = scheduledTime.split(':').map(Number);
    const now = new Date();
    const scheduled = new Date();
    scheduled.setHours(hours, minutes, 0, 0);

    if (scheduled <= now) {
      scheduled.setDate(scheduled.getDate() + 1);
    }

    return scheduled.getTime() - now.getTime();
  }

  async updateWorkflow(workflowId: string, updates: Partial<Workflow>): Promise<Workflow> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow '${workflowId}' not found`);
    }

    Object.assign(workflow, updates, { updatedAt: new Date() });

    // Reschedule if schedule changed
    if (updates.schedule) {
      this.unscheduleWorkflow(workflowId);
      this.scheduleWorkflow(workflowId);
    }

    return workflow;
  }

  async deleteWorkflow(workflowId: string): Promise<void> {
    this.unscheduleWorkflow(workflowId);
    this.workflows.delete(workflowId);
  }

  private unscheduleWorkflow(workflowId: string): void {
    const timeout = this.executionSchedules.get(workflowId);
    if (timeout) {
      clearInterval(timeout);
      this.executionSchedules.delete(workflowId);
    }
  }

  listWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  async getWorkflowHistory(workflowId: string): Promise<WorkflowExecution[]> {
    return Array.from(this.executions.values()).filter((exec) => exec.workflowId === workflowId);
  }

  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }
}
