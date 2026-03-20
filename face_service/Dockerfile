FROM python:3.11-slim

WORKDIR /app

# System deps for OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libsm6 libxext6 libxrender-dev libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

# Pre-download InsightFace models at build time (avoids delay on first request)
RUN python -c "from insightface.app import FaceAnalysis; \
    app = FaceAnalysis(name='buffalo_sc', allowed_modules=['detection','recognition'], \
    providers=['CPUExecutionProvider']); app.prepare(ctx_id=-1, det_size=(320,320))"

ENV FACE_SERVICE_PORT=8001
EXPOSE 8001

CMD ["python", "main.py"]
