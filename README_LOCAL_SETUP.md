# AgriPredict – Local MySQL Setup Guide

This project now runs **fully locally** using MySQL — Supabase has been removed.

## Prerequisites
- Python 3.9+
- MySQL 8.0+ running locally
- Node not required (frontend is pure HTML/JS)

---

## 1. Create the MySQL database

```bash
mysql -u root -p < setup.sql
```

Or manually in MySQL Workbench / shell:
```sql
CREATE DATABASE IF NOT EXISTS agri_predict;
```

---

## 2. Configure your `.env`

```bash
cd backend
copy .env .env.local   # Windows — already pre-filled, just edit password
```

Open `backend/.env` and set:
```
MYSQL_PASSWORD=your_actual_mysql_root_password
```

---

## 3. Install Python dependencies

```bash
pip install flask flask-cors flask-sqlalchemy pymysql python-dotenv pyjwt scikit-learn numpy pandas
```

---

## 4. Run the backend

```bash
cd backend
python app.py
```

On first run the app will:
- Auto-create all MySQL tables
- Seed commodity price data (5 000+ records)
- Create the admin user (`admin@gmail.com` / `admin123`)

---

## 5. Open the frontend

Open `frontend/index.html` directly in your browser, **or** use the Flask static server (it serves `frontend/` at `/`):

```
http://localhost:5000
```

---

## Default credentials

| Role  | Email | Password | Secret Key |
|-------|-------|----------|------------|
| Admin | admin@gmail.com | admin123 | AGRI2026 |
| User  | register via UI | — | — |

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `Access denied for user 'root'` | Check `MYSQL_PASSWORD` in `backend/.env` |
| `Unknown database 'agri_predict'` | Run `setup.sql` first |
| `ModuleNotFoundError: dotenv` | `pip install python-dotenv` |
| `ModuleNotFoundError: pymysql` | `pip install pymysql` |
| Loading screen stuck forever | Backend not running — start `python backend/app.py` |
