# PostgreSQL Query Node - Guía de Troubleshooting

## Índice de Problemas

1. [Errores de Conexión](#errores-de-conexión)
2. [Errores de Autenticación](#errores-de-autenticación)
3. [Errores de SQL](#errores-de-sql)
4. [Problemas de Performance](#problemas-de-performance)
5. [Errores de Timeout](#errores-de-timeout)
6. [Problemas con Pool de Conexiones](#problemas-con-pool-de-conexiones)
7. [Errores de Memoria](#errores-de-memoria)
8. [FAQ - Preguntas Frecuentes](#faq---preguntas-frecuentes)

---

## Errores de Conexión

### Error: `ECONNREFUSED`

**Mensaje típico:**
```
Connection failed: connect ECONNREFUSED 127.0.0.1:5432
```

**Causas:**
- PostgreSQL no está ejecutándose
- Puerto incorrecto en la connection string
- Firewall bloqueando la conexión

**Soluciones:**

1. **Verificar servicio PostgreSQL:**
```bash
# Linux/Mac
sudo systemctl status postgresql
# o
brew services list | grep postgresql

# Windows
sc query postgresql-x64-13
```

2. **Iniciar PostgreSQL:**
```bash
# Linux
sudo systemctl start postgresql

# Mac
brew services start postgresql

# Windows
net start postgresql-x64-13
```

3. **Verificar puerto:**
```bash
# Verificar en qué puerto está corriendo PostgreSQL
sudo netstat -tlnp | grep :5432
# o
sudo ss -tlnp | grep :5432
```

4. **Configurar connection string correcta:**
```typescript
// Correcto
const connectionString = "postgresql://user:password@localhost:5432/database"

// Verificar puerto personalizado
const customPort = "postgresql://user:password@localhost:5433/database"
```

### Error: `ENOTFOUND`

**Mensaje típico:**
```
getaddrinfo ENOTFOUND database-host.com
```

**Causas:**
- Hostname incorrecto
- Problemas de DNS
- Host no accesible desde la red actual

**Soluciones:**

1. **Verificar hostname:**
```bash
# Probar conectividad
ping database-host.com
nslookup database-host.com
```

2. **Usar IP directa:**
```typescript
// En lugar de hostname, usar IP
const connectionString = "postgresql://user:password@192.168.1.100:5432/database"
```

3. **Verificar /etc/hosts (Linux/Mac):**
```bash
# Agregar entrada si es necesario
echo "192.168.1.100 database-host.com" >> /etc/hosts
```

### Error: `ECONNRESET`

**Mensaje típico:**
```
Connection terminated unexpectedly
```

**Causas:**
- Conexión de red inestable
- Servidor PostgreSQL reiniciado
- Timeout de conexión inactiva

**Soluciones:**

1. **Configurar keepalive:**
```typescript
const connectionString = `postgresql://user:password@host:5432/db?keepalive=true&keepaliveInterval=30000`
```

2. **Implementar retry automático:**
```typescript
const nodeConfig = {
  timeout: 60000,
  poolSize: 5,
  retryAttempts: 3,
  retryDelay: 1000
}
```

---

## Errores de Autenticación

### Error: `28P01 - Invalid password`

**Mensaje típico:**
```
password authentication failed for user "myuser"
```

**Soluciones:**

1. **Verificar credenciales:**
```typescript
// Asegurar caracteres especiales escapados
const user = "myuser"
const password = "my@password!123"
const encoded = encodeURIComponent(password)
const connectionString = `postgresql://${user}:${encoded}@host:5432/db`
```

2. **Probar conexión directa:**
```bash
# Probar con psql
psql -h localhost -U myuser -d mydatabase
```

3. **Verificar configuración pg_hba.conf:**
```bash
# Ubicar archivo
sudo find /etc -name "pg_hba.conf" 2>/dev/null

# Verificar configuración de autenticación
# Debe tener línea similar a:
# host    all             all             0.0.0.0/0               md5
```

### Error: `28000 - Invalid authorization`

**Mensaje típico:**
```
role "myuser" does not exist
```

**Soluciones:**

1. **Crear usuario:**
```sql
-- Conectar como superusuario
CREATE USER myuser WITH PASSWORD 'mypassword';
GRANT CONNECT ON DATABASE mydatabase TO myuser;
GRANT USAGE ON SCHEMA public TO myuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO myuser;
```

2. **Verificar permisos existentes:**
```sql
-- Ver usuarios
\du

-- Ver permisos en base de datos
\l

-- Ver permisos en tablas
\dp
```

---

## Errores de SQL

### Error: `42601 - Syntax error`

**Mensaje típico:**
```
syntax error at or near "SELCT"
```

**Soluciones:**

1. **Validar sintaxis SQL:**
```typescript
// Usar herramientas de validación o IDE con syntax highlighting
const query = `
  SELECT u.id, u.name
  FROM users u
  WHERE u.active = $1
` // Verificar que no falten comas, paréntesis, etc.
```

2. **Probar query directamente:**
```bash
# Probar en psql primero
psql -h localhost -U user -d database -c "SELECT * FROM users LIMIT 1;"
```

### Error: `42703 - Column doesn't exist`

**Mensaje típico:**
```
column "user_name" does not exist
```

**Soluciones:**

1. **Verificar estructura de tabla:**
```sql
-- Ver columnas de la tabla
\d users
-- o
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users';
```

2. **Usar nombres exactos:**
```typescript
// PostgreSQL es case-sensitive con comillas
const query = `SELECT "userName" FROM users` // Si la columna se creó con comillas
// o
const query = `SELECT username FROM users`   // Si se creó sin comillas (lowercase)
```

### Error: `42P01 - Table doesn't exist`

**Mensaje típico:**
```
relation "user" does not exist
```

**Soluciones:**

1. **Verificar nombre de tabla:**
```sql
-- Listar todas las tablas
\dt

-- Ver tablas en esquema específico
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```

2. **Incluir esquema:**
```typescript
const query = `SELECT * FROM public.users` // Especificar esquema
```

---

## Problemas de Performance

### Consultas Lentas

**Síntomas:**
- `executionTime` mayor a 5000ms
- Timeouts frecuentes
- Alto uso de CPU en PostgreSQL

**Diagnóstico:**

1. **Usar EXPLAIN ANALYZE:**
```typescript
const explainInput = {
  query: `EXPLAIN ANALYZE SELECT * FROM users WHERE active = $1`,
  parameters: [true]
}
```

2. **Verificar índices:**
```sql
-- Ver índices existentes
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename = 'users';

-- Estadísticas de uso
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE tablename = 'users';
```

**Soluciones:**

1. **Crear índices apropiados:**
```sql
-- Índice simple
CREATE INDEX idx_users_active ON users(active);

-- Índice compuesto
CREATE INDEX idx_users_active_dept ON users(active, department_id);

-- Índice parcial
CREATE INDEX idx_active_users_email ON users(email) WHERE active = true;
```

2. **Optimizar consultas:**
```typescript
// Evitar SELECT *
const optimized = {
  query: `SELECT id, name, email FROM users WHERE active = $1`,
  parameters: [true]
}

// Usar LIMIT para conjuntos grandes
const limited = {
  query: `SELECT * FROM users WHERE active = $1 ORDER BY created_at DESC LIMIT $2`,
  parameters: [true, 100]
}
```

### Alto Consumo de Memoria

**Síntomas:**
- Error "out of memory"
- Respuestas muy grandes
- Servidor PostgreSQL lento

**Soluciones:**

1. **Limitar resultados:**
```typescript
const input = {
  query: `
    SELECT * FROM large_table 
    WHERE date >= $1 
    ORDER BY date DESC 
    LIMIT $2
  `,
  parameters: [new Date('2024-01-01'), 1000]
}
```

2. **Usar paginación:**
```typescript
const paginatedQuery = {
  query: `
    SELECT * FROM users 
    WHERE active = $1 
    ORDER BY id 
    LIMIT $2 OFFSET $3
  `,
  parameters: [true, 50, pageNumber * 50]
}
```

---

## Errores de Timeout

### Error: `Operation timed out`

**Mensaje típico:**
```
Operation timed out after 30000ms
```

**Causas:**
- Consulta muy compleja
- Falta de índices
- Bloqueos en la base de datos
- Red lenta

**Soluciones:**

1. **Aumentar timeout:**
```typescript
const config = {
  timeout: 120000, // 2 minutos
  poolSize: 10
}

const node = new PostgreSQLQueryNode(config)
```

2. **Optimizar consulta:**
```typescript
// Dividir consulta compleja en partes más simples
const simpleQuery = {
  query: `SELECT id FROM users WHERE active = $1 LIMIT 1000`,
  parameters: [true]
}
```

3. **Verificar bloqueos:**
```sql
-- Ver queries activas
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';

-- Ver bloqueos
SELECT blocked_locks.pid AS blocked_pid,
       blocking_locks.pid AS blocking_pid,
       blocked_activity.query AS blocked_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype;
```

---

## Problemas con Pool de Conexiones

### Error: `Pool exhausted`

**Mensaje típico:**
```
Connection pool exhausted - unable to obtain connection
```

**Causas:**
- Pool size muy pequeño
- Conexiones no liberadas correctamente
- Muchas consultas concurrentes

**Soluciones:**

1. **Aumentar pool size:**
```typescript
const config = {
  poolSize: 50, // Aumentar según carga
  timeout: 30000
}
```

2. **Monitorear pool:**
```typescript
// Implementar logging del pool
const nodeWithLogging = new PostgreSQLQueryNode({
  poolSize: 20,
  onPoolStats: (stats) => {
    console.log(`Pool: ${stats.used}/${stats.total} connections`)
  }
})
```

3. **Configurar timeouts apropiados:**
```typescript
const config = {
  poolSize: 25,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  maxUses: 7500
}
```

### Conexiones Colgadas

**Síntomas:**
- Pool nunca se libera completamente
- Conexiones IDLE en PostgreSQL

**Soluciones:**

1. **Verificar conexiones activas:**
```sql
SELECT count(*) as connections, state
FROM pg_stat_activity
WHERE datname = 'your_database'
GROUP BY state;
```

2. **Configurar connection cleanup:**
```sql
-- En postgresql.conf
idle_in_transaction_session_timeout = 60s
statement_timeout = 30s
```

---

## Errores de Memoria

### Error: `JavaScript heap out of memory`

**Causas:**
- Resultado muy grande
- Procesamiento de muchos registros
- Memory leak en el pool

**Soluciones:**

1. **Aumentar heap size:**
```bash
node --max-old-space-size=4096 your-app.js
```

2. **Procesar en chunks:**
```typescript
const processInChunks = async (totalRecords: number) => {
  const chunkSize = 1000
  let offset = 0
  
  while (offset < totalRecords) {
    const input = {
      query: `SELECT * FROM large_table ORDER BY id LIMIT $1 OFFSET $2`,
      parameters: [chunkSize, offset]
    }
    
    const result = await node.execute(input)
    // Procesar chunk
    await processChunk(result.data.result)
    
    offset += chunkSize
  }
}
```

3. **Streaming para resultados grandes:**
```typescript
// Usar cursor para streaming (requiere implementación personalizada)
const streamQuery = {
  query: `DECLARE cursor1 CURSOR FOR SELECT * FROM large_table`,
  parameters: []
}
```

---

## FAQ - Preguntas Frecuentes

### P: ¿Cómo manejo caracteres especiales en la contraseña?

**R:** Usa `encodeURIComponent()` para escapar caracteres especiales:

```typescript
const password = "p@ssw0rd!#$%"
const encoded = encodeURIComponent(password)
const connectionString = `postgresql://user:${encoded}@host:5432/db`
```

### P: ¿Puedo usar transacciones entre múltiples nodos?

**R:** No, cada ejecución del nodo es independiente. Para transacciones complejas, usa un solo nodo con múltiples queries:

```typescript
const transactionQuery = {
  query: `
    BEGIN;
    INSERT INTO users (name) VALUES ($1);
    UPDATE counters SET user_count = user_count + 1;
    COMMIT;
  `,
  parameters: ["New User"]
}
```

### P: ¿Cómo optimizo consultas con muchos JOINs?

**R:** 
1. Usa EXPLAIN ANALYZE para identificar cuellos de botella
2. Crea índices en columnas de JOIN
3. Considera desnormalizar datos frecuentemente consultados
4. Usa CTEs o subconsultas cuando sea más eficiente

### P: ¿Qué hacer si la consulta retorna demasiados datos?

**R:**
1. Implementa paginación con LIMIT/OFFSET
2. Usa filtros más específicos
3. Procesa datos en chunks
4. Considera usar streaming o cursors

### P: ¿Cómo debuggeo problemas de conexión SSL?

**R:**
```typescript
// Habilitar logging detallado
const connectionString = `postgresql://user:pass@host:5432/db?sslmode=require&ssllog=1`

// Verificar certificados
const withSSLOptions = `postgresql://user:pass@host:5432/db?sslmode=verify-full&sslcert=client.crt&sslkey=client.key&sslrootcert=ca.crt`
```

### P: ¿Puedo usar arrays como parámetros?

**R:** Sí, PostgreSQL soporta arrays:

```typescript
const arrayQuery = {
  query: `SELECT * FROM users WHERE id = ANY($1)`,
  parameters: [[1, 2, 3, 4, 5]]
}

// O con ANY()
const anyQuery = {
  query: `SELECT * FROM users WHERE department IN ($1, $2, $3)`,
  parameters: ['Engineering', 'Sales', 'Marketing']
}
```

### P: ¿Cómo manejo tipos de datos PostgreSQL específicos?

**R:**
```typescript
// JSON/JSONB
const jsonQuery = {
  query: `SELECT * FROM products WHERE metadata @> $1`,
  parameters: [JSON.stringify({category: 'electronics'})]
}

// Arrays
const arrayQuery = {
  query: `SELECT * FROM posts WHERE tags && $1`,
  parameters: [['javascript', 'nodejs']]
}

// UUID
const uuidQuery = {
  query: `SELECT * FROM sessions WHERE user_id = $1::uuid`,
  parameters: ['550e8400-e29b-41d4-a716-446655440000']
}
```

### P: ¿Cómo monitoreo el performance de mis consultas?

**R:**
1. Usa las métricas incluidas (`executionTime`, `recordsProcessed`)
2. Implementa logging personalizado
3. Usa herramientas como pgAdmin o pg_stat_statements
4. Configura alertas basadas en tiempos de ejecución

```typescript
const monitoredExecution = async (input: PostgreSQLInput) => {
  const start = Date.now()
  const result = await node.execute(input)
  
  if (result.metrics?.executionTime > 5000) {
    console.warn(`Slow query detected: ${result.metrics.executionTime}ms`)
  }
  
  return result
}
```

## Logs y Debugging

### Habilitar Logging Detallado

```typescript
// En PostgreSQL (postgresql.conf)
log_statement = 'all'
log_duration = on
log_min_duration_statement = 1000

// En la aplicación
const debugConnection = `postgresql://user:pass@host:5432/db?logLevel=debug`
```

### Herramientas Útiles

1. **pgAdmin** - Interface gráfica para administración
2. **pg_stat_statements** - Estadísticas de queries
3. **pgBadger** - Análisis de logs
4. **EXPLAIN.depesz.com** - Análisis de planes de ejecución online

### Comandos de Diagnóstico

```sql
-- Ver configuración actual
SHOW ALL;

-- Ver estadísticas de tablas
SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del
FROM pg_stat_user_tables;

-- Ver índices no utilizados
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
ORDER BY tablename, attname;
```