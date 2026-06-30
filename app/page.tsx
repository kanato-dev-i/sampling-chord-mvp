"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";

type AnalysisResult = {
  key: string;
  bpm: number;
  sections: {
    label: string;
    chords: string[];
  }[];
};

type VideoMeta = {
  title: string;
  authorName?: string;
};

type OutputMode = "chords" | "midi";

const lyricSketch = [
  {
    label: "Intro",
    lines: ["まだ言葉にする前の短いモチーフ", "余白を残して次の展開へ"],
  },
  {
    label: "Verse",
    lines: ["朝の光をなぞるようにメロディを置く", "低い声で景色を少しずつ開く"],
  },
  {
    label: "Chorus",
    lines: ["ここで視界が広がる", "同じ言葉を少し強く返す"],
  },
];

const demoProgressions: AnalysisResult[] = [
  {
    key: "C major",
    bpm: 96,
    sections: [
      { label: "Intro", chords: ["Cmaj7", "G/B", "Am7", "Fmaj7"] },
      { label: "Verse", chords: ["Dm7", "G7", "Em7", "Am7"] },
      { label: "Chorus", chords: ["Fmaj7", "G", "C", "Am7"] },
    ],
  },
  {
    key: "A minor",
    bpm: 112,
    sections: [
      { label: "Intro", chords: ["Am", "F", "C", "G"] },
      { label: "Verse", chords: ["Dm", "Am", "E7", "Am"] },
      { label: "Chorus", chords: ["F", "G", "Em", "Am"] },
    ],
  },
  {
    key: "E major",
    bpm: 128,
    sections: [
      { label: "Intro", chords: ["E", "B", "C#m", "A"] },
      { label: "Verse", chords: ["F#m7", "B7", "Emaj7", "C#m7"] },
      { label: "Chorus", chords: ["A", "B", "G#m7", "C#m7"] },
    ],
  },
];

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

function pickDemoResult(fileName: string): AnalysisResult {
  const charTotal = Array.from(fileName).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return demoProgressions[charTotal % demoProgressions.length];
}

function makeDummyMidiBytes(): Uint8Array {
  return new Uint8Array([
    0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x01, 0x01, 0xe0, 0x4d, 0x54,
    0x72, 0x6b, 0x00, 0x00, 0x00, 0x2b, 0x00, 0xff, 0x03, 0x0f, 0x43, 0x68, 0x6f, 0x72, 0x64, 0x20,
    0x4d, 0x56, 0x50, 0x20, 0x44, 0x65, 0x6d, 0x6f, 0x00, 0xc0, 0x00, 0x00, 0x90, 0x3c, 0x50, 0x00,
    0x90, 0x40, 0x48, 0x00, 0x90, 0x43, 0x48, 0x83, 0x60, 0x80, 0x3c, 0x40, 0x00, 0x80, 0x40, 0x40,
    0x00, 0x80, 0x43, 0x40, 0x00, 0xff, 0x2f, 0x00,
  ]);
}

function downloadDummyMidi(fileName: string) {
  const midiBytes = makeDummyMidiBytes();
  const midiBuffer = new ArrayBuffer(midiBytes.byteLength);
  new Uint8Array(midiBuffer).set(midiBytes);
  const blob = new Blob([midiBuffer], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${fileName.replace(/\.[^/.]+$/, "") || "chord-progression"}-demo.mid`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null);
  const [metaStatus, setMetaStatus] = useState<"idle" | "loading" | "failed">("idle");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [selectedChord, setSelectedChord] = useState<string | null>(null);
  const [outputMode, setOutputMode] = useState<OutputMode>("chords");
  const [midiStatus, setMidiStatus] = useState<"idle" | "saved">("idle");

  const videoId = useMemo(() => extractYouTubeVideoId(youtubeUrl), [youtubeUrl]);
  const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
  const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : null;

  async function handleVideoSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

  function handleAudioFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setAudioFile(file);
    setAnalysis(null);
    setSelectedChord(null);
    setMidiStatus("idle");
  }

  function handleExtract() {
    if (!audioFile) {
      return;
    }

    const nextAnalysis = pickDemoResult(audioFile.name);
    setAnalysis(nextAnalysis);
    setSelectedChord(`${nextAnalysis.sections[0].label}-${nextAnalysis.sections[0].chords[0]}-0`);

    if (outputMode === "midi") {
      downloadDummyMidi(audioFile.name);
      setMidiStatus("saved");
    }
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

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Chord Progression MVP</p>
          <h1>YouTube動画と音源ファイルからコード進行の下書きを作る</h1>
          <p className="lead">
            YouTube URLを入れると動画情報をプレビューします。音源ファイルを選んで解析すると、MVP用のダミーコード進行を表示します。
          </p>
        </div>
      </section>

      <section className="workspace" aria-label="コード進行推定ワークスペース">
        <div className="panel reveal">
          <div className="panel-heading">
            <span className="step">1</span>
            <div>
              <h2>YouTube URL</h2>
              <p>watch、shorts、embed、youtu.be形式に対応</p>
            </div>
          </div>

          <form className="url-form" onSubmit={handleVideoSubmit}>
            <label htmlFor="youtube-url">URL</label>
            <div className="input-row">
              <input
                id="youtube-url"
                type="url"
                value={youtubeUrl}
                onChange={(event) => {
                  setYoutubeUrl(event.target.value);
                  setVideoMeta(null);
                  setMetaStatus("idle");
                }}
                placeholder="https://www.youtube.com/watch?v=..."
              />
              <button type="submit">表示</button>
            </div>
            {youtubeUrl && (
              <p className={videoId ? "status success" : "status error"}>
                {videoId ? `videoId: ${videoId}` : "有効なYouTube URLを入力してください"}
              </p>
            )}
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
                        : "表示ボタンでタイトルを取得します"}
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
        </div>

        <div className="panel reveal delay">
          <div className="panel-heading">
            <span className="step">2</span>
            <div>
              <h2>抽出する出力</h2>
              <p>音源ファイルを選び、コード進行またはMIDIを抽出</p>
            </div>
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

            <div className="output-picker" aria-label="抽出する出力">
              <button
                className={outputMode === "chords" ? "output-option active" : "output-option"}
                type="button"
                onClick={() => {
                  setOutputMode("chords");
                  setMidiStatus("idle");
                }}
              >
                <strong>コード進行</strong>
                <span>歌詞メモと並べて表示</span>
              </button>
              <button
                className={outputMode === "midi" ? "output-option active" : "output-option"}
                type="button"
                onClick={() => setOutputMode("midi")}
              >
                <strong>MIDI</strong>
                <span>ダミー.midを保存</span>
              </button>
            </div>

            <button className="analyze-button" type="button" onClick={handleExtract} disabled={!audioFile}>
              {outputMode === "chords" ? "コード進行を抽出する" : "MIDIを抽出して保存する"}
            </button>
          </div>

          {analysis && outputMode === "chords" && (
            <div className="analysis-result reveal">
              <div className="result-summary">
                <div>
                  <span>Key</span>
                  <strong>{analysis.key}</strong>
                </div>
                <div>
                  <span>BPM</span>
                  <strong>{analysis.bpm}</strong>
                </div>
              </div>

              <div className="parallel-note">
                <div className="lyrics-column" aria-label="歌詞メモ">
                  <h3>歌詞メモ</h3>
                  {lyricSketch.map((section) => (
                    <div className="lyric-block" key={section.label}>
                      <span>{section.label}</span>
                      {section.lines.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                  ))}
                </div>

                <div className="section-list" aria-label="コード進行">
                  <h3>コード進行</h3>
                {analysis.sections.map((section) => (
                  <div className="chord-section" key={section.label}>
                    <h3>{section.label}</h3>
                    <div className="chords">
                      {section.chords.map((chord, index) => (
                        <button
                          className={selectedChord === `${section.label}-${chord}-${index}` ? "chord-card selected" : "chord-card"}
                          key={`${section.label}-${chord}-${index}`}
                          type="button"
                          onClick={() => setSelectedChord(`${section.label}-${chord}-${index}`)}
                        >
                          {chord}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                </div>
              </div>
            </div>
          )}

          {outputMode === "midi" && (
            <div className="midi-export-panel reveal">
              <h3>MIDI書き出し</h3>
              <p>
                「MIDIを抽出して保存する」を押すと、MVP用の短いダミーMIDIファイルを保存します。実際の解析やYouTube音声取得は行いません。
              </p>
              {midiStatus === "saved" && <p className="status success">ダミーMIDIの保存を開始しました。</p>}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
