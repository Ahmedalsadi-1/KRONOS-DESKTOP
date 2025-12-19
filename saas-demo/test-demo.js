/**
 * Simple test to demonstrate saas-builder patterns
 * Shows multi-tenant isolation and JWT-based authorization
 */

// Mock JWT tokens for different tenants
const tenant1Token = createMockJWT('tenant-1', 'user-1', 'admin@tenant1.com', 'admin');
const tenant2Token = createMockJWT('tenant-2', 'user-2', 'user@tenant2.com', 'user');

console.log('🚀 SaaS Builder Demo - Multi-Tenant Patterns\n');

// Test 1: Demonstrate JWT structure with tenant context
console.log('1. JWT Token Structure (Tenant Context)');
console.log('=====================================');
const decoded1 = JSON.parse(atob(tenant1Token.split('.')[1]));
console.log('Tenant 1 Token:', {
  tenantId: decoded1.tenantId,
  userId: decoded1.userId,
  email: decoded1.email,
  role: decoded1.role
});

const decoded2 = JSON.parse(atob(tenant2Token.split('.')[1]));
console.log('Tenant 2 Token:', {
  tenantId: decoded2.tenantId,
  userId: decoded2.userId,
  email: decoded2.email,
  role: decoded2.role
});

// Test 2: Show DynamoDB key patterns for tenant isolation
console.log('\n2. DynamoDB Key Patterns (Tenant Isolation)');
console.log('==========================================');
console.log('Tenant 1 User Key:', `${decoded1.tenantId}#User#user-123`);
console.log('Tenant 2 User Key:', `${decoded2.tenantId}#User#user-456`);
console.log('GSI Query Pattern:', `GSI1PK: ${decoded1.tenantId}, GSI1SK: User#2024-01-01`);

// Test 3: Demonstrate API request patterns
console.log('\n3. API Request Patterns');
console.log('=======================');
console.log('GET /api/v1/users');
console.log('Headers:', {
  'Authorization': `Bearer ${tenant1Token.substring(0, 20)}...`,
  'Content-Type': 'application/json'
});

// Test 4: Show usage tracking event structure
console.log('\n4. Usage Tracking Events (Billing)');
console.log('==================================');
const usageEvent = {
  source: 'saas-demo.users',
  'detail-type': 'Usage Event',
  detail: {
    tenantId: decoded1.tenantId,
    eventType: 'user_created',
    metadata: {
      userId: 'user-123',
      timestamp: new Date().toISOString()
    }
  }
};
console.log('EventBridge Event:', JSON.stringify(usageEvent, null, 2));

// Test 5: Role-based access control
console.log('\n5. Role-Based Access Control (RBAC)');
console.log('===================================');
console.log(`Tenant 1 User (${decoded1.role}): Can create users? ${decoded1.role === 'admin'}`);
console.log(`Tenant 2 User (${decoded2.role}): Can create users? ${decoded2.role === 'admin'}`);

// Test 6: Cost optimization patterns
console.log('\n6. Cost Optimization Patterns');
console.log('=============================');
console.log('✅ Serverless functions (pay per request)');
console.log('✅ DynamoDB on-demand (pay per read/write)');
console.log('✅ No idle costs when not in use');
console.log('✅ Linear scaling with tenant growth');

console.log('\n🎉 Demo Complete! Key SaaS Builder Benefits:');
console.log('• Multi-tenant data isolation with tenant-prefixed keys');
console.log('• JWT-based authentication with tenant context');
console.log('• Role-based access control (RBAC)');
console.log('• Usage tracking for billing integration');
console.log('• Cost-efficient serverless architecture');
console.log('• Production-ready security patterns');

function createMockJWT(tenantId, userId, email, role) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    userId: userId,
    email: email,
    name: email.split('@')[0],
    role: role,
    tenantId: tenantId,
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
  
  return `${encodedHeader}.${encodedPayload}.demo-signature`;
}