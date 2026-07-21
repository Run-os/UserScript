// ==UserScript==
// @name         百度网盘打开中文字幕
// @namespace    http://tampermonkey.net/
// @version      26.7.22
// @description  百度网盘播放视频时自动打开中文字幕
// @author       Run-os
// @match        https://pan.baidu.com/pfile/video?path=*.mp4*
// @match        https://pan.baidu.com/play/video#/video?path=*.mp4*
// @include      /^https?:\/\/pan\.baidu\.com\/(pfile|play)\/video\?.*path=.*\.mp4/
// @icon         https://th.bing.com/th?id=ODLS.039b3eb8-253e-4d80-8727-6e7d039c3891&w=32&h=32&qlt=90&pcl=fffffa&o=6&pid=1.2
// @homepage     https://scriptcat.org/zh-CN/script-show-page/3864/
// @grant        none
// @license      MIT
// ==/UserScript==

// 提示框容器：惰性创建，兼容脚本在 body 尚未就绪时（如 document-start）运行
let message = null;
function ensureMessage() {
    if (message) return;
    message = document.createElement("div");
    message.style.position = "fixed";
    message.style.top = "80%";
    message.style.left = "50%";
    message.style.transform = "translate(-50%, -50%)";
    message.style.background = "#fff";
    message.style.border = "1px solid #ccc";
    message.style.padding = "20px";
    message.style.borderRadius = "5px";
    message.style.boxShadow = "2px 2px 5px rgba(0, 0, 0, 0.3)";
    message.style.zIndex = "9999";
    message.style.fontSize = "16px";
    message.style.display = "none"; // 初始状态下不显示
    (document.body || document.documentElement).appendChild(message);
}

//提示框
function toast(text) {
    ensureMessage();
    message.textContent = text;
    message.style.display = "block";
    setTimeout(function () {
        message.style.display = "none";
    }, 1000);
}

(function () {
    'use strict';

    // 防止 SPA 跳转导致脚本被多次注入、开启多个监听器
    if (window.__bdSubtitleAutoOpen) {
        console.log('[中文字幕] 脚本已运行，跳过重复注入');
        return;
    }
    window.__bdSubtitleAutoOpen = true;

    const log = (...args) => console.log('[中文字幕]', ...args);

    const maxWaitTime = 60000; // 最多等待1分钟
    const startTime = Date.now();
    let clicking = false;     // 并发锁：避免 MutationObserver / 轮询高频触发时重复点击同一字幕项
    let handledItem = null;   // 当前视频已成功勾选的中文字幕项（用于支持切换视频后重新开启）
    let observer = null;
    let pollTimer = null;
    let lastTry = 0;

    // 按文字匹配「中文」字幕项；用 textContent 而非 innerText（折叠/隐藏菜单项 innerText 为空，会匹配不到）
    function findChineseItems() {
        const items = document.querySelectorAll('li.vp-video__control-bar--video-subtitles-select-item');
        const result = [];
        for (const li of items) {
            const t = (li.textContent || '').trim();
            if (t.includes('中文') && !t.includes('不显示') && !t.includes('关闭') && !t.includes('无')) {
                result.push(li);
            }
        }
        return result;
    }

    // 在多个中文项里优先选「简体」，避免误选繁体
    function pickChineseItem(items) {
        for (const li of items) {
            const t = (li.textContent || '').trim();
            if (t.includes('简体') || t.includes('简')) return li;
        }
        return items[0] || null;
    }

    // 元素是否在页面上可见（折叠菜单里的隐藏项 getClientRects 长度为 0）
    function isVisible(el) {
        return !!el && el.getClientRects().length > 0;
    }

    // 找到字幕开关按钮，用于在字幕项被折叠时先展开菜单（优先真正的 <button>，避免点到容器）
    function findSubtitleToggle() {
        const cands = [
            'button[class*="subtitle"]',
            '[title*="字幕"]',
            '[aria-label*="字幕"]',
            '.vp-video__control-bar--video-subtitles',
            '[class*="subtitle-toggle"]',
        ];
        for (const s of cands) {
            const el = document.querySelector(s);
            // typeof el.className === 'string'：SVG 元素的 className 是 SVGAnimatedString，.includes 会抛错，需排除
            if (el && el.tagName !== 'LI' && typeof el.className === 'string' && !el.className.includes('select-item')) {
                return el;
            }
        }
        return null;
    }

    function finish(success, detail) {
        if (observer) observer.disconnect();
        if (pollTimer) clearInterval(pollTimer);
        if (success) {
            log('成功：', detail);
        } else {
            log('失败：', detail);
            toast('⚡自动打开中文字幕失败😢');
        }
    }

    function tryOpen() {
        if (clicking) return; // 已有点击流程进行中，跳过，避免重复点击堆叠
        if (Date.now() - startTime > maxWaitTime) {
            finish(false, '超时未找到中文字幕项');
            return;
        }

        const items = findChineseItems();

        // 之前已处理过的字幕项若已不存在或已取消勾选（切换视频 / 字幕重置），则重新尝试开启
        if (handledItem && (!document.contains(handledItem) || !handledItem.classList.contains('is-checked'))) {
            handledItem = null;
            log('检测到字幕状态变化（可能切换了视频），重新尝试开启中文字幕');
        }

        if (items.length === 0) {
            if (!handledItem) log('尚未找到中文字幕项，继续等待…');
            return;
        }

        const item = pickChineseItem(items);

        // 已经勾选
        if (item.classList.contains('is-checked')) {
            if (item !== handledItem) {
                handledItem = item;
                log('中文字幕已处于勾选状态');
                toast('⚡自动打开中文字幕成功😊');
            }
            return;
        }

        // 未勾选：加并发锁后点击
        clicking = true;
        log('点击中文字幕项（可见=', isVisible(item), '）');
        item.click();

        setTimeout(function () {
            if (item.classList.contains('is-checked')) {
                clicking = false;
                handledItem = item;
                log('成功：点击后已勾选');
                toast('⚡自动打开中文字幕成功😊');
                return;
            }
            // 直接点击未生效：字幕项可能藏在折叠菜单中，先展开菜单再点一次
            const btn = findSubtitleToggle();
            if (btn) {
                log('直接点击未生效，先展开字幕菜单');
                btn.click();
                setTimeout(function () {
                    item.click();
                    setTimeout(function () {
                        clicking = false;
                        if (item.classList.contains('is-checked')) {
                            handledItem = item;
                            log('成功：展开菜单后已勾选');
                            toast('⚡自动打开中文字幕成功😊');
                        } else {
                            log('失败：展开菜单后仍未能勾选');
                        }
                    }, 800);
                }, 300);
            } else {
                clicking = false;
                log('失败：点击后未勾选（元素可能不可点击）');
            }
        }, 800);
    }

    // 节流：MutationObserver 回调高频触发，限制最小间隔，避免刷屏与吃性能
    function scheduleTry() {
        const now = Date.now();
        if (now - lastTry < 300) return;
        lastTry = now;
        tryOpen();
    }

    // 立即尝试一次，并用 MutationObserver 监听字幕项出现（比固定轮询更跟手）
    tryOpen();
    observer = new MutationObserver(scheduleTry);
    observer.observe(document, { childList: true, subtree: true });

    // 兜底轮询，防止某些异步渲染漏掉 MutationObserver 的时机
    pollTimer = setInterval(function () {
        if (Date.now() - startTime > maxWaitTime) {
            finish(false, '超时未找到中文字幕项');
            return;
        }
        scheduleTry();
    }, 2000);
})();
