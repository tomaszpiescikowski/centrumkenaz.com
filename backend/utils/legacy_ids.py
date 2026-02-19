"""Helpers for compatibility with legacy databases using integer IDs."""

from sqlalchemy import String, cast


def normalize_legacy_id(value: object) -> str:
    """Return a normalized string representation of an identifier value."""
    return str(value).strip()


def legacy_id_eq(column, value: object):
    """Compare an identifier column against a value via string cast.

    This keeps queries compatible with deployments where DB columns are still
    INTEGER while SQLAlchemy models already declare String IDs.
    """
    return cast(column, String) == normalize_legacy_id(value)


def optional_str_id(value: object | None) -> str | None:
    """Convert identifier to string, preserving None."""
    if value is None:
        return None
    return str(value)

