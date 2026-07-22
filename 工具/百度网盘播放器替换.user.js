// ==UserScript==
// @name         百度网盘播放器替换(ArtPlayer+hls.js)
// @namespace    http://tampermonkey.net/
// @version      2.3.6
// @description  开源免费复刻：用 ArtPlayer + hls.js 整体替换百度网盘原生播放器。复用网盘自身 /api/streaming 流媒体接口（带 adToken / jsToken / vip 鉴权）拿到多清晰度 M3U8，仅替换前端渲染层，不破解视频源。v2.1 重写拦截逻辑：照搬参考脚本的「轮询 destroyPlayer + 先初始化后销毁」顺序，并额外增加 document-start 阶段 CSS 隐藏原生播放器 + MutationObserver 守卫，彻底杜绝「两个视频」。数据提取路径参照网盘 Vue3+Pinia 真实结构（$pinia.state._rawValue.videoinfo）。
// @author       Run-os
// @match        https://pan.baidu.com/pfile/video*
// @match        https://pan.baidu.com/play/video*
// @match        https://pan.baidu.com/pfile/mboxvideo*
// @match        https://pan.baidu.com/s/*
// @match        https://yun.baidu.com/s/*
// @match        https://pan.baidu.com/wap/home*
// @run-at       document-start
// @require      https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js
// @require      https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.js
// @grant        unsafeWindow
// @grant        GM_addStyle
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // 防止 SPA 跳转 / 重复注入
    if (window.__bdArtPlayerReplaced) return;
    window.__bdArtPlayerReplaced = true;

    const CONFIG = {
        DEBUG: true,
        APP_ID: 250528, // 网盘 web 端 app_id（参考脚本实测值）
        AUTOPLAY: true, // 自动播放：浏览器策略禁止带声音自动播放，故先静音起播，用户首次交互后恢复声音
        RESUME: true,   // 播放进度记忆：按文件（fs_id 优先/path 兜底）记录观看位置，重开时续播（与清晰度无关、有提示）
    };

    // 调试日志同时写入全局，便于 browser-use 通过 js() 读取（console 日志加载后难以回溯）
    window.__BD_ART_LOG__ = window.__BD_ART_LOG__ || [];
    const pushLog = (tag, args) => {
        try {
            window.__BD_ART_LOG__.push('[' + tag + '] ' + args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
        } catch (e) {}
    };
    const log = (...a) => { console.log('[BD-ArtPlayer]', ...a); pushLog('INFO', a); };
    const dbg = (...a) => { if (CONFIG.DEBUG) { console.log('[BD-ArtPlayer][DEBUG]', ...a); pushLog('DEBUG', a); } };
    const delay = (ms) => new Promise((res) => setTimeout(res, ms || 500));

    // ===== 关键：document-start 阶段立即隐藏原生播放器，杜绝"两个视频"瞬态 =====
    // 只隐藏原生容器，不碰 #artplayer（我们的 ArtPlayer 容器）。
    const HIDE_CSS = [
        '#video-wrap, .vp-video__player, .video-js { display: none !important; }',
        // 当前百度新版：原生 <video> 可能直接挂在 SECTION.vp-video 下（非其子元素包装）
        // 仅隐藏播放器区域下的原生 video，不动播放列表缩略图（避免误伤）
        'SECTION.vp-video > video, .vp-video > video { display: none !important; }',
    ].join('\n');
    try {
        if (typeof GM_addStyle === 'function') GM_addStyle(HIDE_CSS);
        else {
            const st = document.createElement('style');
            st.textContent = HIDE_CSS;
            (document.head || document.documentElement || document).appendChild(st);
        }
    } catch (e) { dbg('inject hide css error', e); }

    // ===== 播放地址 / 清晰度 / adToken 构造（参照网盘真实接口，开源免费复刻）=====
    let adToken = '';

    function getVip() {
        try {
            const w = unsafeWindow;
            if (w.yunData && !w.yunData.neglect) {
                return w.yunData.ISSVIP === 1 ? 2 : (w.yunData.ISVIP === 1 ? 1 : 0);
            }
            const L = w.locals;
            if (L) {
                let svip, vip;
                if (L.get) { svip = (+L.get('is_svip') === 1); vip = (+L.get('is_vip') === 1); }
                else { svip = (+L.is_svip === 1); vip = (+L.is_vip === 1); }
                return svip ? 2 : (vip ? 1 : 0);
            }
        } catch (e) { dbg('getVip error', e); }
        return 0;
    }

    function buildGetUrl(file, vip) {
        return function (type) {
            if (type.indexOf('1080') >= 0 && vip <= 1) type = type.replace('1080', '720'); // 非会员 1080 降级 720
            return '/api/streaming?path=' + encodeURIComponent(file.path) +
                '&app_id=' + CONFIG.APP_ID +
                '&clienttype=0' +
                '&type=' + type +
                '&vip=' + vip +
                '&jsToken=' + (unsafeWindow.jsToken || '');
        };
    }

    function getAdToken(getUrl) {
        if (adToken || getVip() > 1) return Promise.resolve(adToken);
        const url = getUrl('M3U8_AUTO_480');
        dbg('getAdToken fetch:', url);
        return fetch(url).then((r) => r.text()).then((t) => {
            try { t = JSON.parse(t); } catch (e) {}
            if (t && t.errno === 133 && t.adTime !== 0) { adToken = t.adToken; dbg('adToken got:', ('' + adToken).slice(0, 16) + '...'); }
            else dbg('getAdToken resp errno=', t && t.errno);
            return adToken;
        }).catch((e) => { dbg('getAdToken error', e); return adToken; });
    }

    function buildQualities(file, getUrl, adToken) {
        const templates = { 1080: '超清 1080P', 720: '高清 720P', 480: '流畅 480P', 360: '省流 360P' };
        const res = file.resolution || '';
        const m = res.match(/width:(\d+),height:(\d+)/) || [];
        const area = (parseInt(m[1], 10) || 0) * (parseInt(m[2], 10) || 0);
        let list = [480, 360];
        if (area > 409920) list.unshift(720);
        if (area > 921600) list.unshift(1080);
        dbg('resolution=', res, 'area=', area, 'qualities=', list);
        return list.map((tpl, i) => ({
            default: i === 0,
            html: templates[tpl],
            url: getUrl('M3U8_AUTO_' + tpl) + '&adToken=' + encodeURIComponent(adToken || ''),
        }));
    }

    // ===== 播放进度记忆（localStorage，按文件 fs_id/path 存，支持续播）=====
    function progressKey(file) {
        const id = (file && (file.fs_id || file.path)) || '';
        return 'bdArtProgress:' + (typeof id === 'string' ? id : String(id));
    }
    function loadProgress(key) {
        try {
            const v = localStorage.getItem(key);
            const n = v ? parseFloat(v) : 0;
            return (n > 0 && isFinite(n)) ? n : 0;
        } catch (e) { return 0; }
    }
    function saveProgress(key, time) {
        try { if (time > 0) localStorage.setItem(key, String(Math.floor(time))); } catch (e) {}
    }
    function clearProgress(key) {
        try { localStorage.removeItem(key); } catch (e) {}
    }
    function fmtTime(sec) {
        sec = Math.floor(sec || 0);
        const m = Math.floor(sec / 60), s = sec % 60;
        return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
    }

    function playM3u8(video, url, art) {
        if (window.Hls && window.Hls.isSupported()) {
            if (art.hls) { try { art.hls.destroy(); } catch (e) {} }
            const hls = new window.Hls();
            hls.loadSource(url);
            hls.attachMedia(video);
            art.hls = hls;
            // 只绑定一次销毁回调：切换清晰度会重复进入本函数，避免 destroy 监听器累积（内存泄漏）
            if (!art.__hlsDestroyBound) {
                art.__hlsDestroyBound = true;
                art.on('destroy', () => { try { art.hls && art.hls.destroy(); } catch (e) {} });
            }
            hls.on(window.Hls.Events.MANIFEST_PARSED, () => { log('m3u8 parsed:', url.slice(0, 50)); });
            hls.on(window.Hls.Events.ERROR, (e, data) => {
                if (data && data.fatal) dbg('hls fatal error', data.type, data.details);
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url; // Safari 原生 HLS
        } else {
            art.notice.show = '当前浏览器不支持 m3u8 播放';
        }
    }

    // ===== 拦截核心（参照参考脚本 replaceVideoPlayer + destroyPlayer）=====
    let videoNode = null; // 被替换下来的原生节点（detached）

    // 找原生播放器节点：优先参考脚本的 3 个选择器，并补充当前百度新版（SECTION.vp-video 下的裸 video）
    function findNativePlayer() {
        return document.querySelector('#video-wrap, .vp-video__player, #app .video-content')
            || document.querySelector('SECTION.vp-video > video')
            || document.querySelector('.vp-video > video');
    }

    function replaceVideoPlayer() {
        const container = document.getElementById('artplayer');
        if (container) { startGuard(); return Promise.resolve(); } // 已替换，直接守卫
        const node = findNativePlayer();
        if (node) {
            // 清理后续兄弟节点（控制栏 / 广告残留）
            while (node.nextSibling) node.parentNode.removeChild(node.nextSibling);
            const art = document.createElement('div');
            art.id = 'artplayer';
            art.style.cssText = 'width:100%;height:100%;background:#000;';
            videoNode = node.parentNode.replaceChild(art, node);
            art.parentNode.style.cssText += ';z-index:auto;';
            dbg('replaced native node:', node.tagName, (node.id || node.className || '').toString().slice(0, 40));
            startGuard(); // 启动守卫，防止原生被重渲染
            return Promise.resolve();
        }
        // 没找到就重试（参考脚本用 delay().then 轮询）
        return delay(500).then(replaceVideoPlayer);
    }

    // 轮询销毁原生 Video.js 实例（参考脚本做法：每 500ms，最长 30s）
    function destroyPlayer() {
        let count = 0;
        const id = setInterval(function () {
            const inst = videoNode && videoNode.firstChild;
            if (inst && inst.player && typeof inst.player.dispose === 'function') {
                clearInterval(id);
                try { inst.player.dispose(); dbg('disposed native player'); } catch (e) { dbg('dispose error', e); }
                inst.player = !1;
                videoNode = null;
            } else if (++count > 60) {
                clearInterval(id);
                videoNode = null;
            }
        }, 500);
    }

    // MutationObserver 守卫：原生播放器一旦被网盘重渲染出来（非 #artplayer 内），立即移除
    let guardStarted = false;
    function startGuard() {
        if (guardStarted) return;
        guardStarted = true;
        const root = document.querySelector('SECTION.vp-video') || document.body;
        const removeNative = (n) => {
            if (!n || n.nodeType !== 1) return;
            const isNative = (n.id === 'video-wrap')
                || (n.classList && (n.classList.contains('vp-video__player') || n.classList.contains('video-js')))
                || (n.tagName === 'VIDEO' && !n.closest('#artplayer'));
            if (isNative && !n.closest('#artplayer')) {
                dbg('guard removed re-created native node:', n.tagName, (n.id || n.className || '').toString().slice(0, 30));
                n.remove();
            }
            // 递归检查子节点
            if (n.querySelectorAll) {
                n.querySelectorAll('video').forEach((v) => { if (!v.closest('#artplayer')) { dbg('guard removed nested native video'); v.remove(); } });
            }
        };
        const obs = new MutationObserver((muts) => {
            for (const m of muts) {
                if (m.addedNodes) m.addedNodes.forEach(removeNative);
            }
        });
        obs.observe(root, { childList: true, subtree: true });
        dbg('guard started on', root === document.body ? 'body' : 'SECTION.vp-video');
    }

    // ===== 控制栏额外功能按钮（纯 ArtPlayer 公开 API，无付费依赖）=====
    // 字段依据 ScriptCat 知识库「控制器 | ArtPlayer.js」：controls.add({name,index,position,html,style,click,tooltip,selector,onSelect})
    function addControlBarButtons(art) {
        // 镜像翻转：切换 art.flip (normal / horizontal / vertical)
        let flipped = false;
        art.controls.add({
            name: 'bdFlip',
            html: '镜像',
            position: 'right',
            index: 65,
            tooltip: '镜像翻转画面',
            click: function () {
                flipped = !flipped;
                try { art.flip = flipped ? 'horizontal' : 'normal'; }
                catch (e) { dbg('flip error', e); }
            },
        });
        // 画中画：保留 ArtPlayer 原生画中画控件（option 里 pip:true 渲染的图标按钮）。
        // 不再额外添加自定义「画中画」文字按钮（bdPip），它与原生图标按钮功能完全重复（都只是切换 art.pip）。
        // 迷你窗口（bdMini）也已删除，故只保留 ArtPlayer 自带的 pip / mini 原生控件（如需迷你再开 mini:true）。
        log('control-bar extra buttons added (flip only; pip uses ArtPlayer native icon control)');
    }

    // ===== 初始化 ArtPlayer（先替换 → 再初始化 → 最后销毁原生）=====
    function initVideoPlayer(file, filelist, qualities) {
        replaceVideoPlayer().then(function () {
            const option = {
                container: '#artplayer',
                url: qualities[0].url,
                type: 'm3u8',
                customType: { m3u8: playM3u8 },
                autoplay: CONFIG.AUTOPLAY,
                // 自动播放必须静音（浏览器策略），声音在用户首次交互后恢复（见下方 restoreSound）
                muted: CONFIG.AUTOPLAY,
                setting: true,
                hotkey: true,
                aspectRatio: true,
                fullscreen: true,
                screenshot: true, // 控制栏自带「截图」按钮（纯公开能力，无付费依赖）
                mutex: true,
                pip: true,   // 保留 ArtPlayer 原生画中画控件（底栏画中画图标按钮）
                mini: false, // 移除迷你窗口按钮（原自定义 bdMini 已删除，不再提供该入口）
                // 初始海报：优先用网盘返回的缩略图，避免起播前纯黑（缺省则 undefined，ArtPlayer 忽略）
                poster: (file && file.thumbs && (file.thumbs.url3 || file.thumbs.url2 || file.thumbs.url1)) || undefined,
                miniProgressBar: true, // 失焦且播放时显示迷你进度条
                // 移动端（@match wap/home*）适配：内联播放 + 网页全屏自动旋转 + 锁定/长按快进
                playsInline: true,
                autoOrientation: true,
                lock: true,
                fastForward: true,
                moreVideoAttr: { playsInline: true, 'webkit-playsinline': true },
            };
            if (qualities.length > 1) {
                option.quality = qualities.map((q, i) => ({ default: i === 0, html: q.html, url: q.url }));
            }
            dbg('ArtPlayer option url:', qualities[0].url.slice(0, 70), 'quality:', qualities.length);

            let art;
            try {
                art = new window.Artplayer(option);
            } catch (e) { dbg('Artplayer init error', e); return; }
            window.__bdArt = art; // 调试句柄：便于验证 pip/mini 等实例属性

            art.on('ready', () => log('ArtPlayer ready'));
            art.on('video:ended', () => { log('playback ended'); goNext(file, filelist); });

            // 静音自动播放 → 用户首次交互（点击/触屏/按键）后恢复声音
            if (CONFIG.AUTOPLAY) {
                log('autoplay muted; restore sound on first user interaction');
                let soundRestored = false;
                const restoreSound = () => {
                    if (soundRestored) return;
                    soundRestored = true;
                    try {
                        art.muted = false;
                        // muted 仅静音不改变音量值；若此前音量为 0 则兜底提到 0.7
                        if (typeof art.volume === 'number' && (!art.volume || art.volume < 0.1)) {
                            art.volume = 0.7;
                        }
                        dbg('sound restored after user interaction');
                    } catch (e) { dbg('restore sound error', e); }
                    ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => document.removeEventListener(ev, restoreSound));
                };
                ['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
                    document.addEventListener(ev, restoreSound, { passive: true }));
            }

            // ===== 播放进度记忆 / 续播 =====
            if (CONFIG.RESUME) {
                const key = progressKey(file);
                let lastSave = 0;
                let applied = false;
                const tryResume = () => {
                    if (applied) return;
                    const dur = (typeof art.duration === 'number') ? art.duration : 0;
                    const saved = loadProgress(key);
                    // 进度过短（<5s）或已接近片尾（>片长-5s）则不续播
                    if (saved <= 5 || (dur && saved >= dur - 5)) { applied = true; return; }
                    try {
                        art.currentTime = saved; // 跳到上次位置
                        applied = true;
                        art.notice.show = '已续播至 ' + fmtTime(saved);
                        log('resumed at', fmtTime(saved), '(saved', saved, 'dur', dur, ')');
                    } catch (e) {
                        dbg('resume seek error', e); // 失败则下次事件再试（applied 仍为 false）
                    }
                };
                // 元数据加载 / 可播放后尝试续播一次
                art.on('video:loadedmetadata', tryResume);
                art.on('video:canplay', tryResume);
                // 周期性（每 4s）+ 暂停时保存进度
                art.on('video:timeupdate', () => {
                    const now = Date.now();
                    if (now - lastSave > 4000) {
                        lastSave = now;
                        try { saveProgress(key, art.currentTime); } catch (e) {}
                    }
                });
                art.on('video:pause', () => { try { saveProgress(key, art.currentTime); } catch (e) {} });
                // 播放结束：清除进度（下次从头开始），并触发连播（已有 goNext 处理）
                art.on('video:ended', () => { try { clearProgress(key); } catch (e) {} });
                // 页面卸载前兜底保存一次
                window.addEventListener('beforeunload', () => { try { saveProgress(key, art.currentTime); } catch (e) {} });
                log('resume/playback-progress enabled (key=' + key + ')');
            }

            // ===== 控制栏「倍速」选择器（紧贴画质，不进设置菜单）=====
            // 用 ArtPlayer 的 controls.add 在控制栏右侧加一个下拉，onSelect 返回的文本即当前显示值。
            let currentRate = 1;
            try {
                const rateItems = [
                    { html: '0.5x', value: 0.5 },
                    { html: '0.75x', value: 0.75 },
                    { html: '常速', value: 1, default: true },
                    { html: '1.25x', value: 1.25 },
                    { html: '1.5x', value: 1.5 },
                    { html: '2x', value: 2 },
                ];
                art.controls.add({
                    name: 'bdPlaybackRate',
                    html: '倍速',
                    position: 'right',
                    index: 60, // 推到画质/全屏附近的右侧区域
                    selector: rateItems,
                    onSelect: function (item) {
                        currentRate = item.value;
                        try { art.playbackRate = item.value; } catch (e) { dbg('set rate error', e); }
                        return item.html; // 控制栏上显示当前倍速
                    },
                });
                // 切换画质会重载视频、倍速可能被重置为 1，这里在可播放时重新应用用户设定的倍速
                art.on('video:canplay', () => {
                    if (currentRate && currentRate !== 1) {
                        try { art.playbackRate = currentRate; } catch (e) {}
                    }
                });
                log('control-bar playback rate added');
            } catch (e) { dbg('add playbackRate control error', e); }

            // 控制栏额外功能按钮（镜像 / 画中画 / 迷你）
            try { addControlBarButtons(art); }
            catch (e) { dbg('add control-bar buttons error', e); }

            // 关键顺序：ArtPlayer 初始化完成后再销毁原生实例（避免原生在初始化期间抢资源/重渲染）
            destroyPlayer();
        });
    }

    // ===== 连续播放：播完跳下一集 =====
    function goNext(file, filelist) {
        if (!filelist || !filelist.length) { log('无播放列表，无法连播'); return; }
        let idx = -1;
        for (let i = 0; i < filelist.length; i++) {
            const it = filelist[i];
            if ((file.fs_id && it.fs_id == file.fs_id) || (file.path && it.path === file.path)) { idx = i; break; }
        }
        if (idx >= 0 && idx + 1 < filelist.length) {
            const next = filelist[idx + 1];
            const p = next.path || '';
            if (p) {
                dbg('next episode:', next.name || next.server_filename || p);
                location.href = 'https://pan.baidu.com/pfile/video?path=' + encodeURIComponent(p);
            }
        } else {
            log('已是最后一集');
        }
    }

    // ===== 入口：从 Vue3 + Pinia 取数据，再替换 =====
    function start() {
        try {
            const appEl = document.querySelector('#app');
            const gp = appEl && appEl.__vue_app__ && appEl.__vue_app__.config.globalProperties;
            const $pinia = gp && gp.$pinia;
            if (!$pinia) { return setTimeout(start, 500); }
            const vi = $pinia.state._rawValue.videoinfo && $pinia.state._rawValue.videoinfo.videoinfo;
            if (!vi || !Object.keys(vi).length) { return setTimeout(start, 500); }

            const file = vi; // { path, fs_id, resolution, thumbs, ... }
            const recommend = $pinia.state._rawValue.recommendListInfo;
            const filelist = (recommend && Array.isArray(recommend.selectionVideoList)) ? recommend.selectionVideoList : [];
            const vip = getVip();
            const getUrl = buildGetUrl(file, vip);

            dbg('video file path:', file.path, 'fs_id:', file.fs_id, 'vip:', vip, 'filelist:', filelist.length);

            getAdToken(getUrl).then((tok) => {
                const qualities = buildQualities(file, getUrl, tok);
                if (!qualities.length) { dbg('no quality built'); return; }
                initVideoPlayer(file, filelist, qualities);
            });
        } catch (e) {
            dbg('start error', e);
            setTimeout(start, 1000);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
