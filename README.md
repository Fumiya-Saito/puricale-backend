# プリカレ バックエンド (Puricale Backend)

学校プリントをAIで解析し、Googleカレンダーに自動登録するLINE Botのバックエンドシステム。

## 🌐 サービス概要

**プリカレ**は、多忙な子育て世帯に向けた**商用B2C SaaS**のバックエンドAPIサーバーです。  
Google Cloud Run上で動作し、LINE BotのWebhookを受け取り、Gemini AIによる画像解析とGoogle Calendar APIへの登録を担います。

- **サービスURL**: https://puricale.jp
- **LINE公式アカウント**: https://lin.ee/XnxBBmG

---

## 💡 課金転換の設計思想（チーム共有）

> **「なぜユーザーはお金を払うのか？」** をチームで共有するためのセクションです。  
> 機能を実装する前に、必ずこの設計意図を確認してください。

プリカレの課金モデルは **「即効性のある価値体験（魔法体験）」** と **「損失回避（Loss Aversion）」** の両輪で成立します。

### ① 魔法体験（Event-Trigger Notification）

ユーザーがプリントを登録した**その瞬間**、去年の同じ行事の記録が自動でヒットし、LINEに通知が届きます。

```
例：「今年の運動会」を登録
  └→「去年の【持ち物リスト】が見つかりました 🗝️」と即座に通知
       └→ タップすると…ロックされている（= チケット消費 or プレミアム登録へ）
```

**「記録があります」という曖昧な通知ではなく、「持ち物リスト」「お弁当メモ」と具体的に提示する**ことで、「見たい！」という強い欲求を生みます（CONCEPT.md § 3 Layer3 参照）。この瞬間が最大のコンバージョンチャンスです。

### ② 損失回避（1ヶ月ロック）

無料ユーザーは、**登録から1ヶ月を経過したプリント画像がロック（閲覧不可）になります。**

```
無料ユーザーの体験:
  ✅ 登録直後     → 普通に見える
  🔒 1ヶ月後     → 鍵マークがかかり、閲覧にチケット🎫が必要になる
  ✅ プレミアム  → 全期間・全データに無制限でアクセス可能
```

習慣化させてから喪失感を与えることで、**「今まで積み上げたデータが見えなくなる恐怖」** がプレミアム継続の動機になります。これはフリーミアム設計の核心であり、コードレビュー時もこの体験フローが壊れていないか確認してください。

### プラン差別化の全体像

| 機能 | スタンダード (無料) | プレミアム (¥300〜500/月) |
| :--- | :--- | :--- |
| カレンダー登録上限 | **月 20件**（30分以内のUndoで枠返却） | **無制限** |
| 子供・カレンダー設定 | **1人分のみ**（単一カレンダー） | **複数人**（兄弟別カレンダー自動振り分け） |
| AI抽出の精度 | **日時・タイトルのみ** | **持ち物・注意事項まで詳細抽出** |
| マイページ（過去の画像） | **直近1ヶ月分のみ**（以降はロック🔒） | **全期間アクセス・復元し放題** |
| 過去画像のロック解除 | **チケット🎫消費**（都度課金） | **Restore Memory 🗝️**（無制限） |
| 事前リマインド通知 | なし | **行事の数日前にLINEで自動リマインド** |

---

## 🛠 技術スタック

- **ランタイム**: [Google Cloud Run](https://cloud.google.com/run) (Node.js)
- **フレームワーク**: [Hono](https://hono.dev/) v4
- **AI**: Google Gemini API (`gemini-2.5-flash`) — 画像OCR・イベント抽出
- **DB**: [Supabase](https://supabase.com/) — ユーザー情報・認証・イベントログ
- **外部連携**: LINE Bot SDK, Google Calendar API, Google OAuth2, LINE LIFF, Stripe

## 🚀 プロジェクト構成

```text
/
├── src/
│   ├── index.ts          # メインロジック（ルーティング・Webhook処理・設定UI）
│   └── flexMessages.ts   # LINE Flex Message UI生成
├── docs/
│   ├── CONCEPT.md        # プロダクト仕様書 v9.1（設計の根拠はこちら）
│   └── FUTURE_REMINDER_SPEC.md  # リマインド通知の詳細仕様
├── Dockerfile            # Cloud Run用コンテナ設定
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
| `/api/cron` | POST | Cron定期実行エンドポイント（認証必須） |
| `/export/data` | GET | 登録データをJSONでダウンロード（要セッション） |

## ⚙️ 処理フロー

### 1. カレンダー登録フロー
```
ユーザーがLINEで画像を送信
  └→ 確認バブル（「解析する」ボタン）を返す
       └→ postback: analyze
            ├→ LINE画像取得
            ├→ Gemini APIで解析（イベント・日時・対象学年を抽出）
            ├→ 兄弟/キーワードごとのカレンダー振り分け
            ├→ Google Calendar に登録
            ├→ タイトルの自動生成と保存（マイページで編集可能）
            ├→ 【課金転換ポイント】過去の同タグプリントを検索し、去年の記録があれば通知
            └→ Flex Messageで結果表示（Undo / 救出ボタン付き）
```

### 2. リマインド通知フロー（現在一時停止中）
```
Google Cloud Scheduler Cron (毎日 12:00 JST) -> /api/cron
  └→ 3日後のカレンダー予定を検索
       └→ プレミアムユーザーへのみLINEリマインドを送信
```

> ⚠️ **現在 `handleScheduled()` の先頭の `return;` により一時停止中。**  
> 再開する際は `src/index.ts` の2184行目を修正してください。

## 🔑 必要な環境変数

`.env`（ローカル）または Google Cloud Run の環境変数に設定します。

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
| `STRIPE_SECRET_KEY` | Stripe APIシークレットキー |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhookシークレット |
| `JWT_SECRET` | セッション署名用シークレット |
| `CRON_SECRET` | /api/cronエンドポイントの認証トークン |
| `ALLOWED_USERS` | アクセス許可するLINEユーザーID（カンマ区切り、αテスト用） |
| `ENVIRONMENT` | `local` を指定するとCookieのSecure属性をOFFにする |

## 🧞 コマンド

| コマンド | 説明 |
| :--- | :--- |
| `npm install` | 依存パッケージのインストール |
| `npm run dev` | ローカル開発サーバー起動 (`tsx watch`) |
| `gcloud run deploy` | Google Cloud Runへ手動デプロイ |

> ⚠️ **重要（開発運用ルール）**:
> * `main`（またはフロントエンドの `master`）ブランチへのマージまたはプッシュにより、Cloud Build 経由で本番環境への自動デプロイが実行されます。
> * そのため、**開発時は直接 `main` (`master`) ブランチへ `push` してはなりません。**
> * 必ず `develop` ブランチ等の開発用ブランチへプッシュし、プルリクエストを経由して本番ブランチへマージするようにしてください。
> * 反映されない場合は [Cloud Build > 履歴](https://console.cloud.google.com/cloud-build/builds) でビルドの成否を確認してください。

## 📐 設計メモ

- **Undo機能**: 登録後30分以内の取り消しであれば月間登録枠が返却されます。`calendar_events` テーブルに `google_event_id` を保存してGoogleカレンダーから削除
- **Rescue機能**: キーワードフィルタで除外された予定を `parsing_logs` テーブルに保存し、後から登録可能
- **複数人（兄弟）対応**: `child_settings` JSONによって、特定のキーワードにマッチした予定を専用のGoogleカレンダーに自動で振り分け
- **ナレッジ化 (Restore機能)**: 過去のプリントを `school_prints` に保存し、カレンダー登録時に去年の同じ行事をレコメンド。閲覧には「チケット」を消費する仕組み
- **二重処理防止**: `processed_messages` テーブルへのupsertで解析の冪等性を担保
- **トークンリフレッシュ**: アクセストークンの有効期限を確認し、期限切れなら自動リフレッシュ

## 📬 お問い合わせ

- メール: support@puricale.jp
- LINE公式アカウント: https://lin.ee/XnxBBmG

© 2026 Puricale Project. All rights reserved.
