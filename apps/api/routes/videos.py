from pathlib import Path
import mimetypes
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from apps.api.core.config import get_settings
from apps.api.core.database import get_db
from apps.api.models import Site, VideoAnalysis
from apps.api.schemas import VideoAnalysisDetail, VideoAnalysisRead
from apps.api.services.video_analysis import process_video_analysis

router = APIRouter(prefix="/videos", tags=["video analysis"])
ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}


@router.post("", response_model=VideoAnalysisRead, status_code=status.HTTP_202_ACCEPTED)
async def upload_video(
    background_tasks: BackgroundTasks,
    site_id: str = Form(...),
    video: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> VideoAnalysis:
    site = db.get(Site, site_id)
    if site is None:
        raise HTTPException(status_code=404, detail="Choose an existing site before uploading a video.")
    filename = Path(video.filename or "video").name
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Upload an MP4, MOV, AVI, MKV, WEBM, or M4V video.")

    settings = get_settings()
    settings.video_storage_dir.mkdir(parents=True, exist_ok=True)
    analysis_id = str(uuid4())
    stored_filename = f"{analysis_id}{suffix}"
    destination = settings.video_storage_dir / stored_filename
    max_bytes = settings.video_upload_limit_mb * 1024 * 1024
    written = 0
    try:
        with destination.open("wb") as output:
            while chunk := await video.read(1024 * 1024):
                written += len(chunk)
                if written > max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Video exceeds the {settings.video_upload_limit_mb} MB upload limit.",
                    )
                output.write(chunk)
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    finally:
        await video.close()

    job = VideoAnalysis(
        id=analysis_id,
        site_id=site_id,
        filename=filename,
        stored_filename=stored_filename,
        status="queued",
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    background_tasks.add_task(process_video_analysis, job.id)
    return job


@router.get("/{analysis_id}", response_model=VideoAnalysisDetail)
def get_video_analysis(analysis_id: str, db: Session = Depends(get_db)) -> VideoAnalysis:
    job = db.get(VideoAnalysis, analysis_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Video analysis not found.")
    return job


@router.get("/{analysis_id}/source")
def get_video_source(analysis_id: str, db: Session = Depends(get_db)) -> FileResponse:
    job = db.get(VideoAnalysis, analysis_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Video analysis not found.")
    path = get_settings().video_storage_dir / job.stored_filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Uploaded video file is unavailable.")
    media_type = mimetypes.guess_type(job.filename)[0] or "application/octet-stream"
    return FileResponse(path, media_type=media_type, filename=job.filename, content_disposition_type="inline")
