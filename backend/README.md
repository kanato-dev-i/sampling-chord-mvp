# Sampling Chord MVP Backend

FastAPI backend mock for local API-shape experiments.

The current product goal is a GitHub Pages compatible static app. This backend is not required for the deployed MVP and does not download YouTube audio.

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

## Behavior

`POST /analyze-youtube` keeps the future API shape but returns deterministic dummy chords:

- No YouTube audio download
- No ffmpeg conversion
- No external API key
- No hosted MIDI file

The static frontend currently performs its main analysis mock in the browser so GitHub Pages can run it without a server.
