(function(PLUGIN_ID) {
  'use strict';

  const AUTO_FETCH_KEY = 'autoFetchStyle';

  const elements = {
    submit: document.getElementById('plugin-submit'),
    cancel: document.getElementById('plugin-cancel'),
    autoFetchCheckbox: document.getElementById('auto-fetch-style')
  };

  function loadAutoFetchSetting() {
    const rawConfig = kintone.plugin.app.getConfig(PLUGIN_ID) || {};
    if (Object.prototype.hasOwnProperty.call(rawConfig, AUTO_FETCH_KEY)) {
      return rawConfig[AUTO_FETCH_KEY] === 'true';
    }
    return true; // デフォルトは有効
  }

  function handleSave(event) {
    event.preventDefault();
    const autoFetchEnabled = elements.autoFetchCheckbox ? elements.autoFetchCheckbox.checked : true;

    kintone.plugin.app.setConfig({
      [AUTO_FETCH_KEY]: String(autoFetchEnabled)
    }, () => {
      alert('設定を保存しました。アプリの設定を更新すると反映されます。');
      window.location.href = `/k/admin/app/${kintone.app.getId()}/plugin/`;
    });
  }

  function handleCancel(event) {
    event.preventDefault();
    window.location.href = `/k/admin/app/${kintone.app.getId()}/plugin/`;
  }

  function initialize() {
    const autoFetchEnabled = loadAutoFetchSetting();

    if (elements.autoFetchCheckbox) {
      elements.autoFetchCheckbox.checked = autoFetchEnabled;
    }

    elements.submit.addEventListener('click', handleSave);
    elements.cancel.addEventListener('click', handleCancel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})(kintone.$PLUGIN_ID);