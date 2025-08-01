# Plan de Pruebas y Carga - Flow Orchestration Platform

## Resumen Ejecutivo

Plan de pruebas integral para la Fase 1 del sistema de orquestación de flujos, diseñado para validar la funcionalidad, performance y resilencia del Scheduler-Engine.

## Objetivos de Testing

### Objetivos Funcionales
- ✅ Validar CRUD completo de flujos de trabajo
- ✅ Verificar programación y ejecución de schedules
- ✅ Comprobar compatibilidad entre nodos
- ✅ Validar integración de los 3 nodos ejemplo
- ✅ Verificar manejo de errores y reintentos

### Objetivos No-Funcionales
- 🎯 **Performance:** <100ms latencia CRUD, <5s inicio ejecución
- 🎯 **Escalabilidad:** Cientos de flujos simultáneos, 10,000+ registros/ejecución
- 🎯 **Disponibilidad:** 99.9% uptime durante pruebas de carga
- 🎯 **Resilencia:** Recovery automático ante fallos
- 🎯 **Seguridad:** Validar autenticación y autorización

## Estrategia de Testing

### 1. Testing Pyramid

```
    ┌─────────────────┐
    │   E2E Tests     │  <- 10% (Critical user journeys)
    │   (Playwright)  │
    ├─────────────────┤
    │ Integration     │  <- 30% (API contracts, DB)
    │ Tests (Jest)    │
    ├─────────────────┤
    │  Unit Tests     │  <- 60% (Business logic, nodes)
    │  (Jest/Vitest)  │
    └─────────────────┘
```

### 2. Tipos de Pruebas

#### Unit Tests (60%)
- **Node-Core Library:** Cada nodo individual
- **Validation Logic:** Compatibility matrix
- **Business Logic:** Flow validation, scheduling
- **Utilities:** Logging, configuration

#### Integration Tests (30%)
- **API Contracts:** OpenAPI compliance
- **Database Integration:** TypeORM entities
- **Queue Integration:** BullMQ job processing
- **Service Communication:** Inter-service calls

#### E2E Tests (10%)
- **Critical User Journeys:** Flow creation → scheduling → execution
- **UI Workflows:** React components integration
- **Error Scenarios:** Failure handling and recovery

## Plan de Ejecución

### Fase 1: Unit Testing (Semana 1-2)

**Node-Core Library Tests:**
```typescript
// Ejemplo: postgresql-query.node.test.ts
describe('PostgreSQLQueryNode', () => {
  test('should execute valid query', async () => {
    const result = await node.execute(validContext)
    expect(result.success).toBe(true)
    expect(result.data.result).toBeInstanceOf(Array)
  })
  
  test('should handle connection errors', async () => {
    const result = await node.execute(invalidContext)
    expect(result.success).toBe(false)
    expect(result.error).toContain('connection')
  })
})
```

**Compatibility Validator Tests:**
```typescript
describe('CompatibilityValidator', () => {
  test('should validate full compatibility', () => {
    const isCompatible = validator.check(pgNode, filterNode, connection)
    expect(isCompatible.level).toBe('full')
  })
})
```

### Fase 2: Integration Testing (Semana 2-3)

**API Contract Tests:**
```typescript
// flow-management.integration.test.ts
describe('Flow Management API', () => {
  test('POST /flows should create valid flow', async () => {
    const response = await request(app)
      .post('/api/v1/flows')
      .send(validFlowData)
    
    expect(response.status).toBe(201)
    expect(response.body).toMatchSchema(flowSchema)
  })
})
```

**Database Integration Tests:**
```typescript
describe('Flow Repository', () => {
  test('should persist flow with relationships', async () => {
    const savedFlow = await flowRepo.save(flowEntity)
    expect(savedFlow.nodes).toHaveLength(3)
    expect(savedFlow.connections).toHaveLength(2)
  })
})
```

### Fase 3: E2E Testing (Semana 3-4)

**Critical User Journey:**
```typescript
// e2e/flow-creation.spec.ts
test('Complete flow creation and execution', async ({ page }) => {
  // 1. Login and navigate to flow builder
  await page.goto('/flows')
  
  // 2. Create flow: SQL → Filter → Mapper
  await page.dragAndDrop('[data-node="postgresql-query"]', '#canvas')
  await page.dragAndDrop('[data-node="data-filter"]', '#canvas')
  await page.dragAndDrop('[data-node="field-mapper"]', '#canvas')
  
  // 3. Connect nodes
  await page.click('[data-output="result"]')
  await page.click('[data-input="data"]')
  
  // 4. Configure nodes
  await page.fill('[data-config="connectionString"]', testDb)
  await page.fill('[data-config="query"]', 'SELECT * FROM test_users')
  
  // 5. Save flow
  await page.click('button:has-text("Guardar Flujo")')
  
  // 6. Create schedule
  await page.goto('/schedules')
  await page.click('button:has-text("Nuevo Schedule")')
  await page.fill('[data-field="cronExpression"]', '0 */5 * * *')
  
  // 7. Verify execution
  await page.goto('/executions')
  await expect(page.locator('[data-status="success"]')).toBeVisible()
})
```

## Testing de Carga

### Herramientas
- **K6** para load testing
- **Artillery** para API stress testing  
- **Docker Compose** para ambiente de pruebas

### Escenarios de Carga

#### Escenario 1: Carga Nominal
```javascript
// k6-nominal-load.js
import http from 'k6/http'

export let options = {
  stages: [
    { duration: '5m', target: 100 }, // Ramp up
    { duration: '10m', target: 100 }, // Stay at 100 users
    { duration: '5m', target: 0 }, // Ramp down
  ],
}

export default function() {
  // Test CRUD operations
  const flowData = { /* ... */ }
  const response = http.post('/api/v1/flows', JSON.stringify(flowData))
  check(response, {
    'status is 201': (r) => r.status === 201,
    'response time < 100ms': (r) => r.timings.duration < 100,
  })
}
```

#### Escenario 2: Pico de Ejecuciones
```javascript
// k6-execution-spike.js
export let options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '1m', target: 500 }, // Sudden spike
    { duration: '2m', target: 500 },
    { duration: '2m', target: 0 },
  ],
}

export default function() {
  // Trigger multiple flow executions
  const schedules = [/* multiple schedule IDs */]
  schedules.forEach(id => {
    http.post(`/api/v1/schedules/${id}/trigger`)
  })
}
```

#### Escenario 3: Volumen de Datos
```javascript
// k6-data-volume.js
export default function() {
  // Test with large datasets (10,000+ records)
  const largeDataset = generateTestData(10000)
  const response = http.post('/api/v1/flows/execute', {
    flowId: 'test-flow',
    inputData: largeDataset
  })
  
  check(response, {
    'handles large dataset': (r) => r.status === 200,
    'completes within 30s': (r) => r.timings.duration < 30000,
  })
}
```

### Métricas Objetivo

| Métrica | Objetivo | Umbral Crítico |
|---------|----------|----------------|
| Response Time (API) | <100ms (p95) | <500ms (p99) |
| Throughput | 1000 req/s | 500 req/s |
| Error Rate | <0.1% | <1% |
| Memory Usage | <80% | <95% |
| CPU Usage | <70% | <90% |
| Queue Processing | <5s delay | <30s delay |

## Ambiente de Testing

### Local Testing Stack
```yaml
# docker-compose.test.yml
version: '3.8'
services:
  test-db:
    image: postgres:15
    environment:
      POSTGRES_DB: flow_platform_test
      POSTGRES_USER: test_user
      POSTGRES_PASSWORD: test_password
    ports:
      - "5433:5432"
      
  test-redis:
    image: redis:7-alpine
    ports:
      - "6380:6379"
      
  test-minio:
    image: minio/minio
    environment:
      MINIO_ROOT_USER: testuser
      MINIO_ROOT_PASSWORD: testpassword
    ports:
      - "9001:9000"
```

### CI/CD Pipeline Testing
```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:coverage
      
  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: testpass
        options: --health-cmd pg_isready --health-interval 10s
      redis:
        image: redis:7
        options: --health-cmd "redis-cli ping" --health-interval 10s
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run test:integration
      
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install
      - run: npm run test:e2e
      
  load-tests:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: grafana/k6-action@v0.2.0
        with:
          filename: tests/load/k6-nominal-load.js
```

## Criterios de Aceptación

### Funcionales
- ✅ Todos los endpoints OpenAPI responden correctamente
- ✅ Flujos se ejecutan end-to-end sin errores
- ✅ Compatibilidad entre nodos se valida correctamente
- ✅ Schedules se activan en tiempo esperado
- ✅ Reintentos funcionan según configuración

### No-Funcionales
- ✅ 95% de coverage en unit tests
- ✅ 0% de fallos en integration tests
- ✅ Load tests pasan con métricas objetivo
- ✅ Sistema se recupera de fallos simulados
- ✅ Memory/CPU usage dentro de límites

## Cronograma

| Semana | Actividad | Responsable | Entregable |
|--------|-----------|-------------|------------|
| 1 | Unit tests Node-Core | Backend-Guru | Test suite completo |
| 1-2 | Unit tests Services | Backend-Guru | API tests |
| 2 | Integration tests | Backend-Guru | DB/Queue integration |
| 2-3 | Frontend unit tests | Frontend-Guru | Component tests |
| 3 | E2E test setup | Frontend-Guru | Playwright config |
| 3 | Load test scripts | Integrations-Mage | K6 scenarios |
| 4 | Performance tuning | Architect-Sensei | Optimization report |
| 4 | CI/CD integration | All | Automated pipeline |

## Reportes y Métricas

### Dashboard de Testing
- **Test Results:** Pass/fail rates por suite
- **Coverage Reports:** Coverage trends over time  
- **Performance Metrics:** Response times, throughput
- **Load Test Results:** Capacity and limits
- **Error Analysis:** Error patterns and frequency

### Alertas
- Test failures en main branch
- Coverage drops below 90%
- Performance degradation >20%
- Load test failures
- Critical path E2E failures

Este plan asegura la calidad y performance del sistema antes del release de Fase 1, estableciendo las bases para la futura Fase 2 (Webhook-Engine).