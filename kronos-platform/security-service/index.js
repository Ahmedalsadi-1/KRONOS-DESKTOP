const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { createClient } = require('redis');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const crypto = require('crypto');
const cron = require('node-cron');

// KRONOS Security Service - Enterprise-grade authentication and authorization
class KronosSecurityService {
  constructor(port = 6000) {
    this.port = port;
    this.app = express();
    this.redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    this.logger = this.setupLogger();

    // Security data stores
    this.users = new Map();
    this.sessions = new Map();
    this.apiKeys = new Map();
    this.roles = new Map();
    this.permissions = new Map();
    this.auditLogs = [];

    this.setupMiddleware();
    this.setupRoutes();
    this.setupDefaultRoles();
    this.setupSecurityMonitoring();
  }

  setupLogger() {
    return winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({
          filename: 'logs/security-service.log',
          maxsize: 10 * 1024 * 1024,
          maxFiles: 5
        })
      ]
    });
  }

  setupMiddleware() {
    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    this.app.use(express.json({ limit: '1mb' }));

    // Global rate limiting
    const globalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // limit each IP to 1000 requests per windowMs
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: 15 * 60
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/auth', globalLimiter);

    // Stricter rate limiting for auth endpoints
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // limit each IP to 5 auth attempts per windowMs
      message: {
        error: 'Too many authentication attempts, please try again later.',
        retryAfter: 15 * 60
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/auth/login', authLimiter);
    this.app.use('/auth/register', authLimiter);

    // Request logging with security focus
    this.app.use((req, res, next) => {
      const correlationId = req.headers['x-correlation-id'] ||
                           req.headers['x-request-id'] ||
                           crypto.randomUUID();

      req.correlationId = correlationId;
      res.setHeader('x-correlation-id', correlationId);

      this.logger.info('Security service request', {
        correlationId,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        securityLevel: this.assessRequestSecurity(req)
      });

      // Log security events
      if (this.isSuspiciousRequest(req)) {
        this.logSecurityEvent('suspicious_request', {
          correlationId,
          ip: req.ip,
          url: req.url,
          userAgent: req.get('User-Agent'),
          headers: req.headers
        });
      }

      next();
    });
  }

  setupRoutes() {
    // Authentication routes
    this.app.post('/auth/register', this.registerUser.bind(this));
    this.app.post('/auth/login', this.loginUser.bind(this));
    this.app.post('/auth/logout', this.authenticate.bind(this), this.logoutUser.bind(this));
    this.app.post('/auth/refresh', this.refreshToken.bind(this));
    this.app.get('/auth/me', this.authenticate.bind(this), this.getCurrentUser.bind(this));

    // API Key management
    this.app.post('/auth/api-keys', this.authenticate.bind(this), this.createApiKey.bind(this));
    this.app.get('/auth/api-keys', this.authenticate.bind(this), this.listApiKeys.bind(this));
    this.app.delete('/auth/api-keys/:keyId', this.authenticate.bind(this), this.deleteApiKey.bind(this));

    // Role and permission management
    this.app.post('/auth/roles', this.authenticate.bind(this), this.authorize.bind(this, ['admin']), this.createRole.bind(this));
    this.app.get('/auth/roles', this.authenticate.bind(this), this.listRoles.bind(this));
    this.app.put('/auth/roles/:roleId', this.authenticate.bind(this), this.authorize.bind(this, ['admin']), this.updateRole.bind(this));
    this.app.delete('/auth/roles/:roleId', this.authenticate.bind(this), this.authorize.bind(this, ['admin']), this.deleteRole.bind(this));

    // User management
    this.app.get('/auth/users', this.authenticate.bind(this), this.authorize.bind(this, ['admin']), this.listUsers.bind(this));
    this.app.put('/auth/users/:userId/roles', this.authenticate.bind(this), this.authorize.bind(this, ['admin']), this.assignUserRoles.bind(this));
    this.app.put('/auth/users/:userId/status', this.authenticate.bind(this), this.authorize.bind(this, ['admin']), this.updateUserStatus.bind(this));

    // Audit and compliance
    this.app.get('/auth/audit', this.authenticate.bind(this), this.authorize.bind(this, ['admin']), this.getAuditLogs.bind(this));
    this.app.get('/auth/sessions', this.authenticate.bind(this), this.getActiveSessions.bind(this));

    // Security monitoring
    this.app.get('/auth/security/status', this.authenticate.bind(this), this.authorize.bind(this, ['admin']), this.getSecurityStatus.bind(this));
    this.app.post('/auth/security/lockdown', this.authenticate.bind(this), this.authorize.bind(this, ['admin']), this.activateLockdown.bind(this));

    // Health check
    this.app.get('/health', this.healthCheck.bind(this));
  }

  // Authentication middleware
  async authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'];

    try {
      let user = null;

      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        user = await this.verifyJWT(token);
      } else if (apiKey) {
        user = await this.verifyApiKey(apiKey);
      }

      if (!user) {
        return res.status(401).json({
          error: 'Authentication required',
          correlationId: req.correlationId
        });
      }

      // Check if user is active
      if (user.status !== 'active') {
        return res.status(403).json({
          error: 'Account is not active',
          correlationId: req.correlationId
        });
      }

      req.user = user;
      next();
    } catch (error) {
      this.logger.error('Authentication failed', {
        error: error.message,
        correlationId: req.correlationId
      });

      res.status(401).json({
        error: 'Invalid authentication',
        correlationId: req.correlationId
      });
    }
  }

  // Authorization middleware
  authorize(requiredRoles) {
    return (req, res, next) => {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          error: 'Authentication required',
          correlationId: req.correlationId
        });
      }

      const hasPermission = requiredRoles.some(role =>
        user.roles.includes(role) || user.roles.includes('admin')
      );

      if (!hasPermission) {
        this.logSecurityEvent('unauthorized_access', {
          userId: user.id,
          requiredRoles,
          userRoles: user.roles,
          correlationId: req.correlationId
        });

        return res.status(403).json({
          error: 'Insufficient permissions',
          requiredRoles,
          correlationId: req.correlationId
        });
      }

      next();
    };
  }

  // User registration
  async registerUser(req, res) {
    try {
      const { email, password, name, organizationId } = req.body;

      // Validate input
      if (!email || !password || !name) {
        return res.status(400).json({
          error: 'Email, password, and name are required',
          correlationId: req.correlationId
        });
      }

      // Check if user already exists
      const existingUser = Array.from(this.users.values()).find(u => u.email === email);
      if (existingUser) {
        return res.status(409).json({
          error: 'User already exists',
          correlationId: req.correlationId
        });
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user
      const userId = crypto.randomUUID();
      const user = {
        id: userId,
        email,
        name,
        passwordHash,
        organizationId: organizationId || 'default',
        roles: ['user'],
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null,
        loginAttempts: 0,
        lockedUntil: null
      };

      this.users.set(userId, user);

      // Generate tokens
      const tokens = await this.generateTokens(user);

      this.logSecurityEvent('user_registered', {
        userId,
        email,
        correlationId: req.correlationId
      });

      res.status(201).json({
        user: {
          id: userId,
          email,
          name,
          roles: user.roles,
          status: user.status
        },
        tokens,
        correlationId: req.correlationId
      });
    } catch (error) {
      this.logger.error('User registration failed', { error });
      res.status(500).json({ error: 'Registration failed' });
    }
  }

  // User login
  async loginUser(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: 'Email and password are required',
          correlationId: req.correlationId
        });
      }

      // Find user
      const user = Array.from(this.users.values()).find(u => u.email === email);
      if (!user) {
        return res.status(401).json({
          error: 'Invalid credentials',
          correlationId: req.correlationId
        });
      }

      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        return res.status(423).json({
          error: 'Account is temporarily locked',
          lockedUntil: user.lockedUntil,
          correlationId: req.correlationId
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        user.loginAttempts++;
        this.users.set(user.id, user);

        // Lock account after 5 failed attempts
        if (user.loginAttempts >= 5) {
          user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
          this.logSecurityEvent('account_locked', {
            userId: user.id,
            email,
            correlationId: req.correlationId
          });
        }

        return res.status(401).json({
          error: 'Invalid credentials',
          correlationId: req.correlationId
        });
      }

      // Reset login attempts and update last login
      user.loginAttempts = 0;
      user.lockedUntil = null;
      user.lastLogin = new Date();
      this.users.set(user.id, user);

      // Generate tokens
      const tokens = await this.generateTokens(user);

      // Store session
      this.sessions.set(tokens.accessToken, {
        userId: user.id,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
      });

      this.logSecurityEvent('user_login', {
        userId: user.id,
        email,
        correlationId: req.correlationId
      });

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: user.roles,
          status: user.status
        },
        tokens,
        correlationId: req.correlationId
      });
    } catch (error) {
      this.logger.error('User login failed', { error });
      res.status(500).json({ error: 'Login failed' });
    }
  }

  // Logout user
  logoutUser(req, res) {
    const token = req.headers.authorization?.substring(7);
    if (token) {
      this.sessions.delete(token);
    }

    this.logSecurityEvent('user_logout', {
      userId: req.user.id,
      correlationId: req.correlationId
    });

    res.json({
      message: 'Logged out successfully',
      correlationId: req.correlationId
    });
  }

  // Refresh token
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          error: 'Refresh token is required',
          correlationId: req.correlationId
        });
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh-secret-key');
      const user = this.users.get(decoded.userId);

      if (!user) {
        return res.status(401).json({
          error: 'Invalid refresh token',
          correlationId: req.correlationId
        });
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      res.json({
        tokens,
        correlationId: req.correlationId
      });
    } catch (error) {
      res.status(401).json({
        error: 'Invalid refresh token',
        correlationId: req.correlationId
      });
    }
  }

  // Get current user
  getCurrentUser(req, res) {
    const user = req.user;
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles,
        status: user.status,
        lastLogin: user.lastLogin,
        organizationId: user.organizationId
      },
      correlationId: req.correlationId
    });
  }

  // API Key management
  async createApiKey(req, res) {
    const user = req.user;
    const { name, permissions, expiresIn } = req.body;

    const apiKey = crypto.randomBytes(32).toString('hex');
    const keyId = crypto.randomUUID();
    const hashedKey = await bcrypt.hash(apiKey, 10);

    const apiKeyData = {
      id: keyId,
      userId: user.id,
      name: name || 'API Key',
      keyHash: hashedKey,
      permissions: permissions || ['read'],
      createdAt: new Date(),
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
      lastUsed: null,
      status: 'active'
    };

    this.apiKeys.set(keyId, apiKeyData);

    this.logSecurityEvent('api_key_created', {
      userId: user.id,
      keyId,
      name,
      correlationId: req.correlationId
    });

    res.status(201).json({
      apiKey: `${keyId}:${apiKey}`, // Only shown once
      keyData: {
        id: keyId,
        name: apiKeyData.name,
        permissions: apiKeyData.permissions,
        expiresAt: apiKeyData.expiresAt,
        createdAt: apiKeyData.createdAt
      },
      correlationId: req.correlationId
    });
  }

  listApiKeys(req, res) {
    const user = req.user;
    const userApiKeys = Array.from(this.apiKeys.values())
      .filter(key => key.userId === user.id)
      .map(key => ({
        id: key.id,
        name: key.name,
        permissions: key.permissions,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt,
        lastUsed: key.lastUsed,
        status: key.status
      }));

    res.json({
      apiKeys: userApiKeys,
      correlationId: req.correlationId
    });
  }

  deleteApiKey(req, res) {
    const user = req.user;
    const { keyId } = req.params;

    const apiKey = this.apiKeys.get(keyId);
    if (!apiKey || apiKey.userId !== user.id) {
      return res.status(404).json({
        error: 'API key not found',
        correlationId: req.correlationId
      });
    }

    this.apiKeys.delete(keyId);

    this.logSecurityEvent('api_key_deleted', {
      userId: user.id,
      keyId,
      correlationId: req.correlationId
    });

    res.json({
      message: 'API key deleted successfully',
      correlationId: req.correlationId
    });
  }

  // Role and permission management
  createRole(req, res) {
    const { name, description, permissions } = req.body;

    if (!name || !permissions || !Array.isArray(permissions)) {
      return res.status(400).json({
        error: 'Name and permissions array are required',
        correlationId: req.correlationId
      });
    }

    const roleId = crypto.randomUUID();
    const role = {
      id: roleId,
      name,
      description: description || '',
      permissions,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.roles.set(roleId, role);

    res.status(201).json({
      role,
      correlationId: req.correlationId
    });
  }

  listRoles(req, res) {
    const roles = Array.from(this.roles.values());
    res.json({
      roles,
      count: roles.length,
      correlationId: req.correlationId
    });
  }

  updateRole(req, res) {
    const { roleId } = req.params;
    const updates = req.body;

    const role = this.roles.get(roleId);
    if (!role) {
      return res.status(404).json({
        error: 'Role not found',
        correlationId: req.correlationId
      });
    }

    Object.assign(role, updates, { updatedAt: new Date() });
    this.roles.set(roleId, role);

    res.json({
      role,
      correlationId: req.correlationId
    });
  }

  deleteRole(req, res) {
    const { roleId } = req.params;

    if (!this.roles.has(roleId)) {
      return res.status(404).json({
        error: 'Role not found',
        correlationId: req.correlationId
      });
    }

    this.roles.delete(roleId);
    res.json({
      message: 'Role deleted successfully',
      correlationId: req.correlationId
    });
  }

  // User management (admin only)
  listUsers(req, res) {
    const users = Array.from(this.users.values()).map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles,
      status: user.status,
      organizationId: user.organizationId,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    }));

    res.json({
      users,
      count: users.length,
      correlationId: req.correlationId
    });
  }

  assignUserRoles(req, res) {
    const { userId } = req.params;
    const { roles } = req.body;

    const user = this.users.get(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        correlationId: req.correlationId
      });
    }

    user.roles = roles;
    user.updatedAt = new Date();
    this.users.set(userId, user);

    this.logSecurityEvent('user_roles_updated', {
      userId,
      newRoles: roles,
      correlationId: req.correlationId
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles
      },
      correlationId: req.correlationId
    });
  }

  updateUserStatus(req, res) {
    const { userId } = req.params;
    const { status } = req.body;

    const user = this.users.get(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        correlationId: req.correlationId
      });
    }

    user.status = status;
    user.updatedAt = new Date();
    this.users.set(userId, user);

    this.logSecurityEvent('user_status_updated', {
      userId,
      newStatus: status,
      correlationId: req.correlationId
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        status: user.status
      },
      correlationId: req.correlationId
    });
  }

  // Audit and compliance
  getAuditLogs(req, res) {
    const { limit = 100, offset = 0, userId, action } = req.query;

    let logs = [...this.auditLogs];

    if (userId) {
      logs = logs.filter(log => log.userId === userId);
    }

    if (action) {
      logs = logs.filter(log => log.action === action);
    }

    const paginatedLogs = logs.slice(offset, offset + limit);

    res.json({
      logs: paginatedLogs,
      total: logs.length,
      limit: parseInt(limit),
      offset: parseInt(offset),
      correlationId: req.correlationId
    });
  }

  getActiveSessions(req, res) {
    const user = req.user;
    const userSessions = Array.from(this.sessions.entries())
      .filter(([token, session]) => session.userId === user.id)
      .map(([token, session]) => ({
        token: token.substring(0, 10) + '...', // Partial token for security
        createdAt: session.createdAt,
        expiresAt: session.expiresAt
      }));

    res.json({
      sessions: userSessions,
      count: userSessions.length,
      correlationId: req.correlationId
    });
  }

  // Security monitoring
  getSecurityStatus(req, res) {
    const securityMetrics = {
      totalUsers: this.users.size,
      activeUsers: Array.from(this.users.values()).filter(u => u.status === 'active').length,
      totalSessions: this.sessions.size,
      totalApiKeys: this.apiKeys.size,
      totalRoles: this.roles.size,
      auditLogEntries: this.auditLogs.length,
      recentSecurityEvents: this.auditLogs
        .filter(log => log.action.includes('security') || log.action.includes('auth'))
        .slice(-10),
      systemUptime: process.uptime(),
      timestamp: new Date().toISOString()
    };

    res.json({
      securityStatus: securityMetrics,
      correlationId: req.correlationId
    });
  }

  activateLockdown(req, res) {
    // Implementation for emergency lockdown
    this.logSecurityEvent('security_lockdown_activated', {
      userId: req.user.id,
      correlationId: req.correlationId
    });

    res.json({
      message: 'Security lockdown activated',
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId
    });
  }

  // Helper methods
  async generateTokens(user) {
    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        organizationId: user.organizationId,
        roles: user.roles,
        permissions: await this.getUserPermissions(user.roles),
        type: 'access'
      },
      process.env.JWT_SECRET || 'access-secret-key',
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      {
        userId: user.id,
        type: 'refresh'
      },
      process.env.JWT_REFRESH_SECRET || 'refresh-secret-key',
      { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
  }

  async getUserPermissions(roles) {
    const permissions = new Set();

    for (const roleName of roles) {
      const role = Array.from(this.roles.values()).find(r => r.name === roleName);
      if (role) {
        role.permissions.forEach(permission => permissions.add(permission));
      }
    }

    return Array.from(permissions);
  }

  async verifyJWT(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'access-secret-key');

      // Check if session is valid
      const session = this.sessions.get(token);
      if (!session || session.expiresAt < new Date()) {
        throw new Error('Session expired');
      }

      const user = this.users.get(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      throw error;
    }
  }

  async verifyApiKey(apiKey) {
    const [keyId, keySecret] = apiKey.split(':');

    const apiKeyData = this.apiKeys.get(keyId);
    if (!apiKeyData || apiKeyData.status !== 'active') {
      throw new Error('Invalid API key');
    }

    // Check expiration
    if (apiKeyData.expiresAt && apiKeyData.expiresAt < new Date()) {
      apiKeyData.status = 'expired';
      this.apiKeys.set(keyId, apiKeyData);
      throw new Error('API key expired');
    }

    // Verify key secret
    const isValid = await bcrypt.compare(keySecret, apiKeyData.keyHash);
    if (!isValid) {
      throw new Error('Invalid API key');
    }

    // Update last used
    apiKeyData.lastUsed = new Date();
    this.apiKeys.set(keyId, apiKeyData);

    return this.users.get(apiKeyData.userId);
  }

  setupDefaultRoles() {
    const defaultRoles = [
      {
        id: 'role-admin',
        name: 'admin',
        description: 'Full system access and management',
        permissions: [
          'users:read', 'users:write', 'users:delete',
          'roles:read', 'roles:write', 'roles:delete',
          'audit:read', 'security:manage',
          'workflows:read', 'workflows:write', 'workflows:execute',
          'services:read', 'services:write',
          'config:read', 'config:write'
        ]
      },
      {
        id: 'role-developer',
        name: 'developer',
        description: 'Development and workflow management access',
        permissions: [
          'workflows:read', 'workflows:write', 'workflows:execute',
          'services:read', 'config:read'
        ]
      },
      {
        id: 'role-operator',
        name: 'operator',
        description: 'System operation and monitoring access',
        permissions: [
          'workflows:read', 'workflows:execute',
          'services:read', 'audit:read'
        ]
      },
      {
        id: 'role-user',
        name: 'user',
        description: 'Basic user access',
        permissions: [
          'workflows:read', 'workflows:execute'
        ]
      }
    ];

    defaultRoles.forEach(role => {
      this.roles.set(role.id, role);
    });

    console.log(`Set up ${defaultRoles.length} default roles`);
  }

  setupSecurityMonitoring() {
    // Clean up expired sessions every hour
    cron.schedule('0 * * * *', () => {
      const now = new Date();
      const expiredSessions = [];

      for (const [token, session] of this.sessions) {
        if (session.expiresAt < now) {
          expiredSessions.push(token);
        }
      }

      expiredSessions.forEach(token => {
        this.sessions.delete(token);
      });

      if (expiredSessions.length > 0) {
        console.log(`Cleaned up ${expiredSessions.length} expired sessions`);
      }
    });

    // Security audit logging
    cron.schedule('0 0 * * *', () => {
      // Daily security summary
      const todayEvents = this.auditLogs.filter(log =>
        new Date(log.timestamp).toDateString() === new Date().toDateString()
      );

      console.log(`Daily security summary: ${todayEvents.length} events`);

      const securityEvents = todayEvents.filter(log =>
        log.action.includes('security') || log.action.includes('auth')
      );

      if (securityEvents.length > 0) {
        console.log(`Security events: ${securityEvents.length}`);
      }
    });
  }

  assessRequestSecurity(req) {
    let score = 0;

    // Check for suspicious patterns
    if (req.url.includes('../') || req.url.includes('..\\')) {
      score += 10; // Path traversal attempt
    }

    if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'DELETE') {
      score += 5; // Unusual HTTP method
    }

    if (req.headers['user-agent'] && req.headers['user-agent'].includes('sqlmap')) {
      score += 20; // Known security tool
    }

    return score > 0 ? 'high' : 'normal';
  }

  isSuspiciousRequest(req) {
    return this.assessRequestSecurity(req) === 'high';
  }

  logSecurityEvent(action, details) {
    const event = {
      id: crypto.randomUUID(),
      action,
      details,
      timestamp: new Date().toISOString(),
      ip: details.ip || 'unknown',
      userId: details.userId || null
    };

    this.auditLogs.push(event);

    // Keep only last 10,000 entries
    if (this.auditLogs.length > 10000) {
      this.auditLogs = this.auditLogs.slice(-5000);
    }

    this.logger.warn('Security event logged', event);
  }

  healthCheck(req, res) {
    res.json({
      status: 'healthy',
      service: 'security-service',
      version: '1.0.0',
      uptime: process.uptime(),
      users: this.users.size,
      sessions: this.sessions.size,
      roles: this.roles.size,
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId
    });
  }

  async start() {
    try {
      await this.redis.connect();
      console.log('Connected to Redis for security service');

      this.app.listen(this.port, () => {
        console.log(`🔒 KRONOS Security Service running on port ${this.port}`);
        console.log(`👥 Registered users: ${this.users.size}`);
        console.log(`🔑 Active sessions: ${this.sessions.size}`);
        console.log(`🛡️  Roles configured: ${this.roles.size}`);
        console.log(`📊 API keys active: ${this.apiKeys.size}`);
        console.log(`📝 Audit log entries: ${this.auditLogs.length}`);
        console.log(`🌐 Ready at http://localhost:${this.port}`);
      });
    } catch (error) {
      console.error('Failed to start Security Service:', error);
      throw error;
    }
  }

  async stop() {
    await this.redis.disconnect();
    console.log('Security Service stopped');
  }
}

// Create default admin user
const createDefaultAdmin = async () => {
  const securityService = new KronosSecurityService();

  // Create admin user
  const saltRounds = 12;
  const passwordHash = await require('bcrypt').hash('admin123!', saltRounds);

  const adminUser = {
    id: 'admin-user',
    email: 'admin@kronos.local',
    name: 'KRONOS Administrator',
    passwordHash,
    organizationId: 'kronos',
    roles: ['admin'],
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLogin: null,
    loginAttempts: 0,
    lockedUntil: null
  };

  securityService.users.set(adminUser.id, adminUser);
  console.log('Created default admin user: admin@kronos.local / admin123!');
};

// Start the security service
const securityService = new KronosSecurityService(6000);
createDefaultAdmin().then(() => {
  securityService.start().catch(console.error);
});

module.exports = KronosSecurityService;