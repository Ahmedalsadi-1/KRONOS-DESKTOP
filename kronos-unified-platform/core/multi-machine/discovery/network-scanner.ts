import * as dns from 'dns';
import * as net from 'net';

/**
 * Network Scanner for Multi-Machine Discovery
 * 
 * Discovers machines on the network using various protocols
 */
export interface DiscoveredHost {
  ip: string;
  hostname?: string;
  port: number;
  protocol: 'ssh' | 'rdp' | 'vnc';
  responseTime: number;
  isActive: boolean;
  services: {
    ssh?: boolean;
    rdp?: boolean;
    vnc?: boolean;
  };
}

export interface ScanOptions {
  timeout?: number;
  concurrency?: number;
  ports?: number[];
  protocols?: ('ssh' | 'rdp' | 'vnc')[];
}

export interface NetworkRange {
  start: string;
  end: string;
  cidr: string;
}

export class NetworkScanner {
  private static readonly DEFAULT_TIMEOUT = 5000; // 5 seconds
  private static readonly DEFAULT_CONCURRENCY = 50;
  private static readonly COMMON_PORTS = {
    ssh: 22,
    rdp: 3389,
    vnc: 5900
  };

  private scanHistory: Map<string, DiscoveredHost[]> = new Map();
  private lastScanTime: Date | null = null;

  /**
   * Scan network range for discovered hosts
   */
  async scanNetwork(
    networkRange: string,
    protocols: ('ssh' | 'rdp' | 'vnc')[] = ['ssh'],
    options: ScanOptions = {}
  ): Promise<DiscoveredHost[]> {
    const timeout = options.timeout || NetworkScanner.DEFAULT_TIMEOUT;
    const concurrency = options.concurrency || NetworkScanner.DEFAULT_CONCURRENCY;
    const ports = options.ports || protocols.map(p => NetworkScanner.COMMON_PORTS[p]);

    try {
      // Parse network range
      const ranges = this.parseNetworkRange(networkRange);
      
      // Generate IP addresses to scan
      const ipAddresses = this.generateIPAddresses(ranges);
      
      console.log(`Starting network scan: ${ipAddresses.length} addresses, ${concurrency} concurrent`);

      // Scan IPs in batches
      const discoveredHosts: DiscoveredHost[] = [];
      const batches = this.createBatches(ipAddresses, concurrency);

      for (const batch of batches) {
        const batchResults = await Promise.allSettled(
          batch.map(ip => this.scanIP(ip, protocols, ports, timeout))
        );

        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            discoveredHosts.push(result.value);
          }
        });

        // Small delay between batches to avoid overwhelming the network
        await this.delay(100);
      }

      // Store results
      this.scanHistory.set(networkRange, discoveredHosts);
      this.lastScanTime = new Date();

      console.log(`Network scan completed: ${discoveredHosts.length} hosts discovered`);

      return discoveredHosts;
    } catch (error) {
      throw new Error(`Network scan failed: ${error.message}`);
    }
  }

  /**
   * Scan specific IP address
   */
  async scanIP(
    ip: string,
    protocols: ('ssh' | 'rdp' | 'vnc')[],
    ports: number[],
    timeout: number
  ): Promise<DiscoveredHost | null> {
    const startTime = Date.now();
    
    try {
      // Check if IP is reachable
      const isReachable = await this.pingIP(ip, timeout);
      if (!isReachable) {
        return null;
      }

      // Scan ports
      const services = await this.scanPorts(ip, ports, timeout);
      
      // Determine available protocols
      const availableProtocols: ('ssh' | 'rdp' | 'vnc')[] = [];
      if (services.ssh) availableProtocols.push('ssh');
      if (services.rdp) availableProtocols.push('rdp');
      if (services.vnc) availableProtocols.push('vnc');

      if (availableProtocols.length === 0) {
        return null;
      }

      // Get hostname
      const hostname = await this.resolveHostname(ip);

      const responseTime = Date.now() - startTime;

      return {
        ip,
        hostname,
        port: this.selectPrimaryPort(services, protocols),
        protocol: protocols.find(p => services[p]) || protocols[0],
        responseTime,
        isActive: true,
        services
      };
    } catch (error) {
      console.warn(`Failed to scan IP ${ip}:`, error.message);
      return null;
    }
  }

  /**
   * Ping IP address to check reachability
   */
  private async pingIP(ip: string, timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeoutHandle = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, timeout);

      socket.connect(80, ip, () => {
        clearTimeout(timeoutHandle);
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        clearTimeout(timeoutHandle);
        resolve(false);
      });
    });
  }

  /**
   * Scan multiple ports on an IP
   */
  private async scanPorts(
    ip: string,
    ports: number[],
    timeout: number
  ): Promise<{ ssh?: boolean; rdp?: boolean; vnc?: boolean }> {
    const results = { ssh: false, rdp: false, vnc: false };

    await Promise.all(
      ports.map(async (port) => {
        const isOpen = await this.checkPort(ip, port, timeout);
        if (isOpen) {
          if (port === NetworkScanner.COMMON_PORTS.ssh) results.ssh = true;
          if (port === NetworkScanner.COMMON_PORTS.rdp) results.rdp = true;
          if (port === NetworkScanner.COMMON_PORTS.vnc) results.vnc = true;
        }
      })
    );

    return results;
  }

  /**
   * Check if specific port is open
   */
  private async checkPort(ip: string, port: number, timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeoutHandle = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, timeout);

      socket.connect(port, ip, () => {
        clearTimeout(timeoutHandle);
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        clearTimeout(timeoutHandle);
        resolve(false);
      });
    });
  }

  /**
   * Resolve hostname from IP
   */
  private async resolveHostname(ip: string): Promise<string | undefined> {
    try {
      return new Promise((resolve) => {
        dns.reverse(ip, (err, hostnames) => {
          if (err || !hostnames || hostnames.length === 0) {
            resolve(undefined);
          } else {
            resolve(hostnames[0]);
          }
        });
      });
    } catch {
      return undefined;
    }
  }

  /**
   * Parse network range (CIDR, range, or single IP)
   */
  private parseNetworkRange(networkRange: string): NetworkRange[] {
    // CIDR notation (e.g., 192.168.1.0/24)
    if (networkRange.includes('/')) {
      return [this.parseCIDR(networkRange)];
    }

    // IP range (e.g., 192.168.1.1-192.168.1.254)
    if (networkRange.includes('-')) {
      return [this.parseIPRange(networkRange)];
    }

    // Single IP
    return [{
      start: networkRange,
      end: networkRange,
      cidr: networkRange
    }];
  }

  /**
   * Parse CIDR notation
   */
  private parseCIDR(cidr: string): NetworkRange {
    const [network, prefix] = cidr.split('/');
    const prefixNum = parseInt(prefix, 10);
    
    const networkInt = this.ipToInt(network);
    const mask = this.prefixToMask(prefixNum);
    const startInt = networkInt & mask;
    const endInt = startInt | ~mask;

    return {
      start: this.intToIp(startInt),
      end: this.intToIp(endInt),
      cidr
    };
  }

  /**
   * Parse IP range
   */
  private parseIPRange(range: string): NetworkRange {
    const [start, end] = range.split('-');
    return {
      start: start.trim(),
      end: end.trim(),
      cidr: `${start.trim()}-${end.trim()}`
    };
  }

  /**
   * Generate IP addresses from ranges
   */
  private generateIPAddresses(ranges: NetworkRange[]): string[] {
    const ips: string[] = [];

    ranges.forEach(range => {
      const startInt = this.ipToInt(range.start);
      const endInt = this.ipToInt(range.end);

      for (let i = startInt; i <= endInt; i++) {
        ips.push(this.intToIp(i));
      }
    });

    return ips;
  }

  /**
   * Create batches for concurrent processing
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Select primary port based on services and preferred protocols
   */
  private selectPrimaryPort(
    services: { ssh?: boolean; rdp?: boolean; vnc?: boolean },
    protocols: ('ssh' | 'rdp' | 'vnc')[]
  ): number {
    for (const protocol of protocols) {
      if (services[protocol]) {
        return NetworkScanner.COMMON_PORTS[protocol];
      }
    }

    // Fallback to SSH
    return NetworkScanner.COMMON_PORTS.ssh;
  }

  /**
   * Convert IP string to integer
   */
  private ipToInt(ip: string): number {
    const parts = ip.split('.').map(Number);
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  }

  /**
   * Convert integer to IP string
   */
  private intToIp(int: number): string {
    return [
      (int >>> 24) & 0xff,
      (int >>> 16) & 0xff,
      (int >>> 8) & 0xff,
      int & 0xff
    ].join('.');
  }

  /**
   * Convert prefix length to subnet mask
   */
  private prefixToMask(prefix: number): number {
    if (prefix === 0) return 0;
    return (0xffffffff << (32 - prefix)) >>> 0;
  }

  /**
   * Add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get scan history
   */
  getScanHistory(): Map<string, DiscoveredHost[]> {
    return new Map(this.scanHistory);
  }

  /**
   * Get last scan time
   */
  getLastScanTime(): Date | null {
    return this.lastScanTime;
  }

  /**
   * Clear scan history
   */
  clearHistory(): void {
    this.scanHistory.clear();
    this.lastScanTime = null;
  }

  /**
   * Get common network ranges for scanning
   */
  getCommonNetworkRanges(): string[] {
    return [
      '192.168.1.0/24',
      '192.168.0.0/24',
      '10.0.0.0/24',
      '172.16.0.0/24'
    ];
  }

  /**
   * Validate network range format
   */
  validateNetworkRange(range: string): { isValid: boolean; error?: string } {
    try {
      const ranges = this.parseNetworkRange(range);
      if (ranges.length === 0) {
        return { isValid: false, error: 'Invalid network range format' };
      }
      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: error.message };
    }
  }
}

export default NetworkScanner;
