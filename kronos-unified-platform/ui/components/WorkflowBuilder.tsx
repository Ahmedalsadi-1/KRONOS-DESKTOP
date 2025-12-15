import React, { useState, useCallback } from 'react';
import { Card, Row, Col, Button, Input, Select, Space, Modal, Form, Steps, Tag, Switch, Typography, Divider, List, Avatar, Badge, Progress } from 'antd';
import { 
  PlayCircleOutlined, 
  PlusOutlined, 
  DeleteOutlined, 
  CopyOutlined, 
  SaveOutlined, 
  RocketOutlined,
  ApiOutlined,
  RobotOutlined,
  MobileOutlined,
  DesktopOutlined,
  GlobalOutlined,
  ThunderboltOutlined,
  SettingOutlined,
  EyeOutlined
} from '@ant-design/icons';

const { TextArea } = Input;
const { Option } = Select;
const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;

// Enhanced Workflow Builder Component for KRONOS
interface WorkflowStep {
  id: string;
  name: string;
  type: 'desktop' | 'mobile' | 'web' | 'api' | 'ai';
  action: string;
  parameters: Record<string, any>;
  condition?: string;
  retryCount?: number;
  timeout?: number;
  dependencies?: string[];
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  steps: WorkflowStep[];
  triggers: string[];
  isActive: boolean;
  version: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowBuilderProps {
  initialWorkflow?: Workflow;
  onSave?: (workflow: Workflow) => void;
  onExecute?: (workflow: Workflow) => void;
}

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ 
  initialWorkflow, 
  onSave, 
  onExecute 
}) => {
  const [workflow, setWorkflow] = useState<Workflow>(initialWorkflow || {
    id: '',
    name: 'New Workflow',
    description: '',
    category: 'Automation',
    tags: [],
    steps: [],
    triggers: [],
    isActive: false,
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [isStepModalVisible, setIsStepModalVisible] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [previewMode, setPreviewMode] = useState<'visual' | 'code'>('visual');

  const stepTypes = [
    { value: 'desktop', label: 'Desktop Action', icon: <DesktopOutlined />, color: '#5e31d8' },
    { value: 'mobile', label: 'Mobile Action', icon: <MobileOutlined />, color: '#52c41a' },
    { value: 'web', label: 'Web Automation', icon: <GlobalOutlined />, color: '#1890ff' },
    { value: 'api', label: 'API Call', icon: <ApiOutlined />, color: '#fa8c16' },
    { value: 'ai', label: 'AI Processing', icon: <RobotOutlined />, color: '#722ed1' }
  ];

  const actionTemplates = {
    desktop: [
      'Take Screenshot',
      'Click Element',
      'Type Text',
      'Scroll Page',
      'Move Mouse',
      'Press Key',
      'Open Application',
      'Close Window'
    ],
    mobile: [
      'Tap Element',
      'Swipe Screen',
      'Install App',
      'Launch App',
      'Send Text',
      'Make Call',
      'Take Photo',
      'Record Video'
    ],
    web: [
      'Navigate to URL',
      'Fill Form',
      'Submit Form',
      'Click Button',
      'Extract Data',
      'Wait for Element',
      'Upload File',
      'Download File'
    ],
    api: [
      'GET Request',
      'POST Request',
      'PUT Request',
      'DELETE Request',
      'Webhook Trigger',
      'Database Query',
      'File Upload',
      'Email Send'
    ],
    ai: [
      'Image Recognition',
      'Text Analysis',
      'Language Translation',
      'Sentiment Analysis',
      'Object Detection',
      'Speech Recognition',
      'Text Generation',
      'Data Classification'
    ]
  };

  const handleAddStep = () => {
    const newStep: WorkflowStep = {
      id: `step_${Date.now()}`,
      name: 'New Step',
      type: 'desktop',
      action: 'Take Screenshot',
      parameters: {},
      retryCount: 3,
      timeout: 30000
    };
    setWorkflow({
      ...workflow,
      steps: [...workflow.steps, newStep]
    });
    setSelectedStep(newStep.id);
  };

  const handleUpdateStep = (stepId: string, updates: Partial<WorkflowStep>) => {
    setWorkflow({
      ...workflow,
      steps: workflow.steps.map(step => 
        step.id === stepId ? { ...step, ...updates } : step
      )
    });
  };

  const handleDeleteStep = (stepId: string) => {
    setWorkflow({
      ...workflow,
      steps: workflow.steps.filter(step => step.id !== stepId)
    });
    if (selectedStep === stepId) {
      setSelectedStep(null);
    }
  };

  const handleDuplicateStep = (stepId: string) => {
    const stepToDuplicate = workflow.steps.find(step => step.id === stepId);
    if (stepToDuplicate) {
      const newStep = {
        ...stepToDuplicate,
        id: `step_${Date.now()}`,
        name: `${stepToDuplicate.name} (Copy)`
      };
      setWorkflow({
        ...workflow,
        steps: [...workflow.steps, newStep]
      });
    }
  };

  const handleSaveWorkflow = () => {
    const savedWorkflow = {
      ...workflow,
      id: workflow.id || `workflow_${Date.now()}`,
      updatedAt: new Date().toISOString()
    };
    onSave?.(savedWorkflow);
  };

  const handleExecuteWorkflow = () => {
    onExecute?.(workflow);
  };

  const getStepTypeConfig = (type: string) => {
    return stepTypes.find(t => t.value === type) || stepTypes[0];
  };

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
          <Title level={2} style={{ color: '#ffffff', margin: 0 }}>
            <RocketOutlined style={{ color: '#5e31d8', marginRight: '12px' }} />
            Workflow Builder
          </Title>
          <Text style={{ color: '#a0a0a0' }}>
            Design and configure intelligent automation workflows
          </Text>
        </Col>
        <Col>
          <Space>
            <Button 
              icon={<EyeOutlined />} 
              onClick={() => setIsPreviewVisible(true)}
              style={{ color: '#ffffff', borderColor: '#5e31d8' }}
            >
              Preview
            </Button>
            <Button 
              icon={<SaveOutlined />} 
              onClick={handleSaveWorkflow}
              type="primary"
              style={{ background: '#5e31d8', borderColor: '#5e31d8' }}
            >
              Save Workflow
            </Button>
            <Button 
              icon={<PlayCircleOutlined />} 
              onClick={handleExecuteWorkflow}
              type="primary"
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
            >
              Execute
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Workflow Configuration */}
      <Card 
        style={{ 
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(94, 49, 216, 0.3)',
          marginBottom: '24px'
        }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Form layout="vertical">
              <Form.Item label={<span style={{ color: '#ffffff' }}>Workflow Name</span>}>
                <Input
                  value={workflow.name}
                  onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
                  style={{ background: 'rgba(255, 255, 255, 0.1)', borderColor: '#5e31d8' }}
                />
              </Form.Item>
              <Form.Item label={<span style={{ color: '#ffffff' }}>Description</span>}>
                <TextArea
                  value={workflow.description}
                  onChange={(e) => setWorkflow({ ...workflow, description: e.target.value })}
                  rows={3}
                  style={{ background: 'rgba(255, 255, 255, 0.1)', borderColor: '#5e31d8' }}
                />
              </Form.Item>
            </Form>
          </Col>
          <Col xs={24} md={12}>
            <Form layout="vertical">
              <Form.Item label={<span style={{ color: '#ffffff' }}>Category</span>}>
                <Select
                  value={workflow.category}
                  onChange={(value) => setWorkflow({ ...workflow, category: value })}
                  style={{ background: 'rgba(255, 255, 255, 0.1)' }}
                >
                  <Option value="Automation">Automation</Option>
                  <Option value="Testing">Testing</Option>
                  <Option value="Data Processing">Data Processing</Option>
                  <Option value="Integration">Integration</Option>
                  <Option value="Monitoring">Monitoring</Option>
                </Select>
              </Form.Item>
              <Form.Item label={<span style={{ color: '#ffffff' }}>Tags</span>}>
                <Input
                  placeholder="Enter tags separated by commas"
                  value={workflow.tags.join(', ')}
                  onChange={(e) => setWorkflow({ 
                    ...workflow, 
                    tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                  })}
                  style={{ background: 'rgba(255, 255, 255, 0.1)', borderColor: '#5e31d8' }}
                />
              </Form.Item>
            </Form>
          </Col>
        </Row>
      </Card>

      {/* Workflow Steps */}
      <Card 
        style={{ 
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(94, 49, 216, 0.3)'
        }}
      >
        <div style={{ marginBottom: '16px' }}>
          <Button 
            type="dashed" 
            icon={<PlusOutlined />} 
            onClick={handleAddStep}
            style={{ 
              color: '#5e31d8', 
              borderColor: '#5e31d8',
              width: '100%',
              height: '80px',
              fontSize: '16px'
            }}
          >
            Add New Step
          </Button>
        </div>

        <Steps
          direction="vertical"
          current={workflow.steps.findIndex(step => step.id === selectedStep)}
          style={{ marginTop: '24px' }}
        >
          {workflow.steps.map((step, index) => {
            const stepConfig = getStepTypeConfig(step.type);
            return (
              <Step
                key={step.id}
                title={
                  <Space>
                    <span style={{ color: '#ffffff' }}>{step.name}</span>
                    <Tag color={stepConfig.color} icon={stepConfig.icon}>
                      {stepConfig.label}
                    </Tag>
                  </Space>
                }
                description={
                  <Card 
                    size="small" 
                    style={{ 
                      background: 'rgba(255, 255, 255, 0.1)',
                      marginTop: '8px',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedStep(step.id)}
                  >
                    <Row justify="space-between" align="middle">
                      <Col>
                        <Text style={{ color: '#ffffff' }}>
                          <strong>Action:</strong> {step.action}
                        </Text>
                        <br />
                        <Text style={{ color: '#a0a0a0' }}>
                          <strong>Timeout:</strong> {step.timeout || 30000}ms
                        </Text>
                        <br />
                        <Text style={{ color: '#a0a0a0' }}>
                          <strong>Retry Count:</strong> {step.retryCount || 3}
                        </Text>
                      </Col>
                      <Col>
                        <Space>
                          <Button 
                            size="small" 
                            icon={<CopyOutlined />} 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateStep(step.id);
                            }}
                          />
                          <Button 
                            size="small" 
                            icon={<DeleteOutlined />} 
                            danger
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteStep(step.id);
                            }}
                          />
                        </Space>
                      </Col>
                    </Row>
                  </Card>
                }
              />
            );
          })}
        </Steps>
      </Card>

      {/* Step Configuration Modal */}
      <Modal
        title="Configure Step"
        open={isStepModalVisible}
        onCancel={() => setIsStepModalVisible(false)}
        footer={null}
        width={600}
        style={{ top: 20 }}
      >
        {selectedStep && (
          <StepConfiguration
            step={workflow.steps.find(s => s.id === selectedStep)!}
            onUpdate={(updates) => handleUpdateStep(selectedStep, updates)}
            onClose={() => setIsStepModalVisible(false)}
          />
        )}
      </Modal>

      {/* Preview Modal */}
      <Modal
        title="Workflow Preview"
        open={isPreviewVisible}
        onCancel={() => setIsPreviewVisible(false)}
        footer={null}
        width={800}
        style={{ top: 20 }}
      >
        <WorkflowPreview workflow={workflow} mode={previewMode} />
      </Modal>
    </div>
  );
};

// Step Configuration Component
const StepConfiguration: React.FC<{
  step: WorkflowStep;
  onUpdate: (updates: Partial<WorkflowStep>) => void;
  onClose: () => void;
}> = ({ step, onUpdate, onClose }) => {
  return (
    <Form layout="vertical" initialValues={step}>
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Form.Item label="Step Name">
            <Input
              value={step.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="Step Type">
            <Select
              value={step.type}
              onChange={(value) => onUpdate({ type: value as any })}
            >
              <Option value="desktop">Desktop Action</Option>
              <Option value="mobile">Mobile Action</Option>
              <Option value="web">Web Automation</Option>
              <Option value="api">API Call</Option>
              <Option value="ai">AI Processing</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>
      <Form.Item label="Action">
        <Select
          value={step.action}
          onChange={(value) => onUpdate({ action: value })}
        >
          {actionTemplates[step.type as keyof typeof actionTemplates]?.map(action => (
            <Option key={action} value={action}>{action}</Option>
          ))}
        </Select>
      </Form.Item>
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Form.Item label="Timeout (ms)">
            <Input
              type="number"
              value={step.timeout}
              onChange={(e) => onUpdate({ timeout: parseInt(e.target.value) })}
            />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="Retry Count">
            <Input
              type="number"
              value={step.retryCount}
              onChange={(e) => onUpdate({ retryCount: parseInt(e.target.value) })}
            />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="Condition">
            <Input
              value={step.condition}
              onChange={(e) => onUpdate({ condition: e.target.value })}
              placeholder="Optional condition"
            />
          </Form.Item>
        </Col>
      </Row>
      <Row justify="end" style={{ marginTop: '16px' }}>
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={onClose}>Save</Button>
        </Space>
      </Row>
    </Form>
  );
};

// Workflow Preview Component
const WorkflowPreview: React.FC<{
  workflow: Workflow;
  mode: 'visual' | 'code';
}> = ({ workflow, mode }) => {
  if (mode === 'code') {
    return (
      <pre style={{ 
        background: '#1e1e1e', 
        color: '#ffffff', 
        padding: '16px', 
        borderRadius: '4px',
        overflow: 'auto',
        maxHeight: '400px'
      }}>
        {JSON.stringify(workflow, null, 2)}
      </pre>
    );
  }

  return (
    <div>
      <Title level={4}>{workflow.name}</Title>
