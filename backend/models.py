"""
AgriPredict Database Models
"""
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    """User model for authentication and profile"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='user', index=True)  # 'user' or 'admin'
    status = db.Column(db.String(20), default='active', index=True)  # 'active' or 'inactive'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    activities = db.relationship('Activity', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'phone': self.phone,
            'role': self.role,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def __repr__(self):
        return f'<User {self.email}>'


class CommodityPrice(db.Model):
    """Commodity price model for historical price data"""
    __tablename__ = 'commodity_prices'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    date = db.Column(db.Date, nullable=False)
    commodity = db.Column(db.String(50), nullable=False)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    district = db.Column(db.String(100), nullable=True, default='Kolar')
    market = db.Column(db.String(100), nullable=True, default='Main Market')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Comprehensive indexes for faster queries
    __table_args__ = (
        db.UniqueConstraint('date', 'commodity', 'district', 'market', name='unique_commodity_date_district_market'),
        db.Index('idx_date', 'date'),
        db.Index('idx_commodity', 'commodity'),
        db.Index('idx_district', 'district'),
        db.Index('idx_market', 'market'),
        db.Index('idx_date_commodity', 'date', 'commodity'),
        db.Index('idx_commodity_district', 'commodity', 'district'),
        db.Index('idx_date_commodity_district', 'date', 'commodity', 'district'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'date': self.date.isoformat() if self.date else None,
            'commodity': self.commodity,
            'price': float(self.price),
            'district': self.district,
            'market': self.market,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self):
        return f'<CommodityPrice {self.commodity} {self.date}>'


class Activity(db.Model):
    """Activity log model for tracking user actions"""
    __tablename__ = 'activities'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    username = db.Column(db.String(100), nullable=True, index=True)
    activity_type = db.Column(db.String(50), nullable=False, index=True)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    # Composite index for common queries
    __table_args__ = (
        db.Index('idx_activity_type_created', 'activity_type', 'created_at'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'username': self.username,
            'activity_type': self.activity_type,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self):
        return f'<Activity {self.activity_type} {self.username}>'


class Prediction(db.Model):
    """Prediction model for storing price predictions"""
    __tablename__ = 'predictions'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    commodity = db.Column(db.String(50), nullable=False)
    district = db.Column(db.String(100), nullable=True)
    market = db.Column(db.String(100), nullable=True)
    quantity = db.Column(db.Integer, nullable=True, default=1)
    current_price = db.Column(db.Numeric(10, 2), nullable=False)
    predicted_price = db.Column(db.Numeric(10, 2), nullable=False)
    prediction_period = db.Column(db.Integer, default=7)  # days ahead
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'commodity': self.commodity,
            'district': self.district,
            'market': self.market,
            'quantity': self.quantity,
            'current_price': float(self.current_price),
            'predicted_price': float(self.predicted_price),
            'prediction_period': self.prediction_period,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self):
        return f'<Prediction {self.commodity}>'


class Remark(db.Model):
    """Remark model for storing user remarks and complaints from market search"""
    __tablename__ = 'remarks'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    username = db.Column(db.String(100), nullable=True)
    commodity = db.Column(db.String(50), nullable=False)
    district = db.Column(db.String(100), nullable=True)
    market = db.Column(db.String(100), nullable=True)
    quantity = db.Column(db.Integer, nullable=True, default=1)
    remark = db.Column(db.Text, nullable=False)
    complaint_type = db.Column(db.String(20), default='remark')  # 'remark' or 'complaint'
    admin_response = db.Column(db.Text, nullable=True)  # Admin's response message
    response_date = db.Column(db.DateTime, nullable=True)  # When admin responded
    is_read = db.Column(db.Boolean, default=False)  # Whether admin has read it
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'username': self.username,
            'commodity': self.commodity,
            'district': self.district,
            'market': self.market,
            'quantity': self.quantity,
            'remark': self.remark,
            'complaint_type': self.complaint_type,
            'admin_response': self.admin_response,
            'response_date': self.response_date.isoformat() if self.response_date else None,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self):
        return f'<Remark {self.id} for {self.commodity}>'

