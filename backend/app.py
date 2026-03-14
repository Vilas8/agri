import sys
import os

# Add the project root (parent of backend) to sys.path so we can import config, models, etc.
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from flask import Flask, request, jsonify
from flask_cors import CORS
from config import Config
from models import db, User, CommodityPrice, Activity, Prediction, Remark
from prediction_service import prediction_service
from api_integration import api_service, get_live_price, get_all_live_prices, refresh_cache
import pymysql
from datetime import datetime, date, timedelta
import jwt
import json

# ── NEW: import validators and sync-profile blueprint ─────────────────────
from validators import validate_email, validate_password, validate_phone
from sync_profile_route import sync_bp
# ──────────────────────────────────────────────────────────────────────────

# Initialize Flask app
app = Flask(__name__)
app.config.from_object(Config)

# Configure static folder and template folder to point to frontend
app_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(app_dir, '..'))
frontend_dir = os.path.join(project_root, 'frontend')
app.static_folder = frontend_dir
app.template_folder = frontend_dir

# Enable CORS
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

# ── Register blueprints ────────────────────────────────────────────────────
app.register_blueprint(sync_bp)   # provides POST /api/auth/sync-profile
# ──────────────────────────────────────────────────────────────────────────

# Initialize database
db.init_app(app)


# ============================================
# Helper Functions
# ============================================

def create_token(user_id, email, role):
    """Create JWT token for authentication"""
    payload = {
        'user_id': user_id,
        'email': email,
        'role': role,
        'exp': datetime.utcnow() + timedelta(hours=Config.JWT_EXPIRATION_HOURS)
    }
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')
    return token

def verify_token(token):
    """Verify JWT token"""
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def init_database():
    """Initialize database and create tables"""
    from config import Config
    
    if Config.MYSQL_AVAILABLE:
        try:
            connection = pymysql.connect(
                host=Config.MYSQL_HOST,
                port=Config.MYSQL_PORT,
                user=Config.MYSQL_USER,
                password=Config.MYSQL_PASSWORD
            )
            cursor = connection.cursor()
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {Config.MYSQL_DATABASE}")
            cursor.close()
            connection.close()
            print(f"Database '{Config.MYSQL_DATABASE}' created/verified successfully on MySQL")
        except Exception as e:
            print(f"MySQL Error: {e}")
            print("Error: MySQL is required but not available. Please ensure MySQL is running.")
            return
    else:
        import os
        instance_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance')
        if not os.path.exists(instance_dir):
            os.makedirs(instance_dir)
        print(f"SQLite database will be created at: {instance_dir}/agripredict.db")
    
    with app.app_context():
        db.create_all()
        print("Database tables created successfully")
        
        admin = User.query.filter_by(email=Config.ADMIN_EMAIL).first()
        if not admin:
            admin = User(
                username='Admin',
                email=Config.ADMIN_EMAIL,
                phone='9999999999',
                password=Config.ADMIN_PASSWORD,
                role='admin',
                status='active'
            )
            db.session.add(admin)
            db.session.commit()
            print("Admin user created successfully")
        
        print("Using prediction_service for prices - skipping database seeding")

def seed_commodity_prices():
    """Seed commodity prices from historical data - optimized to skip if already seeded"""
    existing_count = CommodityPrice.query.count()
    if existing_count > 0:
        print(f"Commodity prices already exist ({existing_count} records). Skipping seeding.")
        return
    
    print("Seeding commodity prices for the first time...")
    
    historical_data = [
        {"Date": "2021-01-01", "Maize": 1957.2, "Paddy": 2190.97, "Wheat": 2272.86, "Sugarcane": 3027.39},
        {"Date": "2021-02-01", "Maize": 2002.69, "Paddy": 2028.69, "Wheat": 2461.8, "Sugarcane": 3137.59},
        {"Date": "2021-03-01", "Maize": 1961.21, "Paddy": 2138.93, "Wheat": 2291.47, "Sugarcane": 3133.54},
        {"Date": "2021-04-01", "Maize": 1977.04, "Paddy": 2209.39, "Wheat": 2280.31, "Sugarcane": 3088.66},
        {"Date": "2021-05-01", "Maize": 1836.54, "Paddy": 2170.54, "Wheat": 2462.07, "Sugarcane": 2887.97},
        {"Date": "2021-06-01", "Maize": 2013.17, "Paddy": 2190.74, "Wheat": 2347.76, "Sugarcane": 3096.76},
        {"Date": "2021-07-01", "Maize": 1930.93, "Paddy": 1990.56, "Wheat": 2408.71, "Sugarcane": 2910.62},
        {"Date": "2021-08-01", "Maize": 1839.69, "Paddy": 2170.12, "Wheat": 2527.23, "Sugarcane": 2823.13},
        {"Date": "2021-09-01", "Maize": 1933.05, "Paddy": 2076.44, "Wheat": 2397.76, "Sugarcane": 2967.79},
        {"Date": "2021-10-01", "Maize": 1808.06, "Paddy": 2088.13, "Wheat": 2397.9, "Sugarcane": 2937.62},
        {"Date": "2021-11-01", "Maize": 1949.81, "Paddy": 2221.79, "Wheat": 2501.16, "Sugarcane": 2920.21},
        {"Date": "2021-12-01", "Maize": 1797.52, "Paddy": 2096.34, "Wheat": 2352.75, "Sugarcane": 2924.31},
        {"Date": "2022-01-01", "Maize": 1876.46, "Paddy": 2177.56, "Wheat": 2568.48, "Sugarcane": 3266.7},
        {"Date": "2022-02-01", "Maize": 2014.91, "Paddy": 2122.65, "Wheat": 2546.25, "Sugarcane": 2971.23},
        {"Date": "2022-03-01", "Maize": 1877.38, "Paddy": 2166.16, "Wheat": 2519.64, "Sugarcane": 3156.55},
        {"Date": "2022-04-01", "Maize": 1909.02, "Paddy": 2217.3, "Wheat": 2428.76, "Sugarcane": 3149.45},
        {"Date": "2022-05-01", "Maize": 1905.77, "Paddy": 2304.3, "Wheat": 2553.59, "Sugarcane": 3097.38},
        {"Date": "2022-06-01", "Maize": 2053.56, "Paddy": 2160.86, "Wheat": 2608.21, "Sugarcane": 3056.98},
        {"Date": "2022-07-01", "Maize": 2089.6, "Paddy": 2142.61, "Wheat": 2431.86, "Sugarcane": 3089.27},
        {"Date": "2022-08-01", "Maize": 2030.38, "Paddy": 2196.47, "Wheat": 2415.05, "Sugarcane": 3090.05},
        {"Date": "2022-09-01", "Maize": 1906.25, "Paddy": 2120.48, "Wheat": 2579.65, "Sugarcane": 3197.35},
        {"Date": "2022-10-01", "Maize": 1992.26, "Paddy": 2294.7, "Wheat": 2393.17, "Sugarcane": 2987.1},
        {"Date": "2022-11-01", "Maize": 1866.34, "Paddy": 2146.99, "Wheat": 2439.41, "Sugarcane": 2990.85},
        {"Date": "2022-12-01", "Maize": 2080.24, "Paddy": 2255.22, "Wheat": 2439.58, "Sugarcane": 3237.68},
        {"Date": "2023-01-01", "Maize": 2120.28, "Paddy": 2240.81, "Wheat": 2614.64, "Sugarcane": 3242.74},
        {"Date": "2023-02-01", "Maize": 2136.36, "Paddy": 2235.67, "Wheat": 2679.14, "Sugarcane": 3255.61},
        {"Date": "2023-03-01", "Maize": 2044.77, "Paddy": 2178.75, "Wheat": 2645.53, "Sugarcane": 3301.19},
        {"Date": "2023-04-01", "Maize": 2093.89, "Paddy": 2206.01, "Wheat": 2671.6, "Sugarcane": 3411.08},
        {"Date": "2023-05-01", "Maize": 2099.68, "Paddy": 2266.61, "Wheat": 2688.13, "Sugarcane": 3318.03},
        {"Date": "2023-06-01", "Maize": 2133.09, "Paddy": 2339.06, "Wheat": 2573.72, "Sugarcane": 3233.92},
        {"Date": "2023-07-01", "Maize": 2075.77, "Paddy": 2205.88, "Wheat": 2506.8, "Sugarcane": 3248.16},
        {"Date": "2023-08-01", "Maize": 2000.93, "Paddy": 2326.83, "Wheat": 2537.51, "Sugarcane": 3367.14},
        {"Date": "2023-09-01", "Maize": 1936.8, "Paddy": 2286.83, "Wheat": 2494.59, "Sugarcane": 3160.48},
        {"Date": "2023-10-01", "Maize": 1973.12, "Paddy": 2230.66, "Wheat": 2467.08, "Sugarcane": 3292.01},
        {"Date": "2023-11-01", "Maize": 1937.49, "Paddy": 2355.17, "Wheat": 2638.82, "Sugarcane": 3274.14},
        {"Date": "2023-12-01", "Maize": 2122.7, "Paddy": 2151.81, "Wheat": 2730.36, "Sugarcane": 3164.73},
        {"Date": "2024-01-01", "Maize": 2046.69, "Paddy": 2249.35, "Wheat": 2720.39, "Sugarcane": 3336.3},
        {"Date": "2024-02-01", "Maize": 2196.89, "Paddy": 2334.82, "Wheat": 2594.35, "Sugarcane": 3504.58},
        {"Date": "2024-03-01", "Maize": 2159.12, "Paddy": 2462.87, "Wheat": 2528.9, "Sugarcane": 3356.04},
        {"Date": "2024-04-01", "Maize": 2086.67, "Paddy": 2282.11, "Wheat": 2667.72, "Sugarcane": 3228.68},
        {"Date": "2024-05-01", "Maize": 2236.16, "Paddy": 2486.83, "Wheat": 2806.15, "Sugarcane": 3500.74},
        {"Date": "2024-06-01", "Maize": 2039.12, "Paddy": 2446.78, "Wheat": 2792.76, "Sugarcane": 3403.49},
        {"Date": "2024-07-01", "Maize": 2001.29, "Paddy": 2306.17, "Wheat": 2845.29, "Sugarcane": 3408.19},
        {"Date": "2024-08-01", "Maize": 2091.29, "Paddy": 2273.58, "Wheat": 2779.84, "Sugarcane": 3543.48},
        {"Date": "2024-09-01", "Maize": 2231.32, "Paddy": 2310.52, "Wheat": 2539.59, "Sugarcane": 3382.31},
        {"Date": "2024-10-01", "Maize": 2249.19, "Paddy": 2213.54, "Wheat": 2700.77, "Sugarcane": 3231.06},
        {"Date": "2024-11-01", "Maize": 2247.22, "Paddy": 2466.08, "Wheat": 2622.93, "Sugarcane": 3421.98},
        {"Date": "2024-12-01", "Maize": 2035.75, "Paddy": 2221.61, "Wheat": 2559.56, "Sugarcane": 3514.77},
        {"Date": "2025-01-01", "Maize": 2243.49, "Paddy": 2572.19, "Wheat": 2932.93, "Sugarcane": 3367.92},
        {"Date": "2025-02-01", "Maize": 2293.7, "Paddy": 2349.45, "Wheat": 2681.27, "Sugarcane": 3494.22},
        {"Date": "2025-03-01", "Maize": 2234.48, "Paddy": 2304.83, "Wheat": 2928.06, "Sugarcane": 3286.86},
        {"Date": "2025-04-01", "Maize": 2319.0, "Paddy": 2393.25, "Wheat": 2875.18, "Sugarcane": 3331.23},
        {"Date": "2025-05-01", "Maize": 2211.14, "Paddy": 2309.83, "Wheat": 2702.38, "Sugarcane": 3319.9},
        {"Date": "2025-06-01", "Maize": 2301.32, "Paddy": 2378.3, "Wheat": 2761.72, "Sugarcane": 3425.04},
        {"Date": "2025-07-01", "Maize": 2175.06, "Paddy": 2313.62, "Wheat": 2767.66, "Sugarcane": 3603.45},
        {"Date": "2025-08-01", "Maize": 2202.22, "Paddy": 2520.71, "Wheat": 2874.39, "Sugarcane": 3595.43},
        {"Date": "2025-09-01", "Maize": 2199.58, "Paddy": 2366.71, "Wheat": 2759.33, "Sugarcane": 3439.59},
        {"Date": "2025-10-01", "Maize": 2227.89, "Paddy": 2550.6, "Wheat": 2769.0, "Sugarcane": 3474.19},
        {"Date": "2025-11-01", "Maize": 2202.21, "Paddy": 2444.48, "Wheat": 2651.3, "Sugarcane": 3667.48},
        {"Date": "2025-12-01", "Maize": 2271.37, "Paddy": 2450.68, "Wheat": 2680.94, "Sugarcane": 3491.51}
    ]
    
    commodities = ['Maize', 'Paddy', 'Wheat', 'Sugarcane']
    districts = ['Kolar', 'Chikkabalpura', 'Bangalore Rural']
    
    markets = {
        'Kolar': {
            'Kolar': ['Kolar Main Market'],
            'Bangarapet': ['Bangarapet Market'],
            'Malur': ['Malur Main Market']
        },
        'Chikkabalpura': {
            'Chikkabalpura': ['Chikkabalpura Main'],
            'Bagepalli': ['Bagepalli Market']
        },
        'Bangalore Rural': {
            'Bangalore Rural': ['Bangalore Rural Main'],
            'Devanahalli': ['Devanahalli Market'],
            'Doddaballapur': ['Doddaballapur Market']
        }
    }
    
    markets_list = []
    for district, taluks in markets.items():
        for taluk, market_list in taluks.items():
            for market in market_list:
                markets_list.append({'district': district, 'market': market})
    
    prices_to_add = []
    for record in historical_data:
        record_date = datetime.strptime(record['Date'], '%Y-%m-%d').date()
        for commodity in commodities:
            base_price = record.get(commodity, 2000)
            for district, taluks in markets.items():
                for taluk, market_list in taluks.items():
                    for market in market_list:
                        price = CommodityPrice(
                            date=record_date,
                            commodity=commodity,
                            price=base_price,
                            district=district,
                            market=market
                        )
                        prices_to_add.append(price)
    
    db.session.bulk_save_objects(prices_to_add)
    db.session.commit()
    print(f"Successfully seeded {len(prices_to_add)} commodity price records")


# ============================================
# Authentication Routes
# ============================================

@app.route('/api/auth/register', methods=['POST'])
def register():
    """Register a new user with full server-side validation."""
    data = request.get_json() or {}

    name     = (data.get('name') or data.get('username') or '').strip()
    email    = (data.get('email')    or '').strip()
    phone    = (data.get('phone')    or '').strip()
    password =  data.get('password') or ''

    if not name:
        return jsonify(success=False, message='Full name is required.'), 400

    # Strict email validation (validators.py)
    email_ok, email_msg = validate_email(email)
    if not email_ok:
        return jsonify(success=False, message=email_msg), 400

    # Phone validation
    phone_ok, phone_result = validate_phone(phone)
    if not phone_ok:
        return jsonify(success=False, message=phone_result), 400
    phone = phone_result  # cleaned 10-digit string

    # Password strength validation
    pw_ok, pw_msg = validate_password(password)
    if not pw_ok:
        return jsonify(success=False, message=pw_msg), 400

    # Duplicate email check
    if User.query.filter_by(email=email.lower()).first():
        return jsonify(success=False, message='Email is already registered.'), 400

    new_user = User(
        username=name,
        email=email.lower(),
        phone=phone,
        password=password,
        role='user',
        status='active'
    )
    try:
        db.session.add(new_user)
        db.session.commit()
        log_activity(new_user.id, new_user.username, 'register',
                     f'User {new_user.email} registered')
        return jsonify(
            success=True,
            message='Registration successful! Please log in.',
            user=new_user.to_dict()
        ), 201
    except Exception as e:
        db.session.rollback()
        return jsonify(success=False, message=str(e)), 500


@app.route('/api/auth/login', methods=['POST'])
def login():
    """User login with server-side email validation."""
    data = request.get_json() or {}

    email    = (data.get('email')    or '').strip()
    password =  data.get('password') or ''

    email_ok, email_msg = validate_email(email)
    if not email_ok:
        return jsonify(success=False, message=email_msg), 400
    if not password:
        return jsonify(success=False, message='Password is required.'), 400

    user = User.query.filter_by(email=email.lower()).first()
    if not user or user.password != password:
        return jsonify(success=False, message='Invalid email or password.'), 401
    if user.status != 'active':
        return jsonify(success=False, message='Account is inactive.'), 403

    token = create_token(user.id, user.email, user.role)
    log_activity(user.id, user.username, 'login', f'User {user.email} logged in')
    return jsonify(
        success=True,
        message='Login successful',
        token=token,
        user=user.to_dict()
    ), 200


@app.route('/api/auth/admin-login', methods=['POST'])
def admin_login():
    """Admin login"""
    data = request.get_json()
    
    email = data.get('email')
    password = data.get('password')
    secret = data.get('secret')
    
    if not all([email, password, secret]):
        return jsonify({'success': False, 'message': 'Email, password, and secret key are required'}), 400
    
    if email != Config.ADMIN_EMAIL or password != Config.ADMIN_PASSWORD:
        user = User.query.filter_by(email=email, role='admin').first()
        if not user or user.password != password:
            return jsonify({'success': False, 'message': 'Invalid admin credentials'}), 401
    
    if secret != Config.ADMIN_SECRET:
        return jsonify({'success': False, 'message': 'Invalid secret key'}), 401
    
    user = User.query.filter_by(email=email).first()
    if not user:
        user = User(
            username='Admin',
            email=email,
            phone='9999999999',
            password=password,
            role='admin',
            status='active'
        )
        db.session.add(user)
        db.session.commit()
    
    token = create_token(user.id, user.email, user.role)
    log_activity(user.id, user.username, 'admin_login', f'Admin {user.email} logged in')
    
    return jsonify({
        'success': True,
        'message': 'Admin login successful',
        'token': token,
        'user': user.to_dict()
    }), 200


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    """User logout"""
    data = request.get_json()
    user_id = data.get('user_id')
    
    if user_id:
        user = User.query.get(user_id)
        if user:
            log_activity(user.id, user.username, 'logout', f'User {user.email} logged out')
    
    return jsonify({'success': True, 'message': 'Logged out successfully'}), 200


# ============================================
# Price Routes
# ============================================

@app.route('/api/prices/live', methods=['GET'])
def get_live_price_endpoint():
    commodity = request.args.get('commodity')
    district = request.args.get('district', 'Kolar')
    market = request.args.get('market', 'Main Market')
    refresh = request.args.get('refresh', 'false').lower() == 'true'
    
    if not commodity:
        return jsonify({'success': False, 'message': 'Commodity is required'}), 400
    
    try:
        if refresh:
            refresh_cache()
        price_data = get_live_price(commodity, district, market)
        return jsonify({
            'success': True,
            'commodity': commodity,
            'district': district,
            'market': market,
            'price': price_data.get('price'),
            'min_price': price_data.get('min_price'),
            'max_price': price_data.get('max_price'),
            'last_updated': price_data.get('last_updated'),
            'source': price_data.get('source', 'unknown')
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/prices/live/all', methods=['GET'])
def get_all_live_prices_endpoint():
    district = request.args.get('district', 'Kolar')
    market = request.args.get('market', 'Main Market')
    refresh = request.args.get('refresh', 'false').lower() == 'true'
    
    try:
        if refresh:
            refresh_cache()
        prices = get_all_live_prices(district, market)
        formatted_prices = {}
        for commodity, data in prices.items():
            formatted_prices[commodity] = {
                'price': data.get('price'),
                'min_price': data.get('min_price'),
                'max_price': data.get('max_price'),
                'last_updated': data.get('last_updated'),
                'source': data.get('source', 'unknown')
            }
        return jsonify({
            'success': True,
            'district': district,
            'market': market,
            'prices': formatted_prices,
            'timestamp': datetime.now().isoformat()
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/prices/market/compare', methods=['GET'])
def compare_market_prices():
    commodity = request.args.get('commodity')
    district = request.args.get('district', 'Kolar')
    
    if not commodity:
        return jsonify({'success': False, 'message': 'Commodity is required'}), 400
    
    try:
        market_data = api_service.get_market_data(commodity, district)
        return jsonify({
            'success': True,
            'commodity': commodity,
            'district': district,
            'markets': market_data
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/prices/cache/clear', methods=['POST'])
def clear_price_cache():
    try:
        refresh_cache()
        return jsonify({'success': True, 'message': 'Price cache cleared successfully'}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/prices/current', methods=['GET'])
def get_current_prices():
    commodity = request.args.get('commodity')
    district = request.args.get('district', 'Kolar')
    market = request.args.get('market', 'Main Market')
    
    try:
        if commodity:
            price = prediction_service.get_current_price(commodity, district, market)
            return jsonify({
                'success': True,
                'price': price,
                'commodity': commodity,
                'district': district,
                'market': market
            }), 200
        else:
            commodities = ['Maize', 'Paddy', 'Wheat', 'Sugarcane']
            prices = {}
            for com in commodities:
                prices[com] = prediction_service.get_current_price(com, district, market)
            return jsonify({
                'success': True,
                'prices': prices,
                'district': district,
                'market': market
            }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/prices/historical', methods=['GET'])
def get_historical_prices():
    commodity = request.args.get('commodity')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    limit = request.args.get('limit', 100, type=int)
    
    try:
        query = CommodityPrice.query
        if commodity:
            query = query.filter_by(commodity=commodity)
        if start_date:
            start = datetime.strptime(start_date, '%Y-%m-%d').date()
            query = query.filter(CommodityPrice.date >= start)
        if end_date:
            end = datetime.strptime(end_date, '%Y-%m-%d').date()
            query = query.filter(CommodityPrice.date <= end)
        prices = query.order_by(CommodityPrice.date.desc()).limit(limit).all()
        return jsonify({
            'success': True,
            'prices': [p.to_dict() for p in prices],
            'count': len(prices)
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/prices/search', methods=['GET'])
def search_prices():
    commodity = request.args.get('commodity')
    district = request.args.get('district', 'Kolar')
    market = request.args.get('market', 'Main Market')
    quantity = request.args.get('quantity', 1, type=int)
    
    if not commodity:
        return jsonify({'success': False, 'message': 'Commodity is required'}), 400
    
    try:
        current_price = prediction_service.get_current_price(commodity, district, market)
        total_value = current_price * quantity
        return jsonify({
            'success': True,
            'commodity': commodity,
            'district': district,
            'market': market,
            'quantity': quantity,
            'price_per_quintal': current_price,
            'total_value': total_value,
            'source': 'prediction_service'
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ============================================
# Prediction Routes
# ============================================

@app.route('/api/predictions/predict', methods=['POST'])
def predict_price():
    data = request.get_json()
    commodity = data.get('commodity')
    district = data.get('district', 'Kolar')
    market = data.get('market', 'Main Market')
    quantity = data.get('quantity', 1)
    days_ahead = data.get('days_ahead', 7)
    user_id = data.get('user_id')
    
    if not commodity:
        return jsonify({'success': False, 'message': 'Commodity is required'}), 400
    
    try:
        result = prediction_service.predict_price(commodity, district, market, days_ahead)
        current_price = result['current_price']
        predicted_price = result['predicted_price']
        current_total = current_price * quantity
        predicted_total = predicted_price * quantity
        price_change = ((predicted_price - current_price) / current_price) * 100
        
        if user_id:
            prediction = Prediction(
                user_id=user_id,
                commodity=commodity,
                district=district,
                market=market,
                quantity=quantity,
                current_price=current_price,
                predicted_price=predicted_price,
                prediction_period=days_ahead
            )
            db.session.add(prediction)
            db.session.commit()
            log_activity(user_id, None, 'prediction', f'Predicted {commodity} prices')
        
        return jsonify({
            'success': True,
            'commodity': commodity,
            'district': district,
            'market': market,
            'quantity': quantity,
            'current_price': current_price,
            'predicted_price': predicted_price,
            'current_total': current_total,
            'predicted_total': predicted_total,
            'price_change_percent': round(price_change, 2),
            'days_ahead': days_ahead,
            'method': result.get('method', 'statistical'),
            'accuracy': result.get('accuracy', '85-90%')
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/predictions/trend', methods=['GET'])
def get_price_trend():
    commodity = request.args.get('commodity', 'Maize')
    try:
        trend = prediction_service.get_price_trend(commodity)
        return jsonify({'success': True, 'commodity': commodity, 'trend': trend}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ============================================
# Admin Routes
# ============================================

@app.route('/api/admin/users', methods=['GET'])
def get_users():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    search = request.args.get('search', '')
    
    try:
        query = User.query
        if search:
            query = query.filter(
                (User.username.ilike(f'%{search}%')) |
                (User.email.ilike(f'%{search}%'))
            )
        pagination = query.order_by(User.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        return jsonify({
            'success': True,
            'users': [u.to_dict() for u in pagination.items],
            'total': pagination.total,
            'page': page,
            'per_page': per_page,
            'pages': pagination.pages
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    data = request.get_json()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    try:
        if 'username' in data:
            user.username = data['username']
        if 'status' in data:
            user.status = data['status']
        if 'role' in data:
            user.role = data['role']
        db.session.commit()
        return jsonify({'success': True, 'message': 'User updated successfully', 'user': user.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/stats', methods=['GET'])
def get_stats():
    try:
        total_users = User.query.count()
        active_users = User.query.filter_by(status='active').count()
        admin_users = User.query.filter_by(role='admin').count()
        today = date.today()
        today_users = User.query.filter(db.func.date(User.created_at) == today).count()
        total_activities = Activity.query.count()
        total_predictions = Prediction.query.count()
        return jsonify({
            'success': True,
            'stats': {
                'total_users': total_users,
                'active_users': active_users,
                'admin_users': admin_users,
                'today_users': today_users,
                'total_activities': total_activities,
                'total_predictions': total_predictions,
                'commodity_records': CommodityPrice.query.count()
            }
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ============================================
# Activity Routes
# ============================================

@app.route('/api/activities', methods=['GET'])
def get_activities():
    limit = request.args.get('limit', 50, type=int)
    activity_type = request.args.get('type')
    try:
        query = Activity.query
        if activity_type:
            query = query.filter_by(activity_type=activity_type)
        activities = query.order_by(Activity.created_at.desc()).limit(limit).all()
        return jsonify({
            'success': True,
            'activities': [a.to_dict() for a in activities],
            'count': len(activities)
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


def log_activity(user_id, username, activity_type, description):
    """Log an activity"""
    try:
        activity = Activity(
            user_id=user_id,
            username=username,
            activity_type=activity_type,
            description=description
        )
        db.session.add(activity)
        db.session.commit()
    except Exception as e:
        print(f"Error logging activity: {e}")
        db.session.rollback()


# ============================================
# Market Data Routes
# ============================================

@app.route('/api/markets', methods=['GET'])
def get_markets():
    districts = request.args.get('districts', 'true').lower() == 'true'
    try:
        db_markets = db.session.query(
            CommodityPrice.district,
            CommodityPrice.market,
            db.func.count(CommodityPrice.id).label('record_count')
        ).group_by(CommodityPrice.district, CommodityPrice.market).all()
        
        if db_markets and len(db_markets) > 0:
            markets_data = {}
            for row in db_markets:
                district = row.district
                market = row.market
                if district not in markets_data:
                    markets_data[district] = {}
                taluk = market.split()[0] if market else 'Main'
                if taluk not in markets_data[district]:
                    markets_data[district][taluk] = []
                if market not in markets_data[district][taluk]:
                    markets_data[district][taluk].append(market)
        else:
            markets_data = {
                'Kolar': {'Kolar': ['Kolar Main Market', 'Kolar APMC', 'Kolar Wholesale'], 'Bangarapet': ['Bangarapet Market', 'Bangarapet APMC'], 'Malur': ['Malur Main Market', 'Malur APMC'], 'Mulbagal': ['Mulbagal Market', 'Mulbagal APMC']},
                'Chikkabalpura': {'Chikkabalpura': ['Chikkabalpura Main', 'Chikkabalpura APMC'], 'Bagepalli': ['Bagepalli Market', 'Bagepalli APMC'], 'Cheemtagi': ['Cheemtagi Market']},
                'Bangalore Rural': {'Bangalore Rural': ['Bangalore Rural Main', 'Bangalore Rural APMC'], 'Devanahalli': ['Devanahalli Market', 'Devanahalli APMC'], 'Doddaballapur': ['Doddaballapur Market', 'Doddaballapur APMC'], 'Hoskote': ['Hoskote Main', 'Hoskote APMC']}
            }
    except Exception as e:
        print(f"Error loading markets from DB: {e}")
        markets_data = {
            'Kolar': {'Kolar': ['Kolar Main Market', 'Kolar APMC', 'Kolar Wholesale'], 'Bangarapet': ['Bangarapet Market', 'Bangarapet APMC'], 'Malur': ['Malur Main Market', 'Malur APMC'], 'Mulbagal': ['Mulbagal Market', 'Mulbagal APMC']},
            'Chikkabalpura': {'Chikkabalpura': ['Chikkabalpura Main', 'Chikkabalpura APMC'], 'Bagepalli': ['Bagepalli Market', 'Bagepalli APMC'], 'Cheemtagi': ['Cheemtagi Market']},
            'Bangalore Rural': {'Bangalore Rural': ['Bangalore Rural Main', 'Bangalore Rural APMC'], 'Devanahalli': ['Devanahalli Market', 'Devanahalli APMC'], 'Doddaballapur': ['Doddaballapur Market', 'Doddaballapur APMC'], 'Hoskote': ['Hoskote Main', 'Hoskote APMC']}
        }
    
    if not districts:
        all_markets = []
        for district, taluks in markets_data.items():
            for taluk, markets in taluks.items():
                all_markets.extend(markets)
        return jsonify({'success': True, 'markets': all_markets}), 200
    
    return jsonify({'success': True, 'markets': markets_data}), 200


# ============================================
# Admin Market Management Routes
# ============================================

@app.route('/api/admin/markets', methods=['GET'])
def get_admin_markets():
    static_markets = {
        'Kolar': {'Kolar': ['Kolar Main Market', 'Kolar APMC', 'Kolar Wholesale'], 'Bangarapet': ['Bangarapet Market', 'Bangarapet APMC', 'Bangarapet Wholesale'], 'Malur': ['Malur Main Market', 'Malur APMC', 'Malur Wholesale'], 'Mulbagal': ['Mulbagal Market', 'Mulbagal APMC', 'Mulbagal Wholesale'], 'Srinivaspur': ['Srinivaspur Market', 'Srinivaspur APMC']},
        'Chikkabalpura': {'Chikkabalpura': ['Chikkabalpura Main', 'Chikkabalpura APMC', 'Chikkabalpura Wholesale'], 'Bagepalli': ['Bagepalli Market', 'Bagepalli APMC'], 'Cheemtagi': ['Cheemtagi Market', 'Cheemtagi APMC'], 'Gudibanda': ['Gudibanda Market', 'Gudibanda APMC'], 'Shravanabelagola': ['Shravanabelagola Market', 'Shravanabelagola APMC']},
        'Bangalore Rural': {'Bangalore Rural': ['Bangalore Rural Main', 'Bangalore Rural APMC', 'Bangalore Rural Wholesale'], 'Devanahalli': ['Devanahalli Market', 'Devanahalli APMC', 'Devanahalli Wholesale'], 'Doddaballapur': ['Doddaballapur Market', 'Doddaballapur APMC', 'Doddaballapur Wholesale'], 'Hoskote': ['Hoskote Main', 'Hoskote APMC', 'Hoskote Wholesale'], 'Nelamangala': ['Nelamangala Market', 'Nelamangala APMC']}
    }
    try:
        db_markets = db.session.query(
            CommodityPrice.district,
            CommodityPrice.market,
            db.func.count(CommodityPrice.id).label('record_count'),
            db.func.max(CommodityPrice.date).label('last_updated'),
            db.func.avg(CommodityPrice.price).label('avg_price')
        ).group_by(CommodityPrice.district, CommodityPrice.market).all()
        
        markets_list = []
        if db_markets and len(db_markets) > 0:
            for i, row in enumerate(db_markets):
                markets_list.append({'id': i + 1, 'district': row.district, 'market': row.market, 'record_count': row.record_count, 'last_updated': row.last_updated.isoformat() if row.last_updated else None, 'avg_price': float(row.avg_price) if row.avg_price else 0})
        
        if len(markets_list) < 30:
            static_id = len(markets_list) + 1
            for district, taluks in static_markets.items():
                for taluk, market_list in taluks.items():
                    for market in market_list:
                        existing = False
                        if db_markets:
                            for row in db_markets:
                                if row.district == district and row.market == market:
                                    existing = True
                                    break
                        if not existing:
                            markets_list.append({'id': static_id, 'district': district, 'market': market, 'record_count': 0, 'last_updated': None, 'avg_price': 0, 'is_static': True})
                            static_id += 1
        
        return jsonify({'success': True, 'markets': markets_list, 'total': len(markets_list)}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/markets', methods=['POST'])
def add_market():
    data = request.get_json()
    district = data.get('district')
    market = data.get('market')
    commodity = data.get('commodity', 'Maize')
    price = data.get('price', 2000)
    
    if not district or not market:
        return jsonify({'success': False, 'message': 'District and Market are required'}), 400
    
    try:
        existing = CommodityPrice.query.filter_by(district=district, market=market).first()
        if existing:
            return jsonify({'success': False, 'message': 'Market already exists in this district'}), 400
        new_price = CommodityPrice(date=date.today(), commodity=commodity, price=price, district=district, market=market)
        db.session.add(new_price)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Market added successfully', 'market': {'district': district, 'market': market, 'commodity': commodity, 'price': price}}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/markets/<path:market_id>', methods=['PUT'])
def update_market(market_id):
    data = request.get_json()
    district = data.get('district')
    new_market = data.get('market')
    new_district = data.get('new_district')
    
    if not district or not new_market:
        return jsonify({'success': False, 'message': 'District and Market are required'}), 400
    
    try:
        market_idx = int(market_id) - 1
        db_markets = db.session.query(CommodityPrice.district, CommodityPrice.market).distinct().all()
        if market_idx < 0 or market_idx >= len(db_markets):
            return jsonify({'success': False, 'message': 'Market not found'}), 404
        old_district = db_markets[market_idx].district
        old_market = db_markets[market_idx].market
        updated_count = CommodityPrice.query.filter_by(district=old_district, market=old_market).update({'district': new_district if new_district else district, 'market': new_market})
        db.session.commit()
        return jsonify({'success': True, 'message': f'Market updated successfully ({updated_count} records updated)', 'updated': updated_count}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/markets/<path:market_id>', methods=['DELETE'])
def delete_market(market_id):
    try:
        market_idx = int(market_id) - 1
        db_markets = db.session.query(CommodityPrice.district, CommodityPrice.market).distinct().all()
        if market_idx < 0 or market_idx >= len(db_markets):
            return jsonify({'success': False, 'message': 'Market not found'}), 404
        district = db_markets[market_idx].district
        market = db_markets[market_idx].market
        deleted_count = CommodityPrice.query.filter_by(district=district, market=market).delete()
        db.session.commit()
        return jsonify({'success': True, 'message': f'Market deleted successfully ({deleted_count} records deleted)', 'deleted': deleted_count}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


# ============================================
# Admin Price Records Management Routes
# ============================================

@app.route('/api/admin/price-records', methods=['GET'])
def get_price_records():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    district = request.args.get('district')
    commodity = request.args.get('commodity')
    try:
        query = CommodityPrice.query
        if district:
            query = query.filter_by(district=district)
        if commodity:
            query = query.filter_by(commodity=commodity)
        pagination = query.order_by(CommodityPrice.date.desc()).paginate(page=page, per_page=per_page, error_out=False)
        return jsonify({'success': True, 'records': [r.to_dict() for r in pagination.items], 'total': pagination.total, 'page': page, 'per_page': per_page, 'pages': pagination.pages}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/price-records/<int:record_id>', methods=['PUT'])
def update_price_record(record_id):
    data = request.get_json()
    record = CommodityPrice.query.get(record_id)
    if not record:
        return jsonify({'success': False, 'message': 'Record not found'}), 404
    try:
        if 'price' in data: record.price = data['price']
        if 'commodity' in data: record.commodity = data['commodity']
        if 'district' in data: record.district = data['district']
        if 'market' in data: record.market = data['market']
        if 'date' in data: record.date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        db.session.commit()
        return jsonify({'success': True, 'message': 'Record updated successfully', 'record': record.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/price-records/<int:record_id>', methods=['DELETE'])
def delete_price_record(record_id):
    record = CommodityPrice.query.get(record_id)
    if not record:
        return jsonify({'success': False, 'message': 'Record not found'}), 404
    try:
        db.session.delete(record)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Record deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/commodities', methods=['GET'])
def get_commodities():
    commodities = [
        {'name': 'Maize', 'icon': '🌽', 'base_price': 2075},
        {'name': 'Paddy', 'icon': '🌾', 'base_price': 2275},
        {'name': 'Wheat', 'icon': '🌿', 'base_price': 2580},
        {'name': 'Sugarcane', 'icon': '🎋', 'base_price': 3300}
    ]
    return jsonify({'success': True, 'commodities': commodities}), 200


# ============================================
# Remarks Routes
# ============================================

@app.route('/api/remarks', methods=['POST'])
def submit_remark():
    data = request.get_json()
    user_id = data.get('user_id')
    username = data.get('username')
    commodity = data.get('commodity')
    district = data.get('district')
    market = data.get('market')
    quantity = data.get('quantity', 1)
    remark = data.get('remark')
    complaint_type = data.get('complaint_type', 'remark')
    
    if not commodity or not remark:
        return jsonify({'success': False, 'message': 'Commodity and remark are required'}), 400
    
    try:
        new_remark = Remark(user_id=user_id, username=username, commodity=commodity, district=district, market=market, quantity=quantity, remark=remark, complaint_type=complaint_type)
        db.session.add(new_remark)
        db.session.commit()
        log_activity(user_id, username, complaint_type, f'Submitted {complaint_type} for {commodity}')
        return jsonify({'success': True, 'message': f'{complaint_type.capitalize()} submitted successfully', 'remark': new_remark.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/remarks/user', methods=['GET'])
def get_user_remarks():
    user_id = request.args.get('user_id', type=int)
    complaint_type = request.args.get('type')
    if not user_id:
        return jsonify({'success': False, 'message': 'User ID is required'}), 400
    try:
        query = Remark.query.filter_by(user_id=user_id)
        if complaint_type:
            query = query.filter_by(complaint_type=complaint_type)
        remarks = query.order_by(Remark.created_at.desc()).all()
        return jsonify({'success': True, 'remarks': [r.to_dict() for r in remarks], 'total': len(remarks)}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/complaints', methods=['GET'])
def get_complaints():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    include_responded = request.args.get('include_responded', 'true').lower() == 'true'
    try:
        query = Remark.query.filter_by(complaint_type='complaint')
        if not include_responded:
            query = query.filter(Remark.admin_response == None)
        pagination = query.order_by(Remark.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
        return jsonify({'success': True, 'complaints': [r.to_dict() for r in pagination.items], 'total': pagination.total, 'page': page, 'per_page': per_page, 'pages': pagination.pages}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/respond-complaint', methods=['POST'])
def respond_to_complaint():
    data = request.get_json()
    complaint_id = data.get('complaint_id')
    admin_response = data.get('response') or data.get('admin_response')
    if not complaint_id or not admin_response:
        return jsonify({'success': False, 'message': 'Complaint ID and response are required'}), 400
    try:
        remark = Remark.query.get(complaint_id)
        if not remark:
            return jsonify({'success': False, 'message': 'Complaint not found'}), 404
        if remark.complaint_type != 'complaint':
            return jsonify({'success': False, 'message': 'This is not a complaint'}), 400
        remark.admin_response = admin_response
        remark.response_date = datetime.utcnow()
        db.session.commit()
        return jsonify({'success': True, 'message': 'Response sent successfully', 'remark': remark.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/user/complaints', methods=['GET'])
def get_user_complaints():
    user_id = request.args.get('user_id', type=int)
    username = request.args.get('username', '')
    show_all = request.args.get('show_all', 'false').lower() == 'true'
    if not user_id and not username:
        return jsonify({'success': False, 'message': 'User ID or username is required'}), 400
    try:
        query = Remark.query.filter_by(complaint_type='complaint')
        if user_id:
            query = query.filter_by(user_id=user_id)
        elif username:
            query = query.filter_by(username=username)
        complaints = query.order_by(Remark.created_at.desc()).all()
        if not complaints and user_id and username:
            complaints = Remark.query.filter_by(complaint_type='complaint', username=username).order_by(Remark.created_at.desc()).all()
        return jsonify({'success': True, 'complaints': [c.to_dict() for c in complaints], 'total': len(complaints)}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/admin/remarks', methods=['GET'])
def get_remarks():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    try:
        query = Remark.query
        pagination = query.order_by(Remark.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
        return jsonify({'success': True, 'remarks': [r.to_dict() for r in pagination.items], 'total': pagination.total, 'page': page, 'per_page': per_page, 'pages': pagination.pages}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ============================================
# Health Check
# ============================================

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'success': True, 'message': 'AgriPredict API is running', 'timestamp': datetime.utcnow().isoformat()}), 200


# ============================================
# Frontend Routes
# ============================================

@app.route('/')
def serve_index():
    try:
        return app.send_static_file('index.html')
    except:
        from flask import render_template
        return render_template('index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    from flask import send_from_directory
    import os
    app_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(app_dir, '..'))
    frontend_dir = os.path.join(project_root, 'frontend')
    file_path = os.path.join(frontend_dir, filename)
    if os.path.exists(file_path):
        return send_from_directory(frontend_dir, filename)
    return jsonify({'success': False, 'message': 'File not found'}), 404


# ============================================
# Main Entry Point
# ============================================

_db_initialized = False

def init_database_lazy():
    global _db_initialized
    if _db_initialized:
        return True
    try:
        init_database()
        _db_initialized = True
        return True
    except Exception as e:
        print(f"Database initialization error (will use fallback): {e}")
        return False

@app.before_request
def before_request_init():
    global _db_initialized
    if not _db_initialized:
        try:
            init_database()
            _db_initialized = True
        except Exception as e:
            print(f"Lazy init error: {e}")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
