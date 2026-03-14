# Price Alerts System - Detailed Explanation

## What is Price Alerts System?

Price Alerts is a notification system that notifies farmers when commodity prices reach their target price, helping them sell at the optimal time.

---

## How It Works - User Flow

### Step 1: User Sets an Alert
```
User selects:
- Commodity: Maize
- District: Kolar  
- Market: Kolar Main Market
- Current Price: ₹2,150/quintal
- Target Price: ₹2,300/quintal (above this price)
- Alert Type: "Notify when price rises above ₹2,300"
```

### Step 2: System Monitors Prices
```
Backend runs a scheduled task every hour:
1. Fetch current prices for all commodities
2. Compare with all active alerts
3. Check if any price crossed the target threshold
4. If crossed → Send notification to user
```

### Step 3: User Gets Notified
```
Notification received:
"📢 Price Alert! 
Maize in Kolar Main Market has reached ₹2,320/quintal!
Your target was ₹2,300. Time to sell! 🎉"
```

---

## Technical Implementation

1. Database Model###  (New Table)

```python
# backend/models.py - Add this model

class PriceAlert(db.Model):
    """Price alert model for user notifications"""
    __tablename__ = 'price_alerts'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Alert Details
    commodity = db.Column(db.String(50), nullable=False)
    district = db.Column(db.String(100), nullable=True)
    market = db.Column(db.String(100), nullable=True)
    
    # Price Settings
    target_price = db.Column(db.Numeric(10, 2), nullable=False)
    alert_type = db.Column(db.String(20), nullable=False)  # 'above' or 'below'
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    triggered_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Notification
    notify_email = db.Column(db.Boolean, default=True)
    notify_sms = db.Column(db.Boolean, default=False)
    notify_push = db.Column(db.Boolean, default=True)
```

### 2. API Endpoints

```python
# backend/app.py - Add these routes

@app.route('/api/alerts', methods=['POST'])
def create_alert():
    """Create a new price alert"""
    data = request.get_json()
    
    new_alert = PriceAlert(
        user_id=data['user_id'],
        commodity=data['commodity'],
        district=data.get('district'),
        market=data.get('market'),
        target_price=data['target_price'],
        alert_type=data['alert_type'],  # 'above' or 'below'
        notify_email=data.get('notify_email', True)
    )
    db.session.add(new_alert)
    db.session.commit()
    
    return jsonify({'success': True, 'alert': new_alert.to_dict()})

@app.route('/api/alerts/<user_id>', methods=['GET'])
def get_user_alerts(user_id):
    """Get all alerts for a user"""
    alerts = PriceAlert.query.filter_by(user_id=user_id).all()
    return jsonify({
        'success': True, 
        'alerts': [a.to_dict() for a in alerts]
    })

@app.route('/api/alerts/<int:alert_id>', methods=['PUT'])
def update_alert(alert_id):
    """Update an alert (activate/deactivate/edit)"""
    alert = PriceAlert.query.get(alert_id)
    
    if 'is_active' in data:
        alert.is_active = data['is_active']
    if 'target_price' in data:
        alert.target_price = data['target_price']
    
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/alerts/<int:alert_id>', methods=['DELETE'])
def delete_alert(alert_id):
    """Delete an alert"""
    alert = PriceAlert.query.get(alert_id)
    db.session.delete(alert)
    db.session.commit()
```

### 3. Background Task (Price Monitor)

```python
asks.py or in app.py

def# backend/t check_price_alerts():
    """Run periodically to check price alerts"""
    
    # Get all active alerts
    active_alerts = PriceAlert.query.filter_by(is_active=True).all()
    
    for alert in active_alerts:
        # Get current price
        current_price = prediction_service.get_current_price(
            alert.commodity, 
            alert.district or 'Kolar',
            alert.market or 'Main Market'
        )
        
        # Check if alert should trigger
        should_trigger = False
        
        if alert.alert_type == 'above' and current_price >= alert.target_price:
            should_trigger = True
        elif alert.alert_type == 'below' and current_price <= alert.target_price:
            should_trigger = True
        
        if should_trigger:
            # Send notification
            send_alert_notification(alert, current_price)
            
            # Mark alert as triggered
            alert.triggered_at = datetime.utcnow()
            alert.is_active = False  # Or keep active for continuous monitoring
            db.session.commit()

# Schedule this task to run every hour
from apscheduler.schedulers.background import BackgroundScheduler
scheduler = BackgroundScheduler()
scheduler.add_job(check_price_alerts, 'interval', hours=1)
scheduler.start()
```

### 4. Notification System

```python
def send_alert_notification(alert, current_price):
    """Send notification to user"""
    
    user = User.query.get(alert.user_id)
    
    # Prepare message
    if alert.alert_type == 'above':
        message = f"Price Alert! {alert.commodity} has risen to ₹{current_price}/quintal (Target: ₹{alert.target_price})"
    else:
        message = f"Price Alert! {alert.commodity} has dropped to ₹{current_price}/quintal (Target: ₹{alert.target_price})"
    
    # Email notification
    if alert.notify_email:
        send_email(user.email, "Price Alert", message)
    
    # SMS notification (if enabled)
    if alert.notify_sms:
        send_sms(user.phone, message)
    
    # Push notification (web push)
    if alert.notify_push:
        send_push_notification(user, message)
    
    # Log activity
    log_activity(user.id, user.username, 'price_alert', message)
```

### 5. Frontend UI (Add to Dashboard)

```javascript
// frontend/script.js - Add UI components

// Show alerts section in user dashboard
function showAlertsSection() {
    return `
        <section id="user-section-alerts" class="p-6">
            <h2 class="text-2xl font-bold text-gray-800 mb-6">Price Alerts</h2>
            
            <!-- Create Alert Form -->
            <div class="bg-white rounded-2xl p-6 shadow-lg mb-6">
                <h3 class="text-lg font-bold mb-4">Create New Alert</h3>
                <form id="create-alert-form" onsubmit="createAlert(event)">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <select id="alert-commodity" required>
                            <option value="">Select Commodity</option>
                            <option value="Maize">Maize</option>
                            <option value="Paddy">Paddy</option>
                            <option value="Wheat">Wheat</option>
                            <option value="Sugarcane">Sugarcane</option>
                        </select>
                        
                        <select id="alert-district">
                            <option value="Kolar">Kolar</option>
                            <option value="Chikkabalpura">Chikkabalpura</option>
                            <option value="Bangalore Rural">Bangalore Rural</option>
                        </select>
                        
                        <select id="alert-type" required>
                            <option value="above">Alert when price rises ABOVE target</option>
                            <option value="below">Alert when price falls BELOW target</option>
                        </select>
                        
                        <input type="number" id="alert-target-price" 
                               placeholder="Target Price (₹)" required>
                        
                        <label class="flex items-center gap-2">
                            <input type="checkbox" id="alert-email" checked>
                            <span>Email Notification</span>
                        </label>
                    </div>
                    <button type="submit" class="mt-4 py-3 bg-emerald-600 text-white rounded-xl">
                        Create Alert
                    </button>
                </form>
            </div>
            
            <!-- Active Alerts List -->
            <div class="bg-white rounded-2xl p-6 shadow-lg">
                <h3 class="text-lg font-bold mb-4">Your Active Alerts</h3>
                <div id="alerts-list"></div>
            </div>
        </section>
    `;
}

// Load and display user's alerts
async function loadUserAlerts() {
    const userId = currentUser?.id;
    if (!userId) return;
    
    const response = await fetch(`/api/alerts/${userId}`);
    const data = await response.json();
    
    if (data.success) {
        displayAlerts(data.alerts);
    }
}
```

---

## Alert Types

### 1. Price Above Alert (Most Popular)
```
Scenario: Farmer wants to sell when price is high

Settings:
- Commodity: Wheat
- Target Price: ₹2,500/quintal
- Alert Type: ABOVE

Trigger: When Wheat price ≥ ₹2,500/quintal

Use Case: "I want to sell my wheat when it reaches ₹2,500 or more"
```

### 2. Price Below Alert (For Buyers)
```
Scenario: Buyer wants to buy when price drops

Settings:
- Commodity: Maize  
- Target Price: ₹1,800/quintal
- Alert Type: BELOW

Trigger: When Maize price ≤ ₹1,800/quintal

Use Case: "I want to buy maize when it falls below ₹1,800"
```

---

## User Experience

### Dashboard View
```
┌─────────────────────────────────────────────────┐
│  💰 Price Alerts                               │
├─────────────────────────────────────────────────┤
│                                                 │
│  🌽 Maize - Kolar                              │
│  Current: ₹2,150    Target: ₹2,300 (Above)     │
│  Status: 🔔 Active    [Edit] [Delete]          │
│                                                 │
│  🌾 Paddy - Bangalore Rural                    │
│  Current: ₹1,940    Target: ₹2,000 (Above)     │
│  Status: ✅ Triggered   [View]                 │
│                                                 │
│  + Create New Alert                            │
└─────────────────────────────────────────────────┘
```

### Notification
```
┌────────────────────────────────────┐
│  📢 Price Alert!                   │
│                                    │
│  Maize in Kolar has reached        │
│  ₹2,320/quintal!                   │
│                                    │
│  Your target was ₹2,300            │
│  ✅ Time to sell!                  │
│                                    │
│  [View Details] [Dismiss]         │
└────────────────────────────────────┘
```

---

## Benefits for Farmers

| Benefit | Explanation |
|---------|-------------|
| ⏰ Save Time | No need to check prices daily |
| 💰 Better Prices | Sell at optimal price point |
| 🔔 Never Miss Opportunity | Instant notifications |
| 📊 Data-Driven | Based on historical trends |
| 📱 Flexible | Choose notification method |

---

## Implementation Complexity

| Component | Complexity | Time Estimate |
|-----------|------------|---------------|
| Database Model | Low | 1 hour |
| API Endpoints | Low | 2 hours |
| Background Task | Medium | 3 hours |
| Notifications | Medium | 4 hours |
| Frontend UI | Medium | 4 hours |
| **Total** | | **~14 hours** |

---

## Quick Start Implementation

If you want to implement this feature, here's the order:

1. **Add PriceAlert model** to `backend/models.py`
2. **Create API endpoints** in `backend/app.py`
3. **Add background scheduler** for price checking
4. **Add notification function** (start with email)
5. **Create frontend UI** in `frontend/script.js`
6. **Add to navigation** in user dashboard

The system can start simple and be enhanced over time with SMS, push notifications, and more sophisticated price prediction triggers.

