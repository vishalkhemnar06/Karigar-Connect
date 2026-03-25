import json
import logging
import math
import os
import threading
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import faiss
import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("semantic_match_service")

DATA_DIR = Path(os.getenv("SEMANTIC_DATA_DIR", str(Path(__file__).resolve().parent / "data")))
DATA_DIR.mkdir(parents=True, exist_ok=True)

WORKER_INDEX_PATH = DATA_DIR / "workers.index"
JOB_INDEX_PATH = DATA_DIR / "jobs.index"
WORKER_META_PATH = DATA_DIR / "workers_meta.json"
JOB_META_PATH = DATA_DIR / "jobs_meta.json"
FEEDBACK_PATH = DATA_DIR / "feedback_stats.json"

MODEL_NAME = os.getenv("SENTENCE_TRANSFORMER_MODEL", "paraphrase-multilingual-MiniLM-L12-v2")
TOP_K_DEFAULT = int(os.getenv("SEMANTIC_TOP_K_DEFAULT", "30"))

model: Optional[SentenceTransformer] = None
lock = threading.RLock()

worker_vectors: Dict[str, np.ndarray] = {}
job_vectors: Dict[str, np.ndarray] = {}
worker_meta: Dict[str, dict] = {}
job_meta: Dict[str, dict] = {}

worker_index: Optional[faiss.IndexFlatIP] = None
job_index: Optional[faiss.IndexFlatIP] = None
worker_ids_order: List[str] = []
job_ids_order: List[str] = []

feedback_stats = {
    "events": {
        "viewed": 1,
        "invited": 1,
        "applied": 1,
        "hired": 1,
        "completed": 1,
        "rejected": 1,
    },
    "pair_events": {},
}


def normalize_text(text: Optional[str]) -> str:
    return " ".join(str(text or "").strip().lower().split())


def normalize_skill(skill: Optional[str]) -> str:
    s = normalize_text(skill)
    synonyms = {
        "wireman": "electrician",
        "pipe fitter": "plumber",
        "carpenter": "carpentry",
        "mason": "masonry",
        "painter": "painting",
    }
    return synonyms.get(s, s)


def parse_experience_years(value) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(max(0, value))

    text = str(value).lower()
    numbers = []
    current = ""
    for ch in text:
        if ch.isdigit() or ch == ".":
            current += ch
        elif current:
            try:
                numbers.append(float(current))
            except Exception:
                pass
            current = ""
    if current:
        try:
            numbers.append(float(current))
        except Exception:
            pass

    return max(numbers) if numbers else 0.0


def parse_location(loc: Optional[dict]) -> dict:
    loc = loc or {}
    city = normalize_text(loc.get("city"))
    lat = loc.get("lat", loc.get("latitude"))
    lng = loc.get("lng", loc.get("longitude"))
    try:
        lat = float(lat) if lat is not None else None
    except Exception:
        lat = None
    try:
        lng = float(lng) if lng is not None else None
    except Exception:
        lng = None
    return {"city": city, "lat": lat, "lng": lng}


def haversine_km(lat1, lon1, lat2, lon2) -> Optional[float]:
    if None in [lat1, lon1, lat2, lon2]:
        return None

    radius = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def cosine_like(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b))


def build_worker_text(meta: dict) -> str:
    fields = [
        f"Worker: {meta.get('name', '')}",
        f"Role: {meta.get('roleLabel', 'worker')}",
        f"Skills: {', '.join(meta.get('skills', []))}",
        f"Experience years: {meta.get('experienceYears', 0)}",
        f"Experience level: {meta.get('overallExperience', '')}",
        f"City: {meta.get('location', {}).get('city', '')}",
        f"Availability: {'available' if meta.get('availability', False) else 'not available'}",
        f"Verification: {meta.get('verificationStatus', '')}",
        f"Bio: {meta.get('bio', '')}",
    ]
    return ". ".join([f for f in fields if f and str(f).strip()])


def build_job_text(meta: dict) -> str:
    fields = [
        f"Job title: {meta.get('title', '')}",
        f"Category: {meta.get('category', '')}",
        f"Description: {meta.get('description', '')}",
        f"Skills needed: {', '.join(meta.get('skills', []))}",
        f"Workers required: {meta.get('workersRequired', 1)}",
        f"City: {meta.get('location', {}).get('city', '')}",
        f"Budget: {meta.get('payment', 0)}",
        f"Duration: {meta.get('duration', '')}",
        f"Urgent: {'yes' if meta.get('urgent') else 'no'}",
    ]
    return ". ".join([f for f in fields if f and str(f).strip()])


def encode_text(text: str) -> np.ndarray:
    if model is None:
        raise RuntimeError("SentenceTransformer model not loaded")
    emb = model.encode([text], normalize_embeddings=True, convert_to_numpy=True)
    return emb[0].astype("float32")


def save_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=True), encoding="utf-8")


def load_json(path: Path, fallback):
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def persist_indexes() -> None:
    if worker_index is not None:
        faiss.write_index(worker_index, str(WORKER_INDEX_PATH))
    if job_index is not None:
        faiss.write_index(job_index, str(JOB_INDEX_PATH))


def persist_meta() -> None:
    w = {
        "ids": worker_ids_order,
        "meta": worker_meta,
        "vectors": {wid: worker_vectors[wid].tolist() for wid in worker_ids_order if wid in worker_vectors},
    }
    j = {
        "ids": job_ids_order,
        "meta": job_meta,
        "vectors": {jid: job_vectors[jid].tolist() for jid in job_ids_order if jid in job_vectors},
    }
    save_json(WORKER_META_PATH, w)
    save_json(JOB_META_PATH, j)
    save_json(FEEDBACK_PATH, feedback_stats)


def rebuild_faiss_indexes() -> None:
    global worker_index, job_index, worker_ids_order, job_ids_order

    worker_ids_order = list(worker_vectors.keys())
    job_ids_order = list(job_vectors.keys())

    worker_index = None
    if worker_ids_order:
        wmat = np.vstack([worker_vectors[wid] for wid in worker_ids_order]).astype("float32")
        worker_index = faiss.IndexFlatIP(wmat.shape[1])
        worker_index.add(wmat)

    job_index = None
    if job_ids_order:
        jmat = np.vstack([job_vectors[jid] for jid in job_ids_order]).astype("float32")
        job_index = faiss.IndexFlatIP(jmat.shape[1])
        job_index.add(jmat)

    persist_indexes()
    persist_meta()


def load_state() -> None:
    global worker_vectors, job_vectors, worker_meta, job_meta, feedback_stats

    w = load_json(WORKER_META_PATH, {"ids": [], "meta": {}, "vectors": {}})
    j = load_json(JOB_META_PATH, {"ids": [], "meta": {}, "vectors": {}})

    worker_meta = w.get("meta", {})
    job_meta = j.get("meta", {})

    worker_vectors = {
        wid: np.array(vec, dtype="float32") for wid, vec in (w.get("vectors", {}) or {}).items()
    }
    job_vectors = {
        jid: np.array(vec, dtype="float32") for jid, vec in (j.get("vectors", {}) or {}).items()
    }

    feedback = load_json(FEEDBACK_PATH, None)
    if isinstance(feedback, dict) and "events" in feedback:
        feedback_stats.update(feedback)

    rebuild_faiss_indexes()


def clamp01(v: float) -> float:
    return max(0.0, min(1.0, v))


def skill_overlap_score(job_skills: List[str], worker_skills: List[str]) -> Tuple[float, List[str]]:
    js = {normalize_skill(s) for s in (job_skills or []) if normalize_skill(s)}
    ws = {normalize_skill(s) for s in (worker_skills or []) if normalize_skill(s)}
    if not js and not ws:
        return 0.5, []
    if not js:
        return 0.4, []

    inter = sorted(js.intersection(ws))
    union = js.union(ws)
    return (len(inter) / max(1, len(union))), inter


def location_score(job_loc: dict, worker_loc: dict) -> Tuple[float, Optional[float]]:
    jc = normalize_text((job_loc or {}).get("city"))
    wc = normalize_text((worker_loc or {}).get("city"))

    distance = haversine_km(
        (job_loc or {}).get("lat"),
        (job_loc or {}).get("lng"),
        (worker_loc or {}).get("lat"),
        (worker_loc or {}).get("lng"),
    )

    if distance is not None:
        if distance <= 3:
            return 1.0, distance
        if distance <= 8:
            return 0.85, distance
        if distance <= 15:
            return 0.65, distance
        if distance <= 35:
            return 0.4, distance
        return 0.15, distance

    if jc and wc and jc == wc:
        return 0.75, None
    if jc and wc and jc != wc:
        return 0.2, None

    return 0.5, None


def experience_score(job_meta_row: dict, worker_meta_row: dict) -> float:
    needed = parse_experience_years(job_meta_row.get("experienceRequired"))
    has = parse_experience_years(worker_meta_row.get("experienceYears"))

    if needed <= 0:
        return clamp01(0.5 + min(has / 20.0, 0.5))

    if has >= needed:
        return 1.0

    return clamp01(has / max(needed, 1))


def pay_score(job_meta_row: dict, worker_meta_row: dict) -> float:
    payment = float(job_meta_row.get("payment", 0) or 0)
    min_expected = float(worker_meta_row.get("expectedMinPay", 0) or 0)
    max_expected = float(worker_meta_row.get("expectedMaxPay", 0) or 0)

    if min_expected <= 0 and max_expected <= 0:
        return 0.5

    if max_expected > 0 and payment > max_expected:
        return 0.85
    if min_expected > 0 and payment < min_expected:
        ratio = payment / max(min_expected, 1.0)
        return clamp01(ratio)

    return 1.0


def get_dynamic_weights() -> dict:
    events = feedback_stats.get("events", {})
    pos = events.get("applied", 0) + events.get("hired", 0) + events.get("completed", 0)
    neg = events.get("rejected", 0)
    ratio = (pos + 1) / (pos + neg + 2)

    semantic = 0.5 + 0.1 * ratio
    skill = 0.2 + 0.05 * ratio
    location = 0.15
    experience = 0.08
    pay = 0.05
    availability = 0.01
    verification = 0.01

    total = semantic + skill + location + experience + pay + availability + verification
    return {
        "semantic": semantic / total,
        "skill": skill / total,
        "location": location / total,
        "experience": experience / total,
        "pay": pay / total,
        "availability": availability / total,
        "verification": verification / total,
    }


def build_worker_result(job_id: str, worker_id: str, semantic: float, rank: int) -> dict:
    jm = job_meta.get(job_id, {})
    wm = worker_meta.get(worker_id, {})

    s_skill, matched = skill_overlap_score(jm.get("skills", []), wm.get("skills", []))
    s_loc, distance_km = location_score(jm.get("location", {}), wm.get("location", {}))
    s_exp = experience_score(jm, wm)
    s_pay = pay_score(jm, wm)

    s_avail = 1.0 if wm.get("availability", False) else 0.0
    s_ver = 1.0 if wm.get("verificationStatus") == "approved" else 0.0

    weights = get_dynamic_weights()

    final_score = (
        weights["semantic"] * semantic
        + weights["skill"] * s_skill
        + weights["location"] * s_loc
        + weights["experience"] * s_exp
        + weights["pay"] * s_pay
        + weights["availability"] * s_avail
        + weights["verification"] * s_ver
    )

    reasons = []
    if semantic >= 0.65:
        reasons.append("High semantic match")
    if matched:
        reasons.append(f"Skill overlap: {', '.join(matched[:4])}")
    if s_loc >= 0.75:
        reasons.append("Strong location compatibility")
    if s_exp >= 0.9:
        reasons.append("Experience meets requirement")
    if s_pay >= 0.9:
        reasons.append("Budget and expected pay are compatible")

    return {
        "rank": rank,
        "jobId": job_id,
        "workerId": worker_id,
        "score": round(float(final_score), 6),
        "semanticScore": round(float(semantic), 6),
        "skillScore": round(float(s_skill), 6),
        "locationScore": round(float(s_loc), 6),
        "experienceScore": round(float(s_exp), 6),
        "payScore": round(float(s_pay), 6),
        "availabilityScore": s_avail,
        "verificationScore": s_ver,
        "distanceKm": None if distance_km is None else round(float(distance_km), 2),
        "matchedSkills": matched,
        "reasons": reasons,
        "worker": wm,
    }


def build_job_result(worker_id: str, job_id: str, semantic: float, rank: int) -> dict:
    result = build_worker_result(job_id, worker_id, semantic, rank)
    jm = job_meta.get(job_id, {})
    return {
        "rank": rank,
        "workerId": worker_id,
        "jobId": job_id,
        "score": result["score"],
        "semanticScore": result["semanticScore"],
        "skillScore": result["skillScore"],
        "locationScore": result["locationScore"],
        "experienceScore": result["experienceScore"],
        "payScore": result["payScore"],
        "distanceKm": result["distanceKm"],
        "matchedSkills": result["matchedSkills"],
        "reasons": result["reasons"],
        "job": jm,
    }


class WorkerPayload(BaseModel):
    workerId: str
    name: str = ""
    roleLabel: str = "worker"
    skills: List[str] = Field(default_factory=list)
    experienceYears: float = 0
    overallExperience: str = ""
    location: dict = Field(default_factory=dict)
    availability: bool = True
    verificationStatus: str = "pending"
    expectedMinPay: float = 0
    expectedMaxPay: float = 0
    bio: str = ""


class JobPayload(BaseModel):
    jobId: str
    title: str = ""
    category: str = ""
    description: str = ""
    skills: List[str] = Field(default_factory=list)
    workersRequired: int = 1
    location: dict = Field(default_factory=dict)
    payment: float = 0
    duration: str = ""
    urgent: bool = False
    experienceRequired: str = ""
    status: str = "open"
    applicationsOpen: bool = True


class RebuildPayload(BaseModel):
    workers: List[WorkerPayload] = Field(default_factory=list)
    jobs: List[JobPayload] = Field(default_factory=list)


class MatchPayload(BaseModel):
    topK: int = TOP_K_DEFAULT
    minScore: float = 0
    includeUnavailable: bool = False


class FeedbackPayload(BaseModel):
    workerId: str
    jobId: str
    event: str
    source: str = "api"


app = FastAPI(title="KarigarConnect Semantic Matching Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    global model
    log.info("Loading sentence transformer model: %s", MODEL_NAME)
    model = SentenceTransformer(MODEL_NAME)
    load_state()
    log.info("Semantic matching service ready. workers=%d jobs=%d", len(worker_vectors), len(job_vectors))


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "workers": len(worker_vectors),
        "jobs": len(job_vectors),
    }


@app.post("/index/rebuild")
def rebuild(payload: RebuildPayload) -> dict:
    with lock:
        worker_vectors.clear()
        worker_meta.clear()
        job_vectors.clear()
        job_meta.clear()

        for w in payload.workers:
            row = w.dict()
            row["skills"] = [normalize_skill(s) for s in (row.get("skills") or []) if normalize_skill(s)]
            row["location"] = parse_location(row.get("location"))
            text = build_worker_text(row)
            worker_vectors[row["workerId"]] = encode_text(text)
            worker_meta[row["workerId"]] = row

        for j in payload.jobs:
            row = j.dict()
            row["skills"] = [normalize_skill(s) for s in (row.get("skills") or []) if normalize_skill(s)]
            row["location"] = parse_location(row.get("location"))
            text = build_job_text(row)
            job_vectors[row["jobId"]] = encode_text(text)
            job_meta[row["jobId"]] = row

        rebuild_faiss_indexes()

    return {
        "status": "ok",
        "workersIndexed": len(worker_vectors),
        "jobsIndexed": len(job_vectors),
    }


@app.post("/index/workers/upsert")
def upsert_worker(payload: WorkerPayload) -> dict:
    with lock:
        row = payload.dict()
        row["skills"] = [normalize_skill(s) for s in (row.get("skills") or []) if normalize_skill(s)]
        row["location"] = parse_location(row.get("location"))
        text = build_worker_text(row)

        worker_vectors[row["workerId"]] = encode_text(text)
        worker_meta[row["workerId"]] = row
        rebuild_faiss_indexes()

    return {"status": "ok", "workerId": payload.workerId}


@app.post("/index/jobs/upsert")
def upsert_job(payload: JobPayload) -> dict:
    with lock:
        row = payload.dict()
        row["skills"] = [normalize_skill(s) for s in (row.get("skills") or []) if normalize_skill(s)]
        row["location"] = parse_location(row.get("location"))
        text = build_job_text(row)

        job_vectors[row["jobId"]] = encode_text(text)
        job_meta[row["jobId"]] = row
        rebuild_faiss_indexes()

    return {"status": "ok", "jobId": payload.jobId}


@app.delete("/index/workers/{worker_id}")
def delete_worker(worker_id: str) -> dict:
    with lock:
        worker_vectors.pop(worker_id, None)
        worker_meta.pop(worker_id, None)
        rebuild_faiss_indexes()
    return {"status": "ok", "workerId": worker_id}


@app.delete("/index/jobs/{job_id}")
def delete_job(job_id: str) -> dict:
    with lock:
        job_vectors.pop(job_id, None)
        job_meta.pop(job_id, None)
        rebuild_faiss_indexes()
    return {"status": "ok", "jobId": job_id}


@app.post("/match/job/{job_id}")
def match_workers_for_job(job_id: str, payload: MatchPayload) -> dict:
    with lock:
        if job_id not in job_vectors:
            raise HTTPException(status_code=404, detail="Job not indexed")
        if worker_index is None or not worker_ids_order:
            return {"jobId": job_id, "matches": []}

        query = job_vectors[job_id].reshape(1, -1)
        top_k = max(1, min(payload.topK, max(1, len(worker_ids_order))))
        scores, indexes = worker_index.search(query, top_k)

        ranked = []
        for idx, sim in zip(indexes[0], scores[0]):
            if idx < 0:
                continue
            worker_id = worker_ids_order[int(idx)]
            wm = worker_meta.get(worker_id, {})

            if not payload.includeUnavailable and not wm.get("availability", False):
                continue
            if wm.get("verificationStatus") not in ["approved", "pending"]:
                continue

            semantic = (float(sim) + 1.0) / 2.0
            result = build_worker_result(job_id, worker_id, semantic, rank=0)
            if result["score"] < payload.minScore:
                continue
            ranked.append(result)

        ranked.sort(key=lambda r: r["score"], reverse=True)
        for i, row in enumerate(ranked, start=1):
            row["rank"] = i

        return {
            "jobId": job_id,
            "weights": get_dynamic_weights(),
            "matches": ranked,
        }


@app.post("/match/worker/{worker_id}")
def match_jobs_for_worker(worker_id: str, payload: MatchPayload) -> dict:
    with lock:
        if worker_id not in worker_vectors:
            raise HTTPException(status_code=404, detail="Worker not indexed")
        if job_index is None or not job_ids_order:
            return {"workerId": worker_id, "matches": []}

        query = worker_vectors[worker_id].reshape(1, -1)
        top_k = max(1, min(payload.topK, max(1, len(job_ids_order))))
        scores, indexes = job_index.search(query, top_k)

        ranked = []
        for idx, sim in zip(indexes[0], scores[0]):
            if idx < 0:
                continue
            job_id = job_ids_order[int(idx)]
            jm = job_meta.get(job_id, {})
            if jm.get("status") not in ["open", "scheduled"]:
                continue
            if not jm.get("applicationsOpen", True):
                continue

            semantic = (float(sim) + 1.0) / 2.0
            result = build_job_result(worker_id, job_id, semantic, rank=0)
            if result["score"] < payload.minScore:
                continue
            ranked.append(result)

        ranked.sort(key=lambda r: r["score"], reverse=True)
        for i, row in enumerate(ranked, start=1):
            row["rank"] = i

        return {
            "workerId": worker_id,
            "weights": get_dynamic_weights(),
            "matches": ranked,
        }


@app.post("/feedback")
def submit_feedback(payload: FeedbackPayload) -> dict:
    event = normalize_text(payload.event)
    allowed = {"viewed", "invited", "applied", "hired", "completed", "rejected"}
    if event not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported event")

    pair_key = f"{payload.jobId}:{payload.workerId}"

    with lock:
        events = feedback_stats.setdefault("events", {})
        events[event] = int(events.get(event, 0)) + 1

        pair_events = feedback_stats.setdefault("pair_events", {})
        if pair_key not in pair_events:
            pair_events[pair_key] = []
        pair_events[pair_key].append({"event": event, "source": payload.source})

        save_json(FEEDBACK_PATH, feedback_stats)

    return {
        "status": "ok",
        "event": event,
        "globalEvents": feedback_stats.get("events", {}),
    }


if __name__ == "__main__":
    host = os.getenv("SEMANTIC_SERVICE_HOST", "0.0.0.0")
    port = int(os.getenv("SEMANTIC_SERVICE_PORT", "5100"))
    uvicorn.run(app, host=host, port=port)
