const { EventEmitter } = require('events');
const Store = require('electron-store');
const crypto = require('crypto');

class AuthManager extends EventEmitter {
  constructor() {
    super();
    this.store = new Store({
      name: 'auth-config',
      clearInvalidConfig: true
    });
    
    this.authTokens = new Map(); // projectId -> token info
    this.credentials = new Map(); // projectId -> encrypted credentials
    
    // Define authentication methods for each project
    this.authMethods = {
      'open-computer-use': {
        type: 'oauth',
        config: {
          authUrl: 'http://localhost:3000/auth/login',
          tokenUrl: 'http://localhost:3000/auth/token',
          clientId: 'unified-platform',
          scope: 'admin'
        }
      },
      'ui-tars-desktop': {
        type: 'api-key',
        config: {
          headerName: 'X-API-Key',
          validateUrl: 'http://localhost:9001/api/validate'
        }
      },
      'gbox': {
        type: 'token',
        config: {
          tokenHeader: 'Authorization',
          tokenPrefix: 'Bearer ',
          validateUrl: 'http://localhost:8080/api/validate'
        }
      },
      'bytebot': {
        type: 'oauth',
        config: {
          authUrl: 'http://localhost:3001/auth/login',
          tokenUrl: 'http://localhost:3001/auth/token',
          clientId: 'unified-platform',
          scope: 'user'
        }
      }
    };
    
    this.initializeAuth();
  }

  initializeAuth() {
    // Load existing tokens from store
    const storedTokens = this.store.get('authTokens', {});
    for (const [projectId, tokenData] of Object.entries(storedTokens)) {
      this.authTokens.set(projectId, tokenData);
    }

    // Load encrypted credentials
    const storedCredentials = this.store.get('credentials', {});
    for (const [projectId, encryptedCreds] of Object.entries(storedCredentials)) {
      this.credentials.set(projectId, encryptedCreds);
    }

    console.log(`[AuthManager] Initialized with ${this.authTokens.size} stored tokens`);
  }

  async authenticatePlatform(projectId, credentials) {
    const authMethod = this.authMethods[projectId];
    if (!authMethod) {
      throw new Error(`No authentication method configured for project ${projectId}`);
    }

    try {
      let tokens;
      
      switch (authMethod.type) {
        case 'oauth':
          tokens = await this.performOAuthAuth(projectId, credentials, authMethod.config);
          break;
        case 'api-key':
          tokens = await this.performApiKeyAuth(projectId, credentials, authMethod.config);
          break;
        case 'token':
          tokens = await this.performTokenAuth(projectId, credentials, authMethod.config);
          break;
        default:
          throw new Error(`Unsupported authentication type: ${authMethod.type}`);
      }

      // Store tokens securely
      this.authTokens.set(projectId, {
        ...tokens,
        projectId,
        acquiredAt: new Date().toISOString(),
        expiresAt: tokens.expiresIn ? 
          new Date(Date.now() + tokens.expiresIn * 1000).toISOString() : 
          null
      });

      // Store encrypted credentials
      this.storeCredentials(projectId, credentials);

      // Persist to store
      this.persistAuthData();

      // Emit authentication event
      this.emit('auth-success', { projectId, tokens });

      return tokens;

    } catch (error) {
      console.error(`[AuthManager] Authentication failed for ${projectId}:`, error);
      this.emit('auth-failure', { projectId, error: error.message });
      throw error;
    }
  }

  async performOAuthAuth(projectId, credentials, config) {
    const axios = require('axios');
    
    // Step 1: Exchange credentials for tokens
    const tokenResponse = await axios.post(config.tokenUrl, {
      grant_type: 'password',
      username: credentials.username,
      password: credentials.password,
      client_id: config.clientId,
      scope: config.scope
    }, {
      timeout: 10000
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
      tokenType: 'Bearer'
    };
  }

  async performApiKeyAuth(projectId, credentials, config) {
    const axios = require('axios');
    
    // Validate API key
    const response = await axios.get(config.validateUrl, {
      headers: {
        [config.headerName]: credentials.apiKey
      },
      timeout: 5000
    });

    if (!response.data.valid) {
      throw new Error('Invalid API key');
    }

    return {
      apiKey: credentials.apiKey,
      validated: true,
      userInfo: response.data.user
    };
  }

  async performTokenAuth(projectId, credentials, config) {
    const axios = require('axios');
    
    // Validate token
    const response = await axios.get(config.validateUrl, {
      headers: {
        [config.tokenHeader]: `${config.tokenPrefix}${credentials.token}`
      },
      timeout: 5000
    });

    if (!response.data.valid) {
      throw new Error('Invalid token');
    }

    return {
      token: credentials.token,
      validated: true,
      userInfo: response.data.user
    };
  }

  async refreshAuthTokens(projectId) {
    const tokenData = this.authTokens.get(projectId);
    if (!tokenData) {
      throw new Error(`No tokens found for project ${projectId}`);
    }

    const authMethod = this.authMethods[projectId];
    if (!authMethod || authMethod.type !== 'oauth') {
      throw new Error(`Token refresh not supported for project ${projectId}`);
    }

    try {
      const axios = require('axios');
      const response = await axios.post(authMethod.config.tokenUrl, {
        grant_type: 'refresh_token',
        refresh_token: tokenData.refreshToken,
        client_id: authMethod.config.clientId
      });

      const { access_token, refresh_token, expires_in } = response.data;

      // Update stored tokens
      const updatedTokens = {
        ...tokenData,
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresIn: expires_in,
        acquiredAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + expires_in * 1000).toISOString()
      };

      this.authTokens.set(projectId, updatedTokens);
      this.persistAuthData();

      this.emit('token-refreshed', { projectId, tokens: updatedTokens });

      return updatedTokens;

    } catch (error) {
      console.error(`[AuthManager] Token refresh failed for ${projectId}:`, error);
      
      // Clear invalid tokens
      this.authTokens.delete(projectId);
      this.persistAuthData();
      
      this.emit('token-refresh-failed', { projectId, error: error.message });
      throw error;
    }
  }

  async validatePlatformAuth(projectId) {
    const tokenData = this.authTokens.get(projectId);
    if (!tokenData) {
      return { valid: false, reason: 'No tokens found' };
    }

    // Check if token is expired
    if (tokenData.expiresAt && new Date() >= new Date(tokenData.expiresAt)) {
      // Try to refresh if it's an OAuth token
      const authMethod = this.authMethods[projectId];
      if (authMethod && authMethod.type === 'oauth') {
        try {
          await this.refreshAuthTokens(projectId);
          return { valid: true, refreshed: true };
        } catch (error) {
          return { valid: false, reason: 'Token expired and refresh failed' };
        }
      } else {
        return { valid: false, reason: 'Token expired' };
      }
    }

    // Validate token with platform
    try {
      const authMethod = this.authMethods[projectId];
      if (!authMethod) {
        return { valid: false, reason: 'No auth method configured' };
      }

      const axios = require('axios');
      const headers = {};

      switch (authMethod.type) {
        case 'oauth':
          headers['Authorization'] = `Bearer ${tokenData.accessToken}`;
          break;
        case 'api-key':
          headers[authMethod.config.headerName] = tokenData.apiKey;
          break;
        case 'token':
          headers[authMethod.config.tokenHeader] = `${authMethod.config.tokenPrefix}${tokenData.token}`;
          break;
      }

      const response = await axios.get(authMethod.config.validateUrl, {
        headers,
        timeout: 5000
      });

      return {
        valid: response.data.valid,
        userInfo: response.data.user,
        refreshed: false
      };

    } catch (error) {
      return { valid: false, reason: 'Validation request failed' };
    }
  }

  getAuthHeaders(projectId) {
    const tokenData = this.authTokens.get(projectId);
    if (!tokenData) {
      return {};
    }

    const authMethod = this.authMethods[projectId];
    if (!authMethod) {
      return {};
    }

    const headers = {};

    switch (authMethod.type) {
      case 'oauth':
        headers['Authorization'] = `Bearer ${tokenData.accessToken}`;
        break;
      case 'api-key':
        headers[authMethod.config.headerName] = tokenData.apiKey;
        break;
      case 'token':
        headers[authMethod.config.tokenHeader] = `${authMethod.config.tokenPrefix}${tokenData.token}`;
        break;
    }

    return headers;
  }

  storeCredentials(projectId, credentials) {
    const encrypted = this.encryptCredentials(credentials);
    this.credentials.set(projectId, encrypted);
  }

  encryptCredentials(credentials) {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher('aes-256-cbc', key);
    cipher.setAutoPadding(true);
    
    let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      data: encrypted,
      iv: iv.toString('hex')
    };
  }

  decryptCredentials(encryptedCreds) {
    try {
      const key = this.getEncryptionKey();
      const decipher = crypto.createDecipher('aes-256-cbc', key);
      decipher.setAutoPadding(true);
      
      let decrypted = decipher.update(encryptedCreds.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('[AuthManager] Failed to decrypt credentials:', error);
      return null;
    }
  }

  getEncryptionKey() {
    // In a real application, this should be more secure
    // For now, using a combination of user data and machine info
    const userData = require('os').userInfo();
    const machineId = require('os').hostname();
    return crypto.createHash('sha256')
      .update(`${userData.username}_${machineId}_unified_platform_key`)
      .digest('hex');
  }

  persistAuthData() {
    // Convert Maps to objects for storage
    const tokensObj = Object.fromEntries(this.authTokens);
    const credsObj = Object.fromEntries(this.credentials);
    
    this.store.set('authTokens', tokensObj);
    this.store.set('credentials', credsObj);
  }

  clearAuthData(projectId) {
    this.authTokens.delete(projectId);
    this.credentials.delete(projectId);
    this.persistAuthData();
    
    this.emit('auth-cleared', { projectId });
  }

  clearAllAuth() {
    this.authTokens.clear();
    this.credentials.clear();
    this.store.clear();
    
    this.emit('all-auth-cleared');
  }

  getAuthStatus(projectId) {
    const tokenData = this.authTokens.get(projectId);
    const encryptedCreds = this.credentials.get(projectId);
    
    return {
      authenticated: !!tokenData,
      hasCredentials: !!encryptedCreds,
      expiresAt: tokenData?.expiresAt,
      acquiredAt: tokenData?.acquiredAt,
      authMethod: this.authMethods[projectId]?.type || 'unknown'
    };
  }

  getAllAuthStatus() {
    const status = {};
    for (const projectId of Object.keys(this.authMethods)) {
      status[projectId] = this.getAuthStatus(projectId);
    }
    return status;
  }

  getStoredCredentials(projectId) {
    const encrypted = this.credentials.get(projectId);
    if (!encrypted) {
      return null;
    }
    
    return this.decryptCredentials(encrypted);
  }

  // Utility method for getting authenticated axios instance
  getAuthenticatedAxios(projectId) {
    const axios = require('axios');
    const headers = this.getAuthHeaders(projectId);
    
    return axios.create({
      headers,
      timeout: 30000
    });
  }
}

module.exports = AuthManager;
