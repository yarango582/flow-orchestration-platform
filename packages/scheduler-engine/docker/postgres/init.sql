-- Initialize Flow Platform Database
-- This script runs when PostgreSQL container starts for the first time

-- Create additional databases if needed
-- CREATE DATABASE flow_platform_test;

-- Set up extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create indexes for better performance
-- These will be created by TypeORM migrations, but included here as reference

-- Example: Create function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE flow_platform TO flow_user;

-- Set timezone
SET timezone TO 'UTC';