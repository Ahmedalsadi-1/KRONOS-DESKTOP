import React, { useState } from 'react';
import { 
  Card, 
  Steps, 
  Form, 
  Input, 
  Select, 
  Button, 
  Space, 
  Typography, 
  Row, 
  Col, 
  Switch, 
  InputNumber,
  Alert,
  Divider,
  List,
  Progress,
  Tabs,
  Radio
} from 'antd';
import { 
  SettingOutlined, 
  CloudOutlined, 
  DesktopOutlined, 
  CheckCircleOutlined,
  SafetyOutlined,
  ThunderboltOutlined,
  DatabaseOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;
const { Option } = Select;
const { TabPane } = Tabs;

interface ConfigurationWizardProps {
  onComplete: (config: any) => void;
  onSkip?: () => void;
}

interface AppConfiguration {
  appName: string;
  appVersion: string;
  organization: string;
  authentication: {
    enabled: boolean;
    method: 'oauth2' | 'jwt' | 'local';
    jwtSecret?: string;
    sessionTimeout: number;
    enableMFA: boolean;
  };
  database: {
    type: 'postgresql' | 'mysql' | 'sqlite';
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl: boolean;
  };
  services: {
    openai?: { apiKey: string; model: string; maxTokens: number; };
    anthropic?: { apiKey: string; model: string; };
    google?: { clientId: string; clientSecret: string; };
    slack?: { botToken: string; webhookUrl: string; };
  };
  desktopAutomation: {
    enabled: boolean;
    screenshotInterval: number;
    maxConcurrentSessions: number;
    enableComputerVision: boolean;
  };
  mobile: {
    enabled: boolean;
    autoDiscovery: boolean;
    maxDevices: number;
    supportedPlatforms: string[];
  };
  ui: {
    theme: 'dark' | 'light' | 'auto';
    primaryColor: string;
    enableAnimations: boolean;
    compactMode: boolean;
  };
}

const ConfigurationWizard: React.FC<ConfigurationWizardProps> = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();
  const [configuration, setConfiguration] = useState<Partial<AppConfiguration>>({});

  const steps = [
    {
      title: 'Welcome & Setup',
      description: 'Basic application configuration',
      icon: <SettingOutlined />,
    },
    {
      title: 'Security & Authentication',
      description: 'Configure authentication settings',
      icon: <SafetyOutlined />,
    },
    {
      title: 'Database Configuration',
      description: 'Set up database connection',
      icon: <DatabaseOutlined />,
    },
    {
      title: 'External Services',
      description: 'Configure third-party integrations',
      icon: <CloudOutlined />,
    },
    {
      title: 'Automation Settings',
      description: 'Desktop & mobile automation',
      icon: <ThunderboltOutlined />,
    },
    {
      title: 'UI & Branding',
      description: 'Customize interface & appearance',
      icon: <DesktopOutlined />,
    },
    {
      title: 'Review & Deploy',
      description: 'Review configuration & finalize',
      icon: <CheckCircleOutlined />,
    }
  ];

  const next = () => {
    form.validateFields().then(() => {
      const values = form.getFieldsValue();
      setConfiguration({ ...configuration, ...values });
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    });
  };

  const prev = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleComplete = () => {
    const finalConfig = { ...configuration, ...form.getFieldsValue() };
    onComplete(finalConfig);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div>
            <Title level={3}>Welcome to KRONOS Configuration Wizard</Title>
            <Paragraph>
              Let's get KRONOS set up with your preferences. This wizard will guide you through 
              the essential configuration steps to get your automation platform running smoothly.
            </Paragraph>
            
            <Form form={form} layout="vertical" initialValues={{
              appName: 'KRONOS Automation Platform',
              appVersion: '2.0.0',
              organization: 'Your Organization'
            }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item 
                    label="Application Name" 
                    name="appName"
                    rules={[{ required: true, message: 'Please enter application name' }]}
                  >
                    <Input placeholder="Enter application name" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item 
                    label="Version" 
                    name="appVersion"
                    rules={[{ required: true, message: 'Please enter version' }]}
                  >
                    <Input placeholder="2.0.0" />
                  </Form.Item>
                </Col>
              </Row>
              
              <Form.Item 
                label="Organization" 
                name="organization"
                rules={[{ required: true, message: 'Please enter organization name' }]}
              >
                <Input placeholder="Your Organization Name" />
              </Form.Item>
              
              <Alert
                message="Configuration Security"
                description="Your configuration will be encrypted and stored securely on your local machine."
                type="info"
                icon={<SafetyOutlined />}
                style={{ marginTop: 16 }}
              />
            </Form>
          </div>
        );

      case 1:
        return (
          <div>
            <Title level={3}>Security & Authentication</Title>
            <Paragraph>
              Configure authentication and security settings for your KRONOS installation.
            </Paragraph>
            
            <Form form={form} layout="vertical" initialValues={{
              'authentication.enabled': true,
              'authentication.method': 'jwt',
              'authentication.sessionTimeout': 3600,
              'authentication.enableMFA': false
            }}>
              <Form.Item 
                label="Enable Authentication" 
                name={['authentication', 'enabled']}
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              
              <Form.Item 
                label="Authentication Method" 
                name={['authentication', 'method']}
                rules={[{ required: true, message: 'Please select authentication method' }]}
              >
                <Select placeholder="Select authentication method">
                  <Option value="jwt">JWT Tokens</Option>
                  <Option value="oauth2">OAuth 2.0</Option>
                  <Option value="local">Local Authentication</Option>
                </Select>
              </Form.Item>
              
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item 
                    label="Session Timeout (seconds)" 
                    name={['authentication', 'sessionTimeout']}
                  >
                    <InputNumber min={300} max={86400} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item 
                    label="Enable Multi-Factor Authentication" 
                    name={['authentication', 'enableMFA']}
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
              
              {form.getFieldValue(['authentication', 'method']) === 'jwt' && (
                <Form.Item 
                  label="JWT Secret" 
                  name={['authentication', 'jwtSecret']}
                  rules={[{ required: true, message: 'Please enter JWT secret' }]}
                >
                  <Input.Password placeholder="Enter JWT secret key" />
                </Form.Item>
              )}
            </Form>
          </div>
        );

      case 2:
        return (
          <div>
            <Title level={3}>Database Configuration</Title>
            <Paragraph>
              Set up your database connection for KRONOS data storage.
            </Paragraph>
            
            <Form form={form} layout="vertical" initialValues={{
              'database.type': 'postgresql',
              'database.port': 5432,
              'database.ssl': false
            }}>
              <Form.Item 
                label="Database Type" 
                name={['database', 'type']}
                rules={[{ required: true, message: 'Please select database type' }]}
              >
                <Radio.Group>
                  <Radio value="postgresql">PostgreSQL</Radio>
                  <Radio value="mysql">MySQL</Radio>
                  <Radio value="sqlite">SQLite</Radio>
                </Radio.Group>
              </Form.Item>
              
              <Row gutter={16}>
                <Col span={16}>
                  <Form.Item 
                    label="Host" 
                    name={['database', 'host']}
                    rules={[{ required: true, message: 'Please enter database host' }]}
                  >
                    <Input placeholder="localhost" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item 
                    label="Port" 
                    name={['database', 'port']}
                  >
                    <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              
              <Form.Item 
                label="Database Name" 
                name={['database', 'database']}
                rules={[{ required: true, message: 'Please enter database name' }]}
              >
                <Input placeholder="kronos_db" />
              </Form.Item>
              
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item 
                    label="Username" 
                    name={['database', 'username']}
                    rules={[{ required: true, message: 'Please enter database username' }]}
                  >
                    <Input placeholder="kronos_user" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item 
                    label="Password" 
                    name={['database', 'password']}
                    rules={[{ required: true, message: 'Please enter database password' }]}
                  >
                    <Input.Password placeholder="••••••••" />
                  </Form.Item>
                </Col>
              </Row>
              
              <Form.Item 
                label="Enable SSL" 
                name={['database', 'ssl']}
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Form>
          </div>
        );

      case 3:
        return (
          <div>
            <Title level={3}>External Services Integration</Title>
            <Paragraph>
              Configure third-party services to enhance KRONOS capabilities.
            </Paragraph>
            
            <Tabs defaultActiveKey="ai">
              <TabPane tab="AI Services" key="ai">
                <Form form={form} layout="vertical">
                  <Title level={4}>OpenAI Integration</Title>
                  <Form.Item 
                    label="OpenAI API Key" 
                    name={['services', 'openai', 'apiKey']}
                  >
                    <Input.Password placeholder="sk-..." />
                  </Form.Item>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item 
                        label="Model" 
                        name={['services', 'openai', 'model']}
                      >
                        <Select>
                          <Option value="gpt-4">GPT-4</Option>
                          <Option value="gpt-3.5-turbo">GPT-3.5 Turbo</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item 
                        label="Max Tokens" 
                        name={['services', 'openai', 'maxTokens']}
                      >
                        <InputNumber min={100} max={4096} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  
                  <Divider />
                  
                  <Title level={4}>Anthropic Integration</Title>
                  <Form.Item 
                    label="Anthropic API Key" 
                    name={['services', 'anthropic', 'apiKey']}
                  >
                    <Input.Password placeholder="sk-ant-..." />
                  </Form.Item>
                  <Form.Item 
                    label="Model" 
                    name={['services', 'anthropic', 'model']}
                  >
                    <Select>
                      <Option value="claude-3-opus">Claude 3 Opus</Option>
                      <Option value="claude-3-sonnet">Claude 3 Sonnet</Option>
                      <Option value="claude-3-haiku">Claude 3 Haiku</Option>
                    </Select>
                  </Form.Item>
                </Form>
              </TabPane>
              
              <TabPane tab="Google Workspace" key="google">
                <Form form={form} layout="vertical">
                  <Form.Item 
                    label="Google Client ID" 
                    name={['services', 'google', 'clientId']}
                  >
                    <Input placeholder="Your Google Client ID" />
                  </Form.Item>
                  <Form.Item 
                    label="Google Client Secret" 
                    name={['services', 'google', 'clientSecret']}
                  >
                    <Input.Password placeholder="Your Google Client Secret" />
                  </Form.Item>
                </Form>
              </TabPane>
              
              <TabPane tab="Slack Integration" key="slack">
                <Form form={form} layout="vertical">
                  <Form.Item 
                    label="Slack Bot Token" 
                    name={['services', 'slack', 'botToken']}
                  >
                    <Input.Password placeholder="xoxb-..." />
                  </Form.Item>
                  <Form.Item 
                    label="Webhook URL" 
                    name={['services', 'slack', 'webhookUrl']}
                  >
                    <Input placeholder="https://hooks.slack.com/..." />
                  </Form.Item>
                </Form>
              </TabPane>
            </Tabs>
          </div>
        );

      case 4:
        return (
          <div>
            <Title level={3}>Automation Settings</Title>
            <Paragraph>
              Configure desktop and mobile automation capabilities.
            </Paragraph>
            
            <Form form={form} layout="vertical" initialValues={{
              'desktopAutomation.enabled': true,
              'desktopAutomation.screenshotInterval': 5000,
              'desktopAutomation.maxConcurrentSessions': 5,
              'desktopAutomation.enableComputerVision': true,
              'mobile.enabled': true,
              'mobile.autoDiscovery': true,
              'mobile.maxDevices': 10
            }}>
              <Card title="Desktop Automation" style={{ marginBottom: 16 }}>
                <Form.Item 
                  label="Enable Desktop Automation" 
                  name={['desktopAutomation', 'enabled']}
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
                
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item 
                      label="Screenshot Interval (ms)" 
                      name={['desktopAutomation', 'screenshotInterval']}
                    >
                      <InputNumber min={1000} max={30000} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item 
                      label="Max Concurrent Sessions" 
                      name={['desktopAutomation', 'maxConcurrentSessions']}
                    >
                      <InputNumber min={1} max={50} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                
                <Form.Item 
                  label="Enable Computer Vision" 
                  name={['desktopAutomation', 'enableComputerVision']}
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              </Card>
              
              <Card title="Mobile Integration">
                <Form.Item 
                  label="Enable Mobile Integration" 
                  name={['mobile', 'enabled']}
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
                
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item 
                      label="Auto Discovery" 
                      name={['mobile', 'autoDiscovery']}
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item 
                      label="Max Devices" 
                      name={['mobile', 'maxDevices']}
                    >
                      <InputNumber min={1} max={100} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                
                <Form.Item 
                  label="Supported Platforms" 
                  name={['mobile', 'supportedPlatforms']}
                >
                  <Select mode="multiple" placeholder="Select supported platforms">
                    <Option value="ios">iOS</Option
