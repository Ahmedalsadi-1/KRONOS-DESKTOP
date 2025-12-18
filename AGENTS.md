# AGENTS.md

## Build/Lint/Test Commands

### Workflow Studio (Primary)
- **Build**: `pnpm build` (Turbo monorepo build)
- **Lint**: `pnpm lint` (Biome linter)
- **Format**: `pnpm format` (Biome formatter)
- **Check**: `pnpm check` (Biome lint + format)
- **Test**: `pnpm test` (Run all tests via pnpm recursive)
- **Test unit**: `pnpm test:unit`
- **Test integration**: `pnpm test:integration`
- **Dev**: `pnpm dev` (Start all development services)

### Individual Apps
- **Web app**: `pnpm --filter @refly/web dev`
- **API app**: `pnpm --filter @refly/api dev`

## Code Style Guidelines

### TypeScript/JavaScript
- Single quotes for string literals
- Optional chaining (`?.`) required for object property access
- Nullish coalescing (`??`) for undefined/null values
- Array existence checks before array methods
- Object property validation before destructuring
- ES6+ features: arrow functions, destructuring, spread operators

### React Performance
- React.memo for pure components
- useMemo for expensive computations
- useCallback for function props
- Proper dependency arrays in useEffect
- No inline objects/arrays in render
- Proper key props for lists (avoid index)
- Split nested closure components

### Error Handling
- Handle async errors with try/catch
- Meaningful error messages
- Fallback UI for failed components
- Error boundaries for runtime errors
- No silent failures - log errors

### Import Organization
- Type-only imports: `import type`
- External libraries first
- Internal imports second
- Group by functionality

### Naming Conventions
- Classes/Interfaces/Types: PascalCase
- Variables/Functions: camelCase
- Constants: UPPER_SNAKE_CASE
- Files: kebab-case for modules, PascalCase for components