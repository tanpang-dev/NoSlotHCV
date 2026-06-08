# NoSlotHCV — リリース計画

> 「お弁当箱（仕組み）は配る。中のおかず（ゲームのデータ）は各自で詰める。」

## 公開範囲
- **A 画面アプリ＋Node鯖** … 自作 → **MIT**、この独立リポジトリ（新規 `git init`）
- **B 本体部品** … nds-bootstrap フォーク → **GPLv3**（別リポジトリ）。prebuilt `MWIFI.BIN`/`.nds` は B の Releases に置く
- **C カードデータ（画像/能力/バーコード）** … **同梱しない**。型(JSON Schema)＋ダミーのみ

## 配らないもの（絶対）
- カード画像・能力値・実バーコード値・実バーコードprefix
- 自分の WiFi 情報（SSID/PSK/PMK）

## 必殺技名
- **省略形のみ**（例 ドラゴンアタック→ドラアタ）＋「非公式の互換ラベル」明記
- 虫の和名/学名（事実）はOK。shipされるサンプルは fictional ダミー

## 起動（初心者向け・.exe化しない）
- 初回: Node導入（README/OS別） → `npm run setup`
- 毎回: `npm start`（Node鯖起動 → 作り置きUI配信 → ブラウザ自動オープン）

## WiFi creds =「鍵焼き」方式
prebuilt `MWIFI.BIN` 内の固定レイアウト鍵スロット（マジック＋SSID＋PMK）を、
PC側ツールが「SSID/PSK → PMK計算 → BIN上書き」。3DS側は実行時計算もSD設定読みも無し
＝ビルド埋め込みと同等の安定性。ツールは A の設定画面に統合。

## README に必須記載（WiFi条件）
- WPA2-PSK（AES/CCMP）
- **PMF（802.11w）無効** … WPA3 / iOS15+ テザリングは不可
- **2.4GHz**、3DSとPCは同一LAN
- 非公式・セガ無関係のディスクレーマ、出典（shonumi「Edge of Emulation」等）

## フェーズ
0. 方針確定 ✅
1. データの型(schema)＋fictionalダミー＋barcode設定の外部化 … 進行中
2. 画面アプリ(A)を GBA-to-PC から分離・スタンドアロン化
3. `npm start` 一発起動＋カード読み込みウィザード
4. 本体部品(B) GPLv3公開＋鍵焼きツール統合
5. 秘匿スキャン(gitleaks)＋クリーンクローン起動検証
6. 初心者向け README ＋ ライセンス整備

## リスク早見
- 🔴 カードデータ/WiFi creds の混入 → 同梱せず＋自動スキャン＋クリーン検証
- 🟠 商標（中立名＋非公式明記）／GPLv3（B）
- 🟡 技名グレー（省略形＋非公式）／Node未導入（手順＋setup）
