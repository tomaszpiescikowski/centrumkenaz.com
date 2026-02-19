import os
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from models.user import User
from security.guards import get_admin_user_dependency

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "static" / "uploads"
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    _admin: User = Depends(get_admin_user_dependency),
) -> dict[str, str]:
    """
    Upload an image file for use in the application.

    This endpoint validates MIME type and size, stores the file in the static
    uploads directory, and returns a relative URL for the saved image.
    """
    if not file.content_type or file.content_type.lower() not in ALLOWED_IMAGE_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Only image uploads are allowed")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        ext = ".jpg"

    name = f"{uuid4().hex}{ext}"
    path = UPLOAD_DIR / name

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty upload")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large")

    with open(path, "wb") as out:
        out.write(content)

    return {"url": f"/uploads/{name}"}
