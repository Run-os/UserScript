// ==UserScript==
// @name         征纳互动人数监控
// @namespace    http://tampermonkey.net/
// @version      1.12
// @description  监控征纳互动等待人数变化并进行语音提示，带折叠面板
// @author       runos
// @match        https://znhd.hunan.chinatax.gov.cn:8443/*
// @grant        GM_addStyle
// @grant        unsafeWindow
// @homepage     https://scriptcat.org/zh-CN/script-show-page/3650
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // 添加自定义样式
    GM_addStyle(`
        #monitorLogContainer {
            position: fixed;
            top: 10px; /* 减小 top 值，将面板向上移动 */
            right: 500px;
            width: 300px;
            background: #ffffff; /* 更纯净的白色背景 */
            border: none; /* 移除边框 */
            border-radius: 12px; /* 更大的圆角 */
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1); /* 更柔和的阴影 */
            z-index: 9999;
            font-family: 'Segoe UI', Roboto, sans-serif; /* 更现代的字体 */
            max-height: 250px;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); /* 更顺滑的过渡效果 */
        }

        #monitorLogContainer.collapsed {
            max-height: none; // 移除最大高度限制，仅折叠日志部分
            overflow: hidden;
        }

        #monitorLogHeader {
            background-color: #f5f5f5; /* 更柔和的头部背景色 */
            padding: 10px; /* 调小头部内边距 */
            border-bottom: none; /* 移除边框 */
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            border-top-left-radius: 12px;
            border-top-right-radius: 12px;
            font-size: 12px; // 调小头部字体大小
        }

        #monitorLogs {
            padding: 16px;
            font-size: 14px; /* 更大的字体 */
            max-height: 200px;
            overflow-y: auto;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); /* 更顺滑的过渡效果 */
        }

        #monitorLogContainer.collapsed #monitorLogs {
            display: none;
        }

        .log-item {
            padding: 8px 0;
            border-bottom: 1px solid #eeeeee; /* 更柔和的分割线 */
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .log-warning {
            color: #ff9800; /* 更鲜明的警告色 */
        }

        .log-info {
            color: #2196f3; /* 更鲜明的信息色 */
        }

        .log-success {
            color: #4caf50; /* 更鲜明的成功色 */
        }

        #toggleCollapseBtn, #toggleVoiceBtn {            background: #2196f3; /* 统一按钮颜色 */
            color: white;
            border: none;
            padding: 4px 10px; /* 调小按钮内边距 */
            border-radius: 8px; /* 按钮圆角 */
            cursor: pointer;
            font-size: 14px;
            margin-left: 8px;
            transition: background 0.2s;
        }

        #toggleCollapseBtn:hover, #toggleVoiceBtn.voice-enabled {
            background: #2196f3; /* 语音开启时的绿色 */
        }
        #toggleVoiceBtn.voice-disabled {
            background: #f44336; /* 语音关闭时的红色 */
        }
        #toggleVoiceBtn:hover.voice-enabled {
            background: #1976d2; /* 语音开启时的深绿色悬停效果 */
        }
        #toggleVoiceBtn:hover.voice-disabled {
            background: #d32f2f; /* 语音关闭时的深红色悬停效果 */
        }

        #toggleCollapseBtn {
            background: #9e9e9e; /* 折叠按钮颜色 */
        }

        #toggleCollapseBtn:hover {
            background: #757575; /* 折叠按钮悬停颜色 */
        }

        #monitorTitle {
            margin: 0;
            font-size: 16px; /* 更大的标题字体 */
            display: flex;
            align-items: center;
            color: #212121; /* 更暗的标题颜色 */
            font-size: 12px; // 调小标题字体大小
        }

        .collapse-icon {
            margin-right: 12px;
            font-size: 16px; /* 更大的图标 */
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        #monitorLogContainer.collapsed .collapse-icon {
            transform: rotate(-90deg);
        }

        .control-buttons {
            display: flex;
        }
    `);

    // 语音播报开关 (true: 开启语音, false: 静音)
    let voiceEnabled = true;
    // 面板折叠状态
    let panelCollapsed = false;
    // 存储日志条目
    const logEntries = [];

    // 配置对象，集中管理可配置项
    const CONFIG = {
        // 检查间隔（毫秒）
        CHECK_INTERVAL: 3000,
        // 最大日志条目数
        MAX_LOG_ENTRIES: 5,
        WORKING_HOURS: {
            MORNING: { START: 9, END: 12 },
            AFTERNOON: { START: 13.5, END: 18 }
        }
    };
    var loginout = 0;
    // 工具函数：获取当前小时（支持小数）
    function getCurrentHour() {
        const now = new Date();
        return now.getHours() + now.getMinutes() / 60;
    }

    // 检查是否在工作时间内
    function isWorkingHours() {
        const currentHour = getCurrentHour();
        return (currentHour >= CONFIG.WORKING_HOURS.MORNING.START && currentHour <= CONFIG.WORKING_HOURS.MORNING.END) ||
            (currentHour >= CONFIG.WORKING_HOURS.AFTERNOON.START && currentHour <= CONFIG.WORKING_HOURS.AFTERNOON.END);
    }

    // 修改主要检测函数
    function checkCount() {
        if (!isWorkingHours()) {
            addLog('当前不在工作时间，已停止脚本', 'warning');
            return;
        }
        try {
            // 获取等待人数
            const ocurrentElement = document.querySelector('.count:nth-child(2)');
            if (!ocurrentElement) {
                addLog('找不到人数元素', 'warning');
                speak("找不到人数元素");
                return;
            }

            const currentCount = parseInt(ocurrentElement.textContent.trim());
            // 检查currentCount是否为有效数字
            if (isNaN(currentCount)) {
                addLog('无法解析等待人数', 'warning');
                speak("无法解析等待人数");
                return;
            }

            if (currentCount === 0) {
                addLog('当前等待人数为0', 'success');
            } else if (currentCount < 5) {
                // 使用具体数字替代length比较
                addLog(`当前等待人数: ${currentCount}`, 'info');
                speak("征纳互动有人来了");
            }

            // 检查离线状态
            const offlineElement = document.querySelector('.t-dialog__body__icon:nth-child(2)');
            if (offlineElement && offlineElement.textContent.trim().includes('离线')) {
                if (loginout < 5) {
                    loginout = loginout + 1;
                    addLog('征纳互动已离线', 'warning');
                    speak("征纳互动已离线");
                } else {
                    addLog('离线：当前已通知5次，等待归零', 'warning');
                }
            } else {
                addLog("未离线", "success")
            }
        } catch (error) {
            addLog(`检测错误: ${error.message}`, 'warning');
        }
    }

    const speechQueue = [];
    let isSpeaking = false;
    let voicesReady = false;

    // 确保语音加载完成
    speechSynthesis.onvoiceschanged = () => {
        voicesReady = !!speechSynthesis.getVoices().length;
    };

    let firstSpeak = true;

    function speak(text, voiceEnabled = true) {
        if (firstSpeak && !voicesReady) {
            const checkVoices = () => {
                if (voicesReady) {
                    firstSpeak = false;
                    addLog('语音首次加载完成，可以开始播报。', 'info');
                    speak(text, voiceEnabled);
                } else {
                    setTimeout(checkVoices, 100);
                    addLog("等待语音加载完成", "info");
                }
            };
            checkVoices();
            return;
        }
        if (!voiceEnabled || !('speechSynthesis' in window) || !voicesReady) return;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 1.0;

        speechQueue.push(utterance);
        processSpeechQueue();
    }

    function processSpeechQueue() {
        if (isSpeaking || speechQueue.length === 0) return;

        isSpeaking = true;
        const utterance = speechQueue.shift();

        utterance.onend = utterance.onerror = (e) => {
            isSpeaking = false;
            processSpeechQueue();
        };

        window.speechSynthesis.speak(utterance);
    }

    // 添加日志条目
    function addLog(message, type = 'info') {
        const timestamp = new Date().toTimeString().slice(0, 8);
        const logItem = { timestamp, message, type };

        logEntries.unshift(logItem);
        if (logEntries.length > CONFIG.MAX_LOG_ENTRIES) {
            logEntries.pop();
        }

        updateLogDisplay();
        console.log(`[监控] ${timestamp} ${message}`);
    }

    // 更新日志显示（使用文档片段优化性能）
    function updateLogDisplay() {
        const logContainer = document.getElementById('monitorLogs');
        if (!logContainer) return;

        const fragment = document.createDocumentFragment();
        logEntries.forEach(log => {
            const logElement = document.createElement('div');
            logElement.className = `log-item log-${log.type}`;
            logElement.innerHTML = `<strong>${log.timestamp}</strong> - ${log.message}`;
            fragment.appendChild(logElement);
        });

        logContainer.innerHTML = '';
        logContainer.appendChild(fragment);
    }

    // 切换面板折叠状态
    function togglePanel() {
        const container = document.getElementById('monitorLogContainer');
        if (!container) return;

        panelCollapsed = !panelCollapsed;

        if (panelCollapsed) {
            container.classList.add('collapsed');
        } else {
            container.classList.remove('collapsed');
        }

        // 更新折叠按钮文本
        const collapseBtn = document.getElementById('toggleCollapseBtn');
        if (collapseBtn) {
            collapseBtn.textContent = panelCollapsed ? '展开面板' : '折叠面板';
        }
    }

    // 创建控制面板
    function createControlPanel() {
        const panel = document.createElement('div');
        panel.id = 'monitorLogContainer';

        // 面板头部
        const header = document.createElement('div');
        header.id = 'monitorLogHeader';

        // 标题区域（可点击折叠）
        const titleArea = document.createElement('div');
        titleArea.style.display = 'flex';
        titleArea.style.alignItems = 'center';

        const title = document.createElement('h4');
        title.id = 'monitorTitle';
        title.innerHTML = '<span class="collapse-icon">▼</span> 征纳互动监控';
        titleArea.appendChild(title);

        header.appendChild(titleArea);

        // 按钮容器
        const btnContainer = document.createElement('div');
        btnContainer.className = 'control-buttons';

        // 语音开关
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'toggleVoiceBtn';
        toggleBtn.textContent = voiceEnabled ? '🔊 语音' : '🔇 静音';
        toggleBtn.title = voiceEnabled ? '关闭语音提示' : '开启语音提示';
        toggleBtn.onclick = (e) => {
            e.stopPropagation(); // 阻止冒泡，避免触发折叠
            voiceEnabled = !voiceEnabled;
            toggleBtn.textContent = voiceEnabled ? '🔊 语音' : '🔇 静音';
            toggleBtn.className = voiceEnabled ? 'voice-enabled' : 'voice-disabled';
            toggleBtn.title = voiceEnabled ? '关闭语音提示' : '开启语音提示';
            addLog(`语音功能已${voiceEnabled ? '启用' : '禁用'}`);
        };
        btnContainer.appendChild(toggleBtn);

        // 折叠按钮
        const collapseBtn = document.createElement('button');
        collapseBtn.id = 'toggleCollapseBtn';
        collapseBtn.textContent = '折叠面板';
        collapseBtn.title = '折叠/展开控制面板';
        collapseBtn.onclick = (e) => {
            e.stopPropagation(); // 阻止冒泡，避免触发折叠
            togglePanel();
        };
        btnContainer.appendChild(collapseBtn);



        header.appendChild(btnContainer);
        panel.appendChild(header);

        // 日志内容区域
        const logContent = document.createElement('div');
        logContent.id = 'monitorLogs';
        logContent.innerHTML = '<div class="log-item log-info">监控启动...</div>';
        panel.appendChild(logContent);

        document.body.appendChild(panel);

        // 添加点击折叠功能（点击标题栏可折叠）
        header.addEventListener('click', togglePanel);

        // 初始添加一条日志
        addLog('监控已启动');
    }

    // 初始化监控
    function initMonitor() {
        createControlPanel();
        speak("监控启动");
        // 每3秒检查一次
        setInterval(checkCount, 3000);
    }

    // 页面加载完成后启动监控
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMonitor);
    } else {
        initMonitor();
    }
})();