# プリカレ バックエンド (Puricale Backend)

学校プリントをAIで解析し、Googleカレンダーに自動登録するLINE Botのバックエンドシステム。

## 🌐 サービス概要

**プリカレ**のバックエンドAPIサーバーです。  
Cloudflare Workers上で動作し、LINE BotのWebhookを受け取り、Gemini AIによる画像解析とGoogle Calendar APIへの登録を担います。

- **サービスURL**: https://puricale.jp
- **LINE公式アカウント**: https://lin.ee/XnxBBmG

## 🛠 技術スタック

- **ランタイム**: [Cloudflare Workers](https://workers.cloudflare.com/)
- **フレームワーク**: [Hono](https://hono.dev/) v4
- **AI**: Google Gemini API (`gemini-2.0-flash`) — 画像OCR・イベント抽出
- **DB**: [Supabase](https://supabase.com/) — ユーザー情報・認証・イベントログ
- **外部連携**: LINE Bot SDK, Google Calendar API, Google OAuth2, LINE LIFF

## 🚀 プロジェクト構成

```text
/
├── src/
│   ├── index.ts          # メインロジック（ルーティング・Webhook処理・設定UI）
│   └── flexMessages.ts   # LINE Flex Message UI生成
├── docs/
│   └── CONCEPT.md        # プロダクト仕様書 v9.1
├── .dev.vars             # ローカル開発用の環境変数（git管理外）
├── wrangler.jsonc        # Cloudflare Workers設定
└── package.json
```

## 📡 主なエンドポイント

| パス | メソッド | 説明 |
| :--- | :--- | :--- |
| `/` | GET | ヘルスチェック |
| `/webhook` | POST | LINE Webhookイベント受信 |
| `/auth/landing` | GET | Google連携の案内LP |
| `/auth` | GET | Google OAuth2 リダイレクト |
| `/auth/callback` | GET | Google OAuth2 コールバック |
| `/liff/entry` | GET | LIFF エントリーポイント |
| `/settings` | GET | ユーザー設定画面 |
| `/settings/update` | POST | キーワード設定の更新 |
| `/settings/update_calendar` | POST | カレンダー設定の更新 |

## ⚙️ 処理フロー

```
ユーザーがLINEで画像を送信
  └→ 確認バブル（「解析する」ボタン）を返す
       └→ postback: analyze
            ├→ LINE画像取得
            ├→ Gemini APIで解析（イベント・日時・対象学年を抽出）
            ├→ キーワードフィルタ（学年・クラスで絞り込み）
            ├→ Google Calendar に登録
            └→ Flex Messageで結果表示（Undo / 除外予定の救出ボタン付き）
```

## 🔑 必要な環境変数

`.dev.vars`（ローカル）または Cloudflare Workers の Secret に設定します。

| 変数名 | 説明 |
| :--- | :--- |
| `GOOGLE_CLIENT_ID` | Google OAuth2 クライアントID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 クライアントシークレット |
| `GOOGLE_REDIRECT_URI` | OAuth2 コールバックURI |
| `GEMINI_API_KEY` | Gemini API キー |
| `SUPABASE_URL` | Supabase プロジェクトURL |
| `SUPABASE_KEY` | Supabase サービスロールキー |
| `LINE_CHANNEL_SECRET` | LINE Bot チャンネルシークレット |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Bot アクセストークン |
| `LINE_CHANNEL_ID` | LINE Bot チャンネルID（LIFF検証用） |
| `LINE_LIFF_ID` | LINE LIFF アプリID |
| `JWT_SECRET` | セッション署名用シークレット |
| `ALLOWED_USERS` | アクセス許可するLINEユーザーID（カンマ区切り、αテスト用） |
| `ENVIRONMENT` | `local` を指定するとCookieのSecure属性をOFFにする |

## 🧞 コマンド

| コマンド | 説明 |
| :--- | :--- |
| `npm install` | 依存パッケージのインストール |
| `npm run dev` | ローカル開発サーバー起動（Wrangler） |
| `npm run deploy` | Cloudflare Workersへデプロイ |
| `npm run cf-typegen` | Cloudflare Bindings の型定義を生成 |

## 📐 設計メモ

- **Undo機能**: 登録後30秒以内に取り消し可能。`calendar_events` テーブルに `google_event_id` を保存してGoogleカレンダーから削除
- **Rescue機能**: キーワードフィルタで除外された予定を `parsing_logs` テーブルに保存し、後から登録可能
- **トークンリフレッシュ**: アクセストークンの有効期限を確認し、期限切れなら自動リフレッシュ
- **二重処理防止**: `processed_messages` テーブルへのupsertで解析の冪等性を担保

## 📬 お問い合わせ

- メール: support@puricale.jp
- LINE公式アカウント: https://lin.ee/XnxBBmG

© 2026 Puricale Project. All rights reserved.
