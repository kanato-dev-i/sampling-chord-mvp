"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";

type AnalysisResult = {
  key: string;
  bpm: number;
  timeline: {
    time: number;
    chord: string;
  }[];
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
type AnalysisStatus = "idle" | "analyzing" | "success" | "failed";
type AnalysisMode = "mock" | "api";

type AnalyzeYoutubeApiResponse = {
  source: "youtube";
  url: string;
  chords: {
    time: number;
    chord: string;
  }[];
  midiUrl: string | null;
};

type SelectedChordMemo = {
  sectionLabel: string;
  chord: string;
  index: number;
  degree: string;
  functionName: string;
  relation: string;
  note: string;
};

const analysisMode: AnalysisMode = process.env.NEXT_PUBLIC_ANALYSIS_MODE === "api" ? "api" : "mock";

const mockYoutubeChords = [
  { time: 0, chord: "Cmaj7" },
  { time: 4, chord: "Am7" },
  { time: 8, chord: "Dm7" },
  { time: 12, chord: "G7" },
];

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
    timeline: mockYoutubeChords,
    sections: [
      { label: "Intro", chords: ["Cmaj7", "G/B", "Am7", "Fmaj7"] },
      { label: "Verse", chords: ["Dm7", "G7", "Em7", "Am7"] },
      { label: "Chorus", chords: ["Fmaj7", "G", "C", "Am7"] },
    ],
  },
  {
    key: "A minor",
    bpm: 112,
    timeline: [
      { time: 0, chord: "Am" },
      { time: 4, chord: "F" },
      { time: 8, chord: "C" },
      { time: 12, chord: "G" },
    ],
    sections: [
      { label: "Intro", chords: ["Am", "F", "C", "G"] },
      { label: "Verse", chords: ["Dm", "Am", "E7", "Am"] },
      { label: "Chorus", chords: ["F", "G", "Em", "Am"] },
    ],
  },
  {
    key: "E major",
    bpm: 128,
    timeline: [
      { time: 0, chord: "E" },
      { time: 4, chord: "B" },
      { time: 8, chord: "C#m" },
      { time: 12, chord: "A" },
    ],
    sections: [
      { label: "Intro", chords: ["E", "B", "C#m", "A"] },
      { label: "Verse", chords: ["F#m7", "B7", "Emaj7", "C#m7"] },
      { label: "Chorus", chords: ["A", "B", "G#m7", "C#m7"] },
    ],
  },
];

const chordMemos: Record<string, Omit<SelectedChordMemo, "sectionLabel" | "chord" | "index">> = {
  Cmaj7: {
    degree: "Imaj7",
    functionName: "Tonic",
    relation: "G/Bへ滑らかに低音だけが下がり、冒頭の落ち着きを保ちます。",
    note: "明るい中心。メロディを広げず、余白を残すとノートらしい静けさが出ます。",
  },
  "G/B": {
    degree: "V/3rd",
    functionName: "Passing dominant",
    relation: "Cmaj7とAm7の間をつなぐ経過和音として働きます。",
    note: "ベースが半音ではなく順に動くので、場面転換を大きくしすぎません。",
  },
  Am7: {
    degree: "vi7",
    functionName: "Relative minor",
    relation: "前後の明るいコードに少し影を足し、歌詞の余韻を置けます。",
    note: "言葉を詰めず、語尾を少し伸ばす場所として扱いやすいコードです。",
  },
  Fmaj7: {
    degree: "IVmaj7",
    functionName: "Subdominant",
    relation: "次の展開へ空気を開き、Chorusでは入口の支えになります。",
    note: "コード感は強いけれど押しつけすぎない、メモ欄向きの柔らかい支点です。",
  },
  Dm7: {
    degree: "ii7",
    functionName: "Pre-dominant",
    relation: "G7へ向かう準備として、Verseの話し始めを整えます。",
    note: "次に進む力を少しだけ持たせたい小節に置くと自然です。",
  },
  G7: {
    degree: "V7",
    functionName: "Dominant",
    relation: "Em7またはCへ戻るための緊張を作ります。",
    note: "強く解決させず、少し濁りを残すと都会的な静けさに寄ります。",
  },
  Em7: {
    degree: "iii7",
    functionName: "Mediant",
    relation: "G7の後に着地しすぎず、Am7へ自然に視線を移します。",
    note: "主役ではなく、色味を変える薄いレイヤーとして使いやすいコードです。",
  },
  G: {
    degree: "V",
    functionName: "Dominant",
    relation: "Fmaj7からCへ戻すための短い橋になります。",
    note: "強いサビ感を出したくない時は、音数を減らして軽く鳴らすのが合います。",
  },
  C: {
    degree: "I",
    functionName: "Tonic",
    relation: "Gから戻って、Am7へ少しだけ表情を落とします。",
    note: "結論に見せつつ、次の小節へ余白を残せる安定点です。",
  },
};

function getChordMemo(chord: string): Omit<SelectedChordMemo, "sectionLabel" | "chord" | "index"> {
  const normalizedChord = chord.replace(/m(aj)?7?|7|\/.*|\#|b/g, "");

  return (
    chordMemos[chord] ??
    {
      degree: normalizedChord ? `${normalizedChord} area` : "N/A",
      functionName: "Color chord",
      relation: "前後のコードとの距離を見ながら、雰囲気を変えるための小節として扱います。",
      note: "MVPのダミー解析なので、実装時にはここを実解析結果に差し替えます。",
    }
  );
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

function pickDemoResult(fileName: string): AnalysisResult {
  const charTotal = Array.from(fileName).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return demoProgressions[charTotal % demoProgressions.length];
}

function apiResponseToAnalysisResult(data: AnalyzeYoutubeApiResponse, outputType: OutputMode): AnalysisResult {
  return {
    key: "C major",
    bpm: outputType === "midi" ? 100 : 96,
    timeline: data.chords,
    sections: [
      {
        label: "YouTube analysis",
        chords: data.chords.map((item) => item.chord),
      },
    ],
  };
}

async function mockAnalyzeYoutubeUrl(_url: string, outputType: OutputMode): Promise<AnalysisResult> {
  await new Promise((resolve) => setTimeout(resolve, 720));

  return {
    key: "C major",
    bpm: outputType === "midi" ? 100 : 96,
    timeline: mockYoutubeChords,
    sections: [
      { label: "YouTube mock", chords: mockYoutubeChords.map((item) => item.chord) },
      { label: "Turnaround", chords: ["Em7", "Am7", "Fmaj7", "G"] },
    ],
  };
}

async function analyzeYoutubeUrl(url: string, outputType: OutputMode): Promise<AnalysisResult> {
  if (!extractYouTubeVideoId(url)) {
    throw new Error("Invalid YouTube URL");
  }

  if (analysisMode === "mock") {
    return mockAnalyzeYoutubeUrl(url, outputType);
  }

  try {
    const response = await fetch("/api/analyze-youtube", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, outputType }),
    });

    if (response.ok) {
      const data = (await response.json()) as AnalyzeYoutubeApiResponse;
      return apiResponseToAnalysisResult(data, outputType);
    }
  } catch {
    // Keep local experiments resilient if an API server is temporarily unavailable.
  }

  return mockAnalyzeYoutubeUrl(url, outputType);
}

export default function Home() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null);
  const [metaStatus, setMetaStatus] = useState<"idle" | "loading" | "failed">("idle");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>("idle");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [selectedChord, setSelectedChord] = useState<string | null>(null);
  const [outputMode, setOutputMode] = useState<OutputMode>("chords");
  const [midiStatus, setMidiStatus] = useState<"idle" | "unavailable">("idle");
  const [analysisMessage, setAnalysisMessage] = useState("YouTube URLを入力して解析を開始できます。");

  const videoId = useMemo(() => extractYouTubeVideoId(youtubeUrl), [youtubeUrl]);
  const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
  const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  const selectedMemo = useMemo<SelectedChordMemo | null>(() => {
    if (!analysis || !selectedChord) {
      return null;
    }

    for (const section of analysis.sections) {
      const index = section.chords.findIndex((chord, chordIndex) => selectedChord === `${section.label}-${chord}-${chordIndex}`);

      if (index >= 0) {
        const chord = section.chords[index];
        return {
          sectionLabel: section.label,
          chord,
          index,
          ...getChordMemo(chord),
        };
      }
    }

    return null;
  }, [analysis, selectedChord]);

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
      setAnalysisMessage("有効なYouTube URLを入力してください。");
      return;
    }

    setAnalysis(null);
    setSelectedChord(null);
    setMidiStatus("idle");
    setAnalysisStatus("analyzing");
    setAnalysisMessage(
      analysisMode === "api"
        ? "YouTube URLを /api/analyze-youtube に送信して解析中です。"
        : "GitHub Pages向けのフロント内モック解析を実行中です。",
    );
    void fetchVideoMeta();

    try {
      const nextAnalysis = await analyzeYoutubeUrl(youtubeUrl, outputMode);
      setAnalysis(nextAnalysis);
      setSelectedChord(`${nextAnalysis.sections[0].label}-${nextAnalysis.sections[0].chords[0]}-0`);
      setAnalysisStatus("success");
      setAnalysisMessage(
        outputMode === "midi"
          ? "コード進行の解析が完了しました。MIDI生成はバックエンド実装後に有効化されます。"
          : "コード進行の解析が完了しました。下の制作ノートで確認できます。",
      );
    } catch {
      setAnalysisStatus("failed");
      setAnalysisMessage("解析に失敗しました。URLの形式を確認してください。");
    }
  }

  function handleAudioFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setAudioFile(file);
    setAnalysis(null);
    setSelectedChord(null);
    setAnalysisStatus("idle");
    setAnalysisMessage(file ? "補助入力の音源ファイルが選択されました。URL解析と同じ結果欄で確認できます。" : "YouTube URLを入力して解析を開始できます。");
    setMidiStatus("idle");
  }

  function handleAnalyzeFile() {
    if (!audioFile) {
      return;
    }

    const nextAnalysis = pickDemoResult(audioFile.name);
    setAnalysis(nextAnalysis);
    setSelectedChord(`${nextAnalysis.sections[0].label}-${nextAnalysis.sections[0].chords[0]}-0`);
    setAnalysisStatus("success");
    setAnalysisMessage("補助入力の音源ファイルから、MVP用のダミー解析結果を表示しています。");
    setMidiStatus("idle");
  }

  function handleMidiExport() {
    if (!analysis) {
      return;
    }

    setMidiStatus("unavailable");
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
          <p className="eyebrow">Urban Dark Chord Notebook</p>
          <h1>YouTubeの音源からコード進行の下書きを作る</h1>
          <p className="lead">
            YouTube URLを貼って解析すると、コード進行メモを作成し、必要に応じてMIDIを書き出せる想定のMVPです。
          </p>
        </div>
      </section>

      <section className="workspace" aria-label="コード進行推定ワークスペース">
        <div className="panel workflow-panel reveal">
          <div className="panel-heading">
            <span className="step">1</span>
            <div>
              <h2>YouTube URLから解析</h2>
              <p>URLを主な入力ソースにして、コード進行またはMIDI用の解析を開始</p>
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
                  setAnalysis(null);
                  setSelectedChord(null);
                  setAnalysisStatus("idle");
                  setMidiStatus("idle");
                  setAnalysisMessage("YouTube URLを入力して解析を開始できます。");
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
                onClick={() => {
                  setOutputMode("chords");
                  setMidiStatus("idle");
                }}
              >
                <strong>コード進行</strong>
                <span>制作ノート上で確認</span>
              </button>
              <button
                className={outputMode === "midi" ? "output-option active" : "output-option"}
                type="button"
                onClick={() => {
                  setOutputMode("midi");
                  setMidiStatus("idle");
                }}
              >
                <strong>MIDI</strong>
                <span>バックエンド実装後に有効化</span>
              </button>
            </div>

            <div className={`analysis-state ${analysisStatus}`} role="status" aria-live="polite">
              <span>{analysisStatus === "analyzing" ? "Analyzing" : analysisStatus === "success" ? "Ready" : analysisStatus === "failed" ? "Check URL" : "Standby"}</span>
              <p>{analysisMessage}</p>
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
              <p>YouTube解析APIが未実装の間、手元の音源ファイルでもダミー結果を確認できます。</p>
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
                補助ファイルでダミー解析
              </button>
            </div>
          </div>
        </div>

        <div className="panel result-panel reveal delay">
          <div className="panel-heading">
            <span className="step">2</span>
            <div>
              <h2>解析結果</h2>
              <p>コード進行を確認し、解析後にMIDIを書き出し</p>
            </div>
          </div>

          {!analysis && (
            <div className="empty-result">
              <h3>まだ解析結果はありません</h3>
              <p>YouTube URLを貼って「解析する」を押すと、ここにコード進行のダミー結果が表示されます。</p>
            </div>
          )}

          {analysis && (
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

              <div className="progression-strip" aria-label="コード進行サマリー">
                {analysis.timeline.map((item, index) => (
                  <span key={`${item.time}-${item.chord}`}>
                    {item.chord}
                    {index < analysis.timeline.length - 1 && <small>-</small>}
                  </span>
                ))}
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
                  <div className="timeline-list" aria-label="時間付きコードリスト">
                    {analysis.timeline.map((item) => (
                      <div className="timeline-item" key={`${item.time}-${item.chord}`}>
                        <span>{item.time}s</span>
                        <strong>{item.chord}</strong>
                      </div>
                    ))}
                  </div>
                  {analysis.sections.map((section) => (
                    <div className="chord-section" key={section.label}>
                      <h3>{section.label}</h3>
                      <div className="chords">
                        {section.chords.map((chord, index) => (
                          <button
                            className={
                              selectedChord === `${section.label}-${chord}-${index}` ? "chord-card selected" : "chord-card"
                            }
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

              {selectedMemo && (
                <aside className="selected-insight reveal" aria-label="選択中コードの分析メモ">
                  <div className="memo-kicker">{selectedMemo.sectionLabel} / Bar {selectedMemo.index + 1}</div>
                  <div className="memo-title-row">
                    <h3>{selectedMemo.chord}</h3>
                    <span>{selectedMemo.degree}</span>
                  </div>
                  <div className="memo-grid">
                    <div>
                      <span>Function</span>
                      <strong>{selectedMemo.functionName}</strong>
                    </div>
                    <div>
                      <span>Relation</span>
                      <p>{selectedMemo.relation}</p>
                    </div>
                  </div>
                  <p className="memo-note">{selectedMemo.note}</p>
                </aside>
              )}

              <div className="midi-export-panel compact">
                <div>
                  <h3>MIDI Export</h3>
                  <p>解析結果がある時だけ、MVP用のダミーMIDIを書き出せます。</p>
                </div>
                <button className="midi-button" type="button" onClick={handleMidiExport} disabled={!analysis}>
                  MIDIを書き出す
                </button>
                {midiStatus === "unavailable" && (
                  <p className="status success">MIDI生成はバックエンド実装後に有効化されます。</p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
