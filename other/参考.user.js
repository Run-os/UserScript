// ==UserScript==
// @name         百度网盘自动打开中文字幕（精简版）
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  百度网盘自动打开中文字幕，仅保留核心功能，支持开关切换
// @author       woshilisisui (精简版)
// @match        https://pan.baidu.com/pfile/video?path=*.mp4*  // 只在百度网盘的视频播放页面运行
// @icon         https://th.bing.com/th?id=ODLS.039b3eb8-253e-4d80-8727-6e7d039c3891&w=32&h=32&qlt=90&pcl=fffffa&o=6&pid=1.2
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @license      GPL3
// ==/UserScript==



(function () {
    'use strict';  // 使用严格模式，避免一些JavaScript的不良写法

    // 全局变量声明
    let interval;  // 用来存储定时器的引用，方便后续清除
    let lastUrl = ''; // 存储上一个URL，用来检测页面是否发生了跳转
    let menuId; // 存储菜单命令的ID

    // 初始化菜单
    function initMenu() {
        const enabled = GM_getValue("subtitle_enabled", true); // 默认开启
        const statusText = enabled ? "已开启" : "已关闭";
        menuId = GM_registerMenuCommand(`中文字幕自动打开: ${statusText}`, toggleSubtitle, "s");
    }

    // 切换字幕功能开关
    function toggleSubtitle() {
        GM_unregisterMenuCommand(menuId);
        const currentEnabled = GM_getValue("subtitle_enabled", true);
        const newEnabled = !currentEnabled;
        GM_setValue("subtitle_enabled", newEnabled);

        const statusText = newEnabled ? "已开启" : "已关闭";
        menuId = GM_registerMenuCommand(`中文字幕自动打开: ${statusText}`, toggleSubtitle, "s");

        console.log(`字幕自动打开功能${statusText}`);

        // 如果开启了功能且当前页面合适，立即开始检测
        if (newEnabled && window.location.href.includes('pan.baidu.com/pfile/video')) {
            clearInterval(interval);
            waitForSubtitleButton();
        } else if (!newEnabled) {
            clearInterval(interval); // 关闭功能时停止检测
        }
    }

    // 检查功能是否启用
    function isSubtitleEnabled() {
        return GM_getValue("subtitle_enabled", true);
    }

    // 初始化菜单
    initMenu();

    // 等待页面完全加载完毕后执行脚本
    window.onload = function () {
        console.log('页面加载完成，开始初始化脚本');

        // 只有在功能启用时才开始检测
        if (isSubtitleEnabled()) {
            // 初始执行字幕检测
            waitForSubtitleButton();
        } else {
            console.log('字幕自动打开功能已关闭');
        }

        // 监听DOM变化以检测URL变化
        // MutationObserver是浏览器提供的API，可以监听DOM树的变化
        const observer = new MutationObserver(() => {
            const currentUrl = window.location.href;  // 获取当前页面的URL

            // 检查URL是否发生变化（用户可能切换了视频）
            if (currentUrl !== lastUrl) {
                console.log('URL发生变化，重新检测字幕');
                lastUrl = currentUrl; // 更新上一个URL记录

                clearInterval(interval); // 停止当前的轮询检测

                // 只有在功能启用时才重新开始检测
                if (isSubtitleEnabled()) {
                    // 延迟一段时间确保新页面的DOM完全更新
                    setTimeout(() => {
                        waitForSubtitleButton();
                    }, 1000);
                }
            }
        });

        // 开始观察整个页面的DOM变化
        // childList: 监听子节点的增删
        // subtree: 监听所有后代节点的变化
        observer.observe(document.body, { childList: true, subtree: true });
    };

    // 修改字幕样式（保留此功能以增强可读性）
    function changeSubtitle() {
        try {
            // 查找当前显示的字幕文本元素
            // querySelector是DOM API，用于查找页面中符合条件的元素
            const subtitleText = document.querySelector('.vp-video__subtitle-text.show');

            if (subtitleText) {
                // 修改字幕的背景色和文字颜色，让字幕更清晰易读
                subtitleText.style.background = 'rgba(214, 214, 214, 0.65)';  // 半透明灰色背景
                subtitleText.style.color = '#ff0000';  // 红色文字
                console.log('字幕样式修改成功');
            }
        } catch (err) {
            // 如果出现错误，记录错误信息并重试
            console.error('修改字幕样式出错:', err);
            setTimeout(changeSubtitle, 1000); // 1秒后重试
        }
    }

    // 轮询检测并自动打开中文字幕
    function waitForSubtitleButton() {
        // 检查功能是否启用
        if (!isSubtitleEnabled()) {
            console.log('字幕自动打开功能已关闭，跳过检测');
            return;
        }

        console.log('开始检测字幕按钮...');

        const maxAttempts = 100; // 最大尝试次数，避免无限循环
        let attempts = 0;  // 当前尝试次数计数器

        // 使用setInterval创建定时器，每隔一段时间执行一次检测
        interval = setInterval(() => {
            attempts++;  // 尝试次数加1

            // 如果尝试次数过多，停止检测
            if (attempts >= maxAttempts) {
                console.log('尝试次数过多，未检测到中文字幕');
                clearInterval(interval);  // 清除定时器
                return;
            }

            // 模拟鼠标悬停以显示字幕菜单
            // 因为字幕选项可能需要鼠标悬停才显示
            simulateMouseHoverToButton();

            // 获取所有字幕选项
            // querySelectorAll会返回所有匹配的元素
            const subtitleElements = document.querySelectorAll('li.vp-video__control-bar--video-subtitles-select-item');

            // 如果找到了字幕选项
            if (subtitleElements.length > 0) {
                console.log(`找到 ${subtitleElements.length} 个字幕选项`);

                // 遍历所有字幕选项
                subtitleElements.forEach(element => {
                    // 检查是否是中文字幕
                    if (element.textContent.trim() === '中文字幕') {
                        clearInterval(interval);  // 停止检测
                        console.log('检测到中文字幕，自动打开');
                        element.click(); // 点击打开中文字幕

                        // 延迟修改字幕样式，给字幕加载一些时间
                        setTimeout(changeSubtitle, 1000);
                    }
                });
            } else {
                console.log(`第 ${attempts} 次尝试：未找到字幕选项`);
            }
        }, 2000); // 每2秒检测一次
    }

    // 模拟鼠标悬停到字幕按钮，确保菜单可点击
    function simulateMouseHoverToButton() {
        // 查找字幕按钮元素
        const buttonElement = document.querySelector('.vp-video__control-bar--button.is-text');

        if (buttonElement) {
            // 创建并触发鼠标进入事件
            // MouseEvent是浏览器提供的鼠标事件构造函数
            const mouseOverEvent = new MouseEvent('mouseenter', {
                view: window,        // 事件发生的窗口
                bubbles: true,       // 事件是否冒泡
                cancelable: true     // 事件是否可以被取消
            });
            buttonElement.dispatchEvent(mouseOverEvent);  // 触发事件

            // 延迟触发鼠标离开事件
            // 这样模拟真实的鼠标悬停行为
            setTimeout(() => {
                const mouseLeaveEvent = new MouseEvent('mouseleave', {
                    view: window,
                    bubbles: true,
                    cancelable: true
                });
                buttonElement.dispatchEvent(mouseLeaveEvent);
            }, 500);  // 500毫秒后触发鼠标离开事件
        }
    }
})();