# kintone フィールドスタイル取得・設定サンプルプラグイン

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/r3-yamauchi/kintone-set-field-style-sample-plugin)

これは kintone の 2026年2月8日アップデートで追加された JavaScript API である kintone.app.record.getFieldStyle および setFieldStyle の実行を試すことのできる kintoneプラグインのサンプルです。
レコード追加画面およびレコード編集画面で、フィールドのスタイル情報を取得・編集・設定できます。

## 主な機能

- フィールドスタイル情報の取得（getFieldStyle）
- フィールドスタイル情報の設定（setFieldStyle）
- 取得したスタイル情報の編集
- フィールドスタイルの既定値への復元
- レコードフォームのレイアウト順でフィールドを一覧表示

## 動作前提

- kintone 環境（PC 版）でプラグインが利用可能であること

## 使用方法

1. プラグインをインストールして、対象アプリに適用します
2. アプリの設定を更新します
3. レコード追加画面またはレコード編集画面を開きます
4. 画面右側にサイドパネルが自動的に表示されます
5. プルダウンからフィールドを選択し、「取得」ボタンをクリックするとフィールドスタイル情報が表示されます
6. 表示されたJSON形式のスタイル情報を編集し、「反映する」ボタンで変更を適用できます
7. 「既定のスタイルへ戻す」ボタンでフィールドスタイルを初期状態に戻すことができます
8. パネルを閉じるには、パネル内の×ボタンをクリックします

## API リファレンス

このプラグインで使用している kintone JavaScript API:

- [kintone.app.record.getFieldStyle()](https://cybozu.dev/ja/kintone/docs/js-api/record/get-field-style/) - フィールドのスタイル情報を取得
- [kintone.app.record.setFieldStyle()](https://cybozu.dev/ja/kintone/docs/js-api/record/set-field-style/) - フィールドのスタイル情報を設定

## ビルド方法

```bash
# 秘密鍵の生成（初回のみ）
npm run keygen

# プラグインのビルド
npm run build

# 開発モード（ファイル監視）
npm run develop

# プラグインのアップロード
npm run upload
```

ビルドされたプラグインは `dist/plugin.zip` に出力されます。

## 利用シーン

このサンプルプラグインは以下のような用途で参考になります:

- **フィールドスタイルのデバッグ**: 現在適用されているフィールドスタイルの確認
- **動的なスタイル変更**: ユーザー操作に応じたフィールドの表示/非表示の制御
- **フィールドの視覚的な強調**: 重要なフィールドの強調表示や警告表示
- **条件付きスタイリング**: レコードの値に応じた動的なフィールドスタイル適用
- **API学習**: getFieldStyle/setFieldStyle API の使用方法の学習

## ライセンス

- 本プラグインは AGPL-3.0 ライセンスです。

**「kintone」はサイボウズ株式会社の登録商標です。**

ここに記載している内容は情報提供を目的としており、個別のサポートはできません。
設定内容についてのご質問やご自身の環境で動作しないといったお問い合わせをいただいても対応はできませんので、ご了承ください。
