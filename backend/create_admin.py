import asyncio
import uuid
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

DB_URL = "postgresql+asyncpg://kenaz:kenaz@localhost:5432/kenaz"
PWD_CTX = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


async def main():
    engine = create_async_engine(DB_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    user_id = str(uuid.uuid4())
    email = "admin@test.local"
    full_name = "Test Admin"
    username = "testadmin"
    password_hash = PWD_CTX.hash("Admin1234!")

    async with async_session() as session:
        result = await session.execute(
            text("SELECT id FROM users WHERE email = :email"), {"email": email}
        )
        existing = result.scalar_one_or_none()
        if existing:
            await session.execute(
                text(
                    "UPDATE users SET role = 'admin', account_status = 'active', password_hash = :ph WHERE email = :email"
                ),
                {"ph": password_hash, "email": email},
            )
            print(f"Updated existing user {email} -> admin/active")
        else:
            await session.execute(
                text(
                    """
                    INSERT INTO users (id, email, full_name, username, password_hash, role, account_status)
                    VALUES (:id, :email, :full_name, :username, :ph, 'admin', 'active')
                    """
                ),
                {
                    "id": user_id,
                    "email": email,
                    "full_name": full_name,
                    "username": username,
                    "ph": password_hash,
                },
            )
            print(f"Created admin: {email} / Admin1234!")
        await session.commit()

    await engine.dispose()
    print("Done.")


asyncio.run(main())
