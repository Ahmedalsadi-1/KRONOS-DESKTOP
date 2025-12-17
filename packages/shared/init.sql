-- Kronos Unified Infrastructure Database Schema
-- This script initializes the shared database schema for all services

-- Create custom types
CREATE TYPE task_status AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED');
CREATE TYPE priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- Users table (Authentication & Authorization)
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    "firstName" VARCHAR(255),
    "lastName" VARCHAR(255),
    "passwordHash" VARCHAR(255) NOT NULL,
    roles TEXT[] DEFAULT '{}',
    permissions TEXT[] DEFAULT '{}',
    "isActive" BOOLEAN DEFAULT true,
    "lastLoginAt" TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP
);

-- Sessions table (JWT session management)
CREATE TABLE sessions (
    id VARCHAR(255) PRIMARY KEY,
    "userId" VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) UNIQUE NOT NULL,
    "expiresAt" TIMESTAMP NOT NULL,
    "isRevoked" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Service registry tables
CREATE TABLE services (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    version VARCHAR(50) NOT NULL,
    description TEXT,
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    protocol VARCHAR(10) DEFAULT 'http',
    status VARCHAR(20) DEFAULT 'unknown',
    metadata JSONB DEFAULT '{}',
    "registeredAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "lastHeartbeat" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE service_endpoints (
    id VARCHAR(255) PRIMARY KEY,
    "serviceId" VARCHAR(255) NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    path VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL,
    description TEXT,
    "requiresAuth" BOOLEAN DEFAULT true,
    "rateLimit" INTEGER,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("serviceId", path, method)
);

-- Tasks table (Task management)
CREATE TABLE tasks (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status task_status DEFAULT 'PENDING',
    priority priority DEFAULT 'MEDIUM',
    "userId" VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "assignedTo" VARCHAR(255) REFERENCES users(id),
    "dueDate" TIMESTAMP,
    "completedAt" TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Computer actions table (Computer control)
CREATE TABLE computer_actions (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    payload JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending',
    "userId" VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "sessionId" VARCHAR(255),
    "executedAt" TIMESTAMP,
    result JSONB,
    error TEXT,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- File uploads table (File storage tracking)
CREATE TABLE file_uploads (
    id VARCHAR(255) PRIMARY KEY,
    filename VARCHAR(500) NOT NULL,
    "originalName" VARCHAR(500) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    size BIGINT NOT NULL,
    path VARCHAR(1000) NOT NULL,
    url VARCHAR(1000) NOT NULL,
    "uploadedBy" VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metadata JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_sessions_user_id ON sessions("userId");
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires_at ON sessions("expiresAt");
CREATE INDEX idx_services_name ON services(name);
CREATE INDEX idx_services_status ON services(status);
CREATE INDEX idx_service_endpoints_service_id ON service_endpoints("serviceId");
CREATE INDEX idx_tasks_user_id ON tasks("userId");
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_computer_actions_user_id ON computer_actions("userId");
CREATE INDEX idx_computer_actions_status ON computer_actions(status);
CREATE INDEX idx_file_uploads_uploaded_by ON file_uploads("uploadedBy");

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_service_endpoints_updated_at BEFORE UPDATE ON service_endpoints FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_computer_actions_updated_at BEFORE UPDATE ON computer_actions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_file_uploads_updated_at BEFORE UPDATE ON file_uploads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: admin123 - change in production!)
INSERT INTO users (id, email, username, "firstName", "lastName", "passwordHash", roles, permissions, "isActive")
VALUES (
    'admin-user-id',
    'admin@kronos.local',
    'admin',
    'System',
    'Administrator',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfLkYykgMNhxRK', -- bcrypt hash for 'admin123'
    ARRAY['admin'],
    ARRAY['user:read', 'user:write', 'user:delete', 'task:read', 'task:write', 'task:delete', 'computer:read', 'computer:control', 'admin:users', 'admin:system', 'service:read', 'service:write'],
    true
);

-- Insert sample service registry entry
INSERT INTO services (id, name, version, description, host, port, protocol, status, metadata)
VALUES (
    'infrastructure-service',
    'infrastructure',
    '1.0.0',
    'Unified infrastructure services',
    'localhost',
    3000,
    'http',
    'healthy',
    '{"type": "infrastructure", "features": ["auth", "cache", "registry", "storage"]}'
);

-- Insert sample endpoints
INSERT INTO service_endpoints ("serviceId", path, method, description, "requiresAuth", "rateLimit")
VALUES
    ('infrastructure-service', '/api/v1/auth/login', 'POST', 'User login', false, 10),
    ('infrastructure-service', '/api/v1/auth/register', 'POST', 'User registration', false, 5),
    ('infrastructure-service', '/api/v1/auth/refresh', 'POST', 'Refresh access token', true, 20),
    ('infrastructure-service', '/api/v1/users', 'GET', 'List users', true, 100),
    ('infrastructure-service', '/api/v1/tasks', 'GET', 'List tasks', true, 200),
    ('infrastructure-service', '/api/v1/services', 'GET', 'List registered services', true, 50),
    ('infrastructure-service', '/api/v1/files/upload', 'POST', 'Upload file', true, 20);

-- Grant permissions (adjust as needed for your PostgreSQL user)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO kronos_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO kronos_user;