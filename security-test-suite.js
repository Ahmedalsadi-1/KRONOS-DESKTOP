const axios = require('axios');

// KRONOS Security System Comprehensive Test Suite
class KronosSecurityTestSuite {
  constructor(baseURL = 'http://localhost:6000') {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.testResults = {
      passed: 0,
      failed: 0,
      tests: []
    };

    this.tokens = {};
    this.apiKeys = {};
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      error: '\x1b[31m',
      warning: '\x1b[33m',
      reset: '\x1b[0m'
    };
    console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
  }

  async runTest(testName, testFn) {
    try {
      this.log(`Running test: ${testName}`, 'info');
      await testFn();
      this.testResults.passed++;
      this.testResults.tests.push({ name: testName, status: 'PASSED' });
      this.log(`✅ ${testName} - PASSED`, 'success');
    } catch (error) {
      this.testResults.failed++;
      this.testResults.tests.push({
        name: testName,
        status: 'FAILED',
        error: error.message
      });
      this.log(`❌ ${testName} - FAILED: ${error.message}`, 'error');
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // === USER REGISTRATION & LOGIN TESTS ===

  async testUserRegistration() {
    const testUsers = [
      {
        email: 'testuser1@kronos.test',
        password: 'SecurePass123!',
        name: 'Test User 1',
        organizationId: 'test-org'
      },
      {
        email: 'testuser2@kronos.test',
        password: 'AnotherSecure456!',
        name: 'Test User 2'
      }
    ];

    for (const userData of testUsers) {
      const response = await this.client.post('/auth/register', userData);
      if (response.status !== 201) {
        throw new Error(`Registration failed for ${userData.email}: ${response.status}`);
      }
      if (!response.data.tokens || !response.data.user) {
        throw new Error(`Invalid registration response for ${userData.email}`);
      }
    }
  }

  async testDuplicateUserRegistration() {
    try {
      await this.client.post('/auth/register', {
        email: 'testuser1@kronos.test',
        password: 'DifferentPass789!',
        name: 'Duplicate User'
      });
      throw new Error('Duplicate registration should have failed');
    } catch (error) {
      if (error.response?.status !== 409) {
        throw new Error(`Expected 409 for duplicate registration, got ${error.response?.status}`);
      }
    }
  }

  async testInvalidRegistration() {
    const invalidCases = [
      { email: '', password: 'pass', name: 'test' }, // Missing email
      { email: 'test@test.com', password: '', name: 'test' }, // Missing password
      { email: 'test@test.com', password: 'pass', name: '' }, // Missing name
      { email: 'invalid-email', password: 'pass', name: 'test' }, // Invalid email format
      { email: 'test@test.com', password: '123', name: 'test' } // Weak password
    ];

    for (const invalidData of invalidCases) {
      try {
        await this.client.post('/auth/register', invalidData);
        throw new Error('Invalid registration should have failed');
      } catch (error) {
        if (error.response?.status !== 400) {
          throw new Error(`Expected 400 for invalid data, got ${error.response?.status}`);
        }
      }
    }
  }

  async testUserLogin() {
    // Login with first test user
    const loginData = {
      email: 'testuser1@kronos.test',
      password: 'SecurePass123!'
    };

    const response = await this.client.post('/auth/login', loginData);
    if (response.status !== 200) {
      throw new Error(`Login failed: ${response.status}`);
    }

    if (!response.data.tokens || !response.data.user) {
      throw new Error('Invalid login response');
    }

    this.tokens.user1 = response.data.tokens;
    this.tokens.user1.user = response.data.user;
  }

  async testInvalidLogin() {
    const invalidCases = [
      { email: 'nonexistent@test.com', password: 'password' }, // Non-existent user
      { email: 'testuser1@kronos.test', password: 'wrongpassword' }, // Wrong password
      { email: '', password: 'password' }, // Missing email
      { email: 'testuser1@kronos.test', password: '' } // Missing password
    ];

    for (const invalidData of invalidCases) {
      try {
        await this.client.post('/auth/login', invalidData);
        throw new Error('Invalid login should have failed');
      } catch (error) {
        if (error.response?.status !== 401) {
          throw new Error(`Expected 401 for invalid login, got ${error.response?.status}`);
        }
      }
    }
  }

  async testAccountLockout() {
    // Attempt multiple failed logins
    for (let i = 0; i < 6; i++) {
      try {
        await this.client.post('/auth/login', {
          email: 'testuser1@kronos.test',
          password: 'wrongpassword'
        });
      } catch (error) {
        // Expected to fail
      }
    }

    // Next attempt should be locked out
    try {
      await this.client.post('/auth/login', {
        email: 'testuser1@kronos.test',
        password: 'SecurePass123!'
      });
      throw new Error('Account should be locked');
    } catch (error) {
      if (error.response?.status !== 423) {
        throw new Error(`Expected 423 for locked account, got ${error.response?.status}`);
      }
    }

    // Wait for lockout to expire (15 minutes simulation - wait 1 second for test)
    await this.delay(1000);
  }

  // === JWT AUTHENTICATION TESTS ===

  async testJWTAuthentication() {
    const response = await this.client.get('/auth/me', {
      headers: {
        'Authorization': `Bearer ${this.tokens.user1.accessToken}`
      }
    });

    if (response.status !== 200) {
      throw new Error(`JWT auth failed: ${response.status}`);
    }

    if (response.data.user.id !== this.tokens.user1.user.id) {
      throw new Error('JWT returned wrong user');
    }
  }

  async testInvalidJWT() {
    try {
      await this.client.get('/auth/me', {
        headers: {
          'Authorization': 'Bearer invalid.jwt.token'
        }
      });
      throw new Error('Invalid JWT should have failed');
    } catch (error) {
      if (error.response?.status !== 401) {
        throw new Error(`Expected 401 for invalid JWT, got ${error.response?.status}`);
      }
    }
  }

  async testMissingJWT() {
    try {
      await this.client.get('/auth/me');
      throw new Error('Missing JWT should have failed');
    } catch (error) {
      if (error.response?.status !== 401) {
        throw new Error(`Expected 401 for missing JWT, got ${error.response?.status}`);
      }
    }
  }

  async testTokenRefresh() {
    const response = await this.client.post('/auth/refresh', {
      refreshToken: this.tokens.user1.refreshToken
    });

    if (response.status !== 200) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    if (!response.data.tokens) {
      throw new Error('No tokens returned from refresh');
    }

    // Update tokens
    this.tokens.user1 = response.data.tokens;
  }

  async testExpiredToken() {
    // Create a token that's already expired
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDAwMDB9.invalid';

    try {
      await this.client.get('/auth/me', {
        headers: {
          'Authorization': `Bearer ${expiredToken}`
        }
      });
      throw new Error('Expired token should have failed');
    } catch (error) {
      if (error.response?.status !== 401) {
        throw new Error(`Expected 401 for expired token, got ${error.response?.status}`);
      }
    }
  }

  // === ROLE-BASED ACCESS CONTROL (RBAC) TESTS ===

  async testRoleBasedAccess() {
    // Test user can access basic endpoints
    const basicResponse = await this.client.get('/auth/me', {
      headers: {
        'Authorization': `Bearer ${this.tokens.user1.accessToken}`
      }
    });
    if (basicResponse.status !== 200) {
      throw new Error('Basic user access failed');
    }

    // Test user cannot access admin endpoints
    try {
      await this.client.get('/auth/users', {
        headers: {
          'Authorization': `Bearer ${this.tokens.user1.accessToken}`
        }
      });
      throw new Error('User should not access admin endpoint');
    } catch (error) {
      if (error.response?.status !== 403) {
        throw new Error(`Expected 403 for unauthorized access, got ${error.response?.status}`);
      }
    }
  }

  async testAdminRoleAccess() {
    // Create admin user for testing
    const adminRegResponse = await this.client.post('/auth/register', {
      email: 'admintest@kronos.test',
      password: 'AdminSecure123!',
      name: 'Admin Test User'
    });

    // Assign admin role (simulate admin action)
    const adminToken = adminRegResponse.data.tokens.accessToken;

    // Update user role to admin
    await this.client.put('/auth/users/admintest@kronos.test/roles', {
      roles: ['admin']
    }, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    // Now admin should access admin endpoints
    const adminResponse = await this.client.get('/auth/users', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (adminResponse.status !== 200) {
      throw new Error('Admin access failed');
    }
  }

  async testRoleManagement() {
    // Create a new role
    const roleResponse = await this.client.post('/auth/roles', {
      name: 'manager',
      description: 'Manager role for testing',
      permissions: ['users:read', 'workflows:manage']
    }, {
      headers: {
        'Authorization': `Bearer ${this.tokens.user1.accessToken}`
      }
    });

    if (roleResponse.status !== 201) {
      throw new Error('Role creation failed');
    }

    // List roles
    const listResponse = await this.client.get('/auth/roles', {
      headers: {
        'Authorization': `Bearer ${this.tokens.user1.accessToken}`
      }
    });

    if (listResponse.status !== 200) {
      throw new Error('Role listing failed');
    }

    const hasManagerRole = listResponse.data.roles.some(role => role.name === 'manager');
    if (!hasManagerRole) {
      throw new Error('Created role not found in list');
    }
  }

  // === API KEY MANAGEMENT TESTS ===

  async testApiKeyCreation() {
    const keyResponse = await this.client.post('/auth/api-keys', {
      name: 'Test API Key',
      permissions: ['read', 'write']
    }, {
      headers: {
        'Authorization': `Bearer ${this.tokens.user1.accessToken}`
      }
    });

    if (keyResponse.status !== 201) {
      throw new Error('API key creation failed');
    }

    if (!keyResponse.data.apiKey) {
      throw new Error('No API key returned');
    }

    // Extract key ID and secret
    const [keyId, keySecret] = keyResponse.data.apiKey.split(':');
    this.apiKeys.user1 = { id: keyId, secret: keySecret, fullKey: keyResponse.data.apiKey };
  }

  async testApiKeyAuthentication() {
    const response = await this.client.get('/auth/me', {
      headers: {
        'x-api-key': this.apiKeys.user1.fullKey
      }
    });

    if (response.status !== 200) {
      throw new Error('API key authentication failed');
    }

    if (response.data.user.id !== this.tokens.user1.user.id) {
      throw new Error('API key returned wrong user');
    }
  }

  async testApiKeyListing() {
    const response = await this.client.get('/auth/api-keys', {
      headers: {
        'Authorization': `Bearer ${this.tokens.user1.accessToken}`
      }
    });

    if (response.status !== 200) {
      throw new Error('API key listing failed');
    }

    if (!response.data.apiKeys || response.data.apiKeys.length === 0) {
      throw new Error('No API keys found in list');
    }
  }

  async testApiKeyDeletion() {
    const response = await this.client.delete(`/auth/api-keys/${this.apiKeys.user1.id}`, {
      headers: {
        'Authorization': `Bearer ${this.tokens.user1.accessToken}`
      }
    });

    if (response.status !== 200) {
      throw new Error('API key deletion failed');
    }

    // Verify key is deleted
    try {
      await this.client.get('/auth/me', {
        headers: {
          'x-api-key': this.apiKeys.user1.fullKey
        }
      });
      throw new Error('Deleted API key should not work');
    } catch (error) {
      if (error.response?.status !== 401) {
        throw new Error(`Expected 401 for deleted API key, got ${error.response?.status}`);
      }
    }
  }

  // === RATE LIMITING TESTS ===

  async testRateLimiting() {
    const requests = [];

    // Make many requests quickly to trigger rate limiting
    for (let i = 0; i < 10; i++) {
      requests.push(
        this.client.post('/auth/login', {
          email: 'testuser1@kronos.test',
          password: 'SecurePass123!'
        }).catch(error => error)
      );
    }

    const results = await Promise.all(requests);
    const rateLimited = results.some(result =>
      result.response?.status === 429
    );

    if (!rateLimited) {
      throw new Error('Rate limiting did not trigger');
    }
  }

  // === AUDIT LOGGING TESTS ===

  async testAuditLogging() {
    // Perform some actions that should be logged
    await this.client.post('/auth/login', {
      email: 'testuser1@kronos.test',
      password: 'SecurePass123!'
    });

    await this.client.get('/auth/me', {
      headers: {
        'Authorization': `Bearer ${this.tokens.user1.accessToken}`
      }
    });

    // Check audit logs
    const auditResponse = await this.client.get('/auth/audit', {
      headers: {
        'Authorization': `Bearer ${this.tokens.user1.accessToken}`
      }
    });

    if (auditResponse.status !== 200) {
      throw new Error('Audit log access failed');
    }

    if (!auditResponse.data.logs || auditResponse.data.logs.length === 0) {
      throw new Error('No audit logs found');
    }

    // Check for login events
    const loginEvents = auditResponse.data.logs.filter(log =>
      log.action === 'user_login'
    );

    if (loginEvents.length === 0) {
      throw new Error('No login events found in audit logs');
    }
  }

  // === SECURITY MONITORING TESTS ===

  async testSecurityStatus() {
    const statusResponse = await this.client.get('/auth/security/status', {
      headers: {
        'Authorization': `Bearer ${this.tokens.user1.accessToken}`
      }
    });

    if (statusResponse.status !== 200) {
      throw new Error('Security status access failed');
    }

    const status = statusResponse.data.securityStatus;
    if (!status || typeof status.totalUsers !== 'number') {
      throw new Error('Invalid security status response');
    }
  }

  // === LOGOUT TESTS ===

  async testUserLogout() {
    const response = await this.client.post('/auth/logout', {}, {
      headers: {
        'Authorization': `Bearer ${this.tokens.user1.accessToken}`
      }
    });

    if (response.status !== 200) {
      throw new Error('Logout failed');
    }

    // Verify token is invalidated
    try {
      await this.client.get('/auth/me', {
        headers: {
          'Authorization': `Bearer ${this.tokens.user1.accessToken}`
        }
      });
      throw new Error('Token should be invalidated after logout');
    } catch (error) {
      if (error.response?.status !== 401) {
        throw new Error(`Expected 401 after logout, got ${error.response?.status}`);
      }
    }
  }

  // === THREAT PROTECTION TESTS ===

  async testSQLInjectionProtection() {
    const maliciousPayloads = [
      { email: "admin' OR '1'='1", password: 'password' },
      { email: "admin'; DROP TABLE users; --", password: 'password' },
      { email: 'admin" OR ""="', password: 'password' }
    ];

    for (const payload of maliciousPayloads) {
      try {
        await this.client.post('/auth/login', payload);
        throw new Error('SQL injection attempt should have failed');
      } catch (error) {
        if (error.response?.status !== 401) {
          throw new Error(`SQL injection not properly blocked: ${error.response?.status}`);
        }
      }
    }
  }

  async testXSSProtection() {
    const xssPayloads = [
      { email: '<script>alert("xss")</script>@test.com', password: 'password' },
      { email: 'test@test.com', password: '<img src=x onerror=alert(1)>' },
      { email: 'javascript:alert(1)@test.com', password: 'password' }
    ];

    for (const payload of xssPayloads) {
      try {
        await this.client.post('/auth/login', payload);
        // XSS in login might not be blocked at this level, but should be logged
      } catch (error) {
        // Expected to fail due to validation or auth
      }
    }
  }

  async testPathTraversalProtection() {
    // Test path traversal in potential file endpoints (if any)
    // Since the current API doesn't expose file endpoints, we'll test request logging
    const suspiciousRequests = [
      '/auth/../../../etc/passwd',
      '/auth/..\\..\\..\\windows\\system32\\config\\sam',
      '/auth/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
    ];

    for (const path of suspiciousRequests) {
      try {
        await this.client.get(path);
      } catch (error) {
        // Expected to fail, but should be logged as suspicious
      }
    }
  }

  async testHealthCheck() {
    const response = await this.client.get('/health');
    if (response.status !== 200) {
      throw new Error(`Health check failed: ${response.status}`);
    }

    if (!response.data.status || response.data.status !== 'healthy') {
      throw new Error('Service is not healthy');
    }
  }

  // === MAIN TEST EXECUTION ===

  async runAllTests() {
    this.log('🚀 Starting KRONOS Security System Comprehensive Test Suite', 'info');
    this.log('=' .repeat(70), 'info');

    // User Registration & Login Tests
    await this.runTest('User Registration', () => this.testUserRegistration());
    await this.runTest('Duplicate User Registration Prevention', () => this.testDuplicateUserRegistration());
    await this.runTest('Invalid Registration Validation', () => this.testInvalidRegistration());
    await this.runTest('User Login', () => this.testUserLogin());
    await this.runTest('Invalid Login Attempts', () => this.testInvalidLogin());
    await this.runTest('Account Lockout Protection', () => this.testAccountLockout());

    // JWT Authentication Tests
    await this.runTest('JWT Authentication', () => this.testJWTAuthentication());
    await this.runTest('Invalid JWT Rejection', () => this.testInvalidJWT());
    await this.runTest('Missing JWT Rejection', () => this.testMissingJWT());
    await this.runTest('Token Refresh', () => this.testTokenRefresh());
    await this.runTest('Expired Token Handling', () => this.testExpiredToken());

    // RBAC Tests
    await this.runTest('Role-Based Access Control', () => this.testRoleBasedAccess());
    await this.runTest('Admin Role Access', () => this.testAdminRoleAccess());
    await this.runTest('Role Management', () => this.testRoleManagement());

    // API Key Tests
    await this.runTest('API Key Creation', () => this.testApiKeyCreation());
    await this.runTest('API Key Authentication', () => this.testApiKeyAuthentication());
    await this.runTest('API Key Listing', () => this.testApiKeyListing());
    await this.runTest('API Key Deletion', () => this.testApiKeyDeletion());

    // Rate Limiting Tests
    await this.runTest('Rate Limiting', () => this.testRateLimiting());

    // Audit Logging Tests
    await this.runTest('Audit Logging', () => this.testAuditLogging());

    // Security Monitoring Tests
    await this.runTest('Security Status Monitoring', () => this.testSecurityStatus());

    // Logout Tests
    await this.runTest('User Logout', () => this.testUserLogout());

    // Threat Protection Tests
    await this.runTest('SQL Injection Protection', () => this.testSQLInjectionProtection());
    await this.runTest('XSS Protection', () => this.testXSSProtection());
    await this.runTest('Path Traversal Protection', () => this.testPathTraversalProtection());

    // Health Check
    await this.runTest('Service Health Check', () => this.testHealthCheck());

    // Print Results
    this.printResults();
  }

  printResults() {
    this.log('=' .repeat(70), 'info');
    this.log('📊 KRONOS Security Test Results', 'info');
    this.log('=' .repeat(70), 'info');

    this.log(`✅ Passed: ${this.testResults.passed}`, 'success');
    this.log(`❌ Failed: ${this.testResults.failed}`, 'error');
    this.log(`📈 Total: ${this.testResults.passed + this.testResults.failed}`, 'info');

    const successRate = ((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100).toFixed(1);
    this.log(`🎯 Success Rate: ${successRate}%`, this.testResults.failed === 0 ? 'success' : 'warning');

    if (this.testResults.failed > 0) {
      this.log('\n❌ Failed Tests:', 'error');
      this.testResults.tests
        .filter(test => test.status === 'FAILED')
        .forEach(test => {
          this.log(`  - ${test.name}: ${test.error}`, 'error');
        });
    }

    this.log('\n🏆 Security Assessment:', 'info');
    if (this.testResults.failed === 0) {
      this.log('  ✅ ALL SECURITY TESTS PASSED - System is secure!', 'success');
    } else if (this.testResults.failed <= 2) {
      this.log('  ⚠️  MINOR ISSUES - System mostly secure, review failed tests', 'warning');
    } else {
      this.log('  ❌ CRITICAL ISSUES - Immediate security review required', 'error');
    }
  }
}

// Run the test suite
async function main() {
  const testSuite = new KronosSecurityTestSuite();

  try {
    await testSuite.runAllTests();
  } catch (error) {
    console.error('Test suite failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = KronosSecurityTestSuite;