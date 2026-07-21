// ==UserScript==
// @name         百度网盘打开中文字幕
// @namespace    http://tampermonkey.net/
// @version      25.7.22
// @description  百度网盘播放视频时自动打开中文字幕
// @author       Run-os
// @match        https://pan.baidu.com/pfile/video?path=*.mp4*
// @match        https://pan.baidu.com/play/video#/video?path=*.mp4*
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
    let done = false;
    let observer = null;
    let pollTimer = null;

    // 按文字匹配「中文」字幕项，避免依赖 li 的顺序（nth-child 在字幕项顺序变化时会点错语言）
    function findChineseItem() {
        const items = document.querySelectorAll('li.vp-video__control-bar--video-subtitles-select-item');
        for (const li of items) {
            const t = (li.innerText || '').trim();
            if (t.includes('中文') && !t.includes('不显示') && !t.includes('关闭') && !t.includes('无')) {
                return li;
            }
        }
        return null;
    }

    // 元素是否在页面上可见（折叠菜单里的隐藏项 getClientRects 长度为 0）
    function isVisible(el) {
        return !!el && el.getClientRects().length > 0;
    }

    // 找到字幕开关按钮，用于在字幕项被折叠时先展开菜单
    function findSubtitleToggle() {
        const cands = [
            '.vp-video__control-bar--video-subtitles',
            '[class*="subtitle-toggle"]',
            'button[class*="subtitle"]',
            '[title*="字幕"]',
            '[aria-label*="字幕"]',
        ];
        for (const s of cands) {
            const el = document.querySelector(s);
            if (el && el.tagName !== 'LI' && !(el.className || '').includes('select-item')) {
                return el;
            }
        }
        return null;
    }

    function finish(success, detail) {
        if (done) return;
        done = true;
        if (observer) observer.disconnect();
        if (pollTimer) clearInterval(pollTimer);
        if (success) {
            log('成功：', detail);
            toast("⚡自动打开中文字幕成功😊");
        } else {
            log('失败：', detail);
            toast("⚡自动打开中文字幕失败😢");
        }
    }

    function tryOpen() {
        if (done) return;
        if (Date.now() - startTime > maxWaitTime) {
            finish(false, '超时未找到中文字幕项');
            return;
        }

        const item = findChineseItem();
        if (!item) {
            log('尚未找到中文字幕项，继续等待…');
            return;
        }

        // 已经勾选则无需重复点击
        if (item.classList.contains('is-checked')) {
            log('中文字幕已处于勾选状态');
            finish(true, '中文字幕已开启');
            return;
        }

        // 先直接点击（百度播放器对隐藏在折叠菜单里的字幕项 .click() 同样生效，已验证）
        log('点击中文字幕项（可见=', isVisible(item), '）');
        item.click();

        setTimeout(function () {
            if (item.classList.contains('is-checked')) {
                finish(true, '点击后已勾选');
            } else {
                // 直接点击未生效：字幕项可能藏在折叠菜单中，先展开菜单再点一次
                const btn = findSubtitleToggle();
                if (btn) {
                    log('直接点击未生效，先展开字幕菜单');
                    btn.click();
                    setTimeout(function () {
                        item.click();
                        setTimeout(function () {
                            if (item.classList.contains('is-checked')) {
                                finish(true, '展开菜单后已勾选');
                            } else {
                                finish(false, '展开菜单后仍未能勾选');
                            }
                        }, 800);
                    }, 300);
                } else {
                    finish(false, '点击后未勾选（元素可能不可点击）');
                }
            }
        }, 800);
    }

    // 立即尝试一次，并用 MutationObserver 监听字幕项出现（比固定轮询更跟手）
    tryOpen();
    observer = new MutationObserver(function () {
        tryOpen();
    });
    observer.observe(document, { childList: true, subtree: true });

    // 兜底轮询，防止某些异步渲染漏掉 MutationObserver 的时机
    pollTimer = setInterval(function () {
        if (done) {
            clearInterval(pollTimer);
            return;
        }
        tryOpen();
    }, 2000);
})();
