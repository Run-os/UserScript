
/**
 * 向【页面里第一个 TinyMCE】追加文本并立即生效
 * @param {string} text2append  要追加的文本
 * @returns {string}            追加后的完整纯文本
 */
function insertTextToTinymce(text2append = 'xxxxx') {
  /* 1. 拿到编辑器实例（动态匹配，不依赖 id） */
  const editors = window.tinymce?.editors ?? [];   // 所有 TinyMCE 实例
  const ed = editors.find(e => e.inline === false); // 先拿第一个非 inline 的
  // 如果上面没拿到，再随便拿一个
  const editor = ed || editors[0];

  /* 2. 真正干活 */
  if (editor) {
    const body = editor.getBody();          // 等同于 iframe.body
    const oldHtml = body.innerHTML;
    body.innerHTML += text2append;          // 追加（支持富文本）
    editor.save();                          // 同步回 textarea
    editor.setDirty(true);                  // 标记脏
    editor.selection.select(body, true);    // 把光标放末尾
    editor.selection.collapse(false);
  } else {
    /* 3. 兜底：直接改 DOM + 触发事件 */
    const iframe = document.querySelector('.input-box iframe.tox-edit-area__iframe');
    if (!iframe) { console.error('❌ 找不到 TinyMCE iframe'); return ''; }
    const body = iframe.contentDocument.querySelector('body#tinymce');
    if (!body) { console.error('❌ 找不到 body#tinymce'); return ''; }

    body.textContent += text2append;
    ['input', 'change', 'keyup'].forEach(ev =>
      body.dispatchEvent(new Event(ev, { bubbles: true }))
    );
  }

  const finalText = editor ? editor.getContent({ format: 'text' })
                           : document.querySelector('body#tinymce')?.textContent ?? '';
  console.log('✅ 已追加并同步：', finalText);
  return finalText;
}

/* ====== 使用示例 ====== */
insertTextToTinymce('bbb');
