# Deployment Guide

## Prerequisites

1. **AWS CLI configured** with appropriate permissions
2. **SAM CLI installed** for serverless deployment
3. **Node.js 18+** for Lambda functions
4. **Optional**: Stripe account for payment integration

## Quick Start

### 1. Deploy Backend Infrastructure

```bash
cd backend
npm install

# Deploy with SAM
sam build
sam deploy --guided
```

### 2. Configure Frontend

```bash
cd frontend
npm install

# Update API endpoint in .env
echo "VITE_API_URL=https://your-api-id.execute-api.region.amazonaws.com/v1" > .env

# Start development server
npm run dev
```

### 3. Test the API

```bash
# Test with demo JWT token
curl -H "Authorization: Bearer $(node -e "console.log(require('./test-demo.js'))")" \
     https://your-api-url/v1/users
```

## Configuration Options

### Enable Stripe Integration

1. Update `saas-builder/mcp.json`:
```json
{
  "mcpServers": {
    "stripe": {
      "disabled": false
    }
  }
}
```

2. Set environment variables:
```bash
export STRIPE_SECRET_KEY=sk_test_...
export STRIPE_WEBHOOK_SECRET=whsec_...
```

### Enable Browser Testing

```json
{
  "mcpServers": {
    "playwright": {
      "disabled": false
    }
  }
}
```

## Key Features Demonstrated

✅ **Multi-tenant data isolation** - All data prefixed with tenant ID
✅ **JWT authentication** - Tenant context injected by authorizer
✅ **Role-based access control** - Admin vs user permissions
✅ **Usage tracking** - Events published to EventBridge for billing
✅ **Cost optimization** - Serverless pay-per-use architecture
✅ **Production patterns** - Error handling, validation, logging

## Next Steps

1. **Add more entities** (orders, products, etc.) following the same patterns
2. **Implement Stripe billing** using the stripe MCP server
3. **Add feature flags** for tenant-specific functionality
4. **Set up monitoring** with CloudWatch dashboards
5. **Add automated tests** for tenant isolation

## Monitoring & Debugging

- **CloudWatch Logs**: `/aws/lambda/function-name`
- **DynamoDB Metrics**: Monitor read/write capacity
- **API Gateway**: Request/response logs and metrics
- **EventBridge**: Usage event delivery status