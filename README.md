# mahjang-bot

Discord で4人麻雀の半荘戦績を記録・集計する Bot。Bun + TypeScript + discord.js + SQLite。
Kubernetes（Argo CD / Longhorn / Sealed Secrets）での運用を前提にしている。

## 現在の機能

- `/record` — 半荘ごとに4人分の点数を一括記録
- `/stats` — 個人の対戦数・平均順位・順位率・合計/平均点数
- `/ranking` — サーバー内ランキング
- `/history` — 直近の対戦履歴
- `/undo` — 記録した半荘の取り消し
- `/help` — 使い方

現時点では**順位と素点のみ**を集計する。ウマ・オカ・ポイント計算、レーティング、和了/放銃などの詳細スタッツは未実装。

## 使い方

```text
/record player1:@Alice score1:45000 player2:@Bob score2:30000 player3:@Carol score3:25000 player4:@Dave score4:0
/stats
/stats user:@Alice period:今月
/ranking sort:平均順位 min_games:5
/history limit:10
/undo game_id:12
```

- `player1` が起家。順位は点数降順、同点は起家に近い席が上位。
- 4人の点数の合計は必ず 100,000点。
- `/record` のゲームIDは `/history` でも確認できる。
- `/undo` は記録した本人、または「サーバー管理」権限を持つユーザーのみ実行可能。

 `/stats` の集計項目:

| 項目 | 内容 |
|---|---|
| 対戦数 | 記録された半荘数 |
| 平均順位 | 1〜4位の平均 |
| 順位率 | 1位/2位/3位/4位の割合 |
| 合計点数 | 最終持ち点の単純合計 |
| 平均点数 | 最終持ち点の平均 |

合計点数は持ち点の合計であり、ウマ・オカは含まない。

## セットアップ

### 1. Discord Application を作成

1. [Discord Developer Portal](https://discord.com/developers/applications) で New Application
2. **General Information** の Application ID を控える
3. **Bot** タブで Token を発行して控える
4. Privileged Gateway Intents は不要（`Guilds` のみ使用）

### 2. Bot をサーバーに招待

以下の URL の `<CLIENT_ID>` を置き換えて開く。

```text
https://discord.com/oauth2/authorize?client_id=<CLIENT_ID>&permissions=19456&scope=bot%20applications.commands
```

`19456` は チャンネルを見る / メッセージを送信 / 埋め込みリンク の権限。

### 3. 環境変数

```sh
cp .env.example .env
```

`.env` に `DISCORD_TOKEN`、`DISCORD_CLIENT_ID`、`GUILD_ID` を設定する。
`GUILD_ID` はコマンドを登録するサーバーの ID。

### 4. 依存関係とコマンド登録

```sh
bun install
bun run deploy
```

`bun run deploy` は `GUILD_ID` のサーバーにスラッシュコマンドを即時登録する。Bot がまだサーバーに参加していないと失敗する。

### 5. 起動

```sh
bun run dev
```

本番相当:

```sh
bun run start
```

## 開発

```sh
bun run typecheck
bun test
```

### 構成

```text
src/
  index.ts             # Discord クライアント、ヘルスサーバー、SIGTERM 処理
  deploy-commands.ts   # ギルドコマンド登録
  commands/            # スラッシュコマンド
  db/                  # SQLite 接続・マイグレーション・クエリ
  lib/                 # 順位計算・集計・表示フォーマット
test/                  # 純ロジックと in-memory DB のテスト
```

## Docker

```sh
docker build -t mahjang-bot .
docker run --rm --env-file .env -p 3000:3000 -v "$PWD/data:/app/data" mahjang-bot
```

`main` ブランチへの push で GitHub Actions が `ghcr.io/<owner>/mahjang-bot` に
`sha-<short>` と `latest` を push する。GHCR のパッケージは初回 push 後に
Package settings から Public に変更する（private の場合は imagePullSecret が必要）。

## Kubernetes

マニフェストは private の `manifests` リポジトリで管理する。

- `applications/mahjang-bot/` — Namespace、Longhorn PVC、Deployment、コマンド登録 Job、SealedSecret
- `argocd/apps/mahjang-bot.yaml` — Argo CD Application

構成のポイント:

- Discord Gateway への outbound 接続のみ。Service / Ingress は不要。
- SQLite を Longhorn PVC に置くため **1 replica 固定 + Recreate**。
- `/healthz` と `/readyz` を 3000 番ポートで提供し、kubelet の probe が直接叩く。
- コマンド登録は Argo CD の PostSync Job で実行する。`PUT` なので毎回実行しても冪等。
- 環境変数は Secret `mahjang-bot-secrets` から注入する。

SealedSecret の生成:

```sh
cd ../manifests
cp applications/mahjang-bot/mahjang-bot.env.example applications/mahjang-bot/mahjang-bot.env
# DISCORD_TOKEN / DISCORD_CLIENT_ID / GUILD_ID を記入
kubectl create secret generic mahjang-bot-secrets \
  --namespace=mahjang-bot \
  --from-env-file=applications/mahjang-bot/mahjang-bot.env \
  --dry-run=client -o yaml | \
kubeseal --controller-name=sealed-secrets-controller \
  --controller-namespace=sealed-secrets \
  --format=yaml \
  > applications/mahjang-bot/mahjang-bot-sealedsecret.yaml
```

生成後、`applications/mahjang-bot/kustomization.yaml` と
`argocd/apps/kustomization.yaml` に必要なファイルを追加する。詳細は
`manifests/applications/mahjang-bot/README.md` を参照。

### データとバックアップ

- DB は `/app/data/mahjang.db`（WAL モード）。
- レプリカを増やすと SQLite が壊れるため、Horizontal Pod Autoscaler や複数 replica は使わない。
- バックアップはまず Longhorn のスナップショットで運用する。必要になったら
  `VACUUM INTO` で RustFS に退避する CronJob を追加する。

## 補足

- コマンドは `GUILD_ID` のサーバーにのみ登録する。複数サーバーで使う場合は、
  サーバーごとに登録するかグローバル登録に切り替える。DB は `guild_id` で分離済み。
- 表示名は記録時点のものを保存する。`/stats` と `/history` は保存済みの表示名を使う。
- ゲスト（Discord 未参加者）は記録できない。
- 三麻、ウマ・オカ、レーティング、詳細スタッツ、CSV エクスポートは今後追加する。
