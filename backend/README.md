# Sampling Chord MVP Backend

FastAPI backend for local YouTube chord analysis experiments.

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Test

```bash
curl -X POST http://localhost:8000/analyze-youtube \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","outputType":"chords"}'
```

## Modes

Default mode is mock mode. It returns deterministic dummy chords without downloading YouTube audio.

To try the development audio pipeline:

```bash
USE_REAL_YOUTUBE_AUDIO=true uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

This requires:

- `yt-dlp` from `requirements.txt`
- `ffmpeg` installed on the machine

The chord analysis step is still a simple deterministic mock. The current goal is to keep the URL -> audio download -> WAV conversion -> response pipeline ready for a real chord model.
