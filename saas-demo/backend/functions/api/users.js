/**
 * Users API - Demonstrates multi-tenant patterns
 * All operations are automatically scoped to the tenant from JWT
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.DYNAMODB_TABLE || 'saas-demo-table';

exports.handler = async (event) => {
  try {
    // Step 1: Extract tenant context from authorizer
    const tenantId = event.requestContext.authorizer.tenantId;
    const userId = event.requestContext.authorizer.userId;
    const roles = JSON.parse(event.requestContext.authorizer.roles);

    if (!tenantId) {
      return errorResponse(500, 'MISSING_TENANT', 'Tenant context not found');
    }

    console.log(`Processing ${event.httpMethod} request for tenant: ${tenantId}`);

    // Step 2: Route to appropriate handler
    switch (event.httpMethod) {
      case 'GET':
        if (event.pathParameters && event.pathParameters.userId) {
          return await getUser(tenantId, event.pathParameters.userId);
        } else {
          return await listUsers(tenantId, event.queryStringParameters || {});
        }
      
      case 'POST':
        // Step 3: Check permissions (RBAC)
        if (!roles.includes('admin')) {
          return errorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'Admin role required');
        }
        return await createUser(tenantId, JSON.parse(event.body));
      
      default:
        return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
    }

  } catch (error) {
    console.error('API Error:', error);
    return errorResponse(500, 'INTERNAL_ERROR', 'Internal server error');
  }
};

async function listUsers(tenantId, queryParams) {
  const page = parseInt(queryParams.page) || 1;
  const pageSize = Math.min(parseInt(queryParams.pageSize) || 20, 100);

  // Step 4: All DB queries prefixed with tenant ID
  const params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: {
      ':pk': `${tenantId}#User`
    },
    Limit: pageSize
  };

  const result = await dynamodb.query(params).promise();
  
  const users = result.Items.map(item => ({
    id: item.sk.split('#')[1],
    email: item.email,
    name: item.name,
    role: item.role,
    createdAt: item.createdAt,
    tenantId: tenantId
  }));

  return successResponse({
    users: users,
    pagination: {
      page: page,
      pageSize: pageSize,
      total: result.Count,
      hasNext: !!result.LastEvaluatedKey
    }
  });
}

async function getUser(tenantId, userIdParam) {
  // Step 5: Tenant-scoped queries only
  const params = {
    TableName: TABLE_NAME,
    Key: {
      pk: `${tenantId}#User`,
      sk: `User#${userIdParam}`
    }
  };

  const result = await dynamodb.get(params).promise();
  
  if (!result.Item) {
    return errorResponse(404, 'USER_NOT_FOUND', 'User not found');
  }

  const user = {
    id: result.Item.sk.split('#')[1],
    email: result.Item.email,
    name: result.Item.name,
    role: result.Item.role,
    createdAt: result.Item.createdAt,
    tenantId: tenantId
  };

  return successResponse(user);
}

async function createUser(tenantId, userData) {
  // Step 6: Validate input
  if (!userData.email || !userData.name) {
    return errorResponse(400, 'INVALID_INPUT', 'Email and name are required');
  }

  const userId = uuidv4();
  const now = new Date().toISOString();

  // Step 7: Store with tenant prefix
  const params = {
    TableName: TABLE_NAME,
    Item: {
      pk: `${tenantId}#User`,
      sk: `User#${userId}`,
      email: userData.email,
      name: userData.name,
      role: userData.role || 'user',
      createdAt: now,
      tenantId: tenantId
    },
    ConditionExpression: 'attribute_not_exists(pk)'
  };

  await dynamodb.put(params).promise();

  // Step 8: Track usage for billing
  await trackUsageEvent(tenantId, 'user_created', {
    userId: userId,
    timestamp: now
  });

  const user = {
    id: userId,
    email: userData.email,
    name: userData.name,
    role: userData.role || 'user',
    createdAt: now,
    tenantId: tenantId
  };

  return successResponse(user, 201);
}

async function trackUsageEvent(tenantId, eventType, metadata) {
  // Publish to EventBridge for billing system
  const eventbridge = new AWS.EventBridge();
  
  await eventbridge.putEvents({
    Entries: [{
      Source: 'saas-demo.users',
      DetailType: 'Usage Event',
      Detail: JSON.stringify({
        tenantId: tenantId,
        eventType: eventType,
        metadata: metadata,
        timestamp: new Date().toISOString()
      })
    }]
  }).promise();
}

function successResponse(data, statusCode = 200) {
  return {
    statusCode: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(data)
  };
}

function errorResponse(statusCode, code, message) {
  return {
    statusCode: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      error: {
        code: code,
        message: message
      }
    })
  };
}