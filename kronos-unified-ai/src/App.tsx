import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Play, Square, ExternalLink, Settings, Cpu, Globe, Smartphone, Zap } from 'lucide-react';

const electronAPI = (window as any).electronAPI;

interface AppConfig {
  name: string;
  path: string;
  command: string;
  port: number | null;
  description: string;
}

interface Apps {
  [key: string]: AppConfig;
}

function App() {
  const [apps, setApps] = useState<Apps>({});
  const [runningApps, setRunningApps] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    // Load apps configuration
    electronAPI.getApps().then(setApps);

    // Listen for app status changes
    electronAPI.onAppStarted((appKey: string) => {
      setRunningApps(prev => new Set(prev).add(appKey));
    });

    electronAPI.onAppStopped((appKey: string) => {
      setRunningApps(prev => {
        const newSet = new Set(prev);
        newSet.delete(appKey);
        return newSet;
      });
    });

    electronAPI.onAppClosed((appKey: string) => {
      setRunningApps(prev => {
        const newSet = new Set(prev);
        newSet.delete(appKey);
        return newSet;
      });
    });

    // Check initial status
    Object.keys(apps).forEach(appKey => {
      electronAPI.getAppStatus(appKey).then((isRunning: boolean) => {
        if (isRunning) {
          setRunningApps(prev => new Set(prev).add(appKey));
        }
      });
    });
  }, []);

  const handleStartApp = async (appKey: string) => {
    try {
      await electronAPI.startApp(appKey);
    } catch (error) {
      console.error('Failed to start app:', error);
    }
  };

  const handleStopApp = async (appKey: string) => {
    try {
      await electronAPI.stopApp(appKey);
    } catch (error) {
      console.error('Failed to stop app:', error);
    }
  };

  const getAppIcon = (appKey: string) => {
    switch (appKey) {
      case 'open-computer-use':
        return <Cpu className="w-8 h-8" />;
      case 'ai-browser':
        return <Globe className="w-8 h-8" />;
      case 'ui-tars':
        return <Zap className="w-8 h-8" />;
      case 'gbox':
        return <Smartphone className="w-8 h-8" />;
      default:
        return <Settings className="w-8 h-8" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Unified AI Ecosystem</h1>
          <p className="text-xl text-gray-300">Integrated platform for AI-powered automation tools</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="applications">Applications</TabsTrigger>
            <TabsTrigger value="mcp">MCP Servers</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {Object.entries(apps).map(([appKey, app]) => (
                <Card key={appKey} className="bg-white/10 border-white/20 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getAppIcon(appKey)}
                        <div>
                          <CardTitle className="text-white text-lg">{app.name}</CardTitle>
                          <Badge variant={runningApps.has(appKey) ? "default" : "secondary"}>
                            {runningApps.has(appKey) ? "Running" : "Stopped"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-gray-300 mb-4">
                      {app.description}
                    </CardDescription>
                    <div className="flex space-x-2">
                      {!runningApps.has(appKey) ? (
                        <Button
                          onClick={() => handleStartApp(appKey)}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Start
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleStopApp(appKey)}
                          variant="destructive"
                          className="flex-1"
                        >
                          <Square className="w-4 h-4 mr-2" />
                          Stop
                        </Button>
                      )}
                      {app.port && (
                        <Button
                          variant="outline"
                          onClick={() => window.open(`http://localhost:${app.port}`, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="applications" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Object.entries(apps).map(([appKey, app]) => (
                <Card key={appKey} className="bg-white/10 border-white/20 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      {getAppIcon(appKey)}
                      <CardTitle className="text-white">{app.name}</CardTitle>
                    </div>
                    <CardDescription className="text-gray-300">
                      {app.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Status:</span>
                      <Badge variant={runningApps.has(appKey) ? "default" : "secondary"}>
                        {runningApps.has(appKey) ? "Running" : "Stopped"}
                      </Badge>
                    </div>
                    {app.port && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Port:</span>
                        <span className="text-sm text-white">{app.port}</span>
                      </div>
                    )}
                    <div className="flex space-x-2">
                      {!runningApps.has(appKey) ? (
                        <Button
                          onClick={() => handleStartApp(appKey)}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Launch Application
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleStopApp(appKey)}
                          variant="destructive"
                          className="flex-1"
                        >
                          <Square className="w-4 h-4 mr-2" />
                          Stop Application
                        </Button>
                      )}
                      {app.port && runningApps.has(appKey) && (
                        <Button
                          variant="outline"
                          onClick={() => window.open(`http://localhost:${app.port}`, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="mcp" className="space-y-6">
            <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white">MCP Servers Status</CardTitle>
                <CardDescription className="text-gray-300">
                  Model Context Protocol servers for enhanced AI capabilities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div>
                      <h3 className="text-white font-medium">Browser Use MCP</h3>
                      <p className="text-sm text-gray-400">Advanced web automation</p>
                    </div>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div>
                      <h3 className="text-white font-medium">Playwright MCP</h3>
                      <p className="text-sm text-gray-400">Browser automation tools</p>
                    </div>
                    <Badge variant="default">Active</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default App;