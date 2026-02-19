"""Reusable authentication/authorization dependencies for endpoint hardening."""


from typing import Annotated

from fastapi import Depends, HTTPException

from config import get_settings
from models.user import AccountStatus, User, UserRole
from routers.auth import get_current_user_dependency
from security.rate_limit import enforce_rate_limit

settings = get_settings()


async def get_authenticated_user_dependency(
    user: User = Depends(get_current_user_dependency),
) -> User:
    """
    Return an authenticated user and apply the baseline rate limit.

    The dependency enforces the authenticated-user rate limit using the user ID
    as the identifier before returning the verified user.
    """
    enforce_rate_limit(
        scope="authenticated",
        identifier=f"user:{user.id}",
        per_minute=settings.rate_limit_authenticated_per_minute,
    )
    return user


async def get_active_user_dependency(
    user: User = Depends(get_authenticated_user_dependency),
) -> User:
    """
    Return an authenticated user that is approved and active.

    The dependency rejects pending accounts with a 403 to enforce approval
    requirements before allowing access to protected endpoints.
    """
    if user.account_status != AccountStatus.ACTIVE:
        raise HTTPException(status_code=403, detail="Account pending admin approval")
    return user


async def get_admin_user_dependency(
    user: User = Depends(get_active_user_dependency),
) -> User:
    """
    Return an active admin user and apply the stricter admin rate limit.

    The dependency enforces the admin rate limit first, then checks the role and
    raises a 403 if the user lacks admin privileges.
    """
    enforce_rate_limit(
        scope="admin",
        identifier=f"user:{user.id}",
        per_minute=settings.rate_limit_admin_per_minute,
    )
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


AuthenticatedUser = Annotated[User, Depends(get_authenticated_user_dependency)]
ActiveUser = Annotated[User, Depends(get_active_user_dependency)]
AdminUser = Annotated[User, Depends(get_admin_user_dependency)]
