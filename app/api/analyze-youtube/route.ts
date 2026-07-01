import { NextResponse } from "next/server";

type OutputType = "chords" | "midi";

type ChordPoint = {
  time: number;
  chord: string;
};

type AnalyzeYoutubeRequest = {
  url?: unknown;
  outputType?: unknown;
};

type AnalyzeYoutubeResponse = {
  source: "youtube";
  url: string;
  chords: ChordPoint[];
  midiUrl: string | null;
};

type AudioBufferMock = {
  sourceUrl: string;
  byteLength: number;
};

type WavBufferMock = {
  sampleRate: number;
  byteLength: number;
};

function validateYoutubeUrl(input: unknown): string {
  if (typeof input !== "string") {
    throw new Error("url must be a string");
  }

  const value = input.trim();

  if (!value) {
    throw new Error("url is required");
  }

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    const isYoutubeHost = host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com" || host === "youtu.be";

    if (!isYoutubeHost) {
      throw new Error("url must be a YouTube URL");
    }

    return url.toString();
  } catch {
    throw new Error("url must be a valid YouTube URL");
  }
}

function validateOutputType(input: unknown): OutputType {
  return input === "midi" ? "midi" : "chords";
}

async function fetchYoutubeAudio(url: string): Promise<AudioBufferMock> {
  // Placeholder only. Do not download YouTube audio in this MVP.
  return {
    sourceUrl: url,
    byteLength: 0,
  };
}

async function convertAudioToWav(audio: AudioBufferMock): Promise<WavBufferMock> {
  // Placeholder for ffmpeg or a managed audio conversion service.
  return {
    sampleRate: 44100,
    byteLength: audio.byteLength,
  };
}

async function analyzeChords(_wav: WavBufferMock): Promise<ChordPoint[]> {
  // Placeholder for a chord recognition model or external analysis worker.
  return [
    { time: 0, chord: "Cmaj7" },
    { time: 4, chord: "Am7" },
    { time: 8, chord: "Dm7" },
    { time: 12, chord: "G7" },
  ];
}

async function generateMidiFromChords(_chords: ChordPoint[], _outputType: OutputType): Promise<string | null> {
  // Placeholder for MIDI generation. Return a file URL when storage exists.
  return null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyzeYoutubeRequest;
    const url = validateYoutubeUrl(body.url);
    const outputType = validateOutputType(body.outputType);
    const audio = await fetchYoutubeAudio(url);
    const wav = await convertAudioToWav(audio);
    const chords = await analyzeChords(wav);
    const midiUrl = await generateMidiFromChords(chords, outputType);

    const response: AnalyzeYoutubeResponse = {
      source: "youtube",
      url,
      chords,
      midiUrl,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to analyze YouTube URL";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
