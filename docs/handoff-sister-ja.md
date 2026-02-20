# お姉ちゃん向けハンドオフ（Fork提出 + 口頭説明）

## 1. Forkしてリポジトリ提出

1. GitHubで元リポジトリをForkする。
2. Fork先をローカルにcloneし、`.env.example` から `.env` を作成する。
   - 提出前は `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` を必ず設定する。
3. 最低限、以下を実行して通ることを確認する。

```bash
npm install
npx prisma db push
npm run lint
npm run build
```

4. 必要ならデモデータを投入する。

```bash
npm run db:seed
```

5. 変更をcommitしてFork先にpushする。
6. 提出時は以下をセットで伝える。
   - Fork URL
   - 提出ブランチ名
   - 最新コミットSHA

## 2. 口頭説明（設計判断）の準備

### 2-1. 3分版トーク順

1. 課題と狙い  
   複数チャネルのメンションをTODO化し、原文へのトレーサビリティを残す。
2. 主要構成  
   Next.js + Prisma + SQLite。Discordは別プロセスBot、GmailはOAuthで同期。
3. 束ね戦略  
   embedding類似度で候補提示し、人が確定（自動確定しない）。
4. 冪等性と運用  
   `sourceChannel + externalId` で重複取り込み防止。
5. セキュリティの現状と対策  
   OAuth `state` 検証、URLサニタイズ、limit上限、secretのクライアント露出回避を実装済み。  
   今後はAPI全体の認証/認可を最優先で追加する。

### 2-2. よく聞かれる質問の短答

- Q: なぜSQLite?  
  A: セットアップ最小化。PrismaでRDB変更コストを抑えている。
- Q: なぜBotを別プロセス?  
  A: Discord接続は常時接続。Next.js本体と責務分離した方が安全で運用しやすい。
- Q: 自動束ねを確定しない理由は?  
  A: 誤束ねのコストが高いため。候補提示 + 人の最終判断にしている。
- Q: セキュリティはどこまで対応した?  
  A: 最小としてHTTP Basic認証を全体適用。OAuth callbackとDiscord webhookのみ連携都合で除外。ユーザー単位の認可は次フェーズ。

### 2-3. デモ導線（詰まりにくい順）

1. `/dashboard` でTODO一覧と統計を見せる  
2. `/messages` でメッセージからTODO作成  
3. `/todos/:id` で原文リンクと関連バンドル確認  
4. `/bundles` で候補の承認/拒否  
