// ==UserScript==
// @name         百度网盘打开中文字幕
// @namespace    http://tampermonkey.net/
// @version      26.07.22-v1
// @description  百度网盘播放视频时自动打开中文字幕，并自动开始播放
// @author       Run-os
// @match        https://pan.baidu.com/pfile/video?path=*.mp4*
// @match        https://pan.baidu.com/play/video#/video?path=*.mp4*
// @include      /^https?:\/\/pan\.baidu\.com\/(pfile|play)\/video\?.*path=.*\.mp4/
// @icon         https://th.bing.com/th?id=ODLS.039b3eb8-253e-4d80-8727-6e7d039c3891&w=32&h=32&qlt=90&pcl=fffffa&o=6&pid=1.2
// @homepage     https://scriptcat.org/zh-CN/script-show-page/3864/
// @require      https://cdn.bootcdn.net/ajax/libs/jquery/3.7.1/jquery.min.js
// @require      https://cdn.bootcdn.net/ajax/libs/toastr.js/2.1.4/toastr.min.js
// @resource     toastrCSS https://cdn.bootcdn.net/ajax/libs/toastr.js/2.1.4/toastr.min.css
// @grant        GM_getResourceText
// @grant        GM_addStyle
// @license      MIT
// ==/UserScript==

// 引入 toastr 样式（@resource 注入）并初始化全局配置。
// 注意：toastr 依赖 jQuery，已在 @require 中一并加载（ScriptCat 文档示例漏了 jQuery，会报 jQuery is not defined）。
GM_addStyle(GM_getResourceText("toastrCSS"));
toastr.options = {
    closeButton: true,
    progressBar: true,
    positionClass: "toast-bottom-center", // 贴近原脚本「底部居中」位置
    timeOut: 3000,
    extendedTimeOut: 1000,
    preventDuplicates: true,
};

(function () {
    'use strict';

    // 防止 SPA 跳转导致脚本被多次注入、开启多个监听器
    if (window.__bdSubtitleAutoOpen) {
        console.log('[中文字幕] 脚本已运行，跳过重复注入');
        return;
    }
    window.__bdSubtitleAutoOpen = true;

    // ===== 配置 =====
    const CONFIG = {
        // 自动播放被浏览器拦截时是否允许「静音兜底」起播。
        // false（默认）：绝不静音，改为等待用户首次与页面交互后带声音播放。
        mutedFallback: false,
    };

    const log = (...args) => console.log('[中文字幕]', ...args);

    const maxWaitTime = 60000; // 最多等待1分钟
    const startTime = Date.now();
    let clicking = false;     // 并发锁：避免 MutationObserver / 轮询高频触发时重复点击同一字幕项
    let handledItem = null;   // 当前视频已成功勾选的中文字幕项（用于支持切换视频后重新开启）
    let observer = null;
    let pollTimer = null;
    let lastTry = 0;
    let playHandled = false;  // 视频是否已成功开始播放（避免重复触发）
    let soundArmed = false;   // 是否已挂载「用户交互后带声音播放」监听
    let hintShown = false;    // 「点击页面即可带声音播放」提示是否已弹过

    // 合并提示状态：「打开字幕」与「自动播放」合并到同一个 toastr 气泡
    let subtitleOpened = false;     // 字幕是否已成功打开
    let playStarted = false;        // 视频是否已开始播放
    let playMutedFallback = false;  // 播放是否走了静音兜底
    let playFailed = false;         // 自动播放彻底失败（含静音兜底也失败）
    let statusShown = false;        // 合并气泡是否已弹出（避免重复）

    // 展示合并气泡：字幕作标题、自动播放作内容；两项都完成才弹，保证只一个气泡
    function updateStatusToast() {
        if (statusShown) return;
        if (subtitleOpened && playStarted) {
            statusShown = true;
            const body = playMutedFallback
                ? '▶️ 已自动播放（暂静音，点击页面即恢复声音）'
                : '▶️ 已自动开始播放';
            toastr.success(body, '⚡ 已自动打开中文字幕');
        }
    }

    // 仅字幕成功、播放失败时的兜底提示（避免信息丢失）
    function showSubtitleOnly() {
        if (statusShown) return;
        statusShown = true;
        toastr.info('⚡ 已自动打开中文字幕（视频未能自动播放）');
    }

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

    // ==== 自动播放 ====
    let unmuteArmed = false;  // 是否已挂载「用户交互后恢复声音」监听

    // 视频是否处于「真正播放中」状态
    function isPlaying(v) {
        return !!v && !v.paused && !v.ended && v.readyState >= 2;
    }

    // 静音自动播放后，用户首次与页面交互时自动恢复声音（合成点击不算手势，只能等真实交互）
    function armUnmuteOnInteraction(video) {
        if (unmuteArmed) return;
        unmuteArmed = true;
        const restore = function () {
            try {
                video.muted = false;
                // 解除静音会让浏览器重新评估自动播放策略；此回调运行在真实用户手势内，
                // 有声播放被允许，若视频因此被暂停则立即恢复播放。
                if (video.paused) { const rp = video.play(); if (rp && rp.catch) rp.catch(function () {}); }
            } catch (e) { /* ignore */ }
            log('检测到用户交互，已恢复声音');
            document.removeEventListener('click', restore, true);
            document.removeEventListener('keydown', restore, true);
            document.removeEventListener('touchstart', restore, true);
        };
        document.addEventListener('click', restore, true);
        document.addEventListener('keydown', restore, true);
        document.addEventListener('touchstart', restore, true);
    }

    // 播放成功后确保画面真正显示：部分播放器（百度 Video.js）在有声自动播放被放行后，
    // 大播放按钮 / 海报层仍覆盖在画面上方，造成「有声音但画面不动」的观感。这里强制清掉遮罩。
    function ensureVideoVisible() {
        try {
            const wrap = document.querySelector('.video-js');
            if (wrap) {
                wrap.classList.add('vjs-has-started', 'vjs-playing');
                wrap.classList.remove('vjs-paused');
            }
            const btn = document.querySelector('.vjs-big-play-button');
            if (btn) btn.style.display = 'none';
        } catch (e) { /* ignore */ }
    }

    // 有声自动播放被拦截时：绝不静音，改为等待用户首次真实交互（点击/按键/触摸）后带声音播放。
    // 合成事件不算用户手势，所以只能等用户真实操作（真实点击会由浏览器视为用户激活，允许有声播放）。
    function armSoundPlayOnInteraction(video) {
        if (soundArmed) return;
        soundArmed = true;
        const go = function () {
            if (playHandled) return;
            try {
                const pp = video.play();
                if (pp && typeof pp.then === 'function') {
                    pp.then(function () {
                        playHandled = true;
                        playStarted = true;
                        ensureVideoVisible();
                        log('用户交互后带声音播放成功');
                        updateStatusToast();
                    }).catch(function (e) {
                        log('用户交互后播放仍失败：', e && e.name);
                    });
                } else {
                    playHandled = true;
                    playStarted = true;
                    ensureVideoVisible();
                    updateStatusToast();
                }
            } catch (e) { /* ignore */ }
            document.removeEventListener('click', go, true);
            document.removeEventListener('keydown', go, true);
            document.removeEventListener('touchstart', go, true);
        };
        document.addEventListener('click', go, true);
        document.addEventListener('keydown', go, true);
        document.addEventListener('touchstart', go, true);
        if (!hintShown) {
            hintShown = true;
            toastr.info('▶️ 点击页面任意位置即可带声音播放');
        }
    }

    function tryPlay() {
        if (playHandled) return;
        const video = document.querySelector('video');
        if (!video) return;

        if (isPlaying(video)) {
            playHandled = true;
            playStarted = true;
            ensureVideoVisible();
            log('视频已在播放中，无需处理');
            updateStatusToast();
            return;
        }

        const p = video.play();
        if (p && typeof p.then === 'function') {
            p.then(function () {
                playHandled = true;
                playStarted = true;
                ensureVideoVisible();
                log('自动播放成功（有声）');
                updateStatusToast();
            }).catch(function (err) {
                log('有声自动播放被拦截：', err && err.name);
                if (CONFIG.mutedFallback) {
                    // 旧逻辑（默认关闭，避免无声音起播）：静音兜底，并在用户首次交互后恢复声音
                    video.muted = true;
                    const p2 = video.play();
                    if (p2 && typeof p2.then === 'function') {
                        p2.then(function () {
                            playHandled = true;
                            playStarted = true;
                            playMutedFallback = true;
                            log('静音自动播放成功，等待用户交互后恢复声音');
                            updateStatusToast();
                            armUnmuteOnInteraction(video);
                        }).catch(function (e2) {
                            log('静音自动播放仍失败：', e2 && e2.name);
                            playFailed = true;
                            if (subtitleOpened) showSubtitleOnly();
                        });
                    }
                } else {
                    // 新逻辑：绝不静音，等用户首次交互后带声音播放
                    armSoundPlayOnInteraction(video);
                }
            });
        }
    }

    function finish(success, detail) {
        if (observer) observer.disconnect();
        if (pollTimer) clearInterval(pollTimer);
        if (success) {
            log('成功：', detail);
        } else {
            log('失败：', detail);
            if (!statusShown) {
                statusShown = true;
                if (subtitleOpened && !playStarted) {
                    toastr.info('⚡ 已自动打开中文字幕（视频未能自动播放）');
                } else if (playStarted && !subtitleOpened) {
                    toastr.warning('▶️ 已自动开始播放（中文字幕未能自动打开）');
                } else {
                    toastr.error('⚡自动打开中文字幕失败😢');
                }
            }
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
                subtitleOpened = true;
                updateStatusToast();
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
                subtitleOpened = true;
                updateStatusToast();
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
                            subtitleOpened = true;
                updateStatusToast();
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
        tryPlay();
    }

    // 立即尝试一次，并用 MutationObserver 监听字幕项/视频出现（比固定轮询更跟手）
    tryOpen();
    tryPlay();
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
