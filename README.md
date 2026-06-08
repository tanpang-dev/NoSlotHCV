# NoSlotHCV

実機の Nintendo DS / 3DS に、HCV-1000 風のカードを **Wi-Fi 経由**で送り込む PC ツールです。
**物理のスロット型カードリーダー（HCV-1000）は不要**（= "No Slot"）。

> ⚠️ **非公式プロジェクトです。** Sega / SEGA TOYS とは一切関係ありません。
> カード画像・能力値・本物のバーコードは**一切同梱していません**。データの「形式」と
> ダミーのサンプルだけが入っています。実データはご自身で用意してください。

---

## これは何 / 何を含まないか

- ✅ 含む：カードを選ぶ画面（図鑑・対戦）、PCサーバ、Wi-Fi「鍵焼き」、データ取り込み画面
- ❌ 含まない：カード画像・カード能力・本物のバーコード・あなたの Wi-Fi 情報

「お弁当箱（仕組み）」は配り、「中のおかず（ゲームのデータ）」は各自で用意する形です。

## 用意するもの（チェックリスト）

前提：**Homebrew 導入済みの 3DS** ＋ **Wi-Fi アクセスポイント（AP）** ＋ **PC** だけ、を想定。

**PC側**
- [ ] [Node.js](https://nodejs.org/)（LTS 推奨）
- [ ] このリポジトリ（NoSlotHCV）
- [ ] あなたの**カードデータ**：`cards.json`（＋画像フォルダ）※自分で用意（同梱されません）

**Wi-Fi（AP）** ※条件を満たさないと 3DS が繋がりません（[詳細](#wi-fi-の条件重要)）
- [ ] **WPA2-PSK（AES）** / **PMF 無効** / **2.4GHz** / PC と 3DS が**同じネットワーク**

**3DS側**
- [ ] [TWiLight Menu++](https://wiki.ds-homebrew.com/twilightmenu/) 導入済み（nds-bootstrap が動く状態）
- [ ] **本体部品（B）= パッチ済み nds-bootstrap ＋ `MWIFI.BIN`**
      → [GPLv3 フォークの Release](https://github.com/tanpang-dev/nds-bootstrap-noslothcv/releases/latest) から入手
- [ ] **対応ソフトの ROM**（HCV-1000 に対応した DS タイトル。自分で吸い出したもの）
- [ ] SD カードへファイルを置く手段（カードリーダー or FTP）

---

## 一気通貫セットアップ

### 1. PC：起動できる状態にする
```bash
npm run setup     # 初回だけ（依存導入＋UIビルド）
npm start         # 毎回（サーバ起動 → ブラウザが http://localhost:3001 を開く）
```

### 2. PC：カードデータを入れる
- 「**データ**」タブ → 自分の `cards.json` を選択（形式は [`data/cards.schema.json`](data/cards.schema.json)）
- 画像フォルダがあれば一緒に取り込み（無くても動作。「画像なし」表示になるだけ）

### 3. PC：Wi-Fi の鍵を焼く（MWIFI.BIN を自分用に）
1. フォーク Release から `MWIFI.BIN`（空スロット版）を入手し **`device/MWIFI.BIN`** に置く
2. 「**設定**」タブ → SSID と Wi-Fi パスワードを入力 → **あなた専用の `MWIFI.BIN`** がダウンロードされる
   （パスワードは PC 内で鍵計算に使うだけ。保存も送信もしません）

### 4. 3DS：SD カードに配置する
- 焼いた **`MWIFI.BIN`** → **SD カードのルート**
- フォークの **パッチ済み nds-bootstrap 本体**（`nds-bootstrap-release.nds`）→ **`/_nds/`** に配置
  （TWiLight の `BOOTSTRAP_FILE` 設定に合わせる。不安なら release/nightly 両方に同じものを置く）
- **対応ソフトの ROM** → `sd:/roms/nds/` 等、`nds-bootstrap.ini` の `NDS_PATH` が指す場所へ

### 5. 遊ぶ
1. 3DS と PC を**同じ AP** に接続
2. **TWiLight Menu++ から対応ソフトを起動**（自動で WiFi 接続 → PC を発見）
3. PC の **http://localhost:3001** でカードをクリック
4. ゲームの**スキャン待ち画面**で、そのカードが読み込まれる

> 仕組み：3DS は PC を UDP で自動発見し、`/mushiking/current-card` を HTTP でポーリング。
> PC で選んだカードが次のポーリングで実機に届きます。

---

## Wi-Fi の条件（重要）

DS/3DS 側がつなげるアクセスポイントは次を満たす必要があります。

- **WPA2-PSK（AES / CCMP）**（WPA2-TKIP は不可）
- **PMF / 802.11w が無効**（「保護された管理フレーム」を要求しない）
  - ⛔ **WPA3** や **iPhone のインターネット共有（iOS 15+）** は不可
- **2.4GHz**、PC と DS/3DS は**同じネットワーク**

## うまく動かないとき

- **3DS が繋がらない**：AP の条件（上記）を確認。特に PMF を無効化、2.4GHz、同一ネットワークか。
- **繋がるがカードが読まれない**：PC の「データ」タブで実カードデータを入れたか確認。
  ゲームが**スキャン待ち画面**かも確認。
- **詳しく見たい**：`NOSLOT_DEBUG=1 npm start` で、3DS の発見・HTTP ポーリング（IP/カード/seq）が
  サーバのログに出ます。

## 本体部品（B）について

実機側のファームウェアは [nds-bootstrap](https://github.com/DS-Homebrew/nds-bootstrap)
の **GPLv3 フォーク**です（別リポジトリ）。標準の nds-bootstrap には WiFi/HCV パッチが
無いため、**必ずフォークのビルドを使ってください**。プレビルドと対応ソースは下記から：

- 本体部品（GPLv3）: https://github.com/tanpang-dev/nds-bootstrap-noslothcv
- **最新リリース**（`MWIFI.BIN` ＋ パッチ済み `nds-bootstrap`）: https://github.com/tanpang-dev/nds-bootstrap-noslothcv/releases/latest

## カードデータの形式

- [`data/cards.schema.json`](data/cards.schema.json) … カードDBの形式（JSON Schema）
- [`data/cards.sample.json`](data/cards.sample.json) … 実データ無しで動かすためのダミー
- [`config/barcode-config.sample.json`](config/barcode-config.sample.json) … バーコード選択ルール（サンプル）

実データ（`data/cards.json`・`data/images/`・実バーコード）は **git に載せません**
（`.gitignore` 済み）。

## 開発者向け

```bash
npm test       # 鍵焼きのユニットテスト
npm run scan   # 秘密（creds/実バーコード/画像）が混ざっていないか検査
```

## ライセンス

- このアプリ（UI + サーバ）：**MIT**（[`LICENSE`](LICENSE)）
- 本体部品（別リポジトリ）：**GPLv3**（nds-bootstrap フォーク）

## クレジット / 免責

[`NOTICE.md`](NOTICE.md) を参照。HCV-1000 の解析は shonumi 氏の記事を参考にしています。
本プロジェクトは非公式であり、権利者とは無関係です。
