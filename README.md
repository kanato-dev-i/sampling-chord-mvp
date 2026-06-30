# YouTube Chord Progression MVP

YouTube URLのプレビューと、音源ファイルからのダミーコード進行/MIDI抽出を試すNext.js MVPです。

## Local

```bash
pnpm install
pnpm run dev
```

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
