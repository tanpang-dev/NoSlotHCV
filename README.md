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

## 必要なもの

- [Node.js](https://nodejs.org/)（LTS 推奨）
- 同じ Wi-Fi につながる PC と DS/3DS
- 実機側で動かすには **本体部品（B）** が必要 → 後述の GPLv3 リポジトリから入手

## インストールと起動

```bash
# 初回だけ（必要な部品を入れて UI をビルド）
npm run setup

# 毎回（サーバ起動 → UI 配信 → ブラウザが自動で開く）
npm start
```

ブラウザが開かない場合は表示された URL（既定 `http://localhost:3001`）を開いてください。

## Wi-Fi の条件（重要）

DS/3DS 側がつなげるアクセスポイントは次を満たす必要があります。

- **WPA2-PSK（AES / CCMP）**（WPA2-TKIP は不可）
- **PMF / 802.11w が無効**（「保護された管理フレーム」を要求しない）
  - ⛔ **WPA3** や **iPhone のインターネット共有（iOS 15+）** は不可
- **2.4GHz**、PC と DS/3DS は**同じネットワーク**

## 使い方の流れ

1. **カードデータを読み込む**（画面の「データ」タブ）
   - 自分の `cards.json` を選択（形式は [`data/cards.schema.json`](data/cards.schema.json)）
   - 画像フォルダがあれば一緒に取り込み（無くても動きます＝「画像なし」表示）
2. **Wi-Fi を設定する**（「設定」タブ＝鍵焼き）
   - SSID とパスワードを入力 → `MWIFI.BIN` がダウンロードされます
   - ※ これには本体部品 B の `MWIFI.BIN` を `device/MWIFI.BIN` に置いておく必要があります
3. **3DS に転送**：ダウンロードした `MWIFI.BIN` を SD カードのルートへ
4. **遊ぶ**：実機でゲームを起動 → PC 側でカードを選ぶ → 実機に届きます

## 本体部品（B）について

実機側のファームウェアは [nds-bootstrap](https://github.com/DS-Homebrew/nds-bootstrap)
の **GPLv3 フォーク**です（別リポジトリ）。プレビルドの `MWIFI.BIN` と対応ソースは
そちらの Releases から入手してください：

- 本体部品（GPLv3）: `https://github.com/tanpang-dev/nds-bootstrap-noslothcv`（公開予定）

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
