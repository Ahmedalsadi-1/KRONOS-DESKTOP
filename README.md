# AI Emulators Ecosystem 🧠🤖

A comprehensive suite of AI-powered computer automation tools and frameworks designed for intelligent desktop and mobile automation across multiple platforms.

## 🌟 Overview

The AI Emulators Ecosystem is a unified platform that brings together cutting-edge AI automation technologies to create intelligent agents capable of automating complex workflows across desktop and mobile environments. This monorepo contains multiple specialized automation frameworks, each designed for specific use cases while maintaining seamless interoperability.

## 🧭 Unified Automation Stack

This repository now also ships with a lightweight **Agent Orchestrator** microservice that parses `agent.md` and exposes inventory, overlap, and manifest endpoints (see `agent-orchestrator/`). The orchestrator plus the Docker stack form the “meta-agent” layer used by the `ai_emulators` GitHub Actions workflow to continuously smoke-test the entire automation fleet.

Each GitHub push/PR triggers the `ai_emulators` workflow, which builds every Docker service, spins the stack up, calls the orchestrator’s `/status`, `/inventory`, and `/overlaps`, and then tears the stack back down. This ensures every automation project stays runnable before merging.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     AI EMULATORS ECOSYSTEM                           │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │              UI-TARS Desktop Automation                         │  │
│  │         Vision-language models for desktop control              │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │              Open Computer Use Framework                        │  │
│  │       Cross-platform computer automation via APIs               │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                Bytebot Agent System                             │  │
│  │     Multi-modal AI agents with MCP protocol integration         │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                 GBox Environment Provisioning                   │  │
│  │    Unified sandboxing for Android/desktop automation            │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │               Unified Automation Platform                       │  │
│  │         Orchestration layer for multi-agent workflows           │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   MCP Integration Layer                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  Cursor     │  │  Claude     │  │ Any MCP     │  │ Custom      │ │
│  │ Integration │  │ Code Agent  │  │ Client      │  │ Agent       │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

### Core Automation Frameworks

- **`UI-TARS-desktop/`** - Vision-language model based desktop automation
  - Advanced computer vision for GUI interaction
  - Multi-modal input processing (text, images, coordinates)
  - Real-time action prediction and execution

- **`open-computer-use/`** - Cross-platform computer automation framework
  - API-driven automation across desktop and mobile
  - Plugin architecture for extensibility
  - Security-focused execution environment

- **`bytebot/`** - Multi-modal AI agent system
  - MCP (Model Context Protocol) integration
  - Real-time agent communication
  - WebSocket-based orchestration

- **`gbox/`** - Unified environment provisioning
  - Cloud Virtual Devices (Android emulators)
  - Cloud Physical Devices (real Android hardware)
  - Local Physical Devices (USB-connected devices)
  - Desktop/Browser environments

### Specialized Automation Tools

- **`ai-browser/`** - Intelligent web automation
- **`local-manus/`** - Local AI agent orchestration
- **`postiz-app/`** - Social media automation platform
- **`unified-automation-platform/`** - Cross-framework orchestration

### Integration Components

- **`unified-ai-ecosystem/`** - Shared AI services and utilities
- **`packages/`** - Shared npm packages and dependencies
- **`ollama/`** - Local LLM inference and model management

### Social Media & Content Automation

- **`instapy/`** - Instagram automation toolkit
- **`onlysnarf/`** - Content management and distribution
- **`tiktokpy/`** - TikTok automation framework
- **`youtube_upload/`** - YouTube content publishing

### Development & Analysis Tools

- **`accessible-view-terminal/`** - Accessibility-focused terminal interface
- **`reports/`** - Analysis reports and documentation
- **`data/`** - Shared data stores and configurations

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm/bun
- **Python** 3.8+ with uv package manager
- **Docker** for containerized deployments
- **Git** for version control

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ai-emulators.git
   cd ai-emulators
   ```

2. **Install dependencies**
   ```bash
   # Install shared packages
   bun install

   # Install Python dependencies
   uv sync
   ```

3. **Environment Setup**
   ```bash
   # Copy environment template
   cp .env.example .env

   # Configure your API keys and settings
   nano .env
   ```

### Development

```bash
# Start development servers
npm run dev

# Run tests
npm run test

# Build all packages
npm run build
```

## 🛠️ Development Guidelines

### Code Style & Conventions

- **TypeScript**: Strict mode, TSDoc comments, camelCase
- **Python**: Type hints, Google docstrings, snake_case
- **Linting**: ESLint + Prettier for consistency
- **Testing**: Jest for unit tests, comprehensive coverage

### Build Commands

```bash
# Lint and format code
npm run lint
npm run format

# Build all components
npm run build

# Run test suite
npm run test
```

### Architecture Patterns

- **Modular Design**: Each framework is independently deployable
- **MCP Integration**: Standardized agent communication protocol
- **Plugin Architecture**: Extensible automation capabilities
- **Security First**: Sandboxed execution, input validation

## 🔧 Configuration

### Environment Variables

Create a `.env` file with the following variables:

```bash
# AI Model Configuration
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
OLLAMA_BASE_URL=http://localhost:11434

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/ai_emulators

# MCP Configuration
MCP_SERVER_PORT=3000
MCP_CLIENT_TIMEOUT=30000

# Security
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_encryption_key
```

### Docker Deployment

```bash
# Build all services
docker-compose build

# Start the ecosystem
docker-compose up -d

# View logs
docker-compose logs -f
```

### Agent Orchestrator API

The orchestrator service runs on port 8080 and is part of the same Docker Compose network. Once the stack is healthy you can query:

```bash
curl http://localhost:8080/status
curl http://localhost:8080/inventory
curl http://localhost:8080/overlaps
```

These endpoints are also used by the GitHub `ai_emulators` workflow to validate the manifest before approving new commits.

## 📚 Documentation

- **[Architecture Overview](./docs/architecture.md)** - Detailed system design
- **[API Reference](./docs/api.md)** - Complete API documentation
- **[Integration Guide](./docs/integration.md)** - Framework integration patterns
- **[Security Guide](./docs/security.md)** - Security best practices
- **[Deployment Guide](./docs/deployment.md)** - Production deployment

## 🤝 Contributing

We welcome contributions from the community! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm run test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- **UI-TARS**: Vision-language desktop automation framework
- **Open Computer Use**: Cross-platform automation community
- **Bytebot**: Multi-modal agent architecture
- **GBox**: Environment provisioning technology
- **MCP Protocol**: Standardized agent communication

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/ai-emulators/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/ai-emulators/discussions)
- **Documentation**: [docs.ai-emulators.dev](https://docs.ai-emulators.dev)

---

**Built with ❤️ for the AI automation community**
