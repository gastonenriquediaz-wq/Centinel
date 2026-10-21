-- Centinel - Migración inicial: Extensiones de PostgreSQL
-- Proyecto de Grado - Universidad Católica de Salta

-- Extensión para generación de identificadores únicos universales (UUID v4)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Extensión para funciones criptográficas y hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
