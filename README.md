# Sampling Chord MVP

GitHub Pagesで動く、静的なコード進行作曲ノートMVPです。

YouTube URLはコード進行の下書きを作る入口として使いますが、YouTube音声の取得・ダウンロードは行いません。コードを手で編集し、キーに基づくディグリー分析を見ながら、現在のコード進行をMIDIとして書き出せます。

## Features

- YouTube URLのvideoId抽出とプレビュー
- ブラウザ内モック解析によるコード進行下書き
- コード名の編集、追加、削除、並べ替え
- Key / Scale / BPM / 1コードの長さ / MIDI音域の設定
- ディグリー、機能分類、前後関係、セカンダリドミナント候補の表示
- `progression-note.mid` のMIDI書き出し
- コード進行とディグリー表記のコピー
- localStorageによる編集内容、設定、テーマ保存
- Urban Darkをデフォルトにしたライト/ダーク切り替え

## Local

```bash
pnpm install
pnpm run dev
```

### Optional local FastAPI mock

GitHub Pagesではバックエンドが動かないため、アプリ本体はフロント内のモック解析を使います。
`backend/` は将来のAPI形状を試すためのローカルモックです。YouTube音声の取得は行いません。

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

バックエンドの `POST /analyze-youtube` はモックのコード進行を返します。

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
