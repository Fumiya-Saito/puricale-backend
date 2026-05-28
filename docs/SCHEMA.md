# プリカレ データベース仕様書 (Supabase Schema)

このドキュメントは、プリカレ（Puricale）のバックエンドシステムで利用している Supabase のテーブル構成とその役割をまとめたものです。

## 全体アーキテクチャ概要

プリカレのDBは、大きく分けて以下の3つの領域から構成されています。
1. **ユーザー・認証基盤**: `users`, `google_auth`
2. **トランザクション（カレンダー連携）**: `calendar_events`, `parsing_logs`, `processed_messages`
3. **資産化・ナレッジ基盤（Phase 5以降）**: `school_prints`, `tag_corrections`

---

## 1. ユーザー・認証基盤

### 1-1. `users` (ユーザー設定)
LINEユーザーの基本情報と、プリカレの動作設定（振り分けルールなど）を保持するマスタテーブル。

| カラム名 | 型 | デフォルト | 制約 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| **`line_user_id`** | `text` | - | **PK**, Not Null | LINEのユーザーID（プライマリキー） |
| `display_name` | `text` | null | | LINEの表示名（デバッグ・表示用） |
| `is_premium` | `boolean`| `false` | | 有料プラン（Pro版）の契約状態 |
| `calendar_id` | `text` | `'primary'`| | 家族共有カレンダーのGoogle Calendar ID |
| `keywords` | `text[]` | `'{ }'` | | 【旧仕様・互換用】抽出対象キーワード |
| `child_settings` | `jsonb` | `'[]'` | | 【Phase5追加】お子様別のカレンダー設定配列<br>例: `[{ "id": "...", "name": "長男", "calendar_id": "xxx", "keywords": ["1年"] }]` |
| `tickets` | `integer`| `3` | | 【Phase5追加】過去プリント復元チケット残数 |
| `created_at` | `timestamptz` | `now()` | | レコード作成日時 |

### 1-2. `google_auth` (Google OAuth情報)
ユーザーごとのGoogleカレンダー連携用トークンを管理するテーブル。
※セキュアな情報を含むため、RLS(Row Level Security)で厳格に保護する必要があります。

| カラム名 | 型 | デフォルト | 制約 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| **`user_id`** | `text` | - | **PK**, Not Null | `users.line_user_id` への外部キー |
| `refresh_token` | `text` | - | Not Null | Google APIのリフレッシュトークン（永続） |
| `access_token` | `text` | null | | Google APIのアクセストークン（一時） |
| `expiry_date` | `bigint` | null | | アクセストークンの有効期限（エポックミリ秒） |

---

## 2. トランザクション（カレンダー連携）

### 2-1. `calendar_events` (登録済みイベントログ)
Googleカレンダーへ登録成功したイベントの控え。「Undo（取り消し）」を実行する際に、どのGoogleイベントを削除すべきかを特定するために使用します。

| カラム名 | 型 | デフォルト | 制約 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| **`id`** | `bigint` | 自動採番 | **PK** | 一意のID |
| `user_id` | `text` | - | Not Null | 登録したユーザーのLINE ID |
| `google_event_id` | `text` | - | Not Null | Googleカレンダー側で発番されたイベントID |
| `source_message_id`| `text` | - | Not Null | 元となったLINEメッセージ（画像）のID |
| `summary` | `text` | - | Not Null | イベントのタイトル |
| `start_time` | `text` | - | Not Null | イベントの開始日時 |
| `created_at` | `timestamptz` | `now()` | | 登録日時 |

### 2-2. `parsing_logs` (除外イベントログ)
キーワードにマッチしなかった等の理由で、「登録を見送った（除外した）イベント」のログ。「Rescue（除外された予定も登録する）」を実行した際の復元データとして使用します。

| カラム名 | 型 | デフォルト | 制約 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| **`id`** | `bigint` | 自動採番 | **PK** | 一意のID |
| `message_id` | `text` | - | Not Null | 元となったLINEメッセージ（画像）のID |
| `ignored_events` | `jsonb` | null | | 除外されたイベント詳細のJSON配列 |
| `created_at` | `timestamptz` | `now()` | | ログ記録日時 |

### 2-3. `processed_messages` (二重処理防止ロック)
ユーザーが「解析する」ボタンを連打した際などに、同じ画像を2回以上Gemini APIに投げない（二重課金や二重登録を防ぐ）ためのロックテーブル。

| カラム名 | 型 | デフォルト | 制約 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| **`message_id`** | `text` | - | **PK**, Not Null | 処理済みのLINEメッセージID |
| `created_at` | `timestamptz` | `now()` | | ロック日時 |

---

## 3. 資産化・ナレッジ基盤（Phase 5以降）

### 3-1. `school_prints` (プリントナレッジDB)
AIが読み取った画像を「来年のための資産」として蓄積するメインテーブル。「去年の運動会の持ち物」などを復元（Restore）する機能のコアとなります。

| カラム名 | 型 | デフォルト | 制約 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| **`id`** | `uuid` | `gen_random_uuid()`| **PK** | 一意のID |
| `user_id` | `text` | null | FK to `users` | 登録したユーザー |
| `message_id` | `text` | - | **Unique**, Not Null | LINEメッセージID |
| `image_path` | `text` | null | | Supabase Storageに保存された画像へのパス |
| `full_ocr_text` | `text` | null | | Geminiが読み取った生テキスト（全文検索用） |
| `canonical_tags` | `text[]` | null | | 正規化されたタグ配列（例: `['EVENT_SPORTS_DAY', 'ITEM_LUNCH']`） |
| `event_date` | `date` | null | | 対象イベントの開催日 |
| `is_restored` | `boolean`| `false` | | 過去データとしてユーザーによってアンロック（復元）されたか |
| `created_at` | `timestamptz` | `now()` | | レコード作成日時 |

### 3-2. `tag_corrections` (タグ辞書・学習用)
AIの「表記揺れ」を吸収・正規化するためのマッピング辞書。ユーザーが間違ったタグを修正した場合に記録し、システム全体のタグ推論精度を向上させるためにも使われます。

| カラム名 | 型 | デフォルト | 制約 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| **`id`** | `bigint` | 自動採番 | **PK** | 一意のID |
| `original_text` | `text` | null | | Geminiが出力した生のテキスト（例: "秋の運動会"） |
| `corrected_tag_id`| `text` | null | | システム内で定義された正規タグ（例: "EVENT_SPORTS_DAY"） |
| `user_id` | `text` | null | | 修正を行ったユーザー（システム管理者の場合はnull等） |
| `created_at` | `timestamptz` | `now()` | | 登録日時 |
