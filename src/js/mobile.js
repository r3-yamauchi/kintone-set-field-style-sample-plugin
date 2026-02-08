(function(PLUGIN_ID) {
  'use strict';

  // 除外するフィールドタイプ
  const EXCLUDED_FIELD_TYPES = [
    'STATUS',           // ステータス
    'STATUS_ASSIGNEE',  // 作業者
    'SUBTABLE',         // テーブル
    'REFERENCE_TABLE',  // 関連レコード一覧
    'GROUP',            // グループ
    'HR',               // 罫線
    'LABEL',            // ラベル
    'SPACER'            // スペース
  ];

  /**
   * フォームレイアウトから配置されているフィールドコードを抽出（順序を保持）
   */
  function extractFieldCodesFromLayout(layout) {
    const fieldCodes = [];
    const seenCodes = new Set(); // 重複チェック用

    for (let i = 0; i < layout.length; i++) {
      const row = layout[i];

      if (row.type === 'ROW') {
        // 通常の行の場合
        for (let j = 0; j < row.fields.length; j++) {
          const field = row.fields[j];
          if (field.type !== 'SPACER' && field.type !== 'HR' && field.type !== 'LABEL') {
            if (!seenCodes.has(field.code)) {
              fieldCodes.push(field.code);
              seenCodes.add(field.code);
            }
          }
        }
      } else if (row.type === 'GROUP') {
        // グループの場合は内部のレイアウトを再帰的に処理
        const groupFieldCodes = extractFieldCodesFromLayout(row.layout);
        for (let k = 0; k < groupFieldCodes.length; k++) {
          const code = groupFieldCodes[k];
          if (!seenCodes.has(code)) {
            fieldCodes.push(code);
            seenCodes.add(code);
          }
        }
      } else if (row.type === 'SUBTABLE') {
        // サブテーブルは除外（EXCLUDED_FIELD_TYPESで除外される）
        continue;
      }
    }

    return fieldCodes;
  }

  /**
   * 現在のフォームにレイアウトされているフィールド情報を取得
   */
  async function getFilteredFields() {
    try {
      const appId = kintone.mobile.app.getId();
      console.log('アプリID:', appId);

      // フォームレイアウト情報を取得
      const layoutResponse = await kintone.api(
        kintone.api.url('/k/v1/app/form/layout', true),
        'GET',
        { app: appId }
      );

      console.log('レイアウト情報:', layoutResponse);

      // レイアウトから配置されているフィールドコードを抽出
      const layoutedFieldCodes = extractFieldCodesFromLayout(layoutResponse.layout);
      console.log('レイアウトされているフィールドコード:', Array.from(layoutedFieldCodes));

      // フィールド情報を取得
      const fieldsResponse = await kintone.api(
        kintone.api.url('/k/v1/app/form/fields', true),
        'GET',
        { app: appId }
      );

      console.log('フィールド情報:', fieldsResponse);

      // レイアウトされていて、除外タイプでないフィールドのみを抽出
      // レイアウト順を保持（ソートしない）
      const filteredFields = [];
      for (let i = 0; i < layoutedFieldCodes.length; i++) {
        const fieldCode = layoutedFieldCodes[i];
        if (Object.prototype.hasOwnProperty.call(fieldsResponse.properties, fieldCode)) {
          const field = fieldsResponse.properties[fieldCode];
          // 除外するフィールドタイプでない場合のみ追加
          if (!EXCLUDED_FIELD_TYPES.includes(field.type)) {
            filteredFields.push({
              code: fieldCode,
              label: field.label,
              type: field.type
            });
          }
        }
      }

      console.log('フィルタリング後のフィールド数:', filteredFields.length);

      return filteredFields;
    } catch (error) {
      console.error('フィールド情報の取得に失敗しました', error);
      return [];
    }
  }

  /**
   * メニューボタンがクリックされた際の処理
   * 適用するスタイルの内容フィールドから値を取得し、スタイル適用対象フィールドに適用する
   */
  async function handleMenuButtonClick() {
    try {
      // プルダウンの選択値を取得
      const targetFieldSelector = document.getElementById('mobile-target-field-selector');
      const styleSourceSelector = document.getElementById('mobile-style-source-selector');

      if (!targetFieldSelector || !styleSourceSelector) {
        alert('プルダウンが見つかりません。');
        return;
      }

      const targetFieldCode = targetFieldSelector.value;
      const styleSourceFieldCode = styleSourceSelector.value;

      // バリデーション: 両方のフィールドが選択されているか確認
      if (!targetFieldCode) {
        alert('スタイル適用対象のフィールドを選択してください。');
        return;
      }

      if (!styleSourceFieldCode) {
        alert('適用するスタイルの内容のフィールドを選択してください。');
        return;
      }

      // 現在のレコードデータを取得
      const record = kintone.mobile.app.record.get();

      // スタイル情報を含むフィールドの値を取得
      const styleSourceField = record.record[styleSourceFieldCode];
      if (!styleSourceField || !styleSourceField.value) {
        alert('適用するスタイルの内容が空です。JSON形式でスタイル情報を入力してください。');
        return;
      }

      const styleJsonString = styleSourceField.value;

      // JSON文字列をパース
      let styleObject;
      try {
        styleObject = JSON.parse(styleJsonString);
      } catch (parseError) {
        alert('スタイル情報のJSON形式が正しくありません。\n\nエラー: ' + parseError.message);
        return;
      }

      // フィールドスタイルを適用（モバイル版API）
      await kintone.mobile.app.record.setFieldStyle(targetFieldCode, styleObject);

      console.log('適用したスタイル:', styleObject);
    } catch (error) {
      console.error('フィールドスタイルの適用に失敗しました', error);
      alert('エラー: ' + error.message);
    }
  }

  /**
   * 既定のスタイルへ戻すボタンがクリックされた際の処理
   */
  async function handleResetStyleButtonClick() {
    try {
      // プルダウンの選択値を取得
      const targetFieldSelector = document.getElementById('mobile-target-field-selector');

      if (!targetFieldSelector) {
        alert('プルダウンが見つかりません。');
        return;
      }

      const targetFieldCode = targetFieldSelector.value;

      // バリデーション: フィールドが選択されているか確認
      if (!targetFieldCode) {
        alert('スタイル適用対象のフィールドを選択してください。');
        return;
      }

      // フィールドスタイルを既定に戻す（モバイル版API）
      await kintone.mobile.app.record.setFieldStyle(targetFieldCode, 'DEFAULT');

      console.log('スタイルを既定に戻しました:', targetFieldCode);
    } catch (error) {
      console.error('フィールドスタイルのリセットに失敗しました', error);
      alert('エラー: ' + error.message);
    }
  }

  /**
   * スタイル適用対象プルダウンを作成する関数
   * @param {Array} fields - フィールド一覧
   * @return {HTMLElement} プルダウン要素を含むコンテナ
   */
  function createTargetFieldDropdown(fields) {
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      margin: 10px 5px;
    `;

    const label = document.createElement('label');
    label.textContent = 'スタイル適用対象:';
    label.style.cssText = `
      font-size: 12px;
      margin-bottom: 4px;
      font-weight: bold;
    `;

    const select = document.createElement('select');
    select.id = 'mobile-target-field-selector';
    select.style.cssText = `
      padding: 8px 10px;
      font-size: 14px;
      border: 1px solid #ccc;
      border-radius: 4px;
      background-color: white;
    `;

    // デフォルトオプション
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- フィールドを選択してください --';
    select.appendChild(defaultOption);

    // フィールドオプションを追加
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const option = document.createElement('option');
      option.value = field.code;
      option.textContent = `${field.label} (${field.code})`;
      select.appendChild(option);
    }

    container.appendChild(label);
    container.appendChild(select);

    return container;
  }

  /**
   * 適用するスタイルの内容プルダウンを作成する関数
   * @param {Array} fields - フィールド一覧
   * @return {HTMLElement} プルダウン要素を含むコンテナ
   */
  function createStyleSourceDropdown(fields) {
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      margin: 10px 5px;
    `;

    const label = document.createElement('label');
    label.textContent = '適用するスタイルの内容:';
    label.style.cssText = `
      font-size: 12px;
      margin-bottom: 4px;
      font-weight: bold;
    `;

    const select = document.createElement('select');
    select.id = 'mobile-style-source-selector';
    select.style.cssText = `
      padding: 8px 10px;
      font-size: 14px;
      border: 1px solid #ccc;
      border-radius: 4px;
      background-color: white;
    `;

    // デフォルトオプション
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- フィールドを選択してください --';
    select.appendChild(defaultOption);

    // 文字列（複数行）フィールドのみを追加
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      if (field.type === 'MULTI_LINE_TEXT') {
        const option = document.createElement('option');
        option.value = field.code;
        option.textContent = `${field.label} (${field.code})`;
        select.appendChild(option);
      }
    }

    container.appendChild(label);
    container.appendChild(select);

    return container;
  }

  /**
   * 反映するボタンを作成する関数
   * @return {HTMLElement} ボタン要素
   */
  function createApplyStyleButton() {
    const button = document.createElement('button');
    button.id = 'mobile-apply-style-button';
    button.textContent = '反映する';
    button.style.cssText = `
      padding: 10px 16px;
      background-color: #27ae60;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      margin: 10px 5px;
      width: 100%;
    `;

    // クリックイベント
    button.addEventListener('click', function() {
      handleMenuButtonClick();
    });

    return button;
  }

  /**
   * 既定のスタイルへ戻すボタンを作成する関数
   * @return {HTMLElement} ボタン要素
   */
  function createResetStyleButton() {
    const button = document.createElement('button');
    button.id = 'mobile-reset-style-button';
    button.textContent = '既定のスタイルへ戻す';
    button.style.cssText = `
      padding: 10px 16px;
      background-color: #e74c3c;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      margin: 10px 5px;
      width: 100%;
    `;

    // クリックイベント
    button.addEventListener('click', async function() {
      await handleResetStyleButtonClick();
    });

    return button;
  }

  /**
   * レコード追加・編集画面のイベントハンドラー
   */
  kintone.events.on(['mobile.app.record.create.show', 'mobile.app.record.edit.show'], async function(event) {
    // フィールド情報を取得
    const fields = await getFilteredFields();

    // 既存のコンテナを削除（重複防止）
    const existingContainer = document.getElementById('mobile-field-style-controls');
    if (existingContainer) {
      existingContainer.remove();
    }

    // ヘッダースペースを取得
    const headerSpace = kintone.mobile.app.getHeaderSpaceElement();

    if (headerSpace) {
      // コンテナを作成
      const controlsContainer = document.createElement('div');
      controlsContainer.id = 'mobile-field-style-controls';
      controlsContainer.style.cssText = `
        background-color: #f5f5f5;
        padding: 10px;
        margin-bottom: 10px;
        border-radius: 4px;
      `;

      // プルダウンとボタンを作成してコンテナに追加
      const targetDropdown = createTargetFieldDropdown(fields);
      const sourceDropdown = createStyleSourceDropdown(fields);
      const applyButton = createApplyStyleButton();
      const resetButton = createResetStyleButton();

      controlsContainer.appendChild(targetDropdown);
      controlsContainer.appendChild(sourceDropdown);
      controlsContainer.appendChild(applyButton);
      controlsContainer.appendChild(resetButton);

      headerSpace.appendChild(controlsContainer);

      // プルダウンの初期値を設定
      const targetFieldSelector = document.getElementById('mobile-target-field-selector');
      const styleSourceSelector = document.getElementById('mobile-style-source-selector');

      // スタイル適用対象プルダウン: フィールドが1つ以上ある場合、最初のフィールドを選択
      if (targetFieldSelector && fields.length > 0) {
        targetFieldSelector.value = fields[0].code;
      }

      // 適用するスタイルの内容プルダウン: 文字列（複数行）フィールドの最初のものを選択
      if (styleSourceSelector) {
        const multiLineFields = fields.filter(function(field) {
          return field.type === 'MULTI_LINE_TEXT';
        });
        if (multiLineFields.length > 0) {
          styleSourceSelector.value = multiLineFields[0].code;
        }
      }
    }

    return event;
  });

})(kintone.$PLUGIN_ID);
