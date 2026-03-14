"""
Server-side input validators for AgriPredict.
Used in auth routes to enforce data integrity independent of client-side checks.
"""
import re

# ── Email ──────────────────────────────────────────────────────────────────
EMAIL_REGEX = re.compile(
    r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$'
)

def validate_email(email: str) -> tuple[bool, str]:
    """
    Returns (True, "") if valid, (False, reason) if invalid.
    Checks:
      - not empty
      - standard RFC-5322-ish regex
      - no consecutive dots
      - domain has at least one dot
    """
    if not email or not email.strip():
        return False, "Email is required."
    email = email.strip().lower()
    if len(email) > 254:
        return False, "Email is too long."
    if not EMAIL_REGEX.match(email):
        return False, "Email format is invalid (e.g. user@example.com)."
    local, domain = email.rsplit('@', 1)
    if '..' in local or '..' in domain:
        return False, "Email must not contain consecutive dots."
    if '.' not in domain:
        return False, "Email domain must contain at least one dot."
    return True, ""


# ── Password ───────────────────────────────────────────────────────────────
def validate_password(password: str) -> tuple[bool, str]:
    """
    Returns (True, "") if valid, (False, reason) if invalid.
    Checks:
      - minimum 8 characters
      - at least one uppercase letter
      - at least one lowercase letter
      - at least one digit
      - at least one special character
    """
    if not password:
        return False, "Password is required."
    errors = []
    if len(password) < 8:
        errors.append("at least 8 characters")
    if not re.search(r'[A-Z]', password):
        errors.append("one uppercase letter")
    if not re.search(r'[a-z]', password):
        errors.append("one lowercase letter")
    if not re.search(r'[0-9]', password):
        errors.append("one digit")
    if not re.search(r'[!@#$%^&*()_+\-=\[\]{};\':"|,.<>\/?`~]', password):
        errors.append("one special character (!@#$...)")  
    if errors:
        return False, f"Password must contain: {', '.join(errors)}."
    return True, ""


# ── Phone ──────────────────────────────────────────────────────────────────
def validate_phone(phone: str) -> tuple[bool, str]:
    """
    Returns (True, cleaned_phone) if valid, (False, reason) if not.
    Accepts exactly 10 digits (strips spaces and dashes).
    """
    if not phone:
        return False, "Phone number is required."
    cleaned = re.sub(r'[\s\-]', '', phone)
    if not cleaned.isdigit() or len(cleaned) != 10:
        return False, "Phone number must be exactly 10 digits."
    return True, cleaned
