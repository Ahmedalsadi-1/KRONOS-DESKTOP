# AGENTS.md

## Build/Lint/Test Commands

### General
- **Build**: `npm run build` (TypeScript compilation)
- **Lint**: `npm run lint` (ESLint + Prettier)
- **Format**: `npm run format` (Prettier)
- **Test all**: `npm run test` (Jest)
- **Test single**: `npm run test -- --testNamePattern="test name"` or `npm run test -- --testPathPattern=filename.spec.ts`
- **Test watch**: `npm run test:watch`

### Electron Apps
- **Dev**: `npm run dev` (unified-ai-ecosystem) or `npm start` (unified-automation-platform)
- **Build**: `npm run build:electron` or `electron-builder`

### Docker Services
- **Build**: `docker build .`
- **Run**: `docker-compose up -d`

## Code Style Guidelines

### TypeScript
- Strict mode enabled, explicit `any` allowed
- Target ES2021, source maps enabled
- Decorators enabled (NestJS)

### Naming
- **Classes/Types**: PascalCase (`AnthropicService`, `ApiResponse`)
- **Variables/Functions**: camelCase (`generateMessage`, `apiKey`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_MODEL`)
- **Files**: kebab-case modules, camelCase services (`anthropic.service.ts`)

### Imports
- External libraries first, then internal imports
- Type-only imports when possible
- Group by functionality

### Architecture
- **Backend**: NestJS with controllers/services, Prisma ORM
- **Frontend**: React/Next.js with TypeScript, Tailwind CSS
- **Error Handling**: Try-catch with proper logging
- **Validation**: Zod schemas, class-validator DTOs
- **Communication**: WebSockets/Socket.io, REST APIs

### General Rules
- Type safety throughout, descriptive names
- Security-first: no eval, input validation, env vars for secrets
- Modular code structure, follow existing patterns</content>
<parameter name="filePath">AGENTS.md