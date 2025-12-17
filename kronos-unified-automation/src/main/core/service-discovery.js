const { EventEmitter } = require('events');
const net = require('net');
const dgram = require('dgram');
const dns = require('dns').promises;
const { URL } = require('url');

/**
 * Service Discovery and Registration System
 * Handles dynamic service discovery and registration for distributed services
 */
class ServiceDiscovery extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      enabled: config.enabled !== false,
      interval: config.interval || 60000, // 1 minute
      timeout: config.timeout || 5000, // 5 seconds
      retries: config.retries || 3,
      multicastAddress: config.multicastAddress || '239.255.255.250',
      multicastPort: config.multicastPort || 1900,
      tcpPortRange: config.tcpPortRange || [3000, 3999],
      udpPortRange: config.udpPortRange || [4000, 4999],
      healthCheckPath: config.healthCheckPath || '/health',
      serviceTypes: config.serviceTypes || {
        'http': { port: 80, protocol: 'tcp' },
        'https': { port: 443, protocol: 'tcp' },
        'ws': { port: 8080, protocol: 'tcp' },
        'wss': { port: 8443, protocol: 'tcp' },
        'udp': { protocol: 'udp' },
        'tcp': { protocol: 'tcp' }
      },
      ...config
    };

    this.services = new Map(); // serviceId -> ServiceInfo
    this.serviceTypes = new Map(); // serviceType -> Set of services
    this.registeredServices = new Map(); // local serviceId -> ServiceInfo
    this.discoveredServices = new Map(); // remote serviceId -> ServiceInfo
    this.discoverySockets = new Map();
    this.healthCheckers = new Map();
    this.isDiscovering = false;
    this.isRegistered = false;
    this.retryTimers = new Map();
  }

  /**
   * Initialize service discovery
   */
  async initialize() {
    try {
      if (this.config.enabled) {
        await this.startDiscovery();
        await this.registerLocalServices();
        this.isRegistered = true;
        console.log('[ServiceDiscovery] Initialized and started discovery');
      }
    } catch (error) {
      console.error('[ServiceDiscovery] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Start service discovery
   */
  async startDiscovery() {
    if (this.isDiscovering) return;
    
    this.isDiscovering = true;
    
    // Start multicast discovery for SSDP-like services
    this.startMulticastDiscovery();
    
    // Start periodic discovery
    this.discoveryInterval = setInterval(() => {
      this.performDiscovery();
    }, this.config.interval);
    
    // Initial discovery
    await this.performDiscovery();
  }

  /**
   * Stop service discovery
   */
  async stopDiscovery() {
    this.isDiscovering = false;
    
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
    
    // Close discovery sockets
    for (const [key, socket] of this.discoverySockets) {
      socket.close();
    }
    this.discoverySockets.clear();
    
    // Stop health checkers
    for (const [serviceId, checker] of this.healthCheckers) {
      checker.stop();
    }
    this.healthCheckers.clear();
  }

  /**
   * Start multicast discovery
   */
  startMulticastDiscovery() {
    try {
      // Create UDP socket for multicast discovery
      const udpSocket = dgram.createSocket('udp4');
      
      udpSocket.on('error', (error) => {
        console.error('[ServiceDiscovery] UDP socket error:', error);
      });
      
      udpSocket.on('message', (message, remote) => {
        this.handleMulticastMessage(message, remote);
      });
      
      udpSocket.bind(this.config.multicastPort, () => {
        udpSocket.setMulticastTTL(1);
        udpSocket.setMulticastLoopback(true);
        console.log('[ServiceDiscovery] UDP multicast discovery started');
      });
      
      this.discoverySockets.set('multicast', udpSocket);
      
      // Send discovery probe
      this.sendMulticastProbe();
      
    } catch (error) {
      console.error('[ServiceDiscovery] Failed to start multicast discovery:', error);
    }
  }

  /**
   * Send multicast discovery probe
   */
  sendMulticastProbe() {
    const message = Buffer.from('M-SEARCH * HTTP/1.1\r\n' +
      'HOST: ' + this.config.multicastAddress + ':' + this.config.multicastPort + '\r\n' +
      'MAN: "ssdp:discover"\r\n' +
      'ST: upnp:rootdevice\r\n' +
      'MX: 3\r\n\r\n');
    
    const udpSocket = this.discoverySockets.get('multicast');
    if (udpSocket) {
      udpSocket.send(message, 0, message.length, this.config.multicastPort, this.config.multicastAddress);
    }
  }

  /**
   * Handle multicast message
   */
  handleMulticastMessage(message, remote) {
    try {
      const messageStr = message.toString();
      
      // Parse SSDP-like responses
      if (messageStr.includes('HTTP/1.1')) {
        const headers = this.parseHeaders(messageStr);
        const location = headers['location'];
        
        if (location) {
          this.discoverServiceFromUrl(location);
        }
      }
    } catch (error) {
      console.error('[ServiceDiscovery] Error handling multicast message:', error);
    }
  }

  /**
   * Parse HTTP-like headers
   */
  parseHeaders(message) {
    const headers = {};
    const lines = message.split('\r\n');
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim().toLowerCase();
          const value = line.substring(colonIndex + 1).trim();
          headers[key] = value;
        }
      }
    }
    
    return headers;
  }

  /**
   * Discover service from URL
   */
  async discoverServiceFromUrl(url) {
    try {
      const response = await fetch(url, {
        timeout: this.config.timeout
      });
      
      if (response.ok) {
        const data = await response.json();
        const serviceInfo = this.parseServiceInfo(data, url);
        
        if (serviceInfo) {
          await this.registerDiscoveredService(serviceInfo);
        }
      }
    } catch (error) {
      console.error(`[ServiceDiscovery] Failed to discover service from ${url}:`, error.message);
    }
  }

  /**
   * Perform service discovery
   */
  async performDiscovery() {
    if (!this.config.enabled) return;
    
    console.log('[ServiceDiscovery] Performing service discovery...');
    
    // Discover services on local network
    await this.discoverLocalNetworkServices();
    
    // Discover services via DNS
    await this.discoverDnsServices();
    
    // Clean up stale services
    this.cleanupStaleServices();
  }

  /**
   * Discover services on local network
   */
  async discoverLocalNetworkServices() {
    const networkInterfaces = require('os').networkInterfaces();
    
    for (const [interfaceName, interfaces] of Object.entries(networkInterfaces)) {
      for (const iface of interfaces) {
        if (iface.family === 'IPv4' && !iface.internal) {
          await this.scanNetworkRange(iface.address, iface.netmask);
        }
      }
    }
  }

  /**
   * Scan network range for services
   */
  async scanNetworkRange(baseIP, netmask) {
    try {
      const network = this.calculateNetwork(baseIP, netmask);
      const hosts = this.getHostAddresses(network, netmask);
      
      // Limit scan to reasonable number of hosts
      const maxHosts = Math.min(hosts.length, 254);
      
      for (let i = 0; i < maxHosts; i++) {
        const host = hosts[i];
        await this.scanHost(host);
      }
    } catch (error) {
      console.error('[ServiceDiscovery] Network scan error:', error);
    }
  }

  /**
   * Calculate network address
   */
  calculateNetwork(ip, netmask) {
    const ipParts = ip.split('.').map(Number);
    const maskParts = netmask.split('.').map(Number);
    
    return ipParts.map((part, i) => part & maskParts[i]).join('.');
  }

  /**
   * Get host addresses in network
   */
  getHostAddresses(network, netmask) {
    const networkParts = network.split('.').map(Number);
    const maskParts = netmask.split('.').map(Number);
    
    const hosts = [];
    for (let i = 1; i < 255; i++) {
      const testIP = [...networkParts];
      testIP[3] = i;
      hosts.push(testIP.join('.'));
    }
    
    return hosts;
  }

  /**
   * Scan host for services
   */
  async scanHost(host) {
    // Scan common service ports
    const commonPorts = [80, 443, 8080, 3000, 5000, 8000, 8443];
    
    for (const port of commonPorts) {
      try {
        const isOpen = await this.checkPort(host, port, this.config.timeout);
        
        if (isOpen) {
          const serviceInfo = await this.identifyService(host, port);
          
          if (serviceInfo) {
            await this.registerDiscoveredService(serviceInfo);
          }
        }
      } catch (error) {
        // Ignore individual port scan errors
      }
    }
  }

  /**
   * Check if port is open
   */
  checkPort(host, port, timeout = 5000) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let connected = false;
      
      const cleanup = () => {
        socket.destroy();
        resolve(connected);
      };
      
      socket.setTimeout(timeout);
      
      socket.on('connect', () => {
        connected = true;
        cleanup();
      });
      
      socket.on('timeout', cleanup);
      socket.on('error', cleanup);
      
      socket.connect(port, host);
    });
  }

  /**
   * Identify service on host:port
   */
  async identifyService(host, port) {
    try {
      // Try HTTP-based service identification
      const protocols = ['http', 'https'];
      
      for (const protocol of protocols) {
        try {
          const url = `${protocol}://${host}:${port}/`;
          const response = await fetch(url, {
            timeout: 2000,
            headers: {
              'User-Agent': 'ServiceDiscovery/1.0'
            }
          });
          
          if (response.ok) {
            const headers = response.headers;
            const server = headers.get('server') || 'unknown';
            
            return {
              id: `${host}:${port}`,
              name: `Service on ${host}:${port}`,
              type: protocol,
              host,
              port,
              url,
              protocol: 'http',
              metadata: {
                server,
                status: 'online',
                discoveredAt: new Date().toISOString()
              }
            };
          }
        } catch (error) {
          // Try next protocol
        }
      }
      
      // Fallback: generic TCP service
      return {
        id: `${host}:${port}`,
        name: `TCP Service on ${host}:${port}`,
        type: 'tcp',
        host,
        port,
        url: null,
        protocol: 'tcp',
        metadata: {
          status: 'online',
          discoveredAt: new Date().toISOString()
        }
      };
      
    } catch (error) {
      console.error(`[ServiceDiscovery] Failed to identify service on ${host}:${port}:`, error);
      return null;
    }
  }

  /**
   * Discover services via DNS
   */
  async discoverDnsServices() {
    const commonServiceNames = [
      'api', 'service', 'backend', 'frontend', 'app',
      'web', 'server', 'node', 'microservice'
    ];
    
    for (const serviceName of commonServiceNames) {
      try {
        const records = await dns.resolve4(serviceName);
        
        for (const ip of records) {
          const serviceInfo = {
            id: `dns:${serviceName}:${ip}`,
            name: `DNS Service: ${serviceName}`,
            type: 'dns',
            host: ip,
            port: 80,
            url: `http://${ip}`,
            protocol: 'http',
            metadata: {
              serviceName,
              resolvedIP: ip,
              discoveredAt: new Date().toISOString()
            }
          };
          
          await this.registerDiscoveredService(serviceInfo);
        }
      } catch (error) {
        // DNS resolution failed, continue
      }
    }
  }

  /**
   * Register discovered service
   */
  async registerDiscoveredService(serviceInfo) {
    try {
      // Check if service already exists
      const existingService = this.discoveredServices.get(serviceInfo.id);
      
      if (existingService) {
        // Update existing service
        existingService.lastSeen = new Date();
        existingService.metadata = { ...existingService.metadata, ...serviceInfo.metadata };
      } else {
        // Register new service
        serviceInfo.lastSeen = new Date();
        serviceInfo.discovered = true;
        
        this.discoveredServices.set(serviceInfo.id, serviceInfo);
        
        // Add to service type index
        if (!this.serviceTypes.has(serviceInfo.type)) {
          this.serviceTypes.set(serviceInfo.type, new Set());
        }
        this.serviceTypes.get(serviceInfo.type).add(serviceInfo.id);
        
        // Emit discovery event
        this.emit('serviceDiscovered', serviceInfo);
        console.log(`[ServiceDiscovery] Discovered service: ${serviceInfo.name} (${serviceInfo.id})`);
      }
      
      // Start health monitoring
      await this.startHealthMonitoring(serviceInfo);
      
    } catch (error) {
      console.error('[ServiceDiscovery] Failed to register discovered service:', error);
    }
  }

  /**
   * Start health monitoring for service
   */
  async startHealthMonitoring(serviceInfo) {
    if (!serviceInfo.url) return;
    
    // Stop existing health checker
    const existingChecker = this.healthCheckers.get(serviceInfo.id);
    if (existingChecker) {
      existingChecker.stop();
    }
    
    // Create new health checker
    const healthChecker = new ServiceHealthChecker(serviceInfo, this.config);
    healthChecker.on('healthChange', (serviceId, isHealthy) => {
      this.handleHealthChange(serviceId, isHealthy);
    });
    
    healthChecker.start();
    this.healthCheckers.set(serviceInfo.id, healthChecker);
  }

  /**
   * Handle health change event
   */
  handleHealthChange(serviceId, isHealthy) {
    const service = this.services.get(serviceId);
    if (service) {
      service.metadata.status = isHealthy ? 'online' : 'offline';
      this.emit('serviceHealthChanged', serviceId, isHealthy);
    }
  }

  /**
   * Clean up stale services
   */
  cleanupStaleServices() {
    const now = new Date();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    for (const [serviceId, service] of this.discoveredServices) {
      const age = now - service.lastSeen;
      
      if (age > maxAge) {
        this.discoveredServices.delete(serviceId);
        
        // Remove from type index
        const typeSet = this.serviceTypes.get(service.type);
        if (typeSet) {
          typeSet.delete(serviceId);
          if (typeSet.size === 0) {
            this.serviceTypes.delete(service.type);
          }
        }
        
        // Stop health monitoring
        const healthChecker = this.healthCheckers.get(serviceId);
        if (healthChecker) {
          healthChecker.stop();
          this.healthCheckers.delete(serviceId);
        }
        
        this.emit('serviceRemoved', service);
        console.log(`[ServiceDiscovery] Removed stale service: ${service.name} (${serviceId})`);
      }
    }
  }

  /**
   * Register local service
   */
  async registerLocalService(serviceInfo) {
    try {
      serviceInfo.local = true;
      serviceInfo.registeredAt = new Date();
      
      this.registeredServices.set(serviceInfo.id, serviceInfo);
      this.services.set(serviceInfo.id, serviceInfo);
      
      // Add to service type index
      if (!this.serviceTypes.has(serviceInfo.type)) {
        this.serviceTypes.set(serviceInfo.type, new Set());
      }
      this.serviceTypes.get(serviceInfo.type).add(serviceInfo.id);
      
      this.emit('serviceRegistered', serviceInfo);
      console.log(`[ServiceDiscovery] Registered local service: ${serviceInfo.name} (${serviceInfo.id})`);
      
    } catch (error) {
      console.error('[ServiceDiscovery] Failed to register local service:', error);
    }
  }

  /**
   * Register all local services
   */
  async registerLocalServices() {
    // This would typically discover services from the ServiceRegistry
    // For now, we'll register some common local services
    
    const localServices = [
      {
        id: 'local:project-manager',
        name: 'Project Manager Service',
        type: 'http',
        host: 'localhost',
        port: 3001,
        url: 'http://localhost:3001',
        protocol: 'http',
        metadata: {
          version: '1.0.0',
          description: 'Manages automation projects'
        }
      },
      {
        id: 'local:websocket-manager',
        name: 'WebSocket Manager Service',
        type: 'ws',
        host: 'localhost',
        port: 3002,
        url: 'ws://localhost:3002',
        protocol: 'ws',
        metadata: {
          version: '1.0.0',
          description: 'Manages WebSocket connections'
        }
      }
    ];
    
    for (const serviceInfo of localServices) {
      await this.registerLocalService(serviceInfo);
    }
  }

  /**
   * Unregister service
   */
  async unregisterService(serviceId) {
    const service = this.services.get(serviceId);
    if (!service) return;
    
    this.services.delete(serviceId);
    this.discoveredServices.delete(serviceId);
    this.registeredServices.delete(serviceId);
    
    // Remove from type index
    const typeSet = this.serviceTypes.get(service.type);
    if (typeSet) {
      typeSet.delete(serviceId);
      if (typeSet.size === 0) {
        this.serviceTypes.delete(service.type);
      }
    }
    
    // Stop health monitoring
    const healthChecker = this.healthCheckers.get(serviceId);
    if (healthChecker) {
      healthChecker.stop();
      this.healthCheckers.delete(serviceId);
    }
    
    this.emit('serviceUnregistered', service);
    console.log(`[ServiceDiscovery] Unregistered service: ${service.name} (${serviceId})`);
  }

  /**
   * Get service by ID
   */
  getService(serviceId) {
    return this.services.get(serviceId) || 
           this.discoveredServices.get(serviceId) || 
           this.registeredServices.get(serviceId);
  }

  /**
   * Get services by type
   */
  getServicesByType(serviceType) {
    const typeSet = this.serviceTypes.get(serviceType);
    if (!typeSet) return [];
    
    const services = [];
    for (const serviceId of typeSet) {
      const service = this.getService(serviceId);
      if (service) services.push(service);
    }
    
    return services;
  }

  /**
   * Get all services
   */
  getAllServices() {
    const allServices = [];
    
    for (const service of this.services.values()) {
      allServices.push(service);
    }
    
    for (const [serviceId, service] of this.discoveredServices) {
      if (!this.services.has(serviceId)) {
        allServices.push(service);
      }
    }
    
    for (const [serviceId, service] of this.registeredServices) {
      if (!this.services.has(serviceId) && !this.discoveredServices.has(serviceId)) {
        allServices.push(service);
      }
    }
    
    return allServices;
  }

  /**
   * Get service statistics
   */
  getStatistics() {
    return {
      totalServices: this.services.size + this.discoveredServices.size + this.registeredServices.size,
      localServices: this.registeredServices.size,
      discoveredServices: this.discoveredServices.size,
      serviceTypes: Array.from(this.serviceTypes.keys()),
      isDiscovering: this.isDiscovering,
      isRegistered: this.isRegistered,
      healthCheckers: this.healthCheckers.size
    };
  }

  /**
   * Shutdown service discovery
   */
  async shutdown() {
    console.log('[ServiceDiscovery] Shutting down...');
    
    await this.stopDiscovery();
    
    // Clear all services
    this.services.clear();
    this.serviceTypes.clear();
    this.discoveredServices.clear();
    this.registeredServices.clear();
    this.healthCheckers.clear();
    
    console.log('[ServiceDiscovery] Shutdown complete');
  }
}

/**
 * Service Health Checker
 */
class ServiceHealthChecker extends EventEmitter {
  constructor(serviceInfo, config) {
    super();
    this.serviceInfo = serviceInfo;
    this.config = config;
    this.isRunning = false;
    this.lastCheck = null;
    this.isHealthy = null;
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.performHealthCheck();
    
    this.interval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval || 30000);
  }

  stop() {
    this.isRunning = false;
    
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async performHealthCheck() {
    try {
      const isHealthy = await this.checkServiceHealth();
      
      if (isHealthy !== this.isHealthy) {
        this.isHealthy = isHealthy;
        this.emit('healthChange', this.serviceInfo.id, isHealthy);
      }
      
      this.lastCheck = new Date();
      
    } catch (error) {
      if (this.isHealthy !== false) {
        this.isHealthy = false;
        this.emit('healthChange', this.serviceInfo.id, false);
      }
    }
  }

  async checkServiceHealth() {
    if (!this.serviceInfo.url) {
      // For non-HTTP services, assume healthy if we can connect
      return await this.checkTcpHealth();
    }
    
    try {
      const response = await fetch(`${this.serviceInfo.url}${this.config.healthCheckPath || '/health'}`, {
        timeout: this.config.timeout || 5000,
        method: 'GET'
      });
      
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async checkTcpHealth() {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, this.config.timeout || 5000);
      
      socket.on('connect', () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve(true);
      });
      
      socket.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
      
      socket.connect(this.serviceInfo.port, this.serviceInfo.host);
    });
  }
}

module.exports = ServiceDiscovery;
