"""
AgriPredict Backend Configuration
"""
import os
import sys

class Config:
    # Flask settings
    SECRET_KEY = os.environ.get('SECRET_KEY', 'agripredict-secret-key-2026')
    DEBUG = os.environ.get('DEBUG', 'True').lower() == 'true'
    
    # Check if MySQL is available
    MYSQL_AVAILABLE = False
    
    # Try to connect to MySQL first, fall back to SQLite
    try:
        import pymysql
        MYSQL_HOST = os.environ.get('MYSQL_HOST', 'localhost')
        MYSQL_PORT = int(os.environ.get('MYSQL_PORT', 3306))
        MYSQL_USER = os.environ.get('MYSQL_USER', 'root')
        MYSQL_PASSWORD = os.environ.get('MYSQL_PASSWORD', 'pallavigowda542004')
        MYSQL_DATABASE = os.environ.get('MYSQL_DATABASE', 'agri_predict')
        
        # Test MySQL connection
        try:
            test_conn = pymysql.connect(
                host=MYSQL_HOST,
                port=MYSQL_PORT,
                user=MYSQL_USER,
                password=MYSQL_PASSWORD,
                connect_timeout=5
            )
            test_conn.close()
            MYSQL_AVAILABLE = True
            print("MySQL connection successful!")
        except Exception as e:
            print(f"MySQL connection failed: {e}")
            print("Falling back to SQLite...")
            MYSQL_AVAILABLE = False
    except ImportError:
        print("PyMySQL not installed. Falling back to SQLite...")
        MYSQL_AVAILABLE = False
    
    # Database settings - Use SQLite as fallback
    if MYSQL_AVAILABLE:
        SQLALCHEMY_DATABASE_URI = os.environ.get(
            'DATABASE_URL', 
            f'mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE}'
        )
    else:
        # Use SQLite database - instance folder is in the project root (parent of config)
        basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
        instance_dir = os.path.join(basedir, 'instance')
        if not os.path.exists(instance_dir):
            os.makedirs(instance_dir)
        SQLALCHEMY_DATABASE_URI = os.environ.get(
            'DATABASE_URL',
            f'sqlite:///{os.path.join(instance_dir, "agripredict.db")}'
        )
        print(f"Using SQLite database: {SQLALCHEMY_DATABASE_URI}")
    
    # SQLAlchemy engine options
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 3600,
    }
    
    # CORS settings
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*')
    
    # Admin credentials
    ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@gmail.com')
    ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')
    ADMIN_SECRET = os.environ.get('ADMIN_SECRET', 'AGRI2026')
    
    # JWT settings
    JWT_EXPIRATION_HOURS = 24
    
    # Pagination
    DEFAULT_PAGE_SIZE = 50
    MAX_PAGE_SIZE = 500

