# PostgreSQL Query Node - API Documentation

## Especificación de Interfaces

### Input Interface: `PostgreSQLInput`

```typescript
interface PostgreSQLInput {
  connectionString: string
  query: string
  parameters?: any[]
}
```

#### Campos de Entrada

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `connectionString` | `string` | ✅ | Cadena de conexión PostgreSQL (formato URI) |
| `query` | `string` | ✅ | Consulta SQL a ejecutar |
| `parameters` | `any[]` | ❌ | Array de parámetros para la consulta ($1, $2, etc.) |

#### Validaciones de Input

- **connectionString**: Debe ser una URI válida de PostgreSQL
- **query**: No puede estar vacío, debe ser una consulta SQL válida
- **parameters**: Si se proporciona, debe ser un array

### Output Interface: `PostgreSQLOutput`

```typescript
interface PostgreSQLOutput {
  result: any[]
  rowCount: number
}
```

#### Campos de Salida

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `result` | `any[]` | Array con los registros retornados por la consulta |
| `rowCount` | `number` | Número total de registros procesados |

### Configuration Interface: `PostgreSQLConfig`

```typescript
interface PostgreSQLConfig {
  timeout?: number
  poolSize?: number
}
```

#### Opciones de Configuración

| Campo | Tipo | Por Defecto | Descripción |
|-------|------|-------------|-------------|
| `timeout` | `number` | `30000` | Timeout en milisegundos para las consultas |
| `poolSize` | `number` | `10` | Tamaño máximo del pool de conexiones |

## Especificación del Resultado

### NodeResult Structure

```typescript
interface NodeResult<PostgreSQLOutput> {
  success: boolean
  data?: PostgreSQLOutput
  error?: string
  metrics?: {
    executionTime: number
    recordsProcessed: number
  }
}
```

### Resultado Exitoso

```typescript
{
  success: true,
  data: {
    result: [
      { id: 1, name: "Usuario 1", email: "user1@example.com" },
      { id: 2, name: "Usuario 2", email: "user2@example.com" }
    ],
    rowCount: 2
  },
  metrics: {
    executionTime: 150,
    recordsProcessed: 2
  }
}
```

### Resultado con Error

```typescript
{
  success: false,
  error: "Connection failed: connection refused"
}
```

## Formatos de Connection String

### Formato Básico
```
postgresql://username:password@hostname:port/database
```

### Con SSL
```
postgresql://username:password@hostname:port/database?sslmode=require
```

### Con Parámetros Adicionales
```
postgresql://user:pass@host:5432/db?sslmode=require&connect_timeout=10&application_name=flow-platform
```

### Opciones de SSL Mode
- `disable` - Sin SSL
- `allow` - SSL si está disponible
- `prefer` - SSL preferido (por defecto)
- `require` - SSL obligatorio
- `verify-ca` - SSL con verificación de CA
- `verify-full` - SSL con verificación completa

## Parámetros de Consulta

### Sintaxis de Parámetros
```sql
-- Correcto - usar $1, $2, $3, etc.
SELECT * FROM users WHERE age > $1 AND city = $2

-- Incorrecto - no usar concatenación directa
SELECT * FROM users WHERE age > ' + age + ' AND city = ' + city + '
```

### Tipos de Parámetros Soportados
- `string` - Texto y varchar
- `number` - Integer, decimal, numeric
- `boolean` - Boolean values
- `Date` - Timestamps y dates
- `Buffer` - Datos binarios (bytea)
- `null` - Valores NULL

### Ejemplo con Múltiples Parámetros
```typescript
{
  query: `
    SELECT u.id, u.name, u.email, p.title
    FROM users u
    JOIN posts p ON u.id = p.user_id
    WHERE u.created_at >= $1 
    AND u.active = $2 
    AND p.category = $3
    ORDER BY u.created_at DESC
    LIMIT $4
  `,
  parameters: [
    new Date('2024-01-01'),
    true,
    'technology',
    50
  ]
}
```

## Códigos de Error

### Errores de Conexión

| Código | Descripción | Causa Común |
|--------|-------------|-------------|
| `ECONNREFUSED` | Conexión rechazada | PostgreSQL no está ejecutándose |
| `ENOTFOUND` | Host no encontrado | Hostname incorrecto |
| `ECONNRESET` | Conexión reiniciada | Problemas de red |
| `ETIMEDOUT` | Timeout de conexión | Red lenta o firewall |

### Errores de Autenticación

| Código | Descripción | Solución |
|--------|-------------|----------|
| `28P01` | Contraseña incorrecta | Verificar credenciales |
| `28000` | Acceso denegado | Verificar permisos de usuario |
| `3D000` | Base de datos no existe | Crear la base de datos |

### Errores de SQL

| Código | Descripción | Causa |
|--------|-------------|-------|
| `42601` | Error de sintaxis SQL | Query mal formada |
| `42703` | Columna no existe | Nombre de columna incorrecto |
| `42P01` | Tabla no existe | Tabla no creada o nombre incorrecto |
| `23505` | Violación de constraint único | Intento de insertar duplicado |

## Validación de Entrada

### Método `validate(input: PostgreSQLInput): boolean`

El método de validación verifica:

1. **Input no nulo**: `input !== null && input !== undefined`
2. **Connection string**: `!!input.connectionString`
3. **Query**: `!!input.query`
4. **Parameters** (opcional): Si existe, debe ser array

### Validación Personalizada

```typescript
// Validación adicional en el código del cliente
function validatePostgreSQLInput(input: PostgreSQLInput): string[] {
  const errors: string[] = []
  
  if (!input.connectionString.startsWith('postgresql://')) {
    errors.push('Connection string must start with postgresql://')
  }
  
  if (input.query.trim().length === 0) {
    errors.push('Query cannot be empty')
  }
  
  if (input.parameters && !Array.isArray(input.parameters)) {
    errors.push('Parameters must be an array')
  }
  
  return errors
}
```

## Límites y Restricciones

### Límites de Datos
- **Tamaño máximo de resultado**: 100MB por defecto
- **Número máximo de parámetros**: 65535 (límite de PostgreSQL)
- **Timeout por defecto**: 30 segundos
- **Pool size por defecto**: 10 conexiones

### Restricciones de SQL
- **Solo consultas de lectura** en modo seguro
- **Transacciones**: Cada ejecución es una transacción independiente
- **Procedimientos almacenados**: Soporte limitado
- **Cursors**: No soportados en esta versión

## Configuración Avanzada

### Pool de Conexiones Personalizado

```typescript
const config: PostgreSQLConfig = {
  timeout: 60000,        // 60 segundos
  poolSize: 20,          // 20 conexiones máximo
}

const node = new PostgreSQLQueryNode(config)
```

### Configuración de Producción

```typescript
const productionConfig: PostgreSQLConfig = {
  timeout: 30000,
  poolSize: 50,
}
```

## Ejemplos de Uso por Tipo de Operación

### SELECT
```typescript
{
  query: "SELECT id, name, email FROM users WHERE active = $1",
  parameters: [true]
}
```

### INSERT
```typescript
{
  query: "INSERT INTO users (name, email, active) VALUES ($1, $2, $3) RETURNING id",
  parameters: ["Juan Pérez", "juan@example.com", true]
}
```

### UPDATE
```typescript
{
  query: "UPDATE users SET last_login = $1 WHERE id = $2",
  parameters: [new Date(), 123]
}
```

### DELETE
```typescript
{
  query: "DELETE FROM users WHERE inactive_since < $1",
  parameters: [new Date('2023-01-01')]
}
```

## Métricas y Monitoreo

### Métricas Incluidas
- `executionTime`: Tiempo total de ejecución en milisegundos
- `recordsProcessed`: Número de registros procesados/retornados

### Ejemplo de Métricas
```typescript
{
  metrics: {
    executionTime: 245,      // 245ms
    recordsProcessed: 1500   // 1500 registros
  }
}
```

## Compatibilidad

### Versiones de PostgreSQL Soportadas
- PostgreSQL 12.x ✅
- PostgreSQL 13.x ✅
- PostgreSQL 14.x ✅
- PostgreSQL 15.x ✅
- PostgreSQL 16.x ✅

### Versiones de Node.js
- Node.js 16.x ✅
- Node.js 18.x ✅
- Node.js 20.x ✅