"""
Django settings for the FSKTM PG Office backend.

Configuration is read from ``backend/.env`` (see ``.env.example``). The app
serves a JSON auth API for the React frontend and a Django admin for managing
user accounts.
"""

from datetime import timedelta
from pathlib import Path

from corsheaders.defaults import default_headers
from dotenv import load_dotenv
from django.core.exceptions import ImproperlyConfigured
import os

from .production_security import (
    DEVELOPMENT_SECRET_KEY,
    validate_production_environment,
)

BASE_DIR = Path(__file__).resolve().parent.parent

# Load backend/.env (no-op if the file is absent; sensible defaults below).
load_dotenv(BASE_DIR / ".env")


def env_bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


def env_list(name: str, default: str) -> list[str]:
    raw_value = os.getenv(name, "").strip() or default
    return [item.strip() for item in raw_value.split(",") if item.strip()]


def env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


# Core
DEBUG = env_bool("DJANGO_DEBUG", True)
configured_secret_key = os.getenv("DJANGO_SECRET_KEY", "").strip()
SECRET_KEY = configured_secret_key or (DEVELOPMENT_SECRET_KEY if DEBUG else "")
ALLOWED_HOSTS = env_list(
    "DJANGO_ALLOWED_HOSTS",
    "localhost,127.0.0.1" if DEBUG else "",
)
CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000" if DEBUG else "",
)
CORS_EXPOSE_HEADERS = (
    "X-Total-Count",
    "X-Limit",
    "X-Offset",
)
CORS_ALLOW_HEADERS = (*default_headers, "x-portal-tab")

if not DEBUG:
    validate_production_environment(
        secret_key=SECRET_KEY,
        allowed_hosts=ALLOWED_HOSTS,
        cors_origins=CORS_ALLOWED_ORIGINS,
    )

    SECURE_SSL_REDIRECT = True
    SECURE_HSTS_SECONDS = max(env_int("DJANGO_SECURE_HSTS_SECONDS", 3600), 0)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool(
        "DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS", False
    )
    SECURE_HSTS_PRELOAD = env_bool("DJANGO_SECURE_HSTS_PRELOAD", False)
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Strict"
    CSRF_COOKIE_SECURE = True
    CSRF_COOKIE_HTTPONLY = True
    CSRF_COOKIE_SAMESITE = "Strict"
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "same-origin"
    X_FRAME_OPTIONS = "DENY"

    if env_bool("DJANGO_TRUST_X_FORWARDED_PROTO", False):
        SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Demo fixtures are opt-in even during local development. Passwords intentionally
# have no fallback so seed_users cannot create known credentials by accident.
ENABLE_DEMO_ACCOUNTS = env_bool("ENABLE_DEMO_ACCOUNTS", False)
DEMO_ADMIN_PASSWORD = os.getenv("DEMO_ADMIN_PASSWORD", "")
DEMO_COORDINATOR_PASSWORD = os.getenv("DEMO_COORDINATOR_PASSWORD", "")
DEMO_LECTURER_PASSWORD = os.getenv("DEMO_LECTURER_PASSWORD", "")
DEMO_STUDENT_PASSWORD = os.getenv("DEMO_STUDENT_PASSWORD", "")
DEMO_LEGACY_EMAIL_MAP = os.getenv("DEMO_LEGACY_EMAIL_MAP", "")

# Where the React app is served. Used to build password-reset links.
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

AUTH_USER_MODEL = "accounts.User"

INSTALLED_APPS = [
    "config.admin.TechnicalAdminConfig",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third-party
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    # local
    "accounts",
    "academics",
    "appointments",
    "dashboard",
    "marks",
    "letters",
    "announcements",
    "documents",
    "faq",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Database (PostgreSQL, reusing the same fsktm_pg_office DB / PG* vars)
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("PGDATABASE", "fsktm_pg_office"),
        "USER": os.getenv("PGUSER", "postgres"),
        "PASSWORD": os.getenv("PGPASSWORD", "postgres"),
        "HOST": os.getenv("PGHOST", "localhost"),
        "PORT": os.getenv("PGPORT", "5432"),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kuala_Lumpur"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Media (announcement attachments and other uploaded files)
# Files are served only through permission-checked API endpoints (e.g.
# /api/announcements/<id>/attachment/), so MEDIA_URL is not exposed publicly.
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# Production workers share throttle history in the configured PostgreSQL DB.
# Run createcachetable before starting them; development can opt in to exercise
# the same backend. Reject typos and process-local production configuration.
cache_backend = os.getenv("DJANGO_CACHE_BACKEND", "").strip().lower()
cache_backend = cache_backend or ("locmem" if DEBUG else "database")
if cache_backend not in ("locmem", "database") or (not DEBUG and cache_backend == "locmem"):
    raise ImproperlyConfigured(
        "DJANGO_CACHE_BACKEND must be database in production; development also supports locmem."
    )
CACHES = {
    "default": {
        "BACKEND": (
            "django.core.cache.backends.db.DatabaseCache" if cache_backend == "database"
            else "django.core.cache.backends.locmem.LocMemCache"
        ),
        "LOCATION": "fsktm_api_cache" if cache_backend == "database" else "fsktm-pg-office-api",
        "OPTIONS": {"MAX_ENTRIES": 10000},
    }
}

# Announcement attachments are validated for size, extension, and magic bytes
# before they are stored. Reverse proxies should cap request bodies slightly
# above this so oversized uploads are rejected before reaching Django workers.
ANNOUNCEMENT_MAX_ATTACHMENT_BYTES = env_int(
    "ANNOUNCEMENT_MAX_ATTACHMENT_BYTES", 10 * 1024 * 1024
)
# File Management uploads. Raising this also means raising the reverse
# proxy's request body limit.
DOCUMENT_MAX_UPLOAD_BYTES = env_int("DOCUMENT_MAX_UPLOAD_BYTES", 10 * 1024 * 1024)
DOCUMENT_UPLOAD_THROTTLE_RATE = os.getenv("DOCUMENT_UPLOAD_THROTTLE_RATE", "100/hour")

AUTH_LOGIN_THROTTLE_RATE = os.getenv("AUTH_LOGIN_THROTTLE_RATE", "10/minute")
AUTH_LOGIN_IDENTIFIER_THROTTLE_RATE = os.getenv(
    "AUTH_LOGIN_IDENTIFIER_THROTTLE_RATE", "30/hour"
)
AUTH_PASSWORD_RESET_THROTTLE_RATE = os.getenv(
    "AUTH_PASSWORD_RESET_THROTTLE_RATE", "5/hour"
)
AUTH_PASSWORD_RESET_CONFIRM_THROTTLE_RATE = os.getenv(
    "AUTH_PASSWORD_RESET_CONFIRM_THROTTLE_RATE", "10/hour"
)
# Opening an activation or reset link checks it before the form is shown.
AUTH_PASSWORD_LINK_CHECK_THROTTLE_RATE = os.getenv(
    "AUTH_PASSWORD_LINK_CHECK_THROTTLE_RATE", "30/hour"
)
# Signed-in password change. Separate scope from reset-confirm, and keyed on the
# account rather than the IP, so shared networks cannot exhaust each other.
AUTH_CHANGE_PASSWORD_THROTTLE_RATE = os.getenv(
    "AUTH_CHANGE_PASSWORD_THROTTLE_RATE", "10/hour"
)
# Office-sent activation or reset links, counted per student account.
REGISTRY_ACCESS_LINK_THROTTLE_RATE = os.getenv(
    "REGISTRY_ACCESS_LINK_THROTTLE_RATE", "3/hour"
)
# Activation emails sent later for a whole import, counted per import.
REGISTRY_BATCH_INVITE_THROTTLE_RATE = os.getenv(
    "REGISTRY_BATCH_INVITE_THROTTLE_RATE", "3/hour"
)
# A bulk import fills a missing student email as <Student ID>@<this domain>:
# every student has SiswaMail, and its username is the Student ID.
REGISTRY_STUDENT_EMAIL_DOMAIN = os.getenv(
    "REGISTRY_STUDENT_EMAIL_DOMAIN", "siswa.um.edu.my"
)

# FAQ chatbot (UC28). "hybrid" adds a small multilingual meaning model to the
# keyword search; "keywords" never loads it. If the model cannot be loaded,
# the chatbot falls back to keywords by itself.
FAQ_SEARCH = os.getenv("FAQ_SEARCH", "hybrid")
FAQ_MODEL = os.getenv("FAQ_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
FAQ_MODEL_CACHE = os.getenv("FAQ_MODEL_CACHE", str(BASE_DIR / "faq_model_cache"))
FAQ_ENCODER = os.getenv("FAQ_ENCODER", "faq.encoder.FastEmbedEncoder")
# How sure the search must be to answer, or to offer choices. Measured on
# docs/faq/evaluation-set.json (evaluate_faq): the most right answers with at
# most 2 wrong ones and 90% of off-topic questions refused. Keyword search
# alone scores on another scale, so it has its own pair.
FAQ_STRONG_MATCH = float(os.getenv("FAQ_STRONG_MATCH", "0.69"))
FAQ_POSSIBLE_MATCH = float(os.getenv("FAQ_POSSIBLE_MATCH", "0.42"))
FAQ_KEYWORD_STRONG_MATCH = float(os.getenv("FAQ_KEYWORD_STRONG_MATCH", "0.61"))
FAQ_KEYWORD_POSSIBLE_MATCH = float(os.getenv("FAQ_KEYWORD_POSSIBLE_MATCH", "0.22"))
# A passage from a reference document is shown only above this. It awaits the
# office's real documents to be measured; a short focused passage scored well above it.
FAQ_DOCUMENT_MATCH = float(os.getenv("FAQ_DOCUMENT_MATCH", "0.6"))
FAQ_ASK_THROTTLE_RATE = os.getenv("FAQ_ASK_THROTTLE_RATE", "30/minute")
FAQ_QUESTION_RETENTION_DAYS = int(os.getenv("FAQ_QUESTION_RETENTION_DAYS", "365"))

# Django REST Framework + SimpleJWT
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "accounts.password_policy.PasswordPolicyJWTAuthentication",
    ),
    # APIs are private by default. Authentication endpoints opt into AllowAny.
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    # Do not trust X-Forwarded-For until a known reverse-proxy chain is configured.
    "NUM_PROXIES": max(env_int("DRF_NUM_PROXIES", 0), 0),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=max(env_int("JWT_ACCESS_TOKEN_MINUTES", 15), 1)
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=max(env_int("JWT_REFRESH_TOKEN_DAYS", 7), 1)
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "CHECK_REVOKE_TOKEN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# Without "Remember me" a sign-in ends this long after its last use, and its
# cookie is dropped when the browser closes.
JWT_SESSION_REFRESH_LIFETIME = timedelta(
    hours=max(env_int("JWT_SESSION_REFRESH_HOURS", 12), 1)
)
JWT_REFRESH_COOKIE_NAME = "fsktm_refresh_token"
JWT_REFRESH_COOKIE_PATH = "/api/auth/"
JWT_REFRESH_COOKIE_SECURE = not DEBUG
CORS_ALLOW_CREDENTIALS = True

# Email (real SMTP when creds are set, console backend otherwise)
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")

if EMAIL_HOST_USER and EMAIL_HOST_PASSWORD:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
    EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
    EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
else:
    # No credentials yet: print the email (and reset link) to the runserver console.
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

DEFAULT_FROM_EMAIL = os.getenv(
    "DEFAULT_FROM_EMAIL",
    EMAIL_HOST_USER or "FSKTM PG Office <no-reply@fsktm.edu.my>",
)

# Password-reset links expire after 30 minutes (matches the frontend copy).
# Activation links have no time limit (accounts.tokens).
PASSWORD_RESET_TIMEOUT = 60 * 30
