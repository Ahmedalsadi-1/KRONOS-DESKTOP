/**
 * Lambda Authorizer - Validates JWT and injects tenant context
 * This is the security boundary for all API requests
 */

const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
  try {
    const token = extractToken(event);
    if (!token) {
      throw new Error('No token provided');
    }

    // Verify JWT (in production, use proper JWT verification)
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.tenantId || !decoded.userId) {
      throw new Error('Invalid token structure');
    }

    // Extract tenant and user context
    const tenantId = decoded.tenantId;
    const userId = decoded.userId;
    const roles = decoded.roles || ['user'];

    console.log(`Authorizing request for tenant: ${tenantId}, user: ${userId}`);

    // Generate IAM policy (allow all for demo)
    const policy = generatePolicy(userId, 'Allow', event.methodArn);
    
    // Inject tenant context into request
    policy.context = {
      tenantId: tenantId,
      userId: userId,
      roles: JSON.stringify(roles)
    };

    return policy;

  } catch (error) {
    console.error('Authorization failed:', error.message);
    throw new Error('Unauthorized');
  }
};

function extractToken(event) {
  const authHeader = event.authorizationToken;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

function generatePolicy(principalId, effect, resource) {
  return {
    principalId: principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource
        }
      ]
    }
  };
}