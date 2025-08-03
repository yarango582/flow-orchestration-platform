# Plan de Escalado Horizontal - Flow Orchestration Platform

## 📋 Resumen Ejecutivo

Este documento describe el plan completo para escalar horizontalmente la plataforma de orquestación de flujos, transformando la arquitectura monolítica actual en un sistema distribuido y escalable que puede desplegarse en cualquier proveedor de nube o infraestructura on-premise.

## 🎯 Objetivos del Escalado

### Objetivos Principales
- ✅ **Escalabilidad Horizontal**: Capacidad de agregar/quitar instancias según demanda
- ✅ **Independencia de Infraestructura**: No depender de proveedores específicos de nube
- ✅ **Balanceamiento de Carga**: Distribución inteligente de trabajo entre workers
- ✅ **Alta Disponibilidad**: Tolerancia a fallos y recuperación automática
- ✅ **Monitoreo Centralizado**: Visibilidad completa del sistema distribuido

### Métricas de Éxito
- Capacidad de procesar > 10,000 flujos concurrentes
- Tiempo de respuesta API < 200ms
- Disponibilidad > 99.9%
- Tiempo de escalado < 30 segundos

## 🏗️ Arquitectura Actual vs Arquitectura Objetivo

### 🔴 Arquitectura Actual (Monolítica)
```
┌─────────────────────────────────────┐
│         Frontend (React)            │
└─────────────────┬───────────────────┘
                  │ HTTP/WebSocket
┌─────────────────▼───────────────────┐
│    Scheduler Engine (NestJS)        │
│  ┌─────────────────────────────────┐ │
│  │ • API Controllers               │ │
│  │ • Execution Service             │ │
│  │ • Scheduler Service (Cron)      │ │
│  │ • Monitoring Service            │ │
│  │ • WebSocket Gateway             │ │
│  │ • Database Layer                │ │
│  └─────────────────────────────────┘ │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│        Infraestructura Base         │
│  • PostgreSQL                      │
│  • Redis (BullMQ)                  │
│  • File System                     │
└─────────────────────────────────────┘
```

### 🟢 Arquitectura Objetivo (Microservicios Distribuidos)
```
                    ┌─────────────────────────────────────┐
                    │         Frontend (React)            │
                    └─────────────────┬───────────────────┘
                                      │ HTTP/WebSocket
                    ┌─────────────────▼───────────────────┐
                    │         Load Balancer               │
                    └─────────────────┬───────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
┌─────────▼─────────┐       ┌─────────▼─────────┐       ┌─────────▼─────────┐
│   API Gateway     │       │  Orchestrator     │       │   Worker Pool     │
│                   │       │                   │       │                   │
│ • Flow CRUD       │◄──────┤ • Task Queue Mgmt │◄──────┤ • Flow Execution  │
│ • Catalog API     │ RabbitMQ • Load Balancing │RabbitMQ │ • Node Processing │
│ • Monitoring API  │       │ • Job Scheduling  │       │ • Result Reporting│
│ • WebSocket Hub   │       │ • Health Checks   │       │                   │
│                   │       │ • Metrics Collector│       │ ┌───────────────┐ │
└───────┬───────────┘       └───────────────────┘       │ │   Worker 1    │ │
        │                                               │ │   Worker 2    │ │
        │                   ┌─────────────────────┐     │ │   Worker N    │ │
        │                   │   Message Broker    │     │ │ (Configurable)│ │
        └───────────────────┤     (RabbitMQ)      │     │ └───────────────┘ │
                            │                     │     └───────────────────┘
                            │ • Task Distribution │
                            │ • Result Collection │             │
                            │ • Dead Letter Queue │             │
                            │ • Retry Logic       │             │
                            └─────────────────────┘             │
                                        │                       │
                            ┌───────────▼───────────────────────▼───────────┐
                            │            Shared Infrastructure              │
                            │                                               │
                            │ ┌─────────────┐ ┌─────────────┐ ┌──────────┐ │
                            │ │ PostgreSQL  │ │    Redis    │ │ Metrics  │ │
                            │ │   Cluster   │ │   Cluster   │ │   Store  │ │
                            │ │ (Primary/   │ │ (Sessions/  │ │(Prometheus)│ │
                            │ │  Replica)   │ │  Cache)     │ │          │ │
                            │ └─────────────┘ └─────────────┘ └──────────┘ │
                            └─────────────────────────────────────────────┘
```

## 🧩 Componentes del Sistema Escalado

### 1. **API Gateway Service** 
- **Propósito**: Punto de entrada único para el frontend
- **Responsabilidades**:
  - Gestión de flujos (CRUD)
  - API del catálogo de nodos
  - APIs de monitoreo y métricas
  - WebSocket hub para tiempo real
  - Autenticación y autorización
  - Rate limiting y throttling

### 2. **Orchestrator Service**
- **Propósito**: Coordinador central de tareas
- **Responsabilidades**:
  - Gestión de colas de tareas en RabbitMQ
  - Balanceamiento de carga entre workers
  - Programación de trabajos (scheduling)
  - Health checks de workers
  - Recolección de métricas de sistema
  - Gestión de dead letter queues
  - Auto-scaling de workers

### 3. **Worker Pool**
- **Propósito**: Ejecución distribuida de flujos
- **Responsabilidades**:
  - Procesamiento de nodos individuales
  - Ejecución de flujos completos
  - Reporte de resultados al orchestrator
  - Health check reporting
  - Resource management local

### 4. **Message Broker (RabbitMQ)**
- **Propósito**: Comunicación asíncrona entre servicios
- **Características**:
  - Colas de tareas por prioridad
  - Dead letter queues para retry logic
  - Routing inteligente de mensajes
  - Persistencia de mensajes
  - Clustering para alta disponibilidad

## ⚙️ Configuración y Parametrización

### Variables de Entorno por Servicio

#### API Gateway
```env
# Server Configuration
PORT=3001
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@host:5432/flowdb
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://host:6379
REDIS_CLUSTER_ENABLED=false

# RabbitMQ
RABBITMQ_URL=amqp://user:pass@host:5672
RABBITMQ_EXCHANGE=flow_orchestration
RABBITMQ_PREFETCH=10

# WebSocket
WS_PORT=3002
WS_CORS_ORIGINS=http://localhost:5173,https://your-domain.com

# Security
JWT_SECRET=your-secret-key
API_RATE_LIMIT=1000

# Monitoring
METRICS_ENABLED=true
METRICS_PORT=9090
LOG_LEVEL=info
```

#### Orchestrator Service
```env
# Server Configuration
PORT=3003
NODE_ENV=production

# RabbitMQ
RABBITMQ_URL=amqp://user:pass@host:5672
RABBITMQ_EXCHANGE=flow_orchestration
RABBITMQ_PREFETCH=50

# Worker Management
WORKER_HEALTH_CHECK_INTERVAL=30000
WORKER_TIMEOUT=300000
MIN_WORKERS=2
MAX_WORKERS=20
AUTO_SCALING_ENABLED=true

# Load Balancing
LOAD_BALANCE_STRATEGY=round_robin # round_robin, least_busy, weighted
QUEUE_HIGH_WATER_MARK=1000
QUEUE_LOW_WATER_MARK=100

# Database
DATABASE_URL=postgresql://user:pass@host:5432/flowdb
DATABASE_POOL_SIZE=10

# Monitoring
METRICS_ENABLED=true
METRICS_PORT=9091
HEALTH_CHECK_PORT=8080
LOG_LEVEL=info
```

#### Worker Service
```env
# Server Configuration
PORT=3004
NODE_ENV=production
WORKER_ID=worker-${HOSTNAME}

# Capacity Configuration
MAX_CONCURRENT_FLOWS=5
MAX_CONCURRENT_NODES=10
MEMORY_LIMIT_MB=1024
CPU_LIMIT_CORES=2

# RabbitMQ
RABBITMQ_URL=amqp://user:pass@host:5672
RABBITMQ_EXCHANGE=flow_orchestration
RABBITMQ_PREFETCH=5

# Database (Read-only replica)
DATABASE_URL=postgresql://user:pass@replica-host:5432/flowdb
DATABASE_POOL_SIZE=5

# Redis (Shared cache)
REDIS_URL=redis://host:6379

# Health Reporting
HEALTH_REPORT_INTERVAL=15000
ORCHESTRATOR_URL=http://orchestrator:3003

# Monitoring
METRICS_ENABLED=true
METRICS_PORT=9092
LOG_LEVEL=info

# Node-Core Library
NODE_CORE_LOG_LEVEL=info
NODE_CORE_TIMEOUT=60000
```

## 📝 Checklist de Implementación

### 🏷️ **Fase 1: Preparación de Infraestructura** (Estimado: 1-2 días)

#### ✅ 1.1 Configuración de Message Broker
- [ ] **1.1.1** Configurar RabbitMQ con clustering
  - [ ] Configurar usuarios y permisos
  - [ ] Crear exchanges y queues necesarias
  - [ ] Configurar dead letter queues
  - [ ] Configurar políticas de retry
  - [ ] Documentar topology de mensajería

- [ ] **1.1.2** Definir estructura de mensajes
  - [ ] Esquemas de mensajes para tasks
  - [ ] Esquemas de mensajes para results
  - [ ] Esquemas de mensajes para health checks
  - [ ] Esquemas de mensajes para metrics

#### ✅ 1.2 Actualización de Base de Datos
- [ ] **1.2.1** Migrar esquema para escalado
  - [ ] Agregar tablas para worker management
  - [ ] Agregar indices para queries distribuidas
  - [ ] Configurar replicación read-only
  - [ ] Optimizar queries para carga distribuida

#### ✅ 1.3 Configuración de Monitoreo
- [ ] **1.3.1** Setup Prometheus/Grafana stack
  - [ ] Configurar Prometheus server
  - [ ] Crear dashboards en Grafana
  - [ ] Configurar alertas críticas
  - [ ] Setup log aggregation

### 🏷️ **Fase 2: Extracción de API Gateway** (Estimado: 2-3 días)

#### ✅ 2.1 Crear nuevo servicio API Gateway
- [ ] **2.1.1** Setup proyecto base
  - [ ] Crear estructura de carpetas
  - [ ] Configurar NestJS con módulos base
  - [ ] Setup configuración y variables de entorno
  - [ ] Configurar logging y health checks

- [ ] **2.1.2** Migrar APIs del frontend
  - [ ] Migrar FlowsModule y controllers
  - [ ] Migrar CatalogModule y controllers  
  - [ ] Migrar MonitoringModule y controllers
  - [ ] Configurar validaciones y DTOs
  - [ ] Implementar rate limiting

- [ ] **2.1.3** Implementar WebSocket Gateway
  - [ ] Migrar RealtimeModule
  - [ ] Configurar broadcasting a múltiples workers
  - [ ] Implementar connection pooling
  - [ ] Agregar autenticación WebSocket

#### ✅ 2.2 Configurar comunicación con Orchestrator
- [ ] **2.2.1** Implementar cliente RabbitMQ
  - [ ] Setup conexión y channels
  - [ ] Implementar envío de tasks
  - [ ] Implementar recepción de results
  - [ ] Configurar error handling y retry

### 🏷️ **Fase 3: Creación del Orchestrator Service** (Estimado: 3-4 días)

#### ✅ 3.1 Crear servicio Orchestrator base
- [ ] **3.1.1** Setup proyecto y estructura
  - [ ] Crear proyecto NestJS independiente
  - [ ] Configurar módulos para queue management
  - [ ] Setup health checks y métricas
  - [ ] Configurar logging distribuido

- [ ] **3.1.2** Implementar Task Queue Management
  - [ ] Crear servicio de gestión de colas
  - [ ] Implementar algoritmos de balanceamiento
  - [ ] Configurar routing de mensajes
  - [ ] Implementar dead letter queue handling

#### ✅ 3.2 Worker Management System
- [ ] **3.2.1** Implementar worker registry
  - [ ] Sistema de registro de workers
  - [ ] Health check monitoring
  - [ ] Capacity tracking por worker
  - [ ] Worker heartbeat management

- [ ] **3.2.2** Load Balancing Logic
  - [ ] Algoritmo round-robin
  - [ ] Algoritmo least-busy
  - [ ] Algoritmo weighted
  - [ ] Configuración dinámica de estrategias

#### ✅ 3.3 Job Scheduling System
- [ ] **3.3.1** Migrar scheduler logic
  - [ ] Extraer SchedulerModule del monolito
  - [ ] Implementar distributed cron jobs
  - [ ] Configurar timezone handling
  - [ ] Implementar job persistence

### 🏷️ **Fase 4: Desarrollo del Worker Service** (Estimado: 2-3 días)

#### ✅ 4.1 Crear Worker base
- [ ] **4.1.1** Setup proyecto Worker
  - [ ] Crear estructura básica NestJS
  - [ ] Integrar node-core library
  - [ ] Configurar capacity limits
  - [ ] Setup health reporting

- [ ] **4.1.2** Implementar Task Processing
  - [ ] Migrar ExecutionModule logic
  - [ ] Implementar flow execution engine
  - [ ] Configurar node processing pipeline
  - [ ] Implementar result reporting

#### ✅ 4.2 Resource Management
- [ ] **4.2.1** Configurar límites de recursos
  - [ ] Memory monitoring y limits
  - [ ] CPU usage monitoring
  - [ ] Concurrent job limits
  - [ ] Graceful shutdown handling

- [ ] **4.2.2** Health Reporting
  - [ ] Implementar health checks
  - [ ] Reporte periódico al orchestrator
  - [ ] Métricas de performance
  - [ ] Error reporting y logging

### 🏷️ **Fase 5: Configuración de Despliegue** (Estimado: 2 días)

#### ✅ 5.1 Docker Configuration
- [ ] **5.1.1** Crear Dockerfiles optimizados
  - [ ] Dockerfile para API Gateway
  - [ ] Dockerfile para Orchestrator  
  - [ ] Dockerfile para Worker
  - [ ] Multi-stage builds para optimización

- [ ] **5.1.2** Docker Compose para desarrollo
  - [ ] Configurar todos los servicios
  - [ ] Setup networking entre servicios
  - [ ] Configurar volúmenes y persistence
  - [ ] Variables de entorno por ambiente

#### ✅ 5.2 Kubernetes Manifests (Opcional)
- [ ] **5.2.1** Crear manifests básicos
  - [ ] Deployments para cada servicio
  - [ ] Services y networking
  - [ ] ConfigMaps y Secrets
  - [ ] Horizontal Pod Autoscaler

### 🏷️ **Fase 6: Testing y Optimización** (Estimado: 2-3 días)

#### ✅ 6.1 Testing Integrado
- [ ] **6.1.1** Tests de comunicación entre servicios
  - [ ] Test API Gateway ↔ Orchestrator
  - [ ] Test Orchestrator ↔ Workers
  - [ ] Test message flow completo
  - [ ] Test failure scenarios

- [ ] **6.1.2** Load Testing
  - [ ] Test con carga baja (10 flujos concurrentes)
  - [ ] Test con carga media (100 flujos concurrentes)
  - [ ] Test con carga alta (1000+ flujos concurrentes)
  - [ ] Test auto-scaling functionality

#### ✅ 6.2 Performance Tuning
- [ ] **6.2.1** Optimización de RabbitMQ
  - [ ] Tuning de prefetch values
  - [ ] Optimización de routing
  - [ ] Memory y disk space optimization
  - [ ] Connection pooling optimization

- [ ] **6.2.2** Database Optimization
  - [ ] Query optimization para cargas distribuidas
  - [ ] Connection pooling tuning
  - [ ] Index optimization
  - [ ] Read replica configuration

### 🏷️ **Fase 7: Monitoreo y Observabilidad** (Estimado: 1-2 días)

#### ✅ 7.1 Métricas y Dashboards
- [ ] **7.1.1** Configurar métricas por servicio
  - [ ] API Gateway metrics (throughput, response times)
  - [ ] Orchestrator metrics (queue sizes, worker health)
  - [ ] Worker metrics (CPU, memory, job success rate)
  - [ ] RabbitMQ metrics (message rates, queue depths)

- [ ] **7.1.2** Dashboards en Grafana
  - [ ] Dashboard de overview del sistema
  - [ ] Dashboard por servicio
  - [ ] Dashboard de worker pool health
  - [ ] Dashboard de performance y SLAs

#### ✅ 7.2 Alertas y Logging
- [ ] **7.2.1** Configurar alertas críticas
  - [ ] Service down alerts
  - [ ] High queue depth alerts
  - [ ] Worker failure rate alerts
  - [ ] Resource exhaustion alerts

### 🏷️ **Fase 8: Documentación y Handoff** (Estimado: 1 día)

#### ✅ 8.1 Documentación Técnica
- [ ] **8.1.1** Guías de operación
  - [ ] Deployment guide
  - [ ] Scaling guide
  - [ ] Troubleshooting guide
  - [ ] Configuration reference

- [ ] **8.1.2** Documentación para desarrolladores
  - [ ] Architecture overview
  - [ ] API documentation
  - [ ] Message schemas
  - [ ] Development setup guide

## 🔧 Herramientas y Tecnologías

### Core Technologies
- **Backend**: NestJS (Node.js + TypeScript)
- **Message Broker**: RabbitMQ
- **Database**: PostgreSQL con read replicas
- **Cache**: Redis
- **Frontend**: React + Vite (sin cambios)

### DevOps Stack
- **Containerization**: Docker + Docker Compose
- **Orchestration**: Kubernetes (opcional)
- **Monitoring**: Prometheus + Grafana
- **Logging**: Winston + ELK Stack (opcional)
- **Load Balancing**: NGINX o cloud load balancer

### Development Tools
- **Package Manager**: npm workspaces
- **Build**: TypeScript + esbuild
- **Testing**: Jest + Supertest
- **Linting**: ESLint + Prettier
- **Git**: Husky + lint-staged

## 📊 Métricas de Monitoreo

### Service Level Indicators (SLIs)
1. **API Response Time**: < 200ms p95
2. **Flow Execution Success Rate**: > 99%
3. **Worker Availability**: > 95%
4. **Message Processing Latency**: < 1s p95
5. **System Throughput**: > 1000 flows/min

### Business Metrics
1. **Concurrent Flow Capacity**: Target 10,000+
2. **Horizontal Scaling Time**: < 30 seconds
3. **Resource Utilization**: 60-80% optimal
4. **Cost per Flow Execution**: Minimized
5. **System Availability**: > 99.9%

## 🚀 Estrategia de Migración

### Enfoque Blue-Green Deployment
1. **Blue Environment**: Sistema actual monolítico
2. **Green Environment**: Nuevo sistema distribuido
3. **Gradual Migration**: 
   - Fase 1: 10% del tráfico al Green
   - Fase 2: 50% del tráfico al Green
   - Fase 3: 100% del tráfico al Green
   - Fase 4: Deprecar Blue environment

### Rollback Plan
- Monitoring continuo durante migración
- Automatic rollback triggers en caso de:
  - Error rate > 5%
  - Response time > 500ms
  - Worker failure rate > 10%
- Manual rollback process < 5 minutos

## 💰 Consideraciones de Costos

### Optimizaciones de Infraestructura
- **Auto-scaling**: Workers escalan según demanda
- **Resource Limits**: Límites configurables por worker
- **Shared Resources**: PostgreSQL y Redis compartidos
- **Efficient Messaging**: RabbitMQ con persistence optimizada

### Estimación de Recursos por Ambiente

#### Desarrollo
- API Gateway: 512MB RAM, 0.5 CPU
- Orchestrator: 1GB RAM, 1 CPU  
- Workers (2x): 1GB RAM cada uno, 1 CPU cada uno
- RabbitMQ: 512MB RAM, 0.5 CPU
- PostgreSQL: 1GB RAM, 1 CPU
- Redis: 256MB RAM, 0.25 CPU

#### Producción (Base)
- API Gateway (2x): 2GB RAM cada uno, 2 CPU cada uno
- Orchestrator (2x): 4GB RAM cada uno, 2 CPU cada uno
- Workers (5x): 2GB RAM cada uno, 2 CPU cada uno  
- RabbitMQ Cluster (3x): 2GB RAM cada uno, 1 CPU cada uno
- PostgreSQL Primary: 8GB RAM, 4 CPU
- PostgreSQL Replica (2x): 4GB RAM cada uno, 2 CPU cada uno
- Redis Cluster (3x): 2GB RAM cada uno, 1 CPU cada uno

## 🎯 Próximos Pasos

Una vez que confirmes el plan, procederemos con la implementación paso a paso siguiendo el checklist. Cada fase será implementada y probada antes de continuar con la siguiente.

¿Te parece bien este plan de escalado? ¿Hay algún aspecto que quisieras modificar o alguna consideración adicional que debería incluir?
