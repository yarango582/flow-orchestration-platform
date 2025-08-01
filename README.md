# Flow Orchestration Platform

Plataforma privada de orquestación de flujos de trabajo con alta resiliencia y escalabilidad.

## Arquitectura del Proyecto

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

## Fase 1 - Scheduler Engine

Implementación del motor de tareas programadas con los siguientes componentes:

### Componentes Principales
- **Flow Management Service:** CRUD de flujos de trabajo
- **Scheduler Service:** Programación y dispatch de tareas
- **Execution Engine:** Motor de ejecución de flujos
- **Node Catalog Service:** Gestión del catálogo de nodos

### Casos de Uso Mínimos
1. Node A → Consulta SQL/PostgreSQL
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