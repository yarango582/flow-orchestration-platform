# Flow Platform Scheduler Engine

A comprehensive NestJS-based microservices platform for flow management, scheduling, and execution using the Flow Platform Node Core library.

## Overview

The Scheduler Engine provides three main microservices:

1. **Flow Management Service** (Port 3001) - CRUD operations for workflow definitions
2. **Scheduler Service** (Port 3002) - Cron-based scheduling and execution management  
3. **Node Catalog Service** (Port 3003) - Node registry and compatibility management

## Features

### Core Features
- ✅ Complete Flow CRUD operations with validation
- ✅ BullMQ-powered job scheduling and execution
- ✅ Dynamic node catalog with compatibility checking
- ✅ Cron-based scheduling with timezone support
- ✅ Execution monitoring and logging
- ✅ Health checks and metrics
- ✅ Swagger/OpenAPI 3 documentation

### Technology Stack
- **Framework**: NestJS 10 with TypeScript
- **Database**: PostgreSQL with TypeORM
- **Queue System**: BullMQ + Redis
- **Validation**: class-validator + class-transformer
- **Documentation**: Swagger/OpenAPI 3
- **Logging**: Winston
- **Testing**: Jest + Supertest

### Architecture
```
├── src/
│   ├── app.module.ts           # Main application module
│   ├── main.ts                 # Application bootstrap
│   ├── common/                 # Shared utilities, guards, filters
│   ├── config/                 # Configuration management
│   ├── database/              # TypeORM entities and migrations
│   ├── flows/                 # Flow Management service
│   ├── scheduler/             # Scheduler service
│   ├── catalog/               # Node Catalog service
│   ├── execution/             # Flow execution engine
│   └── shared/                # Shared services
├── test/                      # E2E tests
├── docker-compose.yml         # Development environment
└── Dockerfile                 # Production container
```

## Quick Start

### Prerequisites
- Node.js 20 LTS
- Docker & Docker Compose
- @flow-platform/node-core library

### Installation

1. **Clone and install dependencies**:
```bash
npm install
```

2. **Set up environment**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start development environment**:
```bash
# Start PostgreSQL + Redis
docker-compose up -d postgres redis

# Run database migrations
npm run migration:run

# Start the application
npm run start:dev
```

4. **Access the services**:
- Flow Management API: http://localhost:3001/api/v1
- Scheduler API: http://localhost:3002/api/v1  
- Node Catalog API: http://localhost:3003/api/v1
- Swagger Documentation: http://localhost:3001/api/docs
- Health Check: http://localhost:3001/api/v1/health

### Full Docker Development

```bash
# Start all services including the application
docker-compose up

# View logs
docker-compose logs -f scheduler-engine

# Stop services
docker-compose down
```

## API Documentation

### Flow Management Service (Port 3001)

#### Key Endpoints:
- `POST /api/v1/flows` - Create new flow
- `GET /api/v1/flows` - List flows with pagination
- `GET /api/v1/flows/{id}` - Get flow by ID  
- `PUT /api/v1/flows/{id}` - Update flow
- `DELETE /api/v1/flows/{id}` - Delete flow
- `POST /api/v1/flows/{id}/validate` - Validate flow compatibility

#### Example Flow Creation:
```json
{
  "name": "User Synchronization Flow",
  "description": "Syncs users from database to external service",
  "nodes": [
    {
      "id": "node-1",
      "type": "postgresql-query",
      "version": "1.0.0",
      "config": {
        "connectionString": "postgresql://user:pass@db:5432/hr",
        "query": "SELECT * FROM users WHERE updated_at > $1"
      },
      "position": { "x": 100, "y": 100 }
    }
  ],
  "connections": []
}
```

### Scheduler Service (Port 3002)

#### Key Endpoints:
- `POST /api/v1/schedules` - Create schedule
- `GET /api/v1/schedules` - List schedules
- `PUT /api/v1/schedules/{id}` - Update schedule
- `POST /api/v1/schedules/{id}/enable` - Enable schedule
- `POST /api/v1/schedules/{id}/disable` - Disable schedule
- `GET /api/v1/executions` - Get execution history
- `POST /api/v1/executions/{id}/retry` - Retry failed execution

#### Example Schedule Creation:
```json
{
  "flowId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Daily User Sync",
  "cronExpression": "0 9 * * 1-5",
  "timezone": "America/Mexico_City",
  "enabled": true,
  "maxRetries": 3,
  "retryDelay": 300
}
```

### Node Catalog Service (Port 3003)

#### Key Endpoints:
- `GET /api/v1/nodes` - Get node catalog
- `POST /api/v1/nodes` - Register new node type
- `GET /api/v1/nodes/{type}` - Get node definition
- `POST /api/v1/compatibility/check` - Check node compatibility
- `GET /api/v1/categories` - Get node categories

## Development

### Database Operations
```bash
# Generate migration
npm run migration:generate -- MigrationName

# Run migrations
npm run migration:run

# Revert migration  
npm run migration:revert

# Drop schema (development only)
npm run schema:drop
```

### Testing
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov

# Watch mode
npm run test:watch
```

### Linting & Formatting
```bash
# Lint code
npm run lint

# Format code
npm run format
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Application port | `3001` |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_USERNAME` | Database user | `flow_user` |
| `DB_PASSWORD` | Database password | `password` |
| `DB_DATABASE` | Database name | `flow_platform` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |

### Database Schema

The application uses the following main entities:

- **Flows**: Workflow definitions with nodes and connections
- **Schedules**: Cron-based execution schedules  
- **Executions**: Execution history and logs
- **NodeDefinitions**: Catalog of available node types

## Production Deployment

### Docker Production Build
```bash
# Build production image
docker build --target production -t scheduler-engine:latest .

# Run production container
docker run -d \
  --name scheduler-engine \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e DB_HOST=your-db-host \
  -e REDIS_HOST=your-redis-host \
  scheduler-engine:latest
```

### Health Checks
The application provides comprehensive health checks:

- `/api/v1/health` - Overall health status
- `/api/v1/health/ready` - Readiness probe for K8s
- `/api/v1/health/live` - Liveness probe for K8s

### Monitoring

Optional services for monitoring:

- **BullMQ Dashboard**: http://localhost:3010 (job queue monitoring)
- **pgAdmin**: http://localhost:5050 (database administration)

## Integration with Node Core

The Scheduler Engine integrates with `@flow-platform/node-core` for:

- Dynamic node registration and discovery
- Flow execution using registered nodes
- Compatibility validation between nodes
- Node metadata and configuration management

## Architecture Decisions

### Design Patterns
- **Repository Pattern**: Clean data access abstraction
- **Service Layer**: Business logic separation
- **DTO Pattern**: Request/response validation
- **Dependency Injection**: Loose coupling and testability

### Error Handling
- Global exception filters for consistent error responses
- Structured logging with Winston
- Validation errors with detailed field information

### Performance Considerations
- Database indexing on frequently queried fields
- BullMQ job queues for scalable execution
- Connection pooling for database operations
- Redis caching for frequently accessed data

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For questions and support:

- Create an issue in the repository
- Check the API documentation at `/api/docs`
- Review the health check endpoints for service status