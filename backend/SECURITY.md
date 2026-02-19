# Backend Security Baseline

This project uses a shared endpoint-hardening pattern so new routes follow one secure style by default.

## 1. Reusable guards (mandatory)

Use dependencies from `security/guards.py`:

- `get_authenticated_user_dependency`
- `get_active_user_dependency`
- `get_admin_user_dependency`

Pattern:

- baseline authn + rate limit comes from guard dependency
- endpoint-specific authorization is added on top (resource ownership, domain-specific rules)

## 2. Rate limiting (mandatory)

`security/rate_limit.py` provides in-memory sliding-window controls:

- public endpoints: per-IP
- authenticated endpoints: per-user
- admin endpoints: stricter per-user limit

Config keys in `backend/.env`:

- `RATE_LIMIT_ENABLED`
- `RATE_LIMIT_PUBLIC_PER_MINUTE`
- `RATE_LIMIT_AUTHENTICATED_PER_MINUTE`
- `RATE_LIMIT_ADMIN_PER_MINUTE`
- `RATE_LIMIT_WEBHOOK_PER_MINUTE`

## 3. OWASP-aligned baseline

- **Authentication**: JWT token verification in `get_current_user_dependency`.
- **Authorization**: deny-by-default via `active/admin` guards and endpoint-level ownership checks.
- **Input validation**: FastAPI/Pydantic schemas (`Path/Query/Field`) with strict bounds.
- **Injection resistance**: SQLAlchemy ORM query construction (no string-concatenated SQL in routers).
- **Information disclosure**: sensitive foreign-resource checks return `404` where appropriate.
- **Redirect safety**: checkout endpoints validate return/cancel URLs against configured frontend origin.

## 4. New endpoint checklist

1. Start with a shared guard dependency (`active` or `admin`).
2. Add object-level authorization (owner/admin/404-on-foreign).
3. Add strict request validation (`Path`, `Query`, `Field` constraints).
4. Add abuse-path tests (`401/403/404/429`) plus happy-path test.
5. Keep using SQLAlchemy expressions; avoid raw SQL unless parameterized and justified.
