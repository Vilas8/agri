"""
AgriPredict Backend Configuration
– MySQL only (no Supabase, no SQLite fallback)
– All secrets loaded from .env (copy backend/.env.example → backend/.env)
"""
import os
from dotenv import load_dotenv

# Load .env from the backend/ folder (works whether you run from project root or backend/)
_backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
load_dotenv(os.path.join(_backend_dir, '.env'))

class Config:
    # ── Flask ────────────────────────────────────────────────────────────────
    SECRET_KEY = os.environ.get('SECRET_KEY', 'agripredict-secret-key-2026')
    DEBUG      = os.environ.get('DEBUG', 'True').lower() == 'true'

    # ── MySQL ────────────────────────────────────────────────────────────────
    MYSQL_HOST     = os.environ.get('MYSQL_HOST',     'localhost')
    MYSQL_PORT     = int(os.environ.get('MYSQL_PORT', 3306))
    MYSQL_USER     = os.environ.get('MYSQL_USER',     'root')
    MYSQL_PASSWORD = os.environ.get('MYSQL_PASSWORD', '')
    MYSQL_DATABASE = os.environ.get('MYSQL_DATABASE', 'agri_predict')
    MYSQL_AVAILABLE = True   # we only support MySQL now

    SQLALCHEMY_DATABASE_URI = (
        os.environ.get('DATABASE_URL') or
        f'mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE}'
    )

    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 3600,
    }

    # ── CORS ────────────────────────────────────────────────────────────────
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*')

    # ── Admin ───────────────────────────────────────────────────────────────
    ADMIN_EMAIL    = os.environ.get('ADMIN_EMAIL',    'admin@gmail.com')
    ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')
    ADMIN_SECRET   = os.environ.get('ADMIN_SECRET',   'AGRI2026')

    # ── JWT ─────────────────────────────────────────────────────────────────
    JWT_EXPIRATION_HOURS = 24

    # ── Pagination ──────────────────────────────────────────────────────────
    DEFAULT_PAGE_SIZE = 50
    MAX_PAGE_SIZE     = 500
