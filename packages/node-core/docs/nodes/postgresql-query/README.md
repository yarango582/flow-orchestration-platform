# PostgreSQL Query Node

## Descripción General

El nodo **PostgreSQL Query Node** permite ejecutar consultas SQL contra bases de datos PostgreSQL dentro de los flujos de trabajo. Este nodo es fundamental para operaciones de lectura de datos desde sistemas de bases de datos relacionales, proporcionando una interfaz robusta y confiable para la integración con PostgreSQL.

## Propósito Principal

- Ejecutar consultas SELECT, INSERT, UPDATE y DELETE en PostgreSQL
- Manejar parámetros de consulta de forma segura (prevención de SQL injection)
- Gestionar conexiones con pool de conexiones configurables
- Proporcionar métricas de rendimiento y tiempo de ejecución
- Soportar transacciones y procedimientos almacenados

## Casos de Uso Principales

### 1. **Extracción de Datos**
Obtener datos de tablas PostgreSQL para procesamiento posterior en el flujo.

### 2. **Reportes Dinámicos**
Generar reportes basados en consultas parametrizadas según condiciones del flujo.

### 3. **Validación de Datos**
Verificar la existencia o validez de datos contra el esquema de la base de datos.

### 4. **Operaciones CRUD**
Realizar operaciones completas de creación, lectura, actualización y eliminación.

### 5. **Integración de Sistemas**
Sincronizar datos entre diferentes sistemas utilizando PostgreSQL como fuente de verdad.

## Diagrama de Conectividad

```mermaid
graph LR
    A[Trigger Node] --> B[PostgreSQL Query Node]
    C[Data Source] --> B
    B --> D[Data Filter Node]
    B --> E[Field Mapper Node]
    B --> F[Output Node]
    
    subgraph "PostgreSQL Database"
        G[Tables]
        H[Views]
        I[Stored Procedures]
    end
    
    B -.-> G
    B -.-> H
    B -.-> I
```

## Quick Start Guide

### Instalación de Dependencias
```bash
npm install pg @types/pg
```

### Configuración Básica
```typescript
import { PostgreSQLQueryNode } from '@flow-platform/node-core'

const node = new PostgreSQLQueryNode({
  timeout: 30000,
  poolSize: 10
})
```

### Ejemplo Básico de Uso
```typescript
const input = {
  connectionString: "postgresql://user:password@localhost:5432/database",
  query: "SELECT * FROM users WHERE active = $1",
  parameters: [true]
}

const result = await node.execute(input)
console.log(result.data.result) // Array de registros
```

## Requisitos y Dependencias

### Requisitos del Sistema
- Node.js >= 16.0.0
- PostgreSQL >= 12.0
- Memoria RAM: Mínimo 256MB por instancia

### Dependencias NPM
```json
{
  "pg": "^8.11.5",
  "@types/pg": "^8.11.5"
}
```

### Variables de Entorno Recomendadas
```bash
# Pool de conexiones
POSTGRES_POOL_SIZE=10
POSTGRES_TIMEOUT=30000

# Configuración de conexión
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=mydb
POSTGRES_USER=myuser
POSTGRES_PASSWORD=mypassword
```

## Configuración de Seguridad

### Mejores Prácticas
1. **Usar SSL/TLS** para conexiones en producción
2. **Parámetros seguros** - Siempre usar parámetros ($1, $2) en lugar de concatenación
3. **Credenciales** - Almacenar credenciales en variables de entorno o servicios de secretos
4. **Permisos mínimos** - Usar usuarios de base de datos con permisos limitados
5. **Timeout apropiado** - Configurar timeouts para evitar consultas colgadas

### Ejemplo de Conexión Segura
```typescript
const connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}?sslmode=require`
```

## Características Avanzadas

### Pool de Conexiones
- Gestión automática de conexiones
- Configuración de tamaños mínimo y máximo
- Reutilización eficiente de conexiones

### Manejo de Errores
- Reintentos automáticos en fallos de conexión
- Mensajes de error descriptivos
- Logging detallado para debugging

### Métricas de Rendimiento
- Tiempo de ejecución de consultas
- Número de registros procesados
- Estadísticas de uso del pool de conexiones

## Limitaciones Conocidas

1. **Transacciones** - Cada ejecución es independiente (sin transacciones entre nodos)
2. **Procedimientos almacenados** - Soporte limitado para procedimientos complejos
3. **Tipos de datos** - Algunos tipos PostgreSQL específicos requieren manejo especial
4. **Concurrencia** - Limitada por el tamaño del pool de conexiones configurado

## Versioning

- **Versión actual**: 1.0.0
- **Compatibilidad**: PostgreSQL 12+
- **Estado**: Estable (Production Ready)

## Soporte y Recursos

- [Documentación de API](./API.md)
- [Ejemplos Prácticos](./EXAMPLES.md)
- [Guía de Troubleshooting](./TROUBLESHOOTING.md)
- [Guía de Performance](../../../performance-benchmarks.md)

## Changelog

### v1.0.0
- Implementación inicial del nodo
- Soporte para consultas básicas con parámetros
- Pool de conexiones configurable
- Métricas de rendimiento integradas