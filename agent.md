# AI Emulators Agent Manifest

## Purpose

Create a single anchor document that describes how every automation project in this workspace contributes to the unified AI emulators platform. This manifest will be the blueprint used when these individual efforts are eventually merged into one cohesive GitHub-hosted product.

## Project Inventory

### UI-TARS-desktop
- Vision-language desktop automation toolkit with GUI-aware agents that control real applications, tailored for complex multi-step workflows.

### open-computer-use
- Cross-platform API-driven automation framework with a plugin architecture for safely orchestrating desktop and mobile actions.

### bytebot
- Multi-modal NestJS/Next.js agent system (Desktop + UI + MCP) designed to host an autonomous AI with its own virtual computer.

### gbox
- Provisioning layer for Android sandboxes, cloud clients, and local hardware to support agents that need actual device access.

### unified-automation-platform
- Orchestration shell that coordinates agents, projects, and adapters built on Electron/Node for desktop control.

### ai-browser
- Intelligent web automation agent focused on browser-based workflows and data extraction.

### accessible-view-terminal
- Accessibility-first CLI for interacting with agents and monitoring systems via a terminal surface.

### local-manus
- Local orchestration service for managing on-prem agents and chaining them with higher-level policies.

### postiz-app
- Social media/content automation platform that prepares posts, schedules campaigns, and handles analytics.

### instapy
- Instagram engagement automation (likes/comments/follows) running via Selenium. See `instapy/agent.md` for the full agent contract.

### instagrapi
- Modern Instagram API wrapper for programmatic interactions. The existing `instagrapi/agent.md` documents capability details.

### onlysnarf
- Content automation & messaging for OnlyFans built on Selenium and Flask; `onlysnarf/agent.md` captures the REST endpoints, commands, and deploy requirements.

### tiktok_api
- TikTok automation toolkit with its own `tiktok_api/agent.md` describing endpoints, scripts, and workflows.

### unified-ai-ecosystem
- Shared AI services, utilities, and contracts that every agent can import.

### packages
- Reusable npm packages (shared types, utilities) consumed across the NestJS and Next.js services.

### ollama
- Local LLM runtime management center for experiments with newer providers.

### youtube_upload
- Automation pipeline for uploading videos to YouTube as part of the content stack.

## Project-specific agent notes

- `instapy/agent.md` – CLI and API bindings plus safety configuration for Selenium automation.
- `onlysnarf/agent.md` – REST endpoints, CLI, security notes, and integration adapter guidance.
- `instagrapi/agent.md` & `tiktok_api/agent.md` – Programmatic references for the social media APIs already documented inside their directories.
- `bytebot/*` – consult `bytebot/docs` and `bytebot/README.md` for agent orchestration context.
- Use `AGENTS.md` at the repo root for standard tooling, linting, and testing commands.

## Capability Overlap & Consolidation

- **Instagram automation** – `instapy` (browser-driven Selenium) and `instagrapi` (API-level) cover largely the same surface (liking, commenting, following, story interactions), so consolidate their adapters around a shared `instagram` capability contract while letting the Selenium path focus on UI-only actions where the API falls short.
- **Messaging + content delivery** – `instagrapi`, `onlysnarf`, and `tiktok_api` all expose posting/messaging workflows; unify their command surfaces to expose consistent scheduling, pricing, and media pipelines while keeping provider-specific details isolated behind adapters.
- **Data collection vs interaction** – `onlysnarf` and `tiktok_api` both scan audiences and monitor trends, so align their monitoring dashboards with the same progress/alert model and reuse the same webhook/notify hooks once the meta-agent livestreams telemetry.
- **Shared UI/CLI experience** – the `unified-automation-platform` and new `agent-orchestrator` service should surface the overlapping capabilities (status, command options, dependencies) so perception of the singular project grows even before functional unification.

Approach: Extract capability schemas from each `agent.md`, keep the unique automation paths (Selenium-driven vs API-driven) documented, and update the adapters/manifest in `agent-orchestrator` to publish one cohesive list of commands and endpoints.

## Shared Tooling & Commands

- `npm run build` – builds backend/service + shared packages before running UI builds; use in every service that supports it.
- `npm run lint` – enforces ESLint/Prettier on TypeScript.
- `npm run test` – executes Jest suites; add `--testNamePattern` or `--testPathPattern` for targeted runs.
- `npm run format` – get automatic Prettier formatting (shared packages and services support this).
- Browser automation projects tend to be Python-based; use `pip install -r requirements.txt` or the existing virtualenv scripts near `instapy/` and `onlysnarf/`.
- Dockers: `docker-compose.yml` at the workspace root wires the services together for integration smoke tests; run it to validate multi-agent scenarios.
- Follow `AGENTS.md` formatting conventions and naming rules to keep new code consistent (TypeScript strictness, `.tsx` file casing, etc.).

## Integration Roadmap

1. **Document interfaces** – make sure every subproject exposes a clear adapter contract (use the agent.md files listed above).
2. **Align dependencies** – unify TypeScript targets, Node versions, Python environments, and shared npm packages from `packages/`.
3. **Compose orchestration** – use the root `docker-compose.yml` to run the existing stack and identify overlapping services that can be merged.
4. **Build a meta-agent layer** – create a coordinating service inside `unified-automation-platform` (or a new shared module) that can boot all existing agents via their documented APIs.
5. **Automate verification** – once the stack is unified, run `npm run lint && npm run test` plus any relevant Python tests before each commit/push.

## Repository / GitHub Setup

- The folder already lives inside a Git repository (`git status` shows branch `main`). To publish on GitHub, add a remote such as `git remote add origin git@github.com:your-org/ai-emulators.git`, then `git push -u origin main`.
- Keep `docker-compose.yml`, `AGENTS.md`, and key `.env` examples committed so other contributors can bootstrap quickly.
- Track environment directories (`instapy/venv`, etc.) in `.gitignore`.

## Next Steps

1. Review each subproject’s agent.md for capability overlap and consolidate redundant features.
2. Update `docker-compose.yml` to include newly unified services or to spin up a single meta-agent process.
3. Automate the onboarding of new agents by documenting dependencies and commands inside this manifest and the relevant `agent.md` files.

## References

- `README.md` – ecosystem overview and quick-start instructions.
- `AGENTS.md` – build, lint, test, and styling rules for every workspace service.
- `docs/` – architecture, API, and deployment guides used when linking agents together.
