"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";

const STORAGE_KEY = "sampling-chord-mvp-state-v2";

const KEY_OPTIONS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;
const SCALE_OPTIONS = ["major", "minor"] as const;
const MIDI_RANGES = ["low", "middle", "high"] as const;
const CHORD_LENGTH_OPTIONS = [
  { label: "1小節", value: 4 },
  { label: "2拍", value: 2 },
  { label: "1拍", value: 1 },
  { label: "2小節", value: 8 },
] as const;

type KeyName = (typeof KEY_OPTIONS)[number];
type ScaleName = (typeof SCALE_OPTIONS)[number];
type MidiRange = (typeof MIDI_RANGES)[number];
type ThemeName = "dark" | "light";
type OutputMode = "chords" | "midi";
type AnalysisStatus = "idle" | "analyzing" | "success" | "failed";

type ChordEntry = {
  id: string;
  chord: string;
  start: number;
  end: number;
  bar: number;
  memo?: string;
};

type AppSettings = {
  key: KeyName;
  scale: ScaleName;
  bpm: number;
  chordLengthBeats: number;
  midiRange: MidiRange;
};

type VideoMeta = {
  title: string;
  authorName?: string;
};

type ParsedChord = {
  raw: string;
  root: string | null;
  rootSemitone: number | null;
  normalized: string;
  quality: "major" | "minor" | "dominant7" | "maj7" | "m7" | "diminished" | "unknown" | "none";
  intervals: number[];
  supported: boolean;
  approximation: string | null;
  reason: string | null;
};

type ChordAnalysis = {
  entry: ChordEntry;
  parsed: ParsedChord;
  degree: string;
  functionName: string;
  previousRelation: string;
  nextRelation: string;
  secondaryDominant: string | null;
  explanation: string;
};

type StoredState = {
  progression?: ChordEntry[];
  settings?: Partial<AppSettings>;
  theme?: ThemeName;
};

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  "E#": 5,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
  Cb: 11,
};

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];
const MAJOR_DEGREES = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
const MINOR_DEGREES = ["i", "ii°", "III", "iv", "v", "VI", "VII"];
const RANGE_BASE: Record<MidiRange, number> = {
  low: 48,
  middle: 60,
  high: 72,
};

const DEFAULT_SETTINGS: AppSettings = {
  key: "C",
  scale: "major",
  bpm: 120,
  chordLengthBeats: 4,
  midiRange: "middle",
};

const PRESETS = [
  { name: "王道進行", description: "C - G - Am - F", chords: ["C", "G", "Am", "F"] },
  { name: "小室進行", description: "Am - F - G - C", chords: ["Am", "F", "G", "C"] },
  { name: "丸サ進行風", description: "FM7 - E7 - Am7 - C7", chords: ["FM7", "E7", "Am7", "C7"] },
  { name: "シティポップ練習", description: "CM7 - Bm7b5 - E7 - Am7 - D7 - G7", chords: ["CM7", "Bm7b5", "E7", "Am7", "D7", "G7"] },
  { name: "切ない進行", description: "F - G - Em - Am", chords: ["F", "G", "Em", "Am"] },
];

const MOCK_YOUTUBE_CHORDS = ["Cmaj7", "Am7", "Dm7", "G7"];
const DEFAULT_PROGRESSION = makeProgression(["C", "G", "Am", "F"], DEFAULT_SETTINGS.chordLengthBeats);

function createId(prefix = "chord") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function makeProgression(chords: string[], chordLengthBeats: number): ChordEntry[] {
  return chords.map((chord, index) => ({
    id: createId(`bar-${index + 1}`),
    chord,
    start: index * chordLengthBeats,
    end: (index + 1) * chordLengthBeats,
    bar: index + 1,
    memo: "",
  }));
}

function normalizeTiming(progression: ChordEntry[], chordLengthBeats: number): ChordEntry[] {
  return progression.map((entry, index) => ({
    ...entry,
    start: index * chordLengthBeats,
    end: (index + 1) * chordLengthBeats,
    bar: index + 1,
  }));
}

function clampBpm(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_SETTINGS.bpm;
  }

  return Math.min(240, Math.max(40, Math.round(value)));
}

function normalizeRoot(rootLetter: string, accidental = "") {
  const normalizedAccidental = accidental.replace("♯", "#").replace("♭", "b");
  return `${rootLetter.toUpperCase()}${normalizedAccidental}`;
}

function parseChord(input: string): ParsedChord {
  const raw = input;
  const compact = input.trim().replace(/\s+/g, "").replace("♯", "#").replace("♭", "b");

  if (!compact) {
    return unsupportedChord(raw, "空欄です。コード名を入力してください。");
  }

  if (/^(N\.?C\.?|休符|なし)$/i.test(compact)) {
    return {
      raw,
      root: null,
      rootSemitone: null,
      normalized: "N.C.",
      quality: "none",
      intervals: [],
      supported: true,
      approximation: null,
      reason: "ノーコードとして扱います。",
    };
  }

  const mainChord = compact.split("/")[0];
  const match = mainChord.match(/^([A-Ga-g])([#b]?)(.*)$/);

  if (!match) {
    return unsupportedChord(raw, "ルート音を読み取れません。C, Dm, G7 のように入力してください。");
  }

  const root = normalizeRoot(match[1], match[2]);
  const rootSemitone = NOTE_TO_SEMITONE[root];

  if (rootSemitone === undefined) {
    return unsupportedChord(raw, "このルート音はまだ対応していません。");
  }

  const qualityText = match[3] ?? "";
  const lowerQuality = qualityText.toLowerCase();
  const hasComplexExtension = /(9|11|13|sus|add|aug|\+|#|b5)/i.test(qualityText);
  let quality: ParsedChord["quality"] = "major";
  let intervals = [0, 4, 7];
  let normalized = root;
  let supported = true;
  let approximation: string | null = null;
  let reason: string | null = null;

  if (/^(m7b5|dim|°|o)/i.test(qualityText)) {
    quality = "diminished";
    intervals = [0, 3, 6, 10];
    normalized = `${root}m7b5`;
  } else if (/^(maj7|ma7|M7|Δ7|Δ|m7\+|m7maj|m7m|m\(maj7\))/i.test(qualityText)) {
    quality = "maj7";
    intervals = [0, 4, 7, 11];
    normalized = `${root}maj7`;
  } else if (/^(m7|min7|-7)/.test(qualityText)) {
    quality = "m7";
    intervals = [0, 3, 7, 10];
    normalized = `${root}m7`;
  } else if (/^(m|min|-)/.test(qualityText)) {
    quality = "minor";
    intervals = [0, 3, 7];
    normalized = `${root}m`;
  } else if (/^(7|dom7)/i.test(lowerQuality)) {
    quality = "dominant7";
    intervals = [0, 4, 7, 10];
    normalized = `${root}7`;
  } else if (/^(maj|ma|M|Δ)/.test(qualityText)) {
    quality = "maj7";
    intervals = [0, 4, 7, 11];
    normalized = `${root}maj7`;
  } else if (qualityText && hasComplexExtension) {
    supported = false;
    approximation = `${root}${lowerQuality.includes("m") && !lowerQuality.includes("maj") ? "m" : ""}`;
    reason = "拡張テンションは近似して扱います。";
  } else if (qualityText) {
    supported = false;
    approximation = root;
    reason = "このコード品質はまだ分析対象外です。";
  }

  if (hasComplexExtension && supported && !["dominant7", "diminished"].includes(quality)) {
    supported = false;
    approximation = normalized;
    reason = "一部のテンションはMIDI化時に近似されます。";
  }

  return {
    raw,
    root,
    rootSemitone,
    normalized,
    quality,
    intervals,
    supported,
    approximation,
    reason,
  };
}

function unsupportedChord(raw: string, reason: string): ParsedChord {
  return {
    raw,
    root: null,
    rootSemitone: null,
    normalized: raw.trim() || "未入力",
    quality: "unknown",
    intervals: [],
    supported: false,
    approximation: null,
    reason,
  };
}

function getScaleData(settings: AppSettings) {
  return settings.scale === "major"
    ? { intervals: MAJOR_SCALE, degrees: MAJOR_DEGREES }
    : { intervals: MINOR_SCALE, degrees: MINOR_DEGREES };
}

function isDiatonicQuality(parsed: ParsedChord, degreeIndex: number, settings: AppSettings) {
  const expectedFamilies = settings.scale === "major"
    ? ["major", "minor", "minor", "major", "major", "minor", "diminished"]
    : ["minor", "diminished", "major", "minor", "minor", "major", "major"];
  const expected = expectedFamilies[degreeIndex];

  if (expected === "major") {
    return parsed.quality === "major" || parsed.quality === "maj7" || (degreeIndex === 4 && parsed.quality === "dominant7");
  }

  if (expected === "minor") {
    return parsed.quality === "minor" || parsed.quality === "m7";
  }

  return parsed.quality === "diminished";
}

function getDegree(parsed: ParsedChord, settings: AppSettings) {
  if (parsed.quality === "none") {
    return "N.C.";
  }

  if (parsed.rootSemitone === null) {
    return "未対応";
  }

  if (!parsed.supported) {
    return parsed.approximation ? "近似" : "未対応";
  }

  const keyRoot = NOTE_TO_SEMITONE[settings.key] ?? 0;
  const { intervals, degrees } = getScaleData(settings);
  const relative = (parsed.rootSemitone - keyRoot + 12) % 12;
  const degreeIndex = intervals.indexOf(relative);

  if (degreeIndex < 0) {
    return "Non-diatonic";
  }

  const baseDegree = degrees[degreeIndex];

  if (!isDiatonicQuality(parsed, degreeIndex, settings)) {
    return "Non-diatonic";
  }

  if (parsed.quality === "dominant7" && baseDegree === "V") {
    return `${baseDegree}7`;
  }

  if (parsed.quality === "maj7" && ["I", "IV", "III", "VI"].includes(baseDegree)) {
    return `${baseDegree}maj7`;
  }

  if (parsed.quality === "m7" && /^(ii|iii|vi|i|iv|v)$/.test(baseDegree)) {
    return `${baseDegree}7`;
  }

  return baseDegree;
}

function getFunctionName(degree: string) {
  if (degree === "N.C.") {
    return "休符/余白";
  }

  if (degree === "未対応") {
    return "未対応";
  }

  if (degree === "近似") {
    return "近似";
  }

  if (degree === "Non-diatonic") {
    return "ノンダイアトニック";
  }

  if (/^(I|i|iii|III|vi|VI)/.test(degree)) {
    return "トニック系";
  }

  if (/^(ii|II|iv|IV)/.test(degree)) {
    return "サブドミナント系";
  }

  if (/^(V|v|vii)/.test(degree)) {
    return "ドミナント系";
  }

  return "カラーコード";
}

function detectSecondaryDominant(current: ParsedChord, next: ParsedChord | null, settings: AppSettings) {
  if (!next || current.quality !== "dominant7" || current.rootSemitone === null || next.rootSemitone === null) {
    return null;
  }

  const expectedDominantRoot = (next.rootSemitone + 7) % 12;
  if (current.rootSemitone !== expectedDominantRoot) {
    return null;
  }

  const targetDegree = getDegree(next, settings).replace(/(maj7|7)$/g, "");

  if (targetDegree === "Non-diatonic" || targetDegree === "未対応" || targetDegree === "N.C.") {
    return null;
  }

  return `V/${targetDegree}`;
}

function describeRelation(current: ParsedChord, other: ParsedChord | null, direction: "previous" | "next") {
  if (!other) {
    return direction === "previous" ? "この進行の開始地点です。" : "ここでひとまず着地します。";
  }

  if (current.rootSemitone === null || other.rootSemitone === null) {
    return "片方が未対応またはノーコードのため、関係性は簡易表示です。";
  }

  const distance = direction === "next"
    ? (other.rootSemitone - current.rootSemitone + 12) % 12
    : (current.rootSemitone - other.rootSemitone + 12) % 12;

  if (distance === 7 || distance === 5) {
    return direction === "next"
      ? "五度圏に沿って自然に次へ進みます。"
      : "前のコードから五度圏に近い動きで入っています。";
  }

  if (distance === 1 || distance === 11) {
    return "半音の近い動きがあり、少し緊張感のあるつながりです。";
  }

  if (distance === 0) {
    return "同じルートを保ち、響きや機能だけを変える動きです。";
  }

  return "ルートがほどよく離れ、色味を切り替える動きです。";
}

function createExplanation(analysis: Omit<ChordAnalysis, "explanation">) {
  if (!analysis.parsed.supported) {
    return analysis.parsed.reason ?? "このコードはまだ分析対象外です。MIDI化時は可能な範囲で近似します。";
  }

  if (analysis.secondaryDominant) {
    return `${analysis.secondaryDominant} として次のコードへ解決する可能性があります。断定ではなく、作曲メモとして確認してください。`;
  }

  if (analysis.degree === "N.C.") {
    return "音を抜く小節として扱えます。次のコードを目立たせたい時に便利です。";
  }

  if (analysis.functionName === "トニック系") {
    return "安定感のある場所です。メロディの着地や余白を置く小節に向いています。";
  }

  if (analysis.functionName === "サブドミナント系") {
    return "次の展開へ空気を開く役割です。サビ前や場面転換の準備に使いやすいです。";
  }

  if (analysis.functionName === "ドミナント系") {
    return "解決したくなる力を持つ場所です。次のコードへの期待感を作れます。";
  }

  if (analysis.functionName === "ノンダイアトニック") {
    return "キー外の色が入っています。次のコードへの解決感や一瞬の違和感をメモしておくと使いやすいです。";
  }

  return "響きの色を変えるコードです。前後のコードと合わせて使いどころを判断できます。";
}

function analyzeProgression(progression: ChordEntry[], settings: AppSettings): ChordAnalysis[] {
  const parsed = progression.map((entry) => parseChord(entry.chord));

  return progression.map((entry, index) => {
    const current = parsed[index];
    const previous = parsed[index - 1] ?? null;
    const next = parsed[index + 1] ?? null;
    const degree = getDegree(current, settings);
    const partial = {
      entry,
      parsed: current,
      degree,
      functionName: getFunctionName(degree),
      previousRelation: describeRelation(current, previous, "previous"),
      nextRelation: describeRelation(current, next, "next"),
      secondaryDominant: detectSecondaryDominant(current, next, settings),
    };

    return {
      ...partial,
      explanation: createExplanation(partial),
    };
  });
}

function extractYouTubeVideoId(input: string): string | null {
  const value = input.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) {
    return value;
  }

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const watchId = url.searchParams.get("v");
      if (watchId && /^[a-zA-Z0-9_-]{11}$/.test(watchId)) {
        return watchId;
      }

      const pathMatch = url.pathname.match(/\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})/);
      return pathMatch?.[1] ?? null;
    }
  } catch {
    return null;
  }

  return null;
}

async function analyzeYoutubeUrl(url: string, outputMode: OutputMode): Promise<ChordEntry[]> {
  if (!extractYouTubeVideoId(url)) {
    throw new Error("Invalid YouTube URL");
  }

  await new Promise((resolve) => setTimeout(resolve, outputMode === "midi" ? 760 : 620));
  return makeProgression(MOCK_YOUTUBE_CHORDS, DEFAULT_SETTINGS.chordLengthBeats);
}

function pickDemoProgression(fileName: string) {
  const presets = PRESETS.map((preset) => preset.chords);
  const charTotal = Array.from(fileName).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return presets[charTotal % presets.length];
}

function getChordNotes(parsed: ParsedChord, midiRange: MidiRange) {
  if (parsed.quality === "none" || parsed.rootSemitone === null) {
    return [];
  }

  const base = RANGE_BASE[midiRange] + parsed.rootSemitone;
  const fallbackIntervals = parsed.quality === "minor" || parsed.normalized.includes("m") && !parsed.normalized.includes("maj")
    ? [0, 3, 7]
    : [0, 4, 7];
  const intervals = parsed.intervals.length ? parsed.intervals : fallbackIntervals;

  return intervals.map((interval) => base + interval);
}

function toVlq(value: number) {
  let buffer = value & 0x7f;
  const bytes = [];

  while ((value >>= 7)) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }

  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) {
      buffer >>= 8;
    } else {
      break;
    }
  }

  return bytes;
}

function uint16(value: number) {
  return [(value >> 8) & 0xff, value & 0xff];
}

function uint32(value: number) {
  return [(value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function ascii(value: string) {
  return Array.from(value).map((char) => char.charCodeAt(0));
}

function createMidiBytes(progression: ChordEntry[], settings: AppSettings) {
  const ticksPerQuarter = 480;
  const chordTicks = settings.chordLengthBeats * ticksPerQuarter;
  const tempo = Math.round(60_000_000 / clampBpm(settings.bpm));
  const track: number[] = [];
  let pendingDelta = 0;

  track.push(0x00, 0xff, 0x51, 0x03, (tempo >> 16) & 0xff, (tempo >> 8) & 0xff, tempo & 0xff);
  track.push(0x00, 0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08);

  progression.forEach((entry) => {
    const notes = getChordNotes(parseChord(entry.chord), settings.midiRange);

    if (notes.length === 0) {
      pendingDelta += chordTicks;
      return;
    }

    notes.forEach((note, noteIndex) => {
      track.push(...toVlq(noteIndex === 0 ? pendingDelta : 0), 0x90, note, 78);
    });

    notes.forEach((note, noteIndex) => {
      track.push(...toVlq(noteIndex === 0 ? chordTicks : 0), 0x80, note, 0);
    });

    pendingDelta = 0;
  });

  track.push(...toVlq(pendingDelta), 0xff, 0x2f, 0x00);

  return [
    ...ascii("MThd"),
    ...uint32(6),
    ...uint16(0),
    ...uint16(1),
    ...uint16(ticksPerQuarter),
    ...ascii("MTrk"),
    ...uint32(track.length),
    ...track,
  ];
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
}

function getValidatedStoredSettings(settings?: Partial<AppSettings>): AppSettings {
  return {
    key: KEY_OPTIONS.includes(settings?.key as KeyName) ? settings?.key as KeyName : DEFAULT_SETTINGS.key,
    scale: SCALE_OPTIONS.includes(settings?.scale as ScaleName) ? settings?.scale as ScaleName : DEFAULT_SETTINGS.scale,
    bpm: clampBpm(Number(settings?.bpm ?? DEFAULT_SETTINGS.bpm)),
    chordLengthBeats: Number(settings?.chordLengthBeats ?? DEFAULT_SETTINGS.chordLengthBeats),
    midiRange: MIDI_RANGES.includes(settings?.midiRange as MidiRange) ? settings?.midiRange as MidiRange : DEFAULT_SETTINGS.midiRange,
  };
}

export default function Home(): ReactElement {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null);
  const [metaStatus, setMetaStatus] = useState<"idle" | "loading" | "failed">("idle");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [progression, setProgression] = useState<ChordEntry[]>(DEFAULT_PROGRESSION);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [selectedChordId, setSelectedChordId] = useState(DEFAULT_PROGRESSION[0]?.id ?? null);
  const [theme, setTheme] = useState<ThemeName>("dark");
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>("idle");
  const [outputMode, setOutputMode] = useState<OutputMode>("chords");
  const [message, setMessage] = useState("YouTube URLを貼るか、コードを直接編集して作曲ノートを始められます。");
  const [copyStatus, setCopyStatus] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const videoId = useMemo(() => extractYouTubeVideoId(youtubeUrl), [youtubeUrl]);
  const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
  const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  const analyses = useMemo(() => analyzeProgression(progression, settings), [progression, settings]);
  const selectedAnalysis = analyses.find((analysis) => analysis.entry.id === selectedChordId) ?? analyses[0] ?? null;
  const chordText = progression.map((entry) => entry.chord.trim() || "N.C.").join(" - ");
  const barText = `| ${progression.map((entry) => entry.chord.trim() || "N.C.").join(" | ")} |`;
  const degreeText = `| ${analyses.map((analysis) => analysis.degree).join(" | ")} |`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved) as StoredState;
        const nextSettings = getValidatedStoredSettings(parsed.settings);
        const savedProgression = Array.isArray(parsed.progression) && parsed.progression.length > 0
          ? normalizeTiming(parsed.progression, nextSettings.chordLengthBeats)
          : DEFAULT_PROGRESSION;

        setSettings(nextSettings);
        setProgression(savedProgression);
        setSelectedChordId(savedProgression[0]?.id ?? null);
        setTheme(parsed.theme === "light" ? "light" : "dark");
      }
    } catch {
      setMessage("保存データを読み込めなかったため、初期状態で開いています。");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const stored: StoredState = {
      progression,
      settings,
      theme,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }, [hydrated, progression, settings, theme]);

  async function fetchVideoMeta() {
    setVideoMeta(null);

    if (!videoId) {
      setMetaStatus("failed");
      return;
    }

    setMetaStatus("loading");

    try {
      const response = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(
          `https://www.youtube.com/watch?v=${videoId}`,
        )}&format=json`,
      );

      if (!response.ok) {
        throw new Error("Failed to load oEmbed metadata");
      }

      const data = (await response.json()) as { title?: string; author_name?: string };
      setVideoMeta({
        title: data.title || `YouTube video ${videoId}`,
        authorName: data.author_name,
      });
      setMetaStatus("idle");
    } catch {
      setVideoMeta({ title: `YouTube video ${videoId}` });
      setMetaStatus("failed");
    }
  }

  async function handleAnalyzeYoutube(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!videoId) {
      setAnalysisStatus("failed");
      setMessage("有効なYouTube URLを入力してください。音声取得は行わず、静的モック解析で進行を作ります。");
      return;
    }

    setAnalysisStatus("analyzing");
    setMessage("GitHub Pages上で動くモック解析を実行中です。YouTube音声の取得は行いません。");
    void fetchVideoMeta();

    try {
      const nextProgression = normalizeTiming(await analyzeYoutubeUrl(youtubeUrl, outputMode), settings.chordLengthBeats);
      setProgression(nextProgression);
      setSelectedChordId(nextProgression[0]?.id ?? null);
      setAnalysisStatus("success");
      setMessage(
        outputMode === "midi"
          ? "コード進行を作成しました。現在の設定でMIDIを書き出せます。"
          : "コード進行を作成しました。カードを編集すると分析とMIDI内容も更新されます。",
      );
    } catch {
      setAnalysisStatus("failed");
      setMessage("解析に失敗しました。URLの形式を確認してください。");
    }
  }

  function handleAudioFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setAudioFile(file);
    setMessage(file ? "補助入力の音源ファイルが選択されました。ここでも静的なダミー進行を作れます。" : "YouTube URLを貼るか、コードを直接編集して作曲ノートを始められます。");
  }

  function handleAnalyzeFile() {
    if (!audioFile) {
      return;
    }

    const nextProgression = makeProgression(pickDemoProgression(audioFile.name), settings.chordLengthBeats);
    setProgression(nextProgression);
    setSelectedChordId(nextProgression[0]?.id ?? null);
    setAnalysisStatus("success");
    setMessage("補助ファイル名からMVP用のダミーコード進行を作成しました。");
  }

  function updateSettings(nextSettings: Partial<AppSettings>) {
    setSettings((current) => {
      const merged = {
        ...current,
        ...nextSettings,
        bpm: nextSettings.bpm === undefined ? current.bpm : clampBpm(nextSettings.bpm),
      };

      if (nextSettings.chordLengthBeats !== undefined) {
        setProgression((currentProgression) => normalizeTiming(currentProgression, merged.chordLengthBeats));
      }

      return merged;
    });
  }

  function updateChord(id: string, value: string) {
    setProgression((current) => current.map((entry) => (entry.id === id ? { ...entry, chord: value } : entry)));
    setSelectedChordId(id);
  }

  function updateMemo(id: string, value: string) {
    setProgression((current) => current.map((entry) => (entry.id === id ? { ...entry, memo: value } : entry)));
  }

  function addChord() {
    setProgression((current) => {
      const next = normalizeTiming([...current, { id: createId(), chord: "C", start: 0, end: 0, bar: current.length + 1, memo: "" }], settings.chordLengthBeats);
      setSelectedChordId(next[next.length - 1]?.id ?? null);
      return next;
    });
  }

  function removeChord(id: string) {
    setProgression((current) => {
      const next = normalizeTiming(current.filter((entry) => entry.id !== id), settings.chordLengthBeats);
      setSelectedChordId((selected) => (selected === id ? next[0]?.id ?? null : selected));
      return next;
    });
  }

  function moveChord(id: string, direction: -1 | 1) {
    setProgression((current) => {
      const index = current.findIndex((entry) => entry.id === id);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return normalizeTiming(next, settings.chordLengthBeats);
    });
  }

  function applyPreset(chords: string[], name: string) {
    const shouldReplace = window.confirm(`${name} に置き換えます。現在のコード進行は上書きされます。`);

    if (!shouldReplace) {
      return;
    }

    const nextProgression = makeProgression(chords, settings.chordLengthBeats);
    setProgression(nextProgression);
    setSelectedChordId(nextProgression[0]?.id ?? null);
    setMessage(`${name} を読み込みました。キーを変えるとディグリー表示も更新されます。`);
  }

  function resetNotebook() {
    const shouldReset = window.confirm("保存内容をリセットして初期状態に戻します。");

    if (!shouldReset) {
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
    setSettings(DEFAULT_SETTINGS);
    setProgression(DEFAULT_PROGRESSION);
    setSelectedChordId(DEFAULT_PROGRESSION[0]?.id ?? null);
    setTheme("dark");
    setMessage("初期状態に戻しました。");
  }

  async function handleCopy(kind: "chords" | "bars" | "degrees") {
    const text = kind === "chords" ? chordText : kind === "bars" ? barText : degreeText;
    await copyText(text);
    setCopyStatus(kind === "degrees" ? "ディグリー表記をコピーしました。" : "コード進行をコピーしました。");
  }

  function handleMidiExport() {
    const bytes = createMidiBytes(progression, settings);
    const blob = new Blob([new Uint8Array(bytes)], { type: "audio/midi" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "progression-note.mid";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setMessage("progression-note.mid を書き出しました。Logic ProなどのDAWにドラッグできます。");
  }

  return (
    <main className="app-shell" data-theme={theme}>
      <button
        className="theme-toggle"
        type="button"
        aria-pressed={theme === "dark"}
        onClick={() => setTheme((currentTheme) => (currentTheme === "light" ? "dark" : "light"))}
      >
        {theme === "light" ? "Dark" : "Light"}
      </button>

      <section className="hero reveal">
        <div className="hero-copy">
          <p className="eyebrow">Urban Dark Chord Notebook</p>
          <h1>コード進行を整理して、MIDIで持ち出す作曲ノート</h1>
          <p className="lead">
            YouTube URLは入口として使い、実際の作業はコードを編集しながらキー、ディグリー、機能を確認する静的Webアプリです。
          </p>
        </div>
      </section>

      <section className="workspace" aria-label="コード進行作曲ワークスペース">
        <div className="main-stack">
          <section className="panel workflow-panel reveal">
            <div className="panel-heading">
              <span className="step">1</span>
              <div>
                <h2>YouTube URLから下書き作成</h2>
                <p>音声の取得は行わず、GitHub Pages上で動くモック解析から編集用のコード進行を作ります。</p>
              </div>
            </div>

            <form className="url-form" onSubmit={handleAnalyzeYoutube}>
              <label htmlFor="youtube-url">YouTube URL</label>
              <div className="input-row">
                <input
                  id="youtube-url"
                  type="url"
                  value={youtubeUrl}
                  onChange={(event) => {
                    setYoutubeUrl(event.target.value);
                    setVideoMeta(null);
                    setMetaStatus("idle");
                    setAnalysisStatus("idle");
                  }}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
                <button type="submit" disabled={!videoId || analysisStatus === "analyzing"}>
                  {analysisStatus === "analyzing" ? "解析中" : "解析する"}
                </button>
              </div>
              {youtubeUrl && (
                <p className={videoId ? "status success" : "status error"}>
                  {videoId ? `videoId: ${videoId}` : "有効なYouTube URLを入力してください"}
                </p>
              )}

              <div className="output-picker primary-output" aria-label="出力形式">
                <button
                  className={outputMode === "chords" ? "output-option active" : "output-option"}
                  type="button"
                  onClick={() => setOutputMode("chords")}
                >
                  <strong>コード進行</strong>
                  <span>編集ノートに反映</span>
                </button>
                <button
                  className={outputMode === "midi" ? "output-option active" : "output-option"}
                  type="button"
                  onClick={() => setOutputMode("midi")}
                >
                  <strong>MIDI</strong>
                  <span>現在の進行から書き出し</span>
                </button>
              </div>

              <div className={`analysis-state ${analysisStatus}`} role="status" aria-live="polite">
                <span>{analysisStatus === "analyzing" ? "Analyzing" : analysisStatus === "success" ? "Ready" : analysisStatus === "failed" ? "Check" : "Static Mode"}</span>
                <p>{message}</p>
              </div>
            </form>

            {videoId && thumbnailUrl && embedUrl && (
              <div className="video-preview reveal">
                <img src={thumbnailUrl} alt="YouTube video thumbnail" />
                <div className="video-copy">
                  <h3>{videoMeta?.title ?? "動画タイトルを取得できます"}</h3>
                  <p>
                    {metaStatus === "loading"
                      ? "タイトルを取得中..."
                      : videoMeta?.authorName
                        ? `Channel: ${videoMeta.authorName}`
                        : metaStatus === "failed"
                          ? "タイトル取得に失敗したためフォールバック表示です"
                          : "解析ボタンでタイトルも確認します"}
                  </p>
                </div>
                <iframe
                  title="YouTube embedded player"
                  src={embedUrl}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            )}

            <div className="supplemental-input">
              <div>
                <h3>補助入力</h3>
                <p>手元の音源ファイル名からダミー進行を作る入口です。ブラウザ内で完結し、音声送信は行いません。</p>
              </div>
              <div className="upload-box">
                <label htmlFor="audio-file">音源ファイル</label>
                <input id="audio-file" type="file" accept="audio/*" onChange={handleAudioFileChange} />
                {audioFile && (
                  <div className="file-summary">
                    <strong>{audioFile.name}</strong>
                    <span>{(audioFile.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                )}
                <button className="secondary-button" type="button" onClick={handleAnalyzeFile} disabled={!audioFile}>
                  補助ファイルで下書き
                </button>
              </div>
            </div>
          </section>

          <section className="panel editor-panel reveal delay">
            <div className="panel-heading editor-heading">
              <span className="step">2</span>
              <div>
                <h2>コード進行エディタ</h2>
                <p>コードを編集して、MIDIとして書き出せます。キーを変更するとディグリーも更新されます。</p>
              </div>
              <button className="ghost-button" type="button" onClick={addChord}>
                Add Chord
              </button>
            </div>

            <div className="progression-strip" aria-label="コード進行サマリー">
              <strong>{chordText || "コードなし"}</strong>
            </div>

            <div className="chord-editor-grid" aria-label="編集可能なコードカード">
              {analyses.map((analysis, index) => (
                <article
                  className={analysis.entry.id === selectedChordId ? "editable-chord-card selected" : "editable-chord-card"}
                  key={analysis.entry.id}
                  onClick={() => setSelectedChordId(analysis.entry.id)}
                >
                  <div className="card-topline">
                    <span>Bar {analysis.entry.bar}</span>
                    <span>{analysis.entry.start}s - {analysis.entry.end}s</span>
                  </div>
                  <label htmlFor={`chord-${analysis.entry.id}`}>Chord</label>
                  <input
                    id={`chord-${analysis.entry.id}`}
                    type="text"
                    value={analysis.entry.chord}
                    onChange={(event) => updateChord(analysis.entry.id, event.target.value)}
                    onFocus={() => setSelectedChordId(analysis.entry.id)}
                    placeholder="Cmaj7"
                  />
                  <div className="degree-pill">{analysis.degree}</div>
                  <textarea
                    value={analysis.entry.memo ?? ""}
                    onChange={(event) => updateMemo(analysis.entry.id, event.target.value)}
                    onFocus={() => setSelectedChordId(analysis.entry.id)}
                    placeholder="メモ"
                    rows={2}
                  />
                  {!analysis.parsed.supported && <p className="card-warning">{analysis.parsed.reason}</p>}
                  <div className="card-actions">
                    <button type="button" onClick={() => moveChord(analysis.entry.id, -1)} disabled={index === 0}>
                      ←
                    </button>
                    <button type="button" onClick={() => moveChord(analysis.entry.id, 1)} disabled={index === analyses.length - 1}>
                      →
                    </button>
                    <button type="button" onClick={() => removeChord(analysis.entry.id)} disabled={analyses.length <= 1}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="side-stack">
          <section className="panel settings-panel reveal delay">
            <div className="panel-heading compact-heading">
              <span className="step">3</span>
              <div>
                <h2>曲設定</h2>
                <p>ディグリー分析とMIDI書き出しに反映されます。</p>
              </div>
            </div>

            <div className="settings-grid">
              <label>
                Key
                <select value={settings.key} onChange={(event) => updateSettings({ key: event.target.value as KeyName })}>
                  {KEY_OPTIONS.map((key) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Scale
                <select value={settings.scale} onChange={(event) => updateSettings({ scale: event.target.value as ScaleName })}>
                  {SCALE_OPTIONS.map((scale) => (
                    <option key={scale} value={scale}>
                      {scale}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                BPM
                <input
                  type="number"
                  min={40}
                  max={240}
                  value={settings.bpm}
                  onChange={(event) => updateSettings({ bpm: Number(event.target.value) })}
                />
              </label>
              <label>
                1コードの長さ
                <select
                  value={settings.chordLengthBeats}
                  onChange={(event) => updateSettings({ chordLengthBeats: Number(event.target.value) })}
                >
                  {CHORD_LENGTH_OPTIONS.map((option) => (
                    <option key={`${option.label}-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                MIDI音域
                <select value={settings.midiRange} onChange={(event) => updateSettings({ midiRange: event.target.value as MidiRange })}>
                  {MIDI_RANGES.map((range) => (
                    <option key={range} value={range}>
                      {range}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="panel preset-panel reveal delay">
            <div className="panel-heading compact-heading">
              <span className="step">4</span>
              <div>
                <h2>プリセット</h2>
                <p>選ぶと現在の進行を置き換えます。</p>
              </div>
            </div>
            <div className="preset-list">
              {PRESETS.map((preset) => (
                <button key={preset.name} type="button" onClick={() => applyPreset(preset.chords, preset.name)}>
                  <strong>{preset.name}</strong>
                  <span>{preset.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel analysis-panel reveal delay">
            <div className="panel-heading compact-heading">
              <span className="step">5</span>
              <div>
                <h2>分析メモ</h2>
                <p>選択中コードの機能と前後関係を確認します。</p>
              </div>
            </div>

            {selectedAnalysis && (
              <div className="selected-insight">
                <div className="memo-kicker">
                  {settings.key} {settings.scale} / Bar {selectedAnalysis.entry.bar}
                </div>
                <div className="memo-title-row">
                  <h3>{selectedAnalysis.entry.chord || "未入力"}</h3>
                  <span>{selectedAnalysis.degree}</span>
                </div>
                <div className="memo-grid">
                  <div>
                    <span>Function</span>
                    <strong>{selectedAnalysis.functionName}</strong>
                  </div>
                  <div>
                    <span>Previous</span>
                    <p>{selectedAnalysis.previousRelation}</p>
                  </div>
                  <div>
                    <span>Next</span>
                    <p>{selectedAnalysis.nextRelation}</p>
                  </div>
                  <div>
                    <span>Possibility</span>
                    <p>{selectedAnalysis.secondaryDominant ? `${selectedAnalysis.secondaryDominant} の可能性があります。` : "特別なセカンダリドミナント候補はありません。"}</p>
                  </div>
                </div>
                <p className="memo-note">{selectedAnalysis.explanation}</p>
              </div>
            )}
          </section>

          <section className="panel export-panel reveal delay">
            <div className="panel-heading compact-heading">
              <span className="step">6</span>
              <div>
                <h2>書き出し</h2>
                <p>未対応コードは可能な範囲で近似してMIDI化されます。</p>
              </div>
            </div>

            <div className="copy-grid">
              <button className="secondary-button" type="button" onClick={() => handleCopy("chords")}>
                Copy Chords
              </button>
              <button className="secondary-button" type="button" onClick={() => handleCopy("bars")}>
                Copy Bars
              </button>
              <button className="secondary-button" type="button" onClick={() => handleCopy("degrees")}>
                Copy Degrees
              </button>
            </div>

            <button className="midi-button" type="button" onClick={handleMidiExport} disabled={progression.length === 0}>
              MIDI Export
            </button>

            {copyStatus && <p className="status success">{copyStatus}</p>}
            <button className="reset-button" type="button" onClick={resetNotebook}>
              Reset Notebook
            </button>
          </section>
        </aside>
      </section>
    </main>
  );
}
