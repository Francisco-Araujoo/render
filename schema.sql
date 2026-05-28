-- ============================================================
-- RENDER 7 — Schema completo do banco de dados (MySQL 8.0+)
-- Execute este script no seu banco antes do primeiro deploy.
-- ============================================================

CREATE DATABASE IF NOT EXISTS render7
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE render7;

-- ============================================================
-- TABELA: admins
-- Somente administradores (ex: Carlos).
-- Criados via POST /auth/setup-admin após o deploy.
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(255) NOT NULL,
    active        TINYINT(1) DEFAULT 1,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABELA: architects
-- Perfis de arquiteto. Criados somente pelo admin.
-- ============================================================
CREATE TABLE IF NOT EXISTS architects (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(255) NOT NULL,
    active        TINYINT(1) DEFAULT 1,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABELA: clients
-- Perfis de cliente. Criados pelo admin ou pelo arquiteto.
-- architect_id → arquiteto ao qual o cliente pertence (obrigatório).
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(255) NOT NULL,
    architect_id  INT NOT NULL,
    active        TINYINT(1) DEFAULT 1,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_clients_architect FOREIGN KEY (architect_id)
        REFERENCES architects(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_clients_architect ON clients(architect_id);

-- ============================================================
-- TABELA: projects
-- architect_id → arquiteto dono do projeto   (ref: architects)
-- client_id    → cliente que pode visualizar (ref: clients)
-- image_base64 → imagem de capa (base64) — LONGTEXT suporta até 4GB
-- pdf_base64   → documento PDF (base64)
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(255) NOT NULL,
    description  TEXT,
    category     VARCHAR(100) DEFAULT 'Residencial',
    location     VARCHAR(255),
    value        VARCHAR(50),
    status       VARCHAR(50) DEFAULT 'Em andamento',
    architect_id INT DEFAULT NULL,
    client_id    INT DEFAULT NULL,
    image_base64 LONGTEXT,
    pdf_base64   LONGTEXT,
    pdf_name     VARCHAR(255),
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_projects_architect FOREIGN KEY (architect_id)
        REFERENCES architects(id) ON DELETE SET NULL,
    CONSTRAINT fk_projects_client FOREIGN KEY (client_id)
        REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_projects_architect ON projects(architect_id);
CREATE INDEX idx_projects_client    ON projects(client_id);

-- ============================================================
-- SEED: Admin principal — Carlos (render7obras@gmail.com)
-- Após o deploy, chame UMA vez:
--   POST {API_BASE}/auth/setup-admin   body: {"password":"SuaSenha"}
-- ============================================================

-- updated_at é atualizado automaticamente pelo
-- ON UPDATE CURRENT_TIMESTAMP — nenhuma trigger necessária.
