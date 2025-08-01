# PostgreSQL Query Node - Ejemplos Prácticos

## Índice de Ejemplos

1. [Consulta Simple de Usuarios](#1-consulta-simple-de-usuarios)
2. [Consulta con Parámetros y Filtros](#2-consulta-con-parámetros-y-filtros)
3. [JOIN Complejo con Múltiples Tablas](#3-join-complejo-con-múltiples-tablas)
4. [Inserción de Datos con RETURNING](#4-inserción-de-datos-con-returning)
5. [Actualización Masiva con Condiciones](#5-actualización-masiva-con-condiciones)
6. [Consulta de Agregación y Reportes](#6-consulta-de-agregación-y-reportes)
7. [Procedimiento Almacenado](#7-procedimiento-almacenado)

---

## 1. Consulta Simple de Usuarios

### Descripción
Obtener todos los usuarios activos de la base de datos para posterior procesamiento.

### Configuración del Nodo
```typescript
const node = new PostgreSQLQueryNode({
  timeout: 30000,
  poolSize: 10
})
```

### Input de Ejemplo
```typescript
const input: PostgreSQLInput = {
  connectionString: "postgresql://app_user:secure_password@localhost:5432/company_db",
  query: "SELECT id, name, email, created_at FROM users WHERE active = $1 ORDER BY created_at DESC",
  parameters: [true]
}
```

### Salida Esperada
```typescript
{
  success: true,
  data: {
    result: [
      {
        id: 105,
        name: "María García",
        email: "maria.garcia@company.com",
        created_at: "2024-01-15T10:30:00.000Z"
      },
      {
        id: 104,
        name: "Carlos López",
        email: "carlos.lopez@company.com",
        created_at: "2024-01-14T16:45:00.000Z"
      },
      {
        id: 103,
        name: "Ana Martínez",
        email: "ana.martinez@company.com",
        created_at: "2024-01-14T09:20:00.000Z"
      }
    ],
    rowCount: 3
  },
  metrics: {
    executionTime: 125,
    recordsProcessed: 3
  }
}
```

### Explicación del Procesamiento
1. El nodo establece conexión con PostgreSQL usando la cadena de conexión
2. Ejecuta la consulta SELECT con el parámetro `active = true`
3. Retorna los usuarios ordenados por fecha de creación descendente
4. Proporciona métricas de tiempo de ejecución y registros procesados

### Casos de Uso
- Dashboard de usuarios activos
- Export de datos de usuarios
- Validación de integridad de datos

---

## 2. Consulta con Parámetros y Filtros

### Descripción
Buscar usuarios por múltiples criterios con paginación y filtros de fecha.

### Input de Ejemplo
```typescript
const input: PostgreSQLInput = {
  connectionString: "postgresql://app_user:secure_password@localhost:5432/company_db",
  query: `
    SELECT 
      u.id, 
      u.name, 
      u.email, 
      u.department,
      u.last_login
    FROM users u
    WHERE u.active = $1 
      AND u.created_at >= $2 
      AND u.department = $3
      AND u.last_login IS NOT NULL
    ORDER BY u.last_login DESC
    LIMIT $4 OFFSET $5
  `,
  parameters: [
    true,                           // $1: active
    new Date('2024-01-01'),        // $2: created_at desde
    'Engineering',                  // $3: department
    25,                            // $4: limit
    0                              // $5: offset
  ]
}
```

### Salida Esperada
```typescript
{
  success: true,
  data: {
    result: [
      {
        id: 201,
        name: "Pedro Rodríguez",
        email: "pedro.rodriguez@company.com",
        department: "Engineering",
        last_login: "2024-01-30T14:22:00.000Z"
      },
      {
        id: 198,
        name: "Laura Fernández",
        email: "laura.fernandez@company.com",
        department: "Engineering",
        last_login: "2024-01-30T11:15:00.000Z"
      }
    ],
    rowCount: 2
  },
  metrics: {
    executionTime: 89,
    recordsProcessed: 2
  }
}
```

### Variaciones Comunes
```typescript
// Búsqueda por texto parcial
const searchByName = {
  query: "SELECT * FROM users WHERE name ILIKE $1 AND active = $2",
  parameters: ['%García%', true]
}

// Rango de fechas
const dateRange = {
  query: `
    SELECT * FROM users 
    WHERE created_at BETWEEN $1 AND $2 
    ORDER BY created_at
  `,
  parameters: [
    new Date('2024-01-01'),
    new Date('2024-01-31')
  ]
}
```

---

## 3. JOIN Complejo con Múltiples Tablas

### Descripción
Obtener información completa de usuarios incluyendo sus proyectos y roles.

### Input de Ejemplo
```typescript
const input: PostgreSQLInput = {
  connectionString: "postgresql://app_user:secure_password@localhost:5432/company_db",
  query: `
    SELECT 
      u.id as user_id,
      u.name as user_name,
      u.email,
      d.name as department_name,
      p.name as project_name,
      p.status as project_status,
      r.name as role_name,
      ur.assigned_at
    FROM users u
    INNER JOIN departments d ON u.department_id = d.id
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.id
    LEFT JOIN project_members pm ON u.id = pm.user_id
    LEFT JOIN projects p ON pm.project_id = p.id
    WHERE u.active = $1
      AND d.active = $2
      AND (p.status IS NULL OR p.status IN ($3, $4))
    ORDER BY u.name, p.name
  `,
  parameters: [
    true,        // $1: user active
    true,        // $2: department active
    'active',    // $3: project status
    'planning'   // $4: project status
  ]
}
```

### Salida Esperada
```typescript
{
  success: true,
  data: {
    result: [
      {
        user_id: 301,
        user_name: "Ana Martínez",
        email: "ana.martinez@company.com",
        department_name: "Engineering",
        project_name: "Mobile App Redesign",
        project_status: "active",
        role_name: "Senior Developer",
        assigned_at: "2024-01-10T00:00:00.000Z"
      },
      {
        user_id: 301,
        user_name: "Ana Martínez",
        email: "ana.martinez@company.com",
        department_name: "Engineering",
        project_name: "API Migration",
        project_status: "planning",
        role_name: "Senior Developer",
        assigned_at: "2024-01-10T00:00:00.000Z"
      }
    ],
    rowCount: 2
  },
  metrics: {
    executionTime: 456,
    recordsProcessed: 2
  }
}
```

### Optimizaciones de Performance
```typescript
// Con índices específicos
const optimizedQuery = {
  query: `
    SELECT /*+ USE_INDEX(users, idx_users_active_dept) */
    u.id, u.name, d.name as dept_name
    FROM users u
    INNER JOIN departments d ON u.department_id = d.id
    WHERE u.active = $1 AND u.department_id = $2
  `,
  parameters: [true, 5]
}
```

---

## 4. Inserción de Datos con RETURNING

### Descripción
Crear un nuevo usuario y obtener el ID generado junto con información adicional.

### Input de Ejemplo
```typescript
const input: PostgreSQLInput = {
  connectionString: "postgresql://app_user:secure_password@localhost:5432/company_db",
  query: `
    INSERT INTO users (
      name, 
      email, 
      department_id, 
      active, 
      created_at,
      employee_number
    ) VALUES (
      $1, $2, $3, $4, $5, 
      (SELECT COALESCE(MAX(employee_number), 0) + 1 FROM users)
    )
    RETURNING 
      id, 
      name, 
      email, 
      employee_number,
      created_at
  `,
  parameters: [
    "Roberto Silva",
    "roberto.silva@company.com",
    3,                              // department_id
    true,
    new Date()
  ]
}
```

### Salida Esperada
```typescript
{
  success: true,
  data: {
    result: [
      {
        id: 402,
        name: "Roberto Silva",
        email: "roberto.silva@company.com",
        employee_number: 1205,
        created_at: "2024-01-31T10:15:30.123Z"
      }
    ],
    rowCount: 1
  },
  metrics: {
    executionTime: 67,
    recordsProcessed: 1
  }
}
```

### Inserción Múltiple (Batch Insert)
```typescript
const batchInsert = {
  query: `
    INSERT INTO users (name, email, department_id, active)
    VALUES 
      ($1, $2, $3, $4),
      ($5, $6, $7, $8),
      ($9, $10, $11, $12)
    RETURNING id, name, email
  `,
  parameters: [
    "Usuario 1", "user1@company.com", 1, true,
    "Usuario 2", "user2@company.com", 2, true,
    "Usuario 3", "user3@company.com", 1, true
  ]
}
```

---

## 5. Actualización Masiva con Condiciones

### Descripción
Actualizar el estado de múltiples usuarios basado en criterios específicos.

### Input de Ejemplo
```typescript
const input: PostgreSQLInput = {
  connectionString: "postgresql://app_user:secure_password@localhost:5432/company_db",
  query: `
    UPDATE users 
    SET 
      active = $1,
      updated_at = $2,
      deactivation_reason = $3
    WHERE last_login < $4 
      AND active = $5
      AND id NOT IN (
        SELECT DISTINCT user_id 
        FROM project_members 
        WHERE project_id IN (
          SELECT id FROM projects WHERE status = 'active'
        )
      )
    RETURNING id, name, email, last_login
  `,
  parameters: [
    false,                          // $1: set active = false
    new Date(),                     // $2: updated_at
    'Inactive due to long absence', // $3: deactivation_reason
    new Date('2023-06-01'),        // $4: last_login threshold
    true                           // $5: current active status
  ]
}
```

### Salida Esperada
```typescript
{
  success: true,
  data: {
    result: [
      {
        id: 501,
        name: "Usuario Inactivo 1",
        email: "inactive1@company.com",
        last_login: "2023-03-15T08:30:00.000Z"
      },
      {
        id: 502,
        name: "Usuario Inactivo 2", 
        email: "inactive2@company.com",
        last_login: "2023-05-20T14:22:00.000Z"
      }
    ],
    rowCount: 2
  },
  metrics: {
    executionTime: 234,
    recordsProcessed: 2
  }
}
```

### Update con JOIN
```typescript
const updateWithJoin = {
  query: `
    UPDATE users 
    SET salary = salary * $1
    FROM departments d
    WHERE users.department_id = d.id 
      AND d.budget_increase = $2
    RETURNING users.id, users.name, users.salary
  `,
  parameters: [1.1, true]  // 10% salary increase
}
```

---

## 6. Consulta de Agregación y Reportes

### Descripción
Generar reporte estadístico de usuarios por departamento y estado.

### Input de Ejemplo
```typescript
const input: PostgreSQLInput = {
  connectionString: "postgresql://app_user:secure_password@localhost:5432/company_db",
  query: `
    SELECT 
      d.name as department_name,
      COUNT(*) as total_users,
      COUNT(CASE WHEN u.active = true THEN 1 END) as active_users,
      COUNT(CASE WHEN u.active = false THEN 1 END) as inactive_users,
      AVG(EXTRACT(days FROM (CURRENT_DATE - u.created_at))) as avg_days_since_creation,
      MAX(u.last_login) as most_recent_login,
      MIN(u.last_login) as oldest_login
    FROM departments d
    LEFT JOIN users u ON d.id = u.department_id
    WHERE d.active = $1
      AND u.created_at >= $2
    GROUP BY d.id, d.name
    HAVING COUNT(*) > $3
    ORDER BY total_users DESC, department_name
  `,
  parameters: [
    true,                          // $1: department active
    new Date('2023-01-01'),       // $2: created_at threshold  
    5                             // $3: minimum users per department
  ]
}
```

### Salida Esperada
```typescript
{
  success: true,
  data: {
    result: [
      {
        department_name: "Engineering",
        total_users: 25,
        active_users: 23,
        inactive_users: 2,
        avg_days_since_creation: 145.5,
        most_recent_login: "2024-01-31T16:45:00.000Z",
        oldest_login: "2024-01-05T09:15:00.000Z"
      },
      {
        department_name: "Sales",
        total_users: 18,
        active_users: 16,
        inactive_users: 2,
        avg_days_since_creation: 167.2,
        most_recent_login: "2024-01-31T14:30:00.000Z",
        oldest_login: "2024-01-08T11:20:00.000Z"
      }
    ],
    rowCount: 2
  },
  metrics: {
    executionTime: 189,
    recordsProcessed: 2
  }
}
```

### Reporte con Ventanas (Window Functions)
```typescript
const windowFunction = {
  query: `
    SELECT 
      u.name,
      u.salary,
      d.name as department,
      AVG(u.salary) OVER (PARTITION BY u.department_id) as dept_avg_salary,
      RANK() OVER (PARTITION BY u.department_id ORDER BY u.salary DESC) as salary_rank
    FROM users u
    JOIN departments d ON u.department_id = d.id
    WHERE u.active = $1
    ORDER BY d.name, salary_rank
  `,
  parameters: [true]
}
```

---

## 7. Procedimiento Almacenado

### Descripción
Ejecutar un procedimiento almacenado para procesamiento complejo de datos.

### Input de Ejemplo
```typescript
const input: PostgreSQLInput = {
  connectionString: "postgresql://app_user:secure_password@localhost:5432/company_db",
  query: `
    SELECT * FROM process_user_statistics($1, $2, $3)
  `,
  parameters: [
    new Date('2024-01-01'),       // start_date
    new Date('2024-01-31'),       // end_date
    'Engineering'                 // department_filter
  ]
}
```

### Definición del Procedimiento (para referencia)
```sql
CREATE OR REPLACE FUNCTION process_user_statistics(
  start_date DATE,
  end_date DATE,
  dept_filter VARCHAR
)
RETURNS TABLE (
  department_name VARCHAR,
  user_count INTEGER,
  active_projects INTEGER,
  total_hours NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.name::VARCHAR,
    COUNT(DISTINCT u.id)::INTEGER,
    COUNT(DISTINCT p.id)::INTEGER,
    COALESCE(SUM(th.hours), 0)::NUMERIC
  FROM departments d
  JOIN users u ON d.id = u.department_id
  LEFT JOIN project_members pm ON u.id = pm.user_id
  LEFT JOIN projects p ON pm.project_id = p.id
  LEFT JOIN time_entries th ON u.id = th.user_id 
    AND th.date BETWEEN start_date AND end_date
  WHERE d.name = dept_filter
    AND u.active = true
  GROUP BY d.id, d.name;
END;
$$ LANGUAGE plpgsql;
```

### Salida Esperada
```typescript
{
  success: true,
  data: {
    result: [
      {
        department_name: "Engineering",
        user_count: 23,
        active_projects: 8,
        total_hours: 3654.5
      }
    ],
    rowCount: 1
  },
  metrics: {
    executionTime: 1247,
    recordsProcessed: 1
  }
}
```

## Patrones de Integración con Otros Nodos

### PostgreSQL → Data Filter → Field Mapper
```typescript
// 1. PostgreSQL Query Node extrae datos
const postgresInput = {
  query: "SELECT id, name, email, department_id, salary FROM users WHERE active = $1",
  parameters: [true]
}

// 2. Data Filter Node filtra por salario
const filterInput = {
  data: postgresResult.data.result,
  conditions: [
    { field: 'salary', operator: 'greater_than', value: 50000 }
  ]
}

// 3. Field Mapper Node transforma la estructura
const mapperInput = {
  source: filteredResult.data.filtered,
  mapping: [
    { sourceField: 'name', targetField: 'full_name', transformation: 'rename' },
    { sourceField: 'email', targetField: 'email_address', transformation: 'rename' },
    { sourceField: 'salary', targetField: 'salary_formatted', transformation: 'function', transformValue: 'currency' }
  ]
}
```

## Tips de Optimización

### 1. Uso de Índices
```sql
-- Crear índices para consultas frecuentes
CREATE INDEX idx_users_active_dept ON users(active, department_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
```

### 2. EXPLAIN para Análisis
```typescript
const explainQuery = {
  query: "EXPLAIN ANALYZE SELECT * FROM users WHERE active = $1",
  parameters: [true]
}
```

### 3. Límites de Memoria
```typescript
// Para consultas que retornan muchos registros
const largeQuery = {
  query: "SELECT * FROM large_table WHERE date >= $1 LIMIT $2",
  parameters: [new Date('2024-01-01'), 1000]
}
```