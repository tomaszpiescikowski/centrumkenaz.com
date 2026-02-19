# Backend testing

## Run tests

From `/workspace/backend`:

```bash
pytest
```

This runs async tests and enforces coverage gate configured in `pytest.ini`:
- coverage report in terminal (`term-missing`)
- minimum total coverage: `65%`

## Security Regression Checklist (before merge)

For every auth/permissions/business-rule change, verify at least:

1. `401` for anonymous access to protected endpoints.
2. `403` for authenticated but not approved (`account_status != active`) when approval is required.
3. Ownership/admin checks for resource-specific endpoints (no IDOR).
4. No bypass via direct URL, relogin, refresh token flow, or alternate endpoint path.
5. Add regression tests for the exact reported loophole.

## Run a single file

```bash
pytest tests/test_api_admin_events.py
```

## CI recommendation

Use the same command as local to keep parity:

```bash
cd backend
pytest
```

## Recommended local flow

1. Run changed tests quickly:

```bash
pytest tests/<changed_file>.py
```

2. Run full suite with coverage gate:

```bash
pytest
```
