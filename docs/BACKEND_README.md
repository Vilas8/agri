# AgriPredict Backend

Flask-based REST API backend for the AgriPredict application.

## Features

- **User Authentication**: Register, Login, Admin Login with JWT tokens
- **Commodity Prices**: Current and historical price data
- **Price Predictions**: AI-powered price predictions using Random Forest
- **Admin Dashboard**: User management and activity monitoring
- **Market Data**: District and market-based pricing

## Prerequisites

1. Python 3.8+
2. MySQL Server (optional - will use fallback if not available)

## Installation

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Database (Optional)

Create a MySQL database or update `config.py`:

```python
# config.py settings
MYSQL_HOST = 'localhost'
MYSQL_PORT = 3306
MYSQL_USER = 'root'
MYSQL_PASSWORD = 'your_password'
MYSQL_DATABASE = 'agri_predict'
```

If MySQL is not available, the app will use SQLite as fallback.

### 3. Update config.py

Set your admin credentials:

```python
ADMIN_EMAIL = 'admin@gmail.com'
ADMIN_PASSWORD = 'admin123'
ADMIN_SECRET = 'AGRI2026'
```

## Running the Backend

### Development Mode

```bash
cd c:/version10smart
python app.py
```

The server will start on `http://localhost:5000`

### Production Mode

```bash
# Using Gunicorn
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/admin-login` | Admin login |
| POST | `/api/auth/logout` | User logout |

### Prices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/prices/current` | Get current prices |
| GET | `/api/prices/historical` | Get historical prices |
| GET | `/api/prices/search` | Search prices |

### Predictions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/predictions/predict` | Predict future prices |
| GET | `/api/predictions/trend` | Get price trends |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | Get all users |
| PUT | `/api/admin/users/<id>` | Update user |
| GET | `/api/admin/stats` | Get dashboard stats |

### Other

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/markets` | Get market list |
| GET | `/api/commodities` | Get commodities |
| GET | `/api/activities` | Get activities |
| GET | `/api/health` | Health check |

## Example API Calls

### Register User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "John Doe",
    "email": "john@example.com",
    "phone": "9876543210",
    "password": "password123"
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Get Current Prices
```bash
curl "http://localhost:5000/api/prices/current"
```

### Predict Price
```bash
curl -X POST http://localhost:5000/api/predictions/predict \
  -H "Content-Type: application/json" \
  -d '{
    "commodity": "Maize",
    "district": "Kolar",
    "market": "Main Market",
    "quantity": 10,
    "days_ahead": 7
  }'
```

## Frontend Integration

Update your frontend JavaScript to call the backend API. Update `script.js`:

```javascript
const API_BASE_URL = 'http://localhost:5000/api';

// Example: Login
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();
  if (data.success) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    showPage('user-dashboard');
  }
}
```

## Project Structure

```
version10smart/
├── app.py                  # Main Flask application
├── config.py               # Configuration settings
├── models.py               # SQLAlchemy models
├── prediction_service.py   # ML prediction service
├── requirements.txt        # Python dependencies
├── database.sql           # MySQL schema
└── README.md             # This file
```

## Admin Credentials

- **Email**: admin@gmail.com
- **Password**: admin123
- **Secret Key**: AGRI2026

## Troubleshooting

### MySQL Connection Error
If you get MySQL connection errors, the app will automatically use SQLite as fallback.

### Port Already in Use
Change the port in `app.py`:
```python
app.run(host='0.0.0.0', port=5001, debug=True)
```

### CORS Issues
If frontend is on a different domain, update CORS settings in `config.py`:
```python
CORS_ORIGINS = 'http://your-frontend-domain.com'
```

## License

This project is part of AgriPredict - Smart Farming Commodity Price Prediction System.

