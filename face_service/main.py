"""
KarigarConnect Face Verification Service
FastAPI + InsightFace (ArcFace + RetinaFace)

Endpoints:
  POST /extract-embedding   — detect face in image, return 512-dim ArcFace embedding
  POST /compare             — cosine similarity between two embeddings
  POST /check-duplicate     — compare against a batch of stored embeddings
  GET  /health              — health check
"""

import logging
import os
import shutil
import urllib.request
import zipfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List, Optional

import cv2
import numpy as np
import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("face_service")

# Keep CPU runtime memory predictable on low-memory hosts (Render free tier, etc.).
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("NUMEXPR_NUM_THREADS", "1")
os.environ.setdefault("ORT_NUM_THREADS", "1")

# ── InsightFace model (loaded once on startup) ────────────────────────────────

# Single shared model instance (loaded eagerly at startup)
face_analyzer = None
loaded_model_name = None
startup_error = None

INSIGHTFACE_MODEL_ROOT = Path(os.path.expanduser(os.getenv("INSIGHTFACE_MODEL_ROOT", "~/.insightface/models")))
INSIGHTFACE_MODEL_PACK = os.getenv("INSIGHTFACE_MODEL_PACK", "buffalo_sc")
INSIGHTFACE_MODEL_BASE_URL = os.getenv(
    "INSIGHTFACE_MODEL_BASE_URL",
    "https://github.com/deepinsight/insightface/releases/download/v0.7",
)
INSIGHTFACE_DET_SIZE = int(os.getenv("INSIGHTFACE_DET_SIZE", "160"))


def model_pack_has_onnx(model_name: str) -> bool:
    return any((INSIGHTFACE_MODEL_ROOT / model_name).glob("*.onnx"))


def normalize_model_pack_layout(model_name: str) -> None:
    """Normalize extracted model files into ~/.insightface/models/<model_name>/*.onnx."""
    pack_dir = INSIGHTFACE_MODEL_ROOT / model_name
    nested_pack_dir = pack_dir / model_name

    # Some archives extract as <root>/<model_name>/<model_name>/*.onnx
    if nested_pack_dir.exists() and any(nested_pack_dir.glob("*.onnx")) and not model_pack_has_onnx(model_name):
        pack_dir.mkdir(parents=True, exist_ok=True)
        for item in nested_pack_dir.iterdir():
            target = pack_dir / item.name
            if target.exists():
                continue
            shutil.move(str(item), str(target))
        try:
            nested_pack_dir.rmdir()
        except OSError:
            pass

    # Some archives extract ONNX files directly into ~/.insightface/models
    if not model_pack_has_onnx(model_name):
        root_onnx = list(INSIGHTFACE_MODEL_ROOT.glob("*.onnx"))
        if root_onnx:
            pack_dir.mkdir(parents=True, exist_ok=True)
            for onnx in root_onnx:
                target = pack_dir / onnx.name
                if target.exists():
                    continue
                shutil.move(str(onnx), str(target))


def download_model_pack(model_name: str) -> None:
    INSIGHTFACE_MODEL_ROOT.mkdir(parents=True, exist_ok=True)
    normalize_model_pack_layout(model_name)
    if model_pack_has_onnx(model_name):
        log.info("InsightFace model pack already present: %s", model_name)
        return

    url = f"{INSIGHTFACE_MODEL_BASE_URL}/{model_name}.zip"
    zip_path = INSIGHTFACE_MODEL_ROOT / f"{model_name}.zip"
    log.info("Downloading InsightFace model pack: %s", url)
    urllib.request.urlretrieve(url, zip_path)

    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(INSIGHTFACE_MODEL_ROOT)

    normalize_model_pack_layout(model_name)

    try:
        zip_path.unlink(missing_ok=True)
    except OSError:
        pass

    if not model_pack_has_onnx(model_name):
        raise RuntimeError(
            f"Downloaded {model_name} but no .onnx files were found under "
            f"{INSIGHTFACE_MODEL_ROOT / model_name}"
        )


def sanitize_model_pack_for_legacy_router(model_name: str) -> None:
    """Move ONNX files unsupported by insightface 0.2.1 router out of the active pack."""
    pack_dir = INSIGHTFACE_MODEL_ROOT / model_name
    if not pack_dir.exists():
        return

    try:
        from insightface.model_zoo import model_zoo
    except Exception:
        return

    unsupported_dir = pack_dir / "_unsupported"
    moved = []
    for onnx_file in pack_dir.glob("*.onnx"):
        try:
            model_zoo.get_model(str(onnx_file))
        except Exception:
            unsupported_dir.mkdir(parents=True, exist_ok=True)
            target = unsupported_dir / onnx_file.name
            if target.exists():
                target.unlink()
            shutil.move(str(onnx_file), str(target))
            moved.append(onnx_file.name)

    if moved:
        log.info(
            "Moved %d unsupported ONNX files to %s: %s",
            len(moved),
            unsupported_dir,
            ", ".join(moved),
        )


def init_face_analyzer(model_candidates=None):
    from insightface.app import FaceAnalysis

    if model_candidates is None:
        # Keep a strict candidate list to avoid accidentally loading larger model packs.
        model_candidates = [INSIGHTFACE_MODEL_PACK]
    model_candidates = list(dict.fromkeys(model_candidates))
    errors = []

    for model_name in model_candidates:
        sanitize_model_pack_for_legacy_router(model_name)
        try:
            analyzer = FaceAnalysis(
                name=model_name,
                allowed_modules=["detection", "recognition"],
                providers=["CPUExecutionProvider"],
            )
            analyzer.prepare(ctx_id=-1, det_size=(INSIGHTFACE_DET_SIZE, INSIGHTFACE_DET_SIZE))
            return analyzer, model_name
        except TypeError:
            # Older InsightFace releases use a smaller constructor and local model files.
            try:
                analyzer = FaceAnalysis(name=model_name)
                analyzer.prepare(ctx_id=-1, det_size=(INSIGHTFACE_DET_SIZE, INSIGHTFACE_DET_SIZE))
                return analyzer, model_name
            except Exception as exc:
                errors.append(f"{model_name}: {exc!r}")
        except Exception as exc:
            errors.append(f"{model_name}: {exc!r}")

    raise RuntimeError(
        "Unable to initialize InsightFace with any model pack. "
        "If using insightface 0.2.1 on Windows, ensure ONNX files exist under "
        "~/.insightface/models/<model_name>/ . Details: "
        + " | ".join(errors)
    )


def load_models_on_startup():
    global face_analyzer, loaded_model_name, startup_error
    try:
        face_analyzer, loaded_model_name = init_face_analyzer([INSIGHTFACE_MODEL_PACK])
        startup_error = None
        log.info("InsightFace model loaded (model pack: %s)", loaded_model_name)
    except Exception as exc:
        log.warning("InsightFace model load failed: %s", exc)
        try:
            download_model_pack(INSIGHTFACE_MODEL_PACK)
            face_analyzer, loaded_model_name = init_face_analyzer([INSIGHTFACE_MODEL_PACK])
            startup_error = None
            log.info("InsightFace model loaded after auto-download (model pack: %s)", loaded_model_name)
        except Exception as retry_exc:
            face_analyzer = None
            loaded_model_name = None
            startup_error = str(retry_exc)
            log.exception("Failed to load InsightFace model after auto-download")


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_models_on_startup()
    yield


app = FastAPI(title="KarigarConnect Face Service", version="1.0.0", lifespan=lifespan)

# Allow calls from Node.js backend only (adjust origins for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("NODE_ORIGIN", "http://localhost:5000"),
        "http://localhost:3000",
        "http://127.0.0.1:5000",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def bytes_to_bgr(data: bytes) -> Optional[np.ndarray]:
    """Decode raw image bytes → OpenCV BGR ndarray."""
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img  # None if decoding fails


def extract_face_embedding(img_bgr: np.ndarray):
    """
    Run face detection + ArcFace embedding on a BGR image.
    Returns (embedding: ndarray[512], det_score: float) or (None, None).
    """
    analyzer = face_analyzer
    if analyzer is None:
        raise RuntimeError("Face models not loaded")
    faces = analyzer.get(img_bgr)
    if not faces:
        return None, None
    # Pick the largest detected face (most likely the subject)
    best = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    return best.embedding, float(best.det_score)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    a = a / (np.linalg.norm(a) + 1e-9)
    b = b / (np.linalg.norm(b) + 1e-9)
    return float(np.dot(a, b))


# ── Request / Response models ─────────────────────────────────────────────────

class CompareRequest(BaseModel):
    embedding1: List[float]
    embedding2: List[float]


class DuplicateRequest(BaseModel):
    embedding: List[float]
    stored_embeddings: List[List[float]]
    threshold: float = 0.85   # 0.85 → very strict duplicate detection for clients


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    analyzer = face_analyzer
    return {
        "status": "ok",
        "models_loaded": analyzer is not None,
        "model": loaded_model_name,
        "startup_error": startup_error,
    }


@app.post("/extract-embedding")
async def extract_embedding(image: UploadFile = File(...)):
    """
    Detect face in uploaded image → generate 512-dim ArcFace embedding.
    Accepts: JPEG, PNG, WebP
    """
    analyzer = face_analyzer
    if analyzer is None:
        detail = "Face models not loaded."
        if startup_error:
            detail = f"Face models not loaded: {startup_error}"
        raise HTTPException(503, detail)

    raw = await image.read()
    img = bytes_to_bgr(raw)
    if img is None:
        raise HTTPException(400, "Could not decode image. Send a valid JPEG/PNG.")

    try:
        embedding, score = extract_face_embedding(img)
    except Exception as exc:
        raise HTTPException(500, f"Face processing error: {exc}")

    if embedding is None:
        return {
            "face_detected": False,
            "embedding": None,
            "detection_score": None,
            "message": "No face detected. Ensure the image is well-lit with a clear front-facing face.",
        }

    return {
        "face_detected": True,
        "embedding": embedding.tolist(),
        "detection_score": score,
        "message": "Face detected successfully",
    }


@app.post("/compare")
def compare_faces(req: CompareRequest):
    """
    Compare two ArcFace embeddings.
    Returns similarity score (0-1) and match decision.
    Threshold 0.60 is used for ID-vs-live comparison (workers).
    """
    try:
        e1 = np.array(req.embedding1, dtype=np.float32)
        e2 = np.array(req.embedding2, dtype=np.float32)
        sim = cosine_similarity(e1, e2)
        return {
            "similarity": round(sim, 4),
            "match": sim >= 0.60,
            "confidence": "high" if sim >= 0.75 else "medium" if sim >= 0.60 else "low",
        }
    except Exception as exc:
        raise HTTPException(500, str(exc))


@app.post("/check-duplicate")
def check_duplicate(req: DuplicateRequest):
    """
    Compare a new embedding against all stored embeddings.
    Returns max similarity and whether a duplicate is found.
    Threshold default 0.85 → strict for clients.
    """
    if not req.stored_embeddings:
        return {"max_similarity": 0.0, "is_duplicate": False}
    try:
        new_emb = np.array(req.embedding, dtype=np.float32)
        max_sim = 0.0
        for stored in req.stored_embeddings:
            sim = cosine_similarity(new_emb, np.array(stored, dtype=np.float32))
            if sim > max_sim:
                max_sim = sim
        return {
            "max_similarity": round(max_sim, 4),
            "is_duplicate": max_sim >= req.threshold,
        }
    except Exception as exc:
        raise HTTPException(500, str(exc))


# ── Entry ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("PORT", os.getenv("FACE_SERVICE_PORT", 8001)))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
