# Mention TODO - Cross-Platform Task Manager

複数のコミュニケーションチャネル（Gmail・Discord）に散らばる「自分宛の依頼・メンション」を収集し、TODOとして束ねて管理するツール。

## 起動手順

### 前提
- Node.js v18+
- npm

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

```bash
cp .env.example .env
# .env を編集してAPIキーを設定
```

既に `.env` がある場合はコピーせず、そのまま編集してください。  
`GMAIL_CLIENT_ID` と `NEXT_PUBLIC_GMAIL_CLIENT_ID` は同じ値を設定します。
提出前は `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` を設定して、アプリ/APIを保護してください。

### 3. データベースのセットアップ

```bash
# テーブル作成（初回のみ）
npx prisma db push

# デモデータの投入（任意）
npm run db:seed
```

`DATABASE_URL` はデフォルトで `file:./prisma/dev.db` を使います。

### 4. アプリケーション起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 にアクセス。

### 5. Discord Bot起動（任意）

```bash
cd discord-bot
npm install
node index.js
```

## 提出前チェック

```bash
npm run lint
npm run build
```

## Fork提出・口頭説明ハンドオフ

お姉ちゃん向けの実行手順は `docs/handoff-sister-ja.md` にまとめています。

## 主要画面

| URL | 説明 |
|-----|------|
| `/dashboard` | TODO一覧・統計・フィルター |
| `/messages` | メッセージ受信箱（チャネル別フィルター） |
| `/todos/:id` | TODO詳細・ソースメッセージ・トレーサビリティ |
| `/bundles` | 類似TODO束ねレビュー（承認/拒否） |
| `/settings/discord` | Discord Bot設定 |
| `/settings/gmail` | Gmail OAuth連携設定 |

## 技術スタック

| 項目 | 選択 |
|------|------|
| Framework | Next.js 16 (App Router) + TypeScript |
| UI | shadcn/ui + Tailwind CSS v4 |
| DB | Prisma ORM + SQLite (better-sqlite3) |
| 外部連携 | Gmail API (OAuth2) + Discord Bot (discord.js) |
| LLM | OpenAI embedding (text-embedding-3-small) |

## データモデル

```
Message ─── MessageToTodo ─── Todo ─── BundleMember ─── Bundle
(受信メッセージ)  (多対多リンク)   (TODO)    (束ねメンバー)    (束ね)
```

- **Message**: 外部チャネルから取り込んだ生メッセージ
- **Todo**: 構造化されたタスク
- **MessageToTodo**: Message↔Todo多対多リンク（トレーサビリティ）
- **Bundle**: 類似TODO束ね候補（SUGGESTED→CONFIRMED/REJECTED）

## 設計判断

### なぜ「候補提示→人が確定」方式か
完全自動化よりも、ユーザーが判断するフローの方が信頼性が高い。
LLMのembeddingで類似度を計算し、閾値超えのペアを候補として提示。
ユーザーが「Bundle these」/「Not related」で最終判断する。

### なぜ SQLite か
- セットアップ不要（`npx prisma db push` だけで起動）
- 個人ユースケースでは十分な性能
- Prisma ORMで抽象化しているためPostgreSQLへの移行も容易

### なぜ Discord Bot は別プロセスか
- Next.jsはリクエスト/レスポンスモデル。WebSocket常時接続は別プロセスが適切
- Bot → Next.js API にHTTP POSTでデータ連携（ステートレス）
- 共有シークレット（DISCORD_WEBHOOK_SECRET）で認証

### 冪等性の担保
- `@@unique([sourceChannel, externalId])` で重複取り込みを防止
- 同一メッセージの再インポートは既存レコードを返す（upsert）

## 現状の制約（口頭説明で触れるポイント）

- 認証はHTTP Basicの最小実装。ユーザー単位の認可は未実装。
- OAuth callback (`/api/integrations/gmail/callback`) と Discord webhook (`/api/integrations/discord/webhook`) は連携要件上、Basic認証の除外対象。

## 環境変数

| 変数 | 必須 | 説明 |
|------|------|------|
| `DATABASE_URL` | ○ | SQLiteファイルパス |
| `GMAIL_CLIENT_ID` | △ | Gmail OAuth Client ID |
| `GMAIL_CLIENT_SECRET` | △ | Gmail OAuth Client Secret |
| `NEXT_PUBLIC_GMAIL_CLIENT_ID` | △ | クライアント側OAuth開始用（`GMAIL_CLIENT_ID` と同値） |
| `GMAIL_REDIRECT_URI` | △ | Gmail OAuth callback URL |
| `NEXT_PUBLIC_GMAIL_REDIRECT_URI` | △ | クライアント側OAuth開始用callback URL |
| `DISCORD_BOT_TOKEN` | △ | Discord Botトークン |
| `DISCORD_WEBHOOK_SECRET` | △ | Webhook認証シークレット |
| `DISCORD_WATCHED_CHANNEL_IDS` | - | Botが監視するチャンネルID（カンマ区切り） |
| `NEXT_APP_URL` | - | BotがPOSTするNext.js APIのURL |
| `OPENAI_API_KEY` | △ | embedding生成用 |
| `SIMILARITY_THRESHOLD` | - | 束ね閾値（デフォルト: 0.82） |
| `BASIC_AUTH_USER` | - | HTTP Basic認証ユーザー名 |
| `BASIC_AUTH_PASSWORD` | - | HTTP Basic認証パスワード |

△ = 対応する連携機能を使う場合に必要
