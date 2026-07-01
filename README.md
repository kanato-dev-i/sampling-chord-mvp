# YouTube Chord Progression MVP

YouTube URLのプレビューと、音源ファイルからのダミーコード進行/MIDI抽出を試すNext.js MVPです。

## Local

```bash
pnpm install
pnpm run dev
```

### Local FastAPI backend

GitHub Pagesではバックエンドが動かないため、通常はフロント内のモック解析を使います。
ローカルでFastAPIバックエンドを試す場合は別ターミナルで起動します。

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

フロントからローカルAPIを呼ぶ場合は、Next.js側を次の環境変数で起動します。

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 NEXT_PUBLIC_ANALYSIS_MODE=api pnpm run dev
```

バックエンドの `POST /analyze-youtube` は最初はモックのコード進行を返します。
`USE_REAL_YOUTUBE_AUDIO=true` を付けて起動すると、開発用に `yt-dlp` と `ffmpeg` を使う音声取得・WAV変換の経路へ進みます。

## Build

```bash
pnpm run build
```

`next.config.mjs`で `output: "export"` を設定しているため、ビルド後に `out/` が生成されます。

## GitHub Pages

このリポジトリでは `.github/workflows/deploy-pages.yml` にGitHub Pages用のActions workflowを追加しています。

1. GitHubのリポジトリ設定で **Settings > Pages > Build and deployment** を開く
2. Sourceを **GitHub Actions** にする
3. `main` ブランチへpushする、またはActions画面から `Deploy GitHub Pages` を手動実行する

通常のリポジトリPagesの場合、公開URLは次の形です。

```text
https://<ユーザー名>.github.io/<リポジトリ名>/
```

ユーザー/Organization Pagesリポジトリ、つまり `<ユーザー名>.github.io` という名前のリポジトリの場合は次の形です。

```text
https://<ユーザー名>.github.io/
```

workflow内で `NEXT_PUBLIC_BASE_PATH` を自動設定し、通常リポジトリでは `/<リポジトリ名>` 配下で動くようにしています。
