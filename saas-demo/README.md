# Multi-Tenant SaaS Demo

A simple demonstration of the saas-builder power patterns for building production-ready SaaS applications.

## Architecture

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: AWS Lambda functions with Node.js
- **Database**: DynamoDB with tenant isolation
- **Auth**: JWT with tenant context
- **Billing**: Stripe integration ready

## Key Features

- Multi-tenant data isolation
- Serverless cost optimization
- Usage-based billing ready
- Role-based access control

## Getting Started

1. Configure AWS credentials
2. Deploy infrastructure
3. Start frontend development server
4. Test API endpoints

## Project Structure

```
/
├── frontend/          # React application
├── backend/           # Lambda functions
├── schema/            # API contracts
└── infrastructure/    # AWS CDK/SAM
```