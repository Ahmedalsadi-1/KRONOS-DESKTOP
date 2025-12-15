# AGENTS.md

## Build/Lint/Test Commands

### Backend Services (bytebot-agent, bytebot-agent-cc, bytebotd)
- **Build**: `npm run build` (builds shared package first)
- **Lint**: `npm run lint` (ESLint with TypeScript + Prettier)
- **Format**: `npm run format` (Prettier)
- **Test all**: `npm run test` (Jest)
- **Test single**: `npm run test -- --testNamePattern="test name"` or `npm run test -- --testPathPattern=filename.spec.ts`
- **Test watch**: `npm run test:watch`
- **Test coverage**: `npm run test:cov`

### UI (bytebot-ui)
- **Build**: `npm run build` (builds shared package first)
- **Lint**: `npm run lint` (Next.js ESLint)
- **Dev server**: `npm run dev`

### Shared Package
- **Build**: `npm run build` (TypeScript compilation)
- **Lint**: `npm run lint`
- **Format**: `npm run format`

### LLM Proxy (bytebot-llm-proxy)
- **Build**: `docker build .` (Docker container)
- **Run**: `docker run -p 4000:4000 [image]`

## Code Style Guidelines

### TypeScript Configuration
- Target: ES2021 (modern JavaScript features)
- Strict null checks enabled
- No implicit any (disabled, allowing explicit `any` usage)
- Decorators enabled (NestJS)
- Source maps enabled for debugging

### Formatting (Prettier)
- Single quotes
- Trailing commas: all
- Consistent casing in filenames

### Linting (ESLint)
- TypeScript recommended rules with type checking
- Prettier integration
- Custom rules:
  - `@typescript-eslint/no-explicit-any`: off
  - `@typescript-eslint/no-floating-promises`: warn
  - `@typescript-eslint/no-unsafe-argument`: warn

### Naming Conventions
- **Classes**: PascalCase (e.g., `AnthropicService`, `AppModule`)
- **Interfaces/Types**: PascalCase (e.g., `BytebotAgentResponse`)
- **Variables/Functions**: camelCase (e.g., `generateMessage`, `apiKey`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `DEFAULT_MODEL`)
- **Files**: kebab-case for modules, camelCase for services (e.g., `anthropic.service.ts`)

### Architecture Patterns
- **Backend**: NestJS with modules, controllers, services
- **Frontend**: Next.js with React 19
- **Validation**: Zod schemas + class-validator DTOs
- **Database**: Prisma ORM
- **WebSockets**: Socket.io
- **Logging**: NestJS Logger
- **Error Handling**: Try-catch with Logger.warn/error

### Import Organization
- External libraries first
- Internal imports (relative paths)
- Type-only imports when possible
- Group by functionality

## Project Rules

### Bytebot Monorepo
- **Backend Services**: NestJS with TypeScript, Prisma ORM, PostgreSQL
- **Frontend**: Next.js 15+ with React 19, Tailwind CSS, shadcn/ui
- **Shared Types**: TypeScript-only package for type definitions and utilities
- **LLM Proxy**: LiteLLM-based proxy for multi-provider AI model access
- **Desktop Automation**: Computer control via MCP protocol and automation libraries
- **Communication**: WebSocket-based real-time updates, REST APIs
- **Security**: Environment variables for secrets, input validation, CORS configuration
- **Testing**: Jest framework with unit and integration tests
- **Deployment**: Docker containers with Kubernetes/Helm support

### General Guidelines
- Descriptive names, modular code structure
- Follow existing patterns and conventions
- Security-first approach (no eval, proper input validation)
- Comprehensive error handling and logging
- Type safety throughout the codebase</content>
<parameter name="filePath">AGENTS.md