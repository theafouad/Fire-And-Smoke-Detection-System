import uvicorn

from apps.api.core.config import get_settings


if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run("apps.api.main:app", host="0.0.0.0", port=8000, reload=settings.environment == "development")
