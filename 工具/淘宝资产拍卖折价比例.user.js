// ==UserScript==
// @name         淘宝资产拍卖折价比例显示
// @namespace    https://github.com/liuyz/UserScript
// @version      26.07.25-v9
// @description  在淘宝/阿里资产拍卖「房产」标的详情页与搜索列表页，自动抓取起拍价、成交价与官方评估价，按「起拍价÷评估价」（已成交则「成交价÷评估价」）计算折价比例，以小标签显示：详情页在 #sf-price 价格「元」之后，列表页覆盖在每张卡片左上角（图片上方）。
// @author       WorkBuddy
// @match        https://zc-paimai.taobao.com/wow/pm/default/pc/*
// @match        https://zc-item.taobao.com/auction/*
// @match        https://sf-item.taobao.com/sf_item/*
// @match        https://susong-item.taobao.com/auction/*
// @match        https://z.taobao.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const BADGE_ID = 'js-zhe-rate-badge';   // 详情页徽标（唯一）
  const TAG_CLASS = 'js-zhe-rate-tag';    // 列表页卡片标签（多个）

  // 解析价格字符串为「元」数值。支持 ¥/￥、千分位逗号、万、亿。
  function parsePrice(raw) {
    if (!raw) return null;
    const text = String(raw).replace(/[\s,]/g, '');
    const m = text.match(/(?:[¥￥])?(\d+(?:\.\d+)?)\s*(亿|万)?/);
    if (!m) return null;
    let val = parseFloat(m[1]);
    if (isNaN(val)) return null;
    if (m[2] === '亿') val *= 1e8;
    else if (m[2] === '万') val *= 1e4;
    return val > 0 ? val : null;
  }

  // 按「折数」（ratio/10）五档配色：
  //   >10 折      → 红
  //   8.5~10 折   → 蓝
  //   7~8.5 折    → 黄
  //   5~7 折      → 绿
  //   <5 折       → 闪烁的绿
  function ratioStyle(ratio) {
    // 按「显示折数」判档（与标签文本的四舍五入一致，避免 8.499 显示 8.5 却配成黄色）
    const zhe = Math.round(ratio) / 10;
    if (zhe > 10)   return { bg: '#f5222d', color: '#ffffff', blink: false }; // 红
    if (zhe >= 8.5) return { bg: '#1677ff', color: '#ffffff', blink: false }; // 蓝
    if (zhe >= 7)   return { bg: '#faad14', color: '#1f1f1f', blink: false }; // 黄
    if (zhe >= 5)   return { bg: '#00a854', color: '#ffffff', blink: false }; // 绿
    return { bg: '#00a854', color: '#ffffff', blink: true };                  // 闪烁绿
  }

  // 注入闪烁动画的 keyframes（只注入一次）
  function ensureBlinkStyle() {
    if (document.getElementById('js-zhe-blink-style')) return;
    const st = document.createElement('style');
    st.id = 'js-zhe-blink-style';
    st.textContent =
      '@keyframes js-zhe-blink{0%,100%{opacity:1;}50%{opacity:0.25;}}' +
      '.js-zhe-blink{animation:js-zhe-blink 1s step-start infinite;}';
    (document.head || document.documentElement).appendChild(st);
  }

  /* ==================== 详情页模式 ==================== */

  // 在指定根节点内，按标签查找价格数值。
  // 注意：同一行（tr/li/td）常同时含多组「标签: 值」（如 起拍价: ¥480,754.56 评估价: ¥751,179），
  // 必须取「标签之后」的第一个价格 token，而不是整行第一个数字。
  function findPriceIn(root, labelRe) {
    if (!root) return null;
    const badge = document.getElementById(BADGE_ID);
    const labelCore = new RegExp(labelRe.source.replace(/^\^/, ''));
    const labels = Array.from(root.querySelectorAll('*')).filter(
      (el) =>
        el.children.length <= 1 &&
        labelRe.test((el.textContent || '').trim()) &&
        (!badge || !badge.contains(el))
    );
    for (const lab of labels) {
      const scope =
        lab.closest('tr') || lab.closest('li') || lab.closest('td') || lab.parentElement || lab;
      if (badge && badge.contains(scope)) continue;
      const text = (scope.textContent || '').replace(/\s+/g, '');
      const lm = text.match(labelCore);
      if (!lm) continue;
      const rest = text.slice(lm.index + lm[0].length);
      const tok = rest.match(/[¥￥]?\d[\d,]*(?:\.\d+)?(?:亿|万)?/);
      if (tok) {
        const v = parsePrice(tok[0]);
        if (v) return v;
      }
    }
    return null;
  }

  const RE_START = /^(起拍价|起始价)/;
  const RE_EVAL = /^(标的评估总价|评估价)/;

  // 大价格区（#sf-price / .sf-price）：读取标签（当前价/起拍价/成交价）与数值
  function getPriceLi(gridc) {
    const scope = gridc || document;
    return (
      scope.querySelector('.pm-bid-block #sf-price') ||
      scope.querySelector('#sf-price') ||
      scope.querySelector('.sf-price') ||
      document.querySelector('#sf-price') ||
      document.querySelector('.sf-price')
    );
  }

  function getMainPrice(gridc) {
    const li = getPriceLi(gridc);
    if (!li) return { label: null, value: null, node: null };
    const titleEl = li.querySelector('.title');
    const priceEl = li.querySelector('.J_Price') || li;
    return {
      label: titleEl ? titleEl.textContent.trim() : '',
      value: parsePrice(priceEl.textContent),
      node: priceEl,
    };
  }

  // 起拍价：优先 .grid-c 内（J_COMPONENT_MAIN_BOTTOM），回退全文档
  function getStartPrice(gridc) {
    if (gridc) {
      const jb =
        gridc.querySelector('#J_COMPONENT_MAIN_BOTTOM') ||
        gridc.querySelector('.J_COMPONENT_MAIN_BOTTOM');
      let v = findPriceIn(jb, RE_START);
      if (v) return v;
      v = findPriceIn(gridc, RE_START);
      if (v) return v;
    }
    return findPriceIn(document, RE_START);
  }

  // 评估价：优先 .grid-c 内（J_COMPONENT_MAIN_BOTTOM），找不到则回退全文档
  function getEvalPrice(gridc) {
    if (gridc) {
      const jb =
        gridc.querySelector('#J_COMPONENT_MAIN_BOTTOM') ||
        gridc.querySelector('.J_COMPONENT_MAIN_BOTTOM');
      let v = findPriceIn(jb, RE_EVAL);
      if (v) return v;
      v = findPriceIn(gridc, RE_EVAL);
      if (v) return v;
    }
    // 兜底：评估价常出现在「标的物介绍」表格（.grid-c 之外）
    return findPriceIn(document, RE_EVAL);
  }

  // 构建内联小标签（详情页）：显示在「元」单位之后
  function buildTag(ratio, formula) {
    const tag = document.createElement('span');
    tag.id = BADGE_ID;
    const s = ratioStyle(ratio);
    tag.title = '折价比例 = ' + formula + ' = ' + ratio.toFixed(2) + '%';
    tag.style.cssText =
      'display:inline-block;vertical-align:middle;margin-left:16px;padding:2px 8px;' +
      'border-radius:4px;background:' + s.bg + ';color:' + s.color + ';' +
      'font-size:13px;font-weight:600;line-height:1.5;white-space:nowrap;' +
      'font-family:-apple-system,"PingFang SC",Microsoft YaHei,sans-serif;';
    tag.textContent = (ratio / 10).toFixed(1) + '折';
    if (s.blink) { ensureBlinkStyle(); tag.classList.add('js-zhe-blink'); }
    return tag;
  }

  let lastKey = '';
  let lastUrl = location.href;

  function tryInjectDetail() {
    const gridc = document.querySelector('.grid-c');
    const main = getMainPrice(gridc); // 大价格区：当前价 / 成交价 / 起始价
    if (!main.node) return; // 价格区尚未就绪（或当前是列表页）

    const evalP = getEvalPrice(gridc);
    if (!evalP) return;

    // 已成交：折价比例 = 成交价 ÷ 评估价；否则 = 起拍价 ÷ 评估价
    const isDeal = main.label && /成交/.test(main.label) && main.value;
    let numerator, formula;
    if (isDeal) {
      numerator = main.value;
      formula = '成交价÷评估价';
    } else {
      numerator = getStartPrice(gridc);
      if (!numerator) return;
      formula = '起拍价÷评估价';
    }

    const ratio = (numerator / evalP) * 100;
    const key = numerator + '|' + evalP + '|' + (main.label || '');
    const existing = document.getElementById(BADGE_ID);
    if (existing && key === lastKey) return;
    if (existing) existing.remove();

    lastKey = key;
    const tag = buildTag(ratio, formula);
    // 内联插入到「元」单位（.rmb-unit）之后；找不到单位节点时退回价格数字之后
    const priceLi = getPriceLi(gridc);
    const unitEl = priceLi ? priceLi.querySelector('.rmb-unit') : null;
    if (unitEl) {
      unitEl.insertAdjacentElement('afterend', tag);
    } else {
      main.node.insertAdjacentElement('afterend', tag);
    }
  }

  /* ==================== 列表页模式（zichansearch 等搜索/列表页卡片） ==================== */

  // 读取「标签行」中标签之外的价格文本（排除我们自己插入的标签）
  function cardRowPrice(row, labelEl) {
    if (!row) return null;
    let text = '';
    for (const node of row.childNodes) {
      if (node.nodeType === 1) {
        if (node === labelEl) continue;
        if (node.classList && node.classList.contains(TAG_CLASS)) continue;
        text += node.textContent || '';
      } else if (node.nodeType === 3) {
        text += node.nodeValue || '';
      }
    }
    return parsePrice(text);
  }

  // 在卡片内查找「文本恰为某标签」的叶子节点，返回 {labelEl, row, price}
  function findCardLabel(card, labelText) {
    const els = card.querySelectorAll('div,span');
    for (const el of els) {
      if (el.children.length !== 0) continue;
      if (el.classList && el.classList.contains(TAG_CLASS)) continue;
      if ((el.textContent || '').trim() !== labelText) continue;
      const row = el.parentElement;
      const price = cardRowPrice(row, el);
      if (price) return { labelEl: el, row: row, price: price };
    }
    return null;
  }

  function buildCardTag(ratio, formula) {
    const tag = document.createElement('span');
    tag.className = TAG_CLASS;
    const s = ratioStyle(ratio);
    tag.title = '折价比例 = ' + formula + ' = ' + ratio.toFixed(2) + '%';
    // 左上角覆盖式：绝对定位于卡片左上角，盖在列表图片上方
    tag.style.cssText =
      'position:absolute;top:0;left:0;z-index:10;' +
      'padding:3px 10px;border-radius:8px 0 8px 0;' +
      'background:' + s.bg + ';color:' + s.color + ';' +
      'font-size:14px;font-weight:700;line-height:1.4;white-space:nowrap;' +
      'box-shadow:0 1px 4px rgba(0,0,0,0.25);pointer-events:none;' +
      'font-family:-apple-system,"PingFang SC",Microsoft YaHei,sans-serif;';
    tag.textContent = (ratio / 10).toFixed(1) + '折';
    if (s.blink) { ensureBlinkStyle(); tag.classList.add('js-zhe-blink'); }
    return tag;
  }

  function tryInjectCards() {
    const anchors = document.querySelectorAll(
      'a[href*="sf-item.taobao.com"], a[href*="zc-item.taobao.com"], a[href*="susong-item.taobao.com"], a[href*="sf_item"], a[href*="/auction/"]'
    );
    anchors.forEach((card) => {
      if (!/(起拍价|当前价|成交价)/.test(card.textContent || '')) return;

      // 分母：评估价 > 市场价（部分卡片如「已撤回」标的用「市场价」字段）
      let evalLabel = '评估价';
      let evalInfo = findCardLabel(card, '评估价');
      if (!evalInfo) { evalInfo = findCardLabel(card, '市场价'); evalLabel = '市场价'; }
      if (!evalInfo) return;
      // 分子：成交价 > 起拍价 > 当前价
      let numInfo = findCardLabel(card, '成交价');
      let numLabel = '成交价';
      if (!numInfo) { numInfo = findCardLabel(card, '起拍价'); numLabel = '起拍价'; }
      if (!numInfo) { numInfo = findCardLabel(card, '当前价'); numLabel = '当前价'; }
      if (!numInfo) return;
      const formula = numLabel + '÷' + evalLabel;

      const ratio = (numInfo.price / evalInfo.price) * 100;
      const key = numInfo.price + '|' + evalInfo.price;

      const existing = card.querySelector('.' + TAG_CLASS);
      if (existing) {
        if (existing.dataset.key === key) return; // 已插入且数据未变
        existing.remove();
      }

      // 覆盖在卡片左上角（图片上方）：确保卡片为定位上下文
      const cs = window.getComputedStyle(card);
      if (cs.position === 'static') card.style.position = 'relative';

      const tag = buildCardTag(ratio, formula);
      tag.dataset.key = key;
      card.appendChild(tag); // 绝对定位于卡片左上角，覆盖列表图片
    });
  }

  /* ==================== 调度 ==================== */

  function tryInject() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      lastKey = '';
      const old = document.getElementById(BADGE_ID);
      if (old) old.remove();
    }
    tryInjectDetail();
    tryInjectCards();
  }

  function debounce(fn, ms) {
    let t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  function init() {
    tryInject();
    const obs = new MutationObserver(debounce(tryInject, 300));
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setInterval(tryInject, 2000); // 兜底轮询，应对异步渲染/翻页/懒加载
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
