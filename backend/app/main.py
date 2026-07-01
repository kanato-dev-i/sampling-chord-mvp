import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Literal, Optional
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


OutputType = Literal["chords", "midi"]


class AnalyzeYoutubeRequest(BaseModel):
    url: str = Field(..., min_length=1)
    outputType: OutputType = "chords"


class ChordPoint(BaseModel):
    time: int
    chord: str


class AnalyzeYoutubeResponse(BaseModel):
    source: Literal["youtube"]
    url: str
    chords: list[ChordPoint]
    midiUrl: Optional[str]


class AudioArtifact(BaseModel):
    path: str
    cleanup_dir: Optional[str] = None


MOCK_CHORDS = [
    ChordPoint(time=0, chord="Cmaj7"),
    ChordPoint(time=4, chord="Am7"),
    ChordPoint(time=8, chord="Dm7"),
    ChordPoint(time=12, chord="G7"),
]

USE_REAL_YOUTUBE_AUDIO = os.getenv("USE_REAL_YOUTUBE_AUDIO", "false").lower() == "true"
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,https://kanato-dev-i.github.io",
    ).split(",")
    if origin.strip()
]

app = FastAPI(title="Sampling Chord MVP API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def validate_youtube_url(url: str) -> str:
    parsed = urlparse(url.strip())
    host = parsed.netloc.removeprefix("www.")
    allowed_hosts = {"youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"}

    if parsed.scheme not in {"http", "https"} or host not in allowed_hosts:
        raise HTTPException(status_code=400, detail="url must be a valid YouTube URL")

    return url.strip()


def fetch_youtube_audio(url: str) -> AudioArtifact:
    if not USE_REAL_YOUTUBE_AUDIO:
        return AudioArtifact(path="mock://youtube-audio")

    try:
        from yt_dlp import YoutubeDL
    except ImportError as exc:
        raise HTTPException(status_code=500, detail="yt-dlp is not installed") from exc

    work_dir = Path(tempfile.mkdtemp(prefix="sampling-chord-"))
    output_template = str(work_dir / "source.%(ext)s")
    options = {
        "format": "bestaudio/best",
        "outtmpl": output_template,
        "quiet": True,
        "noplaylist": True,
    }

    with YoutubeDL(options) as ydl:
        info = ydl.extract_info(url, download=True)
        downloaded_path = Path(ydl.prepare_filename(info))

    if not downloaded_path.exists():
        raise HTTPException(status_code=500, detail="failed to download YouTube audio")

    return AudioArtifact(path=str(downloaded_path), cleanup_dir=str(work_dir))


def convert_audio_to_wav(input_path: str) -> str:
    if input_path.startswith("mock://"):
        return "mock://audio.wav"

    ffmpeg_path = shutil.which("ffmpeg")
    if not ffmpeg_path:
        raise HTTPException(status_code=500, detail="ffmpeg is not installed")

    source_path = Path(input_path)
    wav_path = source_path.with_suffix(".wav")
    command = [
        ffmpeg_path,
        "-y",
        "-i",
        str(source_path),
        "-ac",
        "1",
        "-ar",
        "44100",
        str(wav_path),
    ]
    subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return str(wav_path)


def analyze_chords(_wav_path: str) -> list[ChordPoint]:
    # First implementation: deterministic mock. Replace with a real chord model later.
    return MOCK_CHORDS


def generate_midi_from_chords(_chords: list[ChordPoint]) -> Optional[str]:
    # Placeholder until MIDI rendering and file hosting are implemented.
    return None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze-youtube", response_model=AnalyzeYoutubeResponse)
def analyze_youtube(payload: AnalyzeYoutubeRequest) -> AnalyzeYoutubeResponse:
    url = validate_youtube_url(payload.url)
    audio = fetch_youtube_audio(url)

    try:
        wav_path = convert_audio_to_wav(audio.path)
        chords = analyze_chords(wav_path)
        midi_url = generate_midi_from_chords(chords) if payload.outputType == "midi" else None
    finally:
        if audio.cleanup_dir:
            shutil.rmtree(audio.cleanup_dir, ignore_errors=True)

    return AnalyzeYoutubeResponse(
        source="youtube",
        url=url,
        chords=chords,
        midiUrl=midi_url,
    )
