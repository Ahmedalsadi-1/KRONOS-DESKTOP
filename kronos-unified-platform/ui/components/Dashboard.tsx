import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Progress, Badge, Button, List, Avatar, Switch, Select, Space, Tag, Timeline, Alert, Tabs, Table, Modal, Input, Form } from 'antd';
import { 
  RobotOutlined, 
  DesktopOutlined, 
  MobileOutlined, 
  ApiOutlined, 
  MonitorOutlined, 
  ThunderboltOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  PlusOutlined,
  SettingOutlined,
  BellOutlined,
  UserOutlined,
  GlobalOutlined
} from '@ant-design/icons';

const { TabPane } = Tabs;
const { Option } = Select;
const { Search } = Input;

// Types for KRONOS Dashboard
interface SystemStatus {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'warning' | 'error';
  uptime: number;
  lastUpdate: string;
  version: string;
}

interface WorkflowExecution {
  id: string;
  name: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  progress: number;
  startTime: string;
  estimatedCompletion: string;
  agent: string;
  steps: number;
  currentStep: number;
}

interface AgentActivity {
  id: string;
  name: string;
  type: 'desktop' | 'mobile' | 'web' | 'ai';
  status: 'active' | 'idle' | 'busy' | 'error';
  lastActivity: string;
  tasksCompleted: number;
  successRate: number;
}

interface DeviceInfo {
  id: string;
  name: string;
  type: 'desktop' | 'mobile' | 'tablet';
  platform: string;
  status: 'connected' | 'disconnected' | 'maintenance';
  location: string;
  lastSeen: string;
}

interface NotificationItem {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

const Dashboard: React.FC = () => {
  const [systemStatus, setSystemStatus] = useState<SystemStatus[]>([
    { id: '1', name: 'API Gateway', status: 'online', uptime: 99.9, lastUpdate: '2025-12-17 13:10:30', version: 'v2.1.0' },
    { id: '2', name: 'Orchestration Engine', status: 'online', uptime: 99.8, lastUpdate: '2025-12-17 13:10:28', version: 'v1.9.2' },
    { id: '3', name: 'Desktop Agent', status: 'warning', uptime: 95.2, lastUpdate: '2025-12-17 13:10:25', version: 'v3.0.1' },
    { id: '4', name: 'Mobile Controller', status: 'online', uptime: 98.7, lastUpdate: '2025-12-17 13:10:32', version: 'v2.3.4' }
  ]);

  const [workflows, setWorkflows] = useState<WorkflowExecution[]>([
    { id: '1', name: 'Social Media Automation', status: 'running', progress: 65, startTime: '2025-12-17 12:45:00', estimatedCompletion: '2025-12-17 13:45:00', agent: 'SocialAgent-01', steps: 8, currentStep: 5 },
    { id: '2', name: 'Web Testing Suite', status: 'paused', progress: 30, startTime: '2025-12-17 12:30:00', estimatedCompletion: '2025-12-17 14:00:00', agent: 'WebTester-02', steps: 12, currentStep: 4 },
    { id: '3', name: 'Data Processing Pipeline', status: 'running', progress: 85, startTime: '2025-12-17 11:15:00', estimatedCompletion: '2025-12-17 13:20:00', agent: 'DataProcessor-01', steps: 6, currentStep: 5 }
  ]);

  const [agents, setAgents] = useState<AgentActivity[]>([
    { id: '1', name: 'DesktopAgent-01', type: 'desktop', status: 'active', lastActivity: '2025-12-17 13:10:15', tasksCompleted: 247, successRate: 94.2 },
    { id: '2', name: 'MobileAgent-02', type: 'mobile', status: 'busy', lastActivity: '2025-12-17 13:10:22', tasksCompleted: 189, successRate: 97.8 },
    { id: '3', name: 'WebAgent-03', type: 'web', status: 'idle', lastActivity: '2025-12-17 13:05:45', tasksCompleted: 156, successRate: 91.5 },
    { id: '4', name: 'AIAssistant-01', type: 'ai', status: 'active', lastActivity: '2025-12-17 13:10:30', tasksCompleted: 423, successRate: 99.1 }
  ]);

  const [devices, setDevices] = useState<DeviceInfo[]>([
    { id: '1', name: 'macOS Workstation', type: 'desktop', platform: 'macOS Monterey', status: 'connected', location: 'San Francisco, CA', lastSeen: '2025-12-17 13:10:30' },
    { id: '2', name: 'iPhone 15 Pro', type: 'mobile', platform: 'iOS 17.2', status: 'connected', location: 'San Francisco, CA', lastSeen: '2025-12-17 13:09:45' },
    { id: '3', name: 'Android Tablet', type: 'tablet', platform: 'Android 14', status: 'maintenance', location: 'Remote', lastSeen: '2025-12-17 12:30:15' }
  ]);

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    { id: '1', type: 'success', title: 'Workflow Completed', message: 'Social Media Automation completed successfully', timestamp: '2025-12-17 13:08:15', read: false },
    { id: '2', type: 'warning', title: 'High Resource Usage', message: 'Desktop Agent using 85% CPU', timestamp: '2025-12-17 13:05:30', read: false },
    { id: '3', type: 'info', title: 'New Device Connected', message: 'iPhone 15 Pro connected successfully', timestamp: '2025-12-17 12:45:22', read: true }
  ]);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [activeTab, setActiveTab] = useState('workflows');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'active':
      case 'connected':
      case 'running':
      case 'completed':
        return '#52c41a';
      case 'warning':
      case 'paused':
      case 'idle':
        return '#faad14';
      case 'error':
      case 'failed':
      case 'offline':
      case 'disconnected':
        return '#f5222d';
      case 'busy':
        return '#1890ff';
      default:
        return '#d9d9d9';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
      case 'active':
      case 'connected':
      case 'running':
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'warning':
      case 'paused':
      case 'idle':
        return <WarningOutlined style={{ color: '#faad14' }} />;
      case 'error':
      case 'failed':
      case 'offline':
      case 'disconnected':
        return <StopOutlined style={{ color: '#f5222d' }} />;
      case 'busy':
        return <SyncOutlined style={{ color: '#1890ff', spin: true }} />;
      default:
        return <PauseCircleOutlined style={{ color: '#d9d9d9' }} />;
    }
  };

  const handleCreateWorkflow = () => {
    const newWorkflow: WorkflowExecution = {
      id: Date.now().toString(),
      name: newWorkflowName || 'New Workflow',
      status: 'running',
      progress: 0,
      startTime: new Date().toISOString(),
      estimatedCompletion: new Date(Date.now() + 3600000).toISOString(),
      agent: 'AutoAgent-01',
      steps: 5,
      currentStep: 1
    };
    setWorkflows([...workflows, newWorkflow]);
    setIsModalVisible(false);
    setNewWorkflowName('');
  };

  const workflowColumns = [
    {
      title: 'Workflow Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Tag>
      ),
    },
    {
      title: 'Progress',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress: number) => (
        <Progress percent={progress} size="small" />
      ),
    },
    {
      title: 'Agent',
      dataIndex: 'agent',
      key: 'agent',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: WorkflowExecution) => (
        <Space>
          <Button 
            type="primary" 
            size="small" 
            icon={record.status === 'running' ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
          >
            {record.status === 'running' ? 'Pause' : 'Resume'}
          </Button>
          <Button size="small" icon={<StopOutlined />} danger>
            Stop
          </Button>
        </Space>
      ),
    },
  ];

  const agentColumns = [
    {
      title: 'Agent Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag icon={
          type === 'desktop' ? <DesktopOutlined /> :
          type === 'mobile' ? <MobileOutlined /> :
          type === 'web' ? <GlobalOutlined /> :
          <RobotOutlined />
        }>
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Space>
          {getStatusIcon(status)}
          <span style={{ color: getStatusColor(status) }}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </Space>
      ),
    },
    {
      title: 'Tasks Completed',
      dataIndex: 'tasksCompleted',
      key: 'tasksCompleted',
    },
    {
      title: 'Success Rate',
      dataIndex: 'successRate',
      key: 'successRate',
      render: (rate: number) => (
        <Progress percent={rate} size="small" strokeColor={rate > 95 ? '#52c41a' : rate > 90 ? '#faad14' : '#f5222d'} />
      ),
    },
  ];

  const deviceColumns = [
    {
      title: 'Device Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag icon={type === 'desktop' ? <DesktopOutlined /> : <MobileOutlined />}>
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </Tag>
      ),
    },
    {
      title: 'Platform',
      dataIndex: 'platform',
      key: 'platform',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge 
          status={status === 'connected' ? 'success' : status === 'maintenance' ? 'warning' : 'error'}
          text={status.charAt(0).toUpperCase() + status.slice(1)}
        />
      ),
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
    },
  ];

  return (
    <div style={{ 
      padding: '24px', 
      background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
      minHeight: '100vh',
      color: '#ffffff'
    }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: '24px' }}>
        <Col>
          <h1 style={{ color: '#ffffff', fontSize: '32px', fontWeight: 'bold', margin: 0 }}>
            <ThunderboltOutlined style={{ color: '#5e31d8', marginRight: '12px' }} />
            KRONOS Unified Platform
          </h1>
          <p style={{ color: '#a0a0a0', margin: '4px 0 0 0' }}>
            Intelligent Automation Control Center
          </p>
        </Col>
        <Col>
          <Space>
            <Badge count={notifications.filter(n => !n.read).length}>
              <Button type="primary" icon={<BellOutlined />} style={{ background: '#5e31d8', borderColor: '#5e31d8' }}>
                Notifications
              </Button>
            </Badge>
            <Button icon={<SettingOutlined />} style={{ color: '#ffffff', borderColor: '#5e31d8' }}>
              Settings
            </Button>
            <Button icon={<UserOutlined />} style={{ color: '#ffffff', borderColor: '#5e31d8' }}>
              Profile
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Key Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ 
            background: 'rgba(94, 49, 216, 0.1)', 
            border: '1px solid rgba(94, 49, 216, 0.3)',
            backdropFilter: 'blur(10px)'
          }}>
            <Statistic
              title={<span style={{ color: '#ffffff' }}>Active Agents</span>}
              value={agents.filter(a => a.status === 'active').length}
              prefix={<RobotOutlined style={{ color: '#5e31d8' }} />}
              valueStyle={{ color: '#ffffff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ 
            background: 'rgba(94, 49, 216, 0.1)', 
            border: '1px solid rgba(94, 49, 216, 0.3)',
            backdropFilter: 'blur(10px)'
          }}>
            <Statistic
              title={<span style={{ color: '#ffffff' }}>Running Workflows</span>}
              value={workflows.filter(w => w.status === 'running').length}
              prefix={<PlayCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#ffffff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ 
            background: 'rgba(94, 49, 216, 0.1)', 
            border: '1px solid rgba(94, 49, 216, 0.3)',
            backdropFilter: 'blur(10px)'
          }}>
            <Statistic
              title={<span style={{ color: '#ffffff' }}>Connected Devices</span>}
              value={devices.filter(d => d.status === 'connected').length}
              prefix={<MonitorOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#ffffff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ 
            background: 'rgba(94, 49, 216, 0.1)', 
            border: '1px solid rgba(94, 49, 216, 0.3)',
            backdropFilter: 'blur(10px)'
          }}>
            <Statistic
              title={<span style={{
