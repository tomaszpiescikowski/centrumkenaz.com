"""Helpers for compatibility with legacy databases using integer IDs."""

from sqlalchemy import String, cast


def normalize_legacy_id(value: object) -> str:
    """
    Return a normalised string representation of an identifier value.

    Strips surrounding whitespace from the string conversion so comparisons
    are not skewed by padding that may exist in legacy data.
    """
    return str(value).strip()


def legacy_id_eq(column, value: object):
    """Compare an identifier column against a value via string cast.

    This keeps queries compatible with deployments where DB columns are still
    INTEGER while SQLAlchemy models already declare String IDs.
    """
    return cast(column, String) == normalize_legacy_id(value)


def optional_str_id(value: object | None) -> str | None:
    """
    Convert an identifier value to a string, preserving None.

    Returns None unchanged so optional foreign key fields handled by
    this helper remain None rather than the string literal 'None'.
    """
    if value is None:
        return None
    return str(value)

