import { registerAs } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';

export default registerAs('database', () => ({
  type: 'postgres' as const,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'flow_user',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'flow_platform',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
}));

// Para TypeORM CLI - usando las variables de entorno directamente
const config = {
  type: 'postgres' as const,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'flow_user',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'flow_platform',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

export const connectionSource = new DataSource(config as DataSourceOptions);
