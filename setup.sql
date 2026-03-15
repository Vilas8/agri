-- AgriPredict – MySQL local setup
-- Run this ONCE before starting the backend:
--   mysql -u root -p < setup.sql

CREATE DATABASE IF NOT EXISTS agri_predict CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Verify
SHOW DATABASES LIKE 'agri_predict';
