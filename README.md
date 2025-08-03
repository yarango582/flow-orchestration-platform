# Flow Orchestration Platform - Architecture & Redis Usage

## 📋 Resumen del Proyecto

Flow Orchestration Platform es una plataforma de orquestación de flujos de trabajo que permite crear, programar y ejecutar flujos de datos complejos. El sistema está construido con una arquitectura moderna basada en microservicios usando NestJS, React, PostgreSQL, Redis y MongoDB.

## 🏗️ Arquitectura General

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend UI   │    │  Backend API    │    │   Databases     │
│   (React)       │◄──►│   (NestJS)      │◄──►│   PostgreSQL    │
│   Port: 5173    │    │   Port: 3001    │    │   Redis         │
└─────────────────┘    └─────────────────┘    │   MongoDB       │
                                              └─────────────────┘
```

## 🔴 Uso de Redis en el Sistema

### 1. **Cola de Trabajos con BullMQ**

Redis actúa como el backend principal para el sistema de colas de trabajos utilizando **BullMQ** (una librería avanzada de colas para Node.js).

#### Configuración de Redis:
```typescript
// packages/scheduler-engine/src/config/redis.config.ts
export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB, 10) || 0,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true,
}));
```

#### Configuración de BullMQ:
```typescript
// packages/scheduler-engine/src/app.module.ts
BullModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    redis: {
      host: configService.get('redis.host'),
      port: configService.get('redis.port'),
      password: configService.get('redis.password'),
      db: configService.get('redis.db', 0),
    },
  }),
  inject: [ConfigService],
})
```

### 2. **Cola de Ejecución de Flujos**

#### Características de la Cola:
```typescript
// packages/scheduler-engine/src/scheduler/scheduler.module.ts
BullModule.registerQueue({
  name: 'flow-execution',
  defaultJobOptions: {
    attempts: 3,                    // 3 intentos máximos
    backoff: {                      // Reintentos exponenciales
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 50,           // Mantener 50 trabajos completados
    removeOnFail: 20,              // Mantener 20 trabajos fallidos
  },
})
```

### 3. **Estructura de Datos en Redis**

#### Claves encontradas en Redis:
- `bull:flow-execution:*` - Trabajos individuales de ejecución
- `bull:flow-execution:completed` - Conjunto ordenado de trabajos completados (50 elementos)
- `bull:flow-execution:id` - Contador de IDs para trabajos

#### Tipos de Datos:
- **ZSets (Conjuntos Ordenados)**: Para mantener trabajos completados y fallidos ordenados por tiempo
- **Hashes**: Para almacenar metadatos de trabajos individuales
- **Strings**: Para contadores e IDs

### 4. **Procesamiento de Trabajos**

```typescript
// packages/scheduler-engine/src/scheduler/flow-execution.processor.ts
@Processor('flow-execution')
export class FlowExecutionProcessor {
  @Process('execute-flow')
  async handleFlowExecution(job: Job<FlowExecutionJobData>): Promise<void> {
    // Procesa la ejecución del flujo
    // Maneja reintentos automáticos
    // Emite eventos en tiempo real
  }
}
```

#### Funcionalidades del Procesador:
- **Tracking de trabajos activos**: Mantiene métricas de CPU y memoria
- **Manejo de errores**: Reintentos automáticos con backoff exponencial
- **Eventos en tiempo real**: Emite actualizaciones via WebSocket
- **Limpieza automática**: Remueve trabajos antiguos según configuración

## 🚀 Análisis de Escalabilidad Horizontal

### ❌ **Estado Actual: NO Escalado Horizontalmente**

El sistema actualmente **NO está preparado** para escalamiento horizontal por las siguientes razones:

#### 1. **Instancia Única del Scheduler**
```typescript
// Solo una instancia procesa trabajos
@Processor('flow-execution')
export class FlowExecutionProcessor {
  // Una sola instancia maneja todos los trabajos
}
```

#### 2. **Estado Local en Memoria**
```typescript
// Estado compartido en memoria local
private activeJobs = new Map<string, {
  jobId: string;
  executionId: string;
  // ... otros datos locales
}>();
```

#### 3. **Configuración de Contenedor Único**
```yaml
# docker-compose.yml - Solo un contenedor del backend
scheduler-engine:
  container_name: flow-platform-scheduler  # Instancia única
  environment:
    MAX_CONCURRENT_EXECUTIONS: 10          # Límite por instancia
```

### ✅ **Preparación para Escalamiento Horizontal**

Para soportar **miles de servicios**, se necesitan estos cambios:

#### 1. **Múltiples Instancias del Worker**
```yaml
# docker-compose.yml
scheduler-engine-worker-1:
  build: .
  environment:
    WORKER_ID: "worker-1"
    MAX_CONCURRENT_EXECUTIONS: 20

scheduler-engine-worker-2:
  build: .
  environment:
    WORKER_ID: "worker-2"
    MAX_CONCURRENT_EXECUTIONS: 20
# ... más workers
```

#### 2. **Configuración de Redis para Alta Disponibilidad**
```yaml
# Redis Cluster o Redis Sentinel
redis-master:
  image: redis:7-alpine
  command: redis-server --maxmemory 2gb --maxmemory-policy allkeys-lru

redis-replica-1:
  image: redis:7-alpine
  command: redis-server --replicaof redis-master 6379

redis-sentinel:
  image: redis:7-alpine
  command: redis-sentinel /sentinel.conf
```

#### 3. **Balanceador de Carga**
```yaml
nginx:
  image: nginx:alpine
  ports:
    - "3001:80"
  depends_on:
    - scheduler-engine-1
    - scheduler-engine-2
    - scheduler-engine-3
```

## 📊 **Métricas Actuales de Redis**

### Uso de Memoria:
- **Memoria usada**: 2.07MB
- **Memoria RSS**: 8.85MB  
- **Trabajos completados**: 50 (configurado para mantener este límite)
- **Política de memoria**: noeviction (sin límite configurado)

### Configuración Actual:
- **Puerto**: 6379
- **Persistencia**: AOF habilitado + Snapshots
- **Límite de memoria**: 256MB (en docker)
- **Bases de datos**: 16 disponibles (usando DB 0)

## 🔧 **Recomendaciones para Escalamiento**

### 1. **Inmediatas (Para 100-1000 servicios)**
- Implementar múltiples workers usando Docker Compose scale
- Configurar Redis con más memoria (2-4GB)
- Implementar métricas y monitoreo con Prometheus

### 2. **Mediano Plazo (Para 1000-10000 servicios)**
- Migrar a Kubernetes para orquestación automática
- Implementar Redis Cluster para alta disponibilidad
- Agregar circuit breakers y rate limiting

### 3. **Largo Plazo (Para 10000+ servicios)**
- Considerar migrar a Apache Kafka para el sistema de colas
- Implementar sharding por tipos de flujos
- Usar bases de datos distribuidas como CockroachDB

## 🛠️ **Comandos Útiles**

### Redis:
```bash
# Conectar a Redis
redis-cli

# Ver todas las claves
redis-cli keys "*"

# Ver estadísticas de memoria
redis-cli info memory

# Ver trabajos en cola
redis-cli zcard "bull:flow-execution:completed"

# Monitor en tiempo real
redis-cli monitor
```

### Docker:
```bash
# Escalar workers
docker-compose up --scale scheduler-engine=3

# Ver logs de Redis
docker-compose logs redis

# Ver dashboard de BullMQ
# http://localhost:3010
```

## 📈 **Monitoreo**

### Métricas Clave para Redis:
- **Memoria usada vs disponible**
- **Número de trabajos en cola**
- **Latencia de operaciones**
- **Conexiones activas**
- **Hit/Miss ratio**

### Dashboard BullMQ:
El sistema incluye Bull Board dashboard en el puerto 3010 para monitorear:
- Trabajos activos, completados y fallidos
- Métricas de rendimiento
- Logs de trabajos individuales
- Reintentos y estadísticas de errores

---

## 📁 Arquitectura del Proyecto

```
flow-orchestration-platform/
├── packages/
│   ├── node-core/           # Librería compartida de nodos
│   ├── scheduler-engine/    # Backend para tareas programadas  
│   └── scheduler-ui/        # Frontend para diseño de flujos
├── infra/
│   ├── helm/               # Charts de Helm para Kubernetes
│   ├── terraform/          # Infraestructura como código
│   └── docker/             # Dockerfiles y docker-compose
├── docs/
│   ├── architecture/       # Documentación arquitectónica
│   ├── api/               # Especificaciones OpenAPI
│   └── guides/            # Guías de desarrollo
├── scripts/
│   ├── setup.sh           # Script de configuración inicial
│   └── deploy.sh          # Scripts de despliegue
└── .github/
    └── workflows/         # CI/CD con GitHub Actions
```

## Stack Tecnológico

- **Runtime:** Node.js 20 LTS
- **Frontend:** React + TypeScript + Vite
- **Backend:** NestJS + TypeScript + TypeORM
- **Queue:** BullMQ + Redis
- **Database:** PostgreSQL
- **Storage:** MinIO/S3
- **Orchestration:** Kubernetes + Helm
- **Monitoring:** OpenTelemetry + Prometheus + Grafana

---

**Conclusión**: El sistema actual funciona bien para cargas pequeñas a medianas (hasta ~1000 ejecuciones concurrentes), pero necesita refactoring significativo para soportar "miles de servicios" con escalamiento horizontal real.
2. Node B → Filtro de datos
3. Node C → Mapeo de campos  
4. Node D → Envío a servicio externo (HTTP POST)

## Comenzar

```bash
# Instalar dependencias
npm install

# Configurar entorno local
./scripts/setup.sh

# Ejecutar en modo desarrollo
npm run dev

# Ejecutar tests
npm test

# Build para producción
npm run build
```

## Estructura de Nodos

Los nodos siguen el patrón de compatibilidad tipo "puzzle":

```typescript
interface Node {
  inputs: NodeInput[];
  outputs: NodeOutput[];
  compatibilityMatrix: CompatibilityRule[];
  execute(context: ExecutionContext): Promise<NodeResult>;
}
```

## Contribuir

1. Fork del repositorio
2. Crear branch para feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit de cambios (`git commit -m 'Añadir nueva funcionalidad'`)
4. Push al branch (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## Licencia

Uso interno de la organización.