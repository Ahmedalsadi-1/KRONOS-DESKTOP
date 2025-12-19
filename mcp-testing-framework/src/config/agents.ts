import { AgentConfig } from '../types';

export const AGENT_CONFIGS: Record<string, AgentConfig> = {
  'agent-orchestrator': {
    name: 'agent-orchestrator',
    url: 'http://localhost:8080',
    protocol: 'http',
    timeout: 5000,
    retryAttempts: 3
  },
  'onlysnarf': {
    name: 'onlysnarf',
    url: 'http://localhost:5005',
    protocol: 'http',
    timeout: 10000,
    retryAttempts: 3
  },
  'instapy': {
    name: 'instapy',
    url: 'http://localhost:8081', // Docker container port
    protocol: 'http',
    timeout: 10000,
    retryAttempts: 3
  },
  'instagrapi': {
    name: 'instagrapi',
    url: 'http://localhost:8082', // Docker container port
    protocol: 'http',
    timeout: 10000,
    retryAttempts: 3
  },
  'tiktok_api': {
    name: 'tiktok_api',
    url: 'http://localhost:8083', // Docker container port
    protocol: 'http',
    timeout: 10000,
    retryAttempts: 3
  },
  'pytube': {
    name: 'pytube',
    url: 'http://localhost:8084', // Docker container port
    protocol: 'http',
    timeout: 10000,
    retryAttempts: 3
  },
  'youtube_upload': {
    name: 'youtube_upload',
    url: 'http://localhost:8085', // Docker container port
    protocol: 'http',
    timeout: 10000,
    retryAttempts: 3
  }
};

export const TEST_CONFIG = {
  defaultTimeout: 30000,
  maxConcurrentTests: 10,
  retryAttempts: 3,
  logLevel: process.env.LOG_LEVEL || 'info'
};

export const STRESS_TEST_CONFIG = {
  duration: 60, // seconds
  concurrentConnections: 50,
  messageRate: 100, // messages per second
  rampUpTime: 10 // seconds
};

export const BENCHMARK_CONFIG = {
  warmUpIterations: 100,
  testIterations: 1000,
  cooldownTime: 5000, // milliseconds
  percentileReporting: [50, 90, 95, 99, 99.9]
};

export const STREAMING_TEST_CONFIG = {
  streamDuration: 30, // seconds
  chunkSize: 1024, // bytes
  totalDataSize: 1048576, // 1MB
  concurrentStreams: 5
};