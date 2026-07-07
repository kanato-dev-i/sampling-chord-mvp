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


MOCK_CHORDS = [
    ChordPoint(time=0, chord="Cmaj7"),
    ChordPoint(time=4, chord="Am7"),
    ChordPoint(time=8, chord="Dm7"),
    ChordPoint(time=12, chord="G7"),
]

ALLOWED_ORIGINS = ["http://localhost:3000", "https://kanato-dev-i.github.io"]

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
    # This MVP intentionally does not download YouTube audio.
    # Keep the function boundary so a future backend can replace the mock safely.
    return AudioArtifact(path=f"mock://youtube-audio?source={url}")


def convert_audio_to_wav(input_path: str) -> str:
    # Mock conversion. No ffmpeg process is invoked in the GitHub Pages MVP.
    return input_path.replace("youtube-audio", "audio.wav")


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
    wav_path = convert_audio_to_wav(audio.path)
    chords = analyze_chords(wav_path)
    midi_url = generate_midi_from_chords(chords) if payload.outputType == "midi" else None

    return AnalyzeYoutubeResponse(
        source="youtube",
        url=url,
        chords=chords,
        midiUrl=midi_url,
    )
