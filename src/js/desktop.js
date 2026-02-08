(function(PLUGIN_ID) {
  'use strict';

  // フィールドスタイル操作パネルの状態管理
  let sidePanelElement = null;
  let isOpen = false;

  // プラグイン設定
  const AUTO_FETCH_KEY = 'autoFetchStyle';
  let autoFetchEnabled = true; // デフォルトは有効

  /**
   * プラグイン設定を読み込む
   */
  function loadPluginConfig() {
    const config = kintone.plugin.app.getConfig(PLUGIN_ID) || {};
    if (Object.prototype.hasOwnProperty.call(config, AUTO_FETCH_KEY)) {
      autoFetchEnabled = config[AUTO_FETCH_KEY] === 'true';
    }
    console.log('自動取得設定:', autoFetchEnabled);
  }

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
      const appId = kintone.app.getId();
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
   * フィールドスタイルを取得して表示
   */
  async function getAndDisplayFieldStyle(fieldCode) {
    try {
      const style = await kintone.app.record.getFieldStyle(fieldCode);
      console.dir(style);

      // 結果をテキストエリアに表示
      const textarea = document.getElementById('field-style-result');
      if (textarea) {
        textarea.value = JSON.stringify(style, null, 2);
      }
    } catch (error) {
      console.error('フィールドスタイルの取得に失敗しました', error);
      const textarea = document.getElementById('field-style-result');
      if (textarea) {
        textarea.value = 'エラー: ' + error.message;
      }
    }
  }

  /**
   * フィールドスタイルを反映する
   */
  async function applyFieldStyle(fieldCode) {
    try {
      const textarea = document.getElementById('field-style-result');
      if (!textarea || !textarea.value.trim()) {
        alert('スタイル情報を入力してください。');
        return;
      }

      // JSON文字列をパース
      const styleObject = JSON.parse(textarea.value);
      console.log('反映するフィールドスタイル:', styleObject);

      // フィールドスタイルを設定
      await kintone.app.record.setFieldStyle(fieldCode, styleObject);
      alert('フィールドスタイルを反映しました。');
    } catch (error) {
      console.error('フィールドスタイルの反映に失敗しました', error);
      alert('エラー: ' + error.message);
    }
  }

  /**
   * フィールドスタイルを既定に戻す
   */
  async function resetFieldStyle(fieldCode) {
    try {
      // スタイル解除
      await kintone.app.record.setFieldStyle(fieldCode, 'DEFAULT');
      console.log('フィールドスタイルを既定に戻しました');

      // 改めてスタイルを取得してテキストエリアに代入
      const style = await kintone.app.record.getFieldStyle(fieldCode);
      const textarea = document.getElementById('field-style-result');
      if (textarea) {
        textarea.value = JSON.stringify(style, null, 2);
      }

      alert('フィールドスタイルを既定に戻しました。');
    } catch (error) {
      console.error('フィールドスタイルのリセットに失敗しました', error);
      alert('エラー: ' + error.message);
    }
  }

  /**
   * アクションボタンの有効/無効を更新
   */
  function updateActionButtonsState(fieldCode) {
    const applyButton = document.getElementById('apply-field-style-button');
    const resetButton = document.getElementById('reset-field-style-button');

    if (applyButton && resetButton) {
      if (fieldCode) {
        applyButton.disabled = false;
        resetButton.disabled = false;
      } else {
        applyButton.disabled = true;
        resetButton.disabled = true;
      }
    }
  }

  /**
   * フィールド選択UIを作成
   */
  function createFieldSelectUI(fields) {
    const container = document.createElement('div');
    container.className = 'kintone-side-panel__field-select-container';

    // ラベル
    const label = document.createElement('label');
    label.className = 'kintone-side-panel__select-label';
    label.textContent = 'フィールドを選択:';
    label.setAttribute('for', 'field-selector');

    // プルダウンとボタンのラッパー
    const controlsWrapper = document.createElement('div');
    controlsWrapper.className = 'kintone-side-panel__controls-wrapper';

    // プルダウン
    const select = document.createElement('select');
    select.id = 'field-selector';
    select.className = 'kintone-side-panel__select';

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
      option.dataset.type = field.type;
      select.appendChild(option);
    }

    // 取得ボタン
    const fetchButton = document.createElement('button');
    fetchButton.id = 'fetch-field-style-button';
    fetchButton.className = 'kintone-side-panel__fetch-button';
    fetchButton.textContent = '取得';
    fetchButton.disabled = true; // 初期状態は無効

    // 選択イベント
    select.addEventListener('change', async function() {
      const selectedCode = this.value;
      if (selectedCode) {
        // フィールドが選択されたらボタンを有効化
        fetchButton.disabled = false;
        console.log('選択されたフィールド:', selectedCode);
        // 自動取得が有効な場合のみスタイルを取得して表示
        if (autoFetchEnabled) {
          await getAndDisplayFieldStyle(selectedCode);
        }
      } else {
        // 未選択の場合はボタンを無効化
        fetchButton.disabled = true;
      }
      // アクションボタンの状態を更新
      updateActionButtonsState(selectedCode);
    });

    // 取得ボタンのクリックイベント
    fetchButton.addEventListener('click', function() {
      const selectedCode = select.value;
      if (selectedCode) {
        getAndDisplayFieldStyle(selectedCode);
      }
    });

    controlsWrapper.appendChild(select);
    controlsWrapper.appendChild(fetchButton);

    container.appendChild(label);
    container.appendChild(controlsWrapper);

    return container;
  }

  /**
   * フィールドスタイル操作パネルのHTML要素を作成
   */
  async function createSidePanelElement() {
    const panel = document.createElement('div');
    panel.id = 'kintone-side-panel';
    panel.className = 'kintone-side-panel';

    // パネルヘッダー
    const header = document.createElement('div');
    header.className = 'kintone-side-panel__header';

    const title = document.createElement('h2');
    title.className = 'kintone-side-panel__title';
    title.textContent = 'kintone.app.record.getFieldStyle および setFieldStyle の実行サンプル';

    const closeButton = document.createElement('button');
    closeButton.className = 'kintone-side-panel__close-button';
    closeButton.textContent = '×';
    closeButton.addEventListener('click', closeSidePanel);

    header.appendChild(title);
    header.appendChild(closeButton);

    // パネルコンテンツ
    const content = document.createElement('div');
    content.className = 'kintone-side-panel__content';

    // フィールド情報を取得
    const fields = await getFilteredFields();

    // フィールド選択セクション
    const fieldSection = document.createElement('div');
    fieldSection.className = 'kintone-side-panel__section';

    // フィールド選択UIを追加
    const fieldSelectUI = createFieldSelectUI(fields);
    fieldSection.appendChild(fieldSelectUI);

    content.appendChild(fieldSection);

    // 結果表示セクション
    const resultSection = document.createElement('div');
    resultSection.className = 'kintone-side-panel__section';

    // テキストエリア
    const textarea = document.createElement('textarea');
    textarea.id = 'field-style-result';
    textarea.className = 'kintone-side-panel__textarea';
    resultSection.appendChild(textarea);

    // アクションボタンのコンテナ
    const actionButtonsWrapper = document.createElement('div');
    actionButtonsWrapper.className = 'kintone-side-panel__action-buttons';

    // 反映するボタン
    const applyButton = document.createElement('button');
    applyButton.id = 'apply-field-style-button';
    applyButton.className = 'kintone-side-panel__action-button kintone-side-panel__action-button--primary';
    applyButton.textContent = '反映する';
    applyButton.disabled = true; // 初期状態は無効

    // 反映するボタンのクリックイベント
    applyButton.addEventListener('click', function() {
      const select = document.getElementById('field-selector');
      const selectedCode = select ? select.value : '';
      if (selectedCode) {
        applyFieldStyle(selectedCode);
      }
    });

    // 既定のスタイルへ戻すボタン
    const resetButton = document.createElement('button');
    resetButton.id = 'reset-field-style-button';
    resetButton.className = 'kintone-side-panel__action-button kintone-side-panel__action-button--secondary';
    resetButton.textContent = '既定のスタイルへ戻す';
    resetButton.disabled = true; // 初期状態は無効

    // 既定のスタイルへ戻すボタンのクリックイベント
    resetButton.addEventListener('click', function() {
      const select = document.getElementById('field-selector');
      const selectedCode = select ? select.value : '';
      if (selectedCode) {
        resetFieldStyle(selectedCode);
      }
    });

    actionButtonsWrapper.appendChild(applyButton);
    actionButtonsWrapper.appendChild(resetButton);

    resultSection.appendChild(actionButtonsWrapper);
    content.appendChild(resultSection);

    panel.appendChild(header);
    panel.appendChild(content);

    // フィールドが1つ以上ある場合、最初のフィールドを自動選択してスタイルを取得
    if (fields.length > 0) {
      // DOMに追加された後に実行するため、次のイベントループで実行
      setTimeout(async function() {
        const select = document.getElementById('field-selector');
        if (select && fields[0]) {
          // 最初のフィールドを選択
          select.value = fields[0].code;

          // 取得ボタンを有効化
          const fetchButton = document.getElementById('fetch-field-style-button');
          if (fetchButton) {
            fetchButton.disabled = false;
          }

          // アクションボタンを有効化
          updateActionButtonsState(fields[0].code);

          // 自動取得が有効な場合のみスタイル情報を取得
          if (autoFetchEnabled) {
            await getAndDisplayFieldStyle(fields[0].code);
          }
        }
      }, 0);
    }

    return panel;
  }

  /**
   * フィールドスタイル操作パネルを開く
   */
  function openSidePanel() {
    if (sidePanelElement && !isOpen) {
      sidePanelElement.classList.add('kintone-side-panel--open');
      isOpen = true;
    }
  }

  /**
   * フィールドスタイル操作パネルを閉じる
   */
  function closeSidePanel() {
    if (sidePanelElement && isOpen) {
      sidePanelElement.classList.remove('kintone-side-panel--open');
      isOpen = false;
    }
  }

  /**
   * フィールドスタイル操作パネルを初期化してページに追加
   */
  async function initializeSidePanel() {
    // プラグイン設定を読み込む
    loadPluginConfig();

    // 既存のパネルを削除
    if (sidePanelElement) {
      sidePanelElement.remove();
      sidePanelElement = null;
    }

    // 状態をリセット
    isOpen = false;

    // フィールドスタイル操作パネルを作成（非同期）
    sidePanelElement = await createSidePanelElement();
    document.body.appendChild(sidePanelElement);

    // 自動的にパネルを開く
    openSidePanel();
  }

  /**
   * メニューボタンがクリックされた際の処理
   * 適用するスタイルの内容フィールドから値を取得し、スタイル適用対象フィールドに適用する
   */
  async function handleMenuButtonClick() {
    try {
      // プルダウンの選択値を取得
      const targetFieldSelector = document.getElementById('target-field-selector');
      const styleSourceSelector = document.getElementById('style-source-selector');

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
      const record = kintone.app.record.get();

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

      // フィールドスタイルを適用
      await kintone.app.record.setFieldStyle(targetFieldCode, styleObject);

      console.log('適用したスタイル:', styleObject);
    } catch (error) {
      console.error('フィールドスタイルの適用に失敗しました', error);
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
      display: inline-flex;
      flex-direction: column;
      margin: 10px;
      vertical-align: middle;
    `;

    const label = document.createElement('label');
    label.textContent = 'スタイル適用対象:';
    label.style.cssText = `
      font-size: 12px;
      margin-bottom: 4px;
      font-weight: bold;
    `;

    const select = document.createElement('select');
    select.id = 'target-field-selector';
    select.style.cssText = `
      padding: 6px 12px;
      font-size: 14px;
      border: 1px solid #ccc;
      border-radius: 4px;
      background-color: white;
      cursor: pointer;
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
      display: inline-flex;
      flex-direction: column;
      margin: 10px;
      vertical-align: middle;
    `;

    const label = document.createElement('label');
    label.textContent = '適用するスタイルの内容:';
    label.style.cssText = `
      font-size: 12px;
      margin-bottom: 4px;
      font-weight: bold;
    `;

    const select = document.createElement('select');
    select.id = 'style-source-selector';
    select.style.cssText = `
      padding: 6px 12px;
      font-size: 14px;
      border: 1px solid #ccc;
      border-radius: 4px;
      background-color: white;
      cursor: pointer;
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
    button.id = 'apply-style-button';
    button.textContent = '反映する';
    button.style.cssText = `
      padding: 8px 16px;
      background-color: #27ae60;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      margin: 10px;
      vertical-align: bottom;
      transition: background-color 0.2s ease;
    `;

    // ホバー効果
    button.addEventListener('mouseenter', function() {
      button.style.backgroundColor = '#229954';
    });

    button.addEventListener('mouseleave', function() {
      button.style.backgroundColor = '#27ae60';
    });

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
    button.id = 'reset-style-button';
    button.textContent = '既定のスタイルへ戻す';
    button.style.cssText = `
      padding: 8px 16px;
      background-color: #e74c3c;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      margin: 10px;
      vertical-align: bottom;
      transition: background-color 0.2s ease;
    `;

    // ホバー効果
    button.addEventListener('mouseenter', function() {
      button.style.backgroundColor = '#c0392b';
    });

    button.addEventListener('mouseleave', function() {
      button.style.backgroundColor = '#e74c3c';
    });

    // クリックイベント
    button.addEventListener('click', async function() {
      await handleResetStyleButtonClick();
    });

    return button;
  }

  /**
   * 既定のスタイルへ戻すボタンがクリックされた際の処理
   */
  async function handleResetStyleButtonClick() {
    try {
      // プルダウンの選択値を取得
      const targetFieldSelector = document.getElementById('target-field-selector');

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

      // フィールドスタイルを既定に戻す
      await kintone.app.record.setFieldStyle(targetFieldCode, 'DEFAULT');

      console.log('スタイルを既定に戻しました:', targetFieldCode);
    } catch (error) {
      console.error('フィールドスタイルのリセットに失敗しました', error);
      alert('エラー: ' + error.message);
    }
  }

  /**
   * レコード追加・編集画面のイベントハンドラー
   */
  kintone.events.on(['app.record.create.show', 'app.record.edit.show'], async function(event) {
    await initializeSidePanel();

    // フィールド情報を取得
    const fields = await getFilteredFields();

    // 既存のボタンとプルダウンを削除（重複防止）
    const existingApplyButton = document.getElementById('apply-style-button');
    if (existingApplyButton) {
      existingApplyButton.remove();
    }
    const existingResetButton = document.getElementById('reset-style-button');
    if (existingResetButton) {
      existingResetButton.remove();
    }
    const existingTargetDropdown = document.getElementById('target-field-selector');
    if (existingTargetDropdown && existingTargetDropdown.parentElement) {
      existingTargetDropdown.parentElement.remove();
    }
    const existingSourceDropdown = document.getElementById('style-source-selector');
    if (existingSourceDropdown && existingSourceDropdown.parentElement) {
      existingSourceDropdown.parentElement.remove();
    }

    // ヘッダーメニュースペースを取得
    const headerMenuSpace = kintone.app.record.getHeaderMenuSpaceElement();

    if (headerMenuSpace) {
      // プルダウンとボタンを作成してヘッダーメニュースペースに追加
      const targetDropdown = createTargetFieldDropdown(fields);
      const sourceDropdown = createStyleSourceDropdown(fields);
      const applyButton = createApplyStyleButton();
      const resetButton = createResetStyleButton();

      headerMenuSpace.appendChild(targetDropdown);
      headerMenuSpace.appendChild(sourceDropdown);
      headerMenuSpace.appendChild(applyButton);
      headerMenuSpace.appendChild(resetButton);

      // プルダウンの初期値を設定
      const targetFieldSelector = document.getElementById('target-field-selector');
      const styleSourceSelector = document.getElementById('style-source-selector');

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

  /**
   * モバイル版URLへ変換する関数
   * @param {string} currentUrl - 現在のURL
   * @return {string} モバイル版のURL
   */
  function convertToMobileUrl(currentUrl) {
    // PC版のURLパターン: https://xxx.cybozu.com/k/{appId}/
    // モバイル版のURLパターン: https://xxx.cybozu.com/k/m/{appId}/
    let mobileUrl = currentUrl.replace(/\/k\/(\d+)\//, '/k/m/$1/');

    // ハッシュ部分（#record=1など）をクエリパラメータ（?record=1）に変換
    mobileUrl = mobileUrl.replace(/#record=/, '?record=');

    return mobileUrl;
  }

  /**
   * モバイル版へ遷移ボタンを作成する関数
   * @return {HTMLElement} ボタン要素
   */
  function createMobileTransitionButton() {
    const button = document.createElement('button');
    button.id = 'mobile-transition-button';
    button.textContent = 'モバイル版へ移動';
    button.style.cssText = `
      padding: 8px 16px;
      background-color: #ffd700;
      color: black;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      margin: 10px;
      transition: background-color 0.3s ease;
    `;

    // ホバー効果
    button.addEventListener('mouseenter', function() {
      button.style.backgroundColor = '#f0c000';
    });

    button.addEventListener('mouseleave', function() {
      button.style.backgroundColor = '#ffd700';
    });

    // クリックイベント
    button.addEventListener('click', function() {
      const currentUrl = window.location.href;
      const mobileUrl = convertToMobileUrl(currentUrl);

      // モバイル版URLへ遷移
      window.location.href = mobileUrl;
    });

    return button;
  }

  /**
   * レコード一覧画面表示時のイベントハンドラー
   */
  kintone.events.on('app.record.index.show', function(event) {
    // 既存のボタンを削除（重複防止）
    const existingButton = document.getElementById('mobile-transition-button');
    if (existingButton) {
      existingButton.remove();
    }

    // ヘッダーメニュースペースを取得（画面右上）
    const headerMenuSpace = kintone.app.getHeaderMenuSpaceElement();

    if (headerMenuSpace) {
      // ボタンを作成してヘッダーメニュースペースに追加
      const button = createMobileTransitionButton();
      headerMenuSpace.appendChild(button);
    }

    return event;
  });

  /**
   * レコード詳細（閲覧）画面表示時のイベントハンドラー
   */
  kintone.events.on('app.record.detail.show', function(event) {
    // 既存のボタンを削除（重複防止）
    const existingButton = document.getElementById('mobile-transition-button');
    if (existingButton) {
      existingButton.remove();
    }

    // ヘッダーメニュースペースを取得（画面右上）
    const headerMenuSpace = kintone.app.record.getHeaderMenuSpaceElement();

    if (headerMenuSpace) {
      // ボタンを作成してヘッダーメニュースペースに追加
      const button = createMobileTransitionButton();
      headerMenuSpace.appendChild(button);
    }

    return event;
  });

})(kintone.$PLUGIN_ID);
