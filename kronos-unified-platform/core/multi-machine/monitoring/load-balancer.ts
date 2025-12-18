import { ConnectionManager } from '../connection-manager';
import { ResourceMonitor, ResourceUsage } from './resource-monitor';

/**
 * Load Balancer for Multi-Machine Task Distribution
 * 
 * Intelligently distributes tasks across connected machines based on
 * resource availability, performance metrics, and task requirements
 */
export interface LoadBalancingStrategy {
  name: string;
  description: string;
  weight: number;
}

export interface TaskRequirements {
  cpu?: number;
  memory?: number;
  maxExecutionTime?: number;
  protocol?: 'ssh' | 'rdp' | 'vnc';
  priority?: 'low' | 'normal' | 'high' | 'critical';
  estimatedDuration?: number;
  dependencies?: string[];
}

export interface MachineScore {
  machineId: string;
  score: number;
  availableCapacity: {
    cpu: number;
    memory: number;
  };
  currentLoad: {
    cpu: number;
    memory: number;
    disk: number;
  };
  performance: {
    avgResponseTime: number;
    reliability: number;
    throughput: number;
  };
  factors: {
    resourceAvailability: number;
    performance: number;
    reliability: number;
    load: number;
  };
}

export class LoadBalancer {
  private static readonly STRATEGIES: LoadBalancingStrategy[] = [
    {
      name: 'round_robin',
      description: 'Distribute tasks evenly across all machines',
      weight: 1.0
    },
    {
      name: 'least_loaded',
      description: 'Select machine with lowest current load',
      weight: 1.5
    },
    {
      name: 'resource_based',
      description: 'Select based on available CPU and memory',
      weight: 2.0
    },
    {
      name: 'performance_based',
      description: 'Select based on historical performance metrics',
      weight: 1.8
    },
    {
      name: 'adaptive',
      description: 'Adaptive selection combining multiple factors',
      weight: 2.5
    }
  ];

  private connectionManager: ConnectionManager;
  private resourceMonitor: ResourceMonitor;
  private currentStrategy: string = 'adaptive';
  private machineStatistics: Map<string, {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    totalExecutionTime: number;
    averageResponseTime: number;
    lastUsed: Date;
  }> = new Map();
  private taskHistory: Map<string, {
    machineId: string;
    startTime: Date;
    endTime?: Date;
    requirements: TaskRequirements;
    status: 'pending' | 'running' | 'completed' | 'failed';
  }> = new Map();
  private roundRobinIndex: number = 0;

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.resourceMonitor = new ResourceMonitor(connectionManager);
  }

  /**
   * Select optimal machine for task execution
   */
  async selectOptimalMachine(
    availableMachines: string[],
    requirements: TaskRequirements
  ): Promise<string | null> {
    if (availableMachines.length === 0) {
      return null;
    }

    // Filter machines based on requirements
    const eligibleMachines = this.filterMachinesByRequirements(availableMachines, requirements);
    
    if (eligibleMachines.length === 0) {
      console.warn('No machines meet the task requirements');
      return null;
    }

    // Score machines based on current strategy
    const machineScores = await this.scoreMachines(eligibleMachines, requirements);
    
    // Select best machine
    const bestMachine = this.selectBestMachine(machineScores);
    
    if (bestMachine) {
      console.log(`Selected machine ${bestMachine.machineId} for task (score: ${bestMachine.score.toFixed(2)})`);
      return bestMachine.machineId;
    }

    return null;
  }

  /**
   * Get machine recommendations for task requirements
   */
  async getMachineRecommendations(
    requirements: TaskRequirements,
    limit: number = 5
  ): Promise<MachineScore[]> {
    const availableMachines = this.connectionManager.getConnectedMachines();
    const eligibleMachines = this.filterMachinesByRequirements(availableMachines, requirements);
    const machineScores = await this.scoreMachines(eligibleMachines, requirements);
    
    return machineScores
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get current load balancing strategy
   */
  getCurrentStrategy(): LoadBalancingStrategy {
    return LoadBalancer.STRATEGIES.find(s => s.name === this.currentStrategy) || LoadBalancer.STRATEGIES[0];
  }

  /**
   * Set load balancing strategy
   */
  setStrategy(strategyName: string): void {
    const strategy = LoadBalancer.STRATEGIES.find(s => s.name === strategyName);
    if (strategy) {
      this.currentStrategy = strategyName;
      console.log(`Load balancing strategy set to: ${strategyName}`);
    } else {
      throw new Error(`Unknown strategy: ${strategyName}`);
    }
  }

  /**
   * Get available strategies
   */
  getAvailableStrategies(): LoadBalancingStrategy[] {
    return [...LoadBalancer.STRATEGIES];
  }

  /**
   * Record task execution start
   */
  recordTaskStart(taskId: string, machineId: string, requirements: TaskRequirements): void {
    this.taskHistory.set(taskId, {
      machineId,
      startTime: new Date(),
      requirements,
      status: 'running'
    });

    // Update machine statistics
    const stats = this.machineStatistics.get(machineId) || {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      totalExecutionTime: 0,
      averageResponseTime: 0,
      lastUsed: new Date()
    };
    
    stats.totalTasks++;
    stats.lastUsed = new Date();
    this.machineStatistics.set(machineId, stats);
  }

  /**
   * Record task execution completion
   */
  recordTaskCompletion(
    taskId: string,
    success: boolean,
    executionTime: number,
    responseTime?: number
  ): void {
    const task = this.taskHistory.get(taskId);
    if (!task) {
      return;
    }

    task.endTime = new Date();
    task.status = success ? 'completed' : 'failed';

    // Update machine statistics
    const machineStats = this.machineStatistics.get(task.machineId);
    if (machineStats) {
      if (success) {
        machineStats.completedTasks++;
      } else {
        machineStats.failedTasks++;
      }
      
      machineStats.totalExecutionTime += executionTime;
      if (responseTime !== undefined) {
        machineStats.averageResponseTime = 
          (machineStats.averageResponseTime + responseTime) / 2;
      }
    }
  }

  /**
   * Get machine load statistics
   */
  getMachineStatistics(machineId: string): any {
    return this.machineStatistics.get(machineId) || {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      totalExecutionTime: 0,
      averageResponseTime: 0,
      lastUsed: new Date()
    };
  }

  /**
   * Get all machine statistics
   */
  getAllMachineStatistics(): Record<string, any> {
    const stats: Record<string, any> = {};
    this.machineStatistics.forEach((value, key) => {
      stats[key] = value;
    });
    return stats;
  }

  /**
   * Get load balancing metrics
   */
  getLoadBalancingMetrics(): {
    strategy: string;
    totalTasks: number;
    successRate: number;
    averageExecutionTime: number;
    machineUtilization: Record<string, number>;
  } {
    const allStats = this.getAllMachineStatistics();
    const totalTasks = Object.values(allStats).reduce((sum: number, stats: any) => 
      sum + stats.totalTasks, 0);
    
    const totalCompleted = Object.values(allStats).reduce((sum: number, stats: any) => 
      sum + stats.completedTasks, 0);
    
    const successRate = totalTasks > 0 ? (totalCompleted / totalTasks) * 100 : 0;
    
    const avgExecutionTime = Object.values(allStats).length > 0
      ? Object.values(allStats).reduce((sum: number, stats: any) => 
          sum + stats.averageResponseTime, 0) / Object.values(allStats).length
      : 0;

    // Calculate machine utilization
    const machineUtilization: Record<string, number> = {};
    Object.entries(allStats).forEach(([machineId, stats]: [string, any]) => {
      machineUtilization[machineId] = stats.totalTasks;
    });

    return {
      strategy: this.currentStrategy,
      totalTasks,
      successRate,
      averageExecutionTime: avgExecutionTime,
      machineUtilization
    };
  }

  /**
   * Filter machines by requirements
   */
  private filterMachinesByRequirements(
    machines: string[],
    requirements: TaskRequirements
  ): string[] {
    return machines.filter(machineId => {
      const status = this.connectionManager.getMachineStatus(machineId);
      if (!status || !status.isConnected) {
        return false;
      }

      // Check protocol requirement
      if (requirements.protocol) {
        // This would require access to machine config
        // For now, we'll assume all connected machines support the required protocol
      }

      // Check resource requirements (simplified)
      const currentUsage = this.resourceMonitor.getCurrentResourceUsage(machineId);
      if (currentUsage) {
        if (requirements.cpu && currentUsage.cpu + requirements.cpu > 95) {
          return false;
        }
        if (requirements.memory && currentUsage.memory + requirements.memory > 95) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Score machines based on strategy and requirements
   */
  private async scoreMachines(
    machines: string[],
    requirements: TaskRequirements
  ): Promise<MachineScore[]> {
    const scores: MachineScore[] = [];

    for (const machineId of machines) {
      const score = await this.calculateMachineScore(machineId, requirements);
      scores.push(score);
    }

    return scores;
  }

  /**
   * Calculate score for individual machine
   */
  private async calculateMachineScore(
    machineId: string,
    requirements: TaskRequirements
  ): Promise<MachineScore> {
    const status = this.connectionManager.getMachineStatus(machineId);
    const currentUsage = this.resourceMonitor.getCurrentResourceUsage(machineId);
    const machineStats = this.getMachineStatistics(machineId);

    // Calculate resource availability (0-100)
    const resourceAvailability = this.calculateResourceAvailability(currentUsage, requirements);
    
    // Calculate performance score (0-100)
    const performance = this.calculatePerformanceScore(machineStats);
    
    // Calculate reliability score (0-100)
    const reliability = this.calculateReliabilityScore(machineStats);
    
    // Calculate current load score (inverse of load) (0-100)
    const load = this.calculateLoadScore(currentUsage);

    // Combine factors based on strategy
    let finalScore = 0;
    switch (this.currentStrategy) {
      case 'round_robin':
        finalScore = 100; // All machines get equal score
        break;
      case 'least_loaded':
        finalScore = load * 0.6 + resourceAvailability * 0.4;
        break;
      case 'resource_based':
        finalScore = resourceAvailability * 0.7 + load * 0.3;
        break;
      case 'performance_based':
        finalScore = performance * 0.5 + reliability * 0.5;
        break;
      case 'adaptive':
      default:
        finalScore = 
          resourceAvailability * 0.35 +
          performance * 0.25 +
          reliability * 0.25 +
          load * 0.15;
        break;
    }

    return {
      machineId,
      score: finalScore,
      availableCapacity: {
        cpu: currentUsage ? 100 - currentUsage.cpu : 100,
        memory: currentUsage ? 100 - currentUsage.memory : 100
      },
      currentLoad: {
        cpu: currentUsage?.cpu || 0,
        memory: currentUsage?.memory || 0,
        disk: currentUsage?.disk || 0
      },
      performance: {
        avgResponseTime: machineStats.averageResponseTime,
        reliability: machineStats.totalTasks > 0 
          ? (machineStats.completedTasks / machineStats.totalTasks) * 100 
          : 100,
        throughput: machineStats.totalTasks
      },
      factors: {
        resourceAvailability,
        performance,
        reliability,
        load
      }
    };
  }

  /**
   * Calculate resource availability score
   */
  private calculateResourceAvailability(
    usage: ResourceUsage | null,
    requirements: TaskRequirements
  ): number {
    if (!usage) {
      return 50; // Neutral score if no data
    }

    let score = 100;
    
    // Penalize for high resource usage
    if (requirements.cpu) {
      const availableCpu = 100 - usage.cpu;
      score -= Math.max(0, requirements.cpu - availableCpu) * 2;
    }
    
    if (requirements.memory) {
      const availableMemory = 100 - usage.memory;
      score -= Math.max(0, requirements.memory - availableMemory) * 1.5;
    }

    // Additional penalty for general high usage
    score -= (usage.cpu + usage.memory + usage.disk) / 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate performance score
   */
  private calculatePerformanceScore(stats: any): number {
    // Base score on response time and throughput
    const responseTimeScore = Math.max(0, 100 - (stats.averageResponseTime / 10));
    const throughputScore = Math.min(100, stats.totalTasks * 5);
    
    return (responseTimeScore + throughputScore) / 2;
  }

  /**
   * Calculate reliability score
   */
  private calculateReliabilityScore(stats: any): number {
    if (stats.totalTasks === 0) {
      return 100; // New machines get full score
    }
    
    const successRate = (stats.completedTasks / stats.totalTasks) * 100;
    return successRate;
  }

  /**
   * Calculate load score (inverse of current load)
   */
  private calculateLoadScore(usage: ResourceUsage | null): number {
    if (!usage) {
      return 50; // Neutral score if no data
    }
    
    const avgLoad = (usage.cpu + usage.memory + usage.disk) / 3;
    return Math.max(0, 100 - avgLoad);
  }

  /**
   * Select best machine from scored list
   */
  private selectBestMachine(scores: MachineScore[]): MachineScore | null {
    if (scores.length === 0) {
      return null;
    }

    // For round robin, cycle through machines
    if (this.currentStrategy === 'round_robin') {
      const selected = scores[this.roundRobinIndex % scores.length];
      this.roundRobinIndex++;
      return selected;
    }

    // For other strategies, select highest score
    return scores.reduce((best, current) => 
      current.score > best.score ? current : best
    );
  }

  /**
   * Clean up load balancer resources
   */
  cleanup(): void {
    this.machineStatistics.clear();
    this.taskHistory.clear();
    this.roundRobinIndex = 0;
  }
}

export default LoadBalancer;
