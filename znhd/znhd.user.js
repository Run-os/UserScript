// ==UserScript==
// @name        征纳互动人数和在线监控
// @namespace   https://scriptcat.org/
// @description 监控征纳互动等待人数和在线状态，支持语音播报和Gotify推送通知。
// @version     25.12.07-1
// @author      runos
// @match       https://znhd.hunan.chinatax.gov.cn:8443/*
// @match       https://www.52pojie.cn/*
// @icon        https://znhd.hunan.chinatax.gov.cn:8443/favicon.ico
// @grant       GM_addStyle
// @grant       unsafeWindow
// @grant       GM_xmlhttpRequest
// @grant       GM_setClipboard
// @connect     sct.icodef.com
// @grant       GM_notification
// @homepage    https://scriptcat.org/zh-CN/script-show-page/3650
// @require     https://scriptcat.org/lib/1167/1.0.0/%E8%84%9A%E6%9C%AC%E7%8C%ABUI%E5%BA%93.js  // 引入脚本猫UI库
// ==/UserScript==

// 暴露变量到全局，方便在浏览器控制台调试
// 使用安全的命名空间，避免全局污染
const ScriptCatMonitor = {
    CAT_UI: CAT_UI,
    React: React,
    ReactDOM: ReactDOM,
    jsxLoader: jsxLoader,
    addLog: addLog
};
// 仅在开发环境下暴露到全局
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    (window.unsafeWindow || window).ScriptCatMonitor = ScriptCatMonitor;
}

// ==========配置==========
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

// ==========日志管理==========
// 全局日志状态管理
let setLogEntriesCallback = null;

// 添加日志条目函数
function addLog(message, type = 'info', logenabled = false) {
    const timestamp = new Date().toTimeString().slice(0, 8);
    const logItem = { timestamp, message, type };

    // 更新React状态
    if (setLogEntriesCallback) {
        setLogEntriesCallback(prevEntries => {
            const newEntries = [logItem, ...prevEntries];
            if (newEntries.length > CONFIG.MAX_LOG_ENTRIES) {
                newEntries.pop();
            }
            return newEntries;
        });
    }
    if (logenabled) {
        console.log(`[监控] ${timestamp} ${message}`);
    }
}




// ==========存储管理==========
// 存储键名
const STORAGE_KEY = 'scriptCat_Allvalue';
const DEFAULTS = {
    voiceEnabled: true,
    getPushStatus: true,
    pushUrl: "",
    pushToken: "",
    commonPhraseUrl: "",
};

// 从localStorage加载Allvalue数据
function loadAllvalue() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            return { ...DEFAULTS, ...parsed };
        }

    } catch (error) {
        console.error('加载存储数据失败:', error);
    }
    // 返回默认值
    return { ...DEFAULTS };
}

// 保存Allvalue数据到localStorage
function saveAllvalue(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        console.log('数据已保存到localStorage');
    } catch (error) {
        console.error('保存数据失败:', error);
        CAT_UI.Message.error('保存设置失败: ' + error.message);
    }
}

// ==========UI部分==========
// 抽屉/模态框组件示例
function DM() {
    // 使用加载的数据初始化Allvalue
    const [Allvalue, setAllvalue] = CAT_UI.useState(loadAllvalue());

    // 包装setAllvalue函数，实现自动保存
    const updateAllvalue = (newValue) => {
        setAllvalue(newValue);
        // 自动保存到localStorage
        saveAllvalue(newValue);
    };
    const patchAllvalue = (kv) => updateAllvalue({ ...Allvalue, ...kv });

    // 解构状态变量，方便后续使用
    const { voiceEnabled, getPushStatus, pushUrl, pushToken, commonPhraseUrl } = Allvalue;

    const voiceEnabledText = voiceEnabled ? "🔊 语音" : "🔇 静音";
    const getPushStatusText = getPushStatus ? "▶️ 运行中" : "⏸️ 已停止";

    // 抽屉显示状态管理
    const [visible, setVisible] = CAT_UI.useState(false);
    // 日志条目状态管理
    const [logEntries, setLogEntries] = CAT_UI.useState([]);

    // 设置日志回调函数
    CAT_UI.useEffect(() => {
        setLogEntriesCallback = setLogEntries;
        return () => {
            setLogEntriesCallback = null;
        };
    }, []);

    // push 配置变化时自动应用最新连接状态
    CAT_UI.useEffect(() => {
        if (!getPushStatus) {
            initPushCatDevice(false);
            return;
        }
        if (pushUrl && pushToken) {
            initPushCatDevice(true, pushUrl, pushToken);
        }
    }, [getPushStatus, pushUrl, pushToken]);



    return CAT_UI.Space(
        [
            // 水平排列按钮和抽屉
            // 打开抽屉按钮
            CAT_UI.Space(
                [
                    CAT_UI.Text("push运行状态: "),
                    CAT_UI.Button(getPushStatusText, {
                        type: "primary",
                        onClick() {
                            const newgetPushStatus = !getPushStatus;
                            patchAllvalue({ getPushStatus: newgetPushStatus });
                            initPushCatDevice(newgetPushStatus, pushUrl, pushToken);
                        },
                        style: {
                            backgroundColor: !getPushStatus ? "#ff4d4f" : undefined,
                            borderColor: !getPushStatus ? "#ff4d4f" : undefined,
                            ":hover": {
                                backgroundColor: !getPushStatus ? "#f5222d" : undefined,
                                borderColor: !getPushStatus ? "#f5222d" : undefined
                            }
                        }
                    }),
                ],
                {
                    direction: "horizontal", // 横向排列（默认值，可省略）
                    size: "middle", // 元素间间距（可选：small/middle/large，默认middle）
                    style: { marginBottom: "8px" } // 可选：给这一行加底部间距，避免与下方元素拥挤
                }
            ),
            CAT_UI.Space(
                [
                    CAT_UI.Button("设置", {
                        type: "primary",
                        onClick: () => setVisible(true),  // 显示抽屉
                    }),

                    CAT_UI.Button(voiceEnabledText, {
                        type: "primary",
                        onClick: () => {
                            const newVoiceEnabled = !voiceEnabled;
                            patchAllvalue({ voiceEnabled: newVoiceEnabled });  // 更新状态，触发重新渲染

                            // 启用语音时，初始化语音合成（解决浏览器not-allowed限制）
                            if (newVoiceEnabled && 'speechSynthesis' in window) {
                                // 播放一个静默语音来激活语音功能
                                const testUtterance = new SpeechSynthesisUtterance('');
                                window.speechSynthesis.speak(testUtterance);
                                CAT_UI.Message.success('语音功能已启用');
                            }
                        },
                        // 动态样式：根据静音状态切换颜色
                        style: {
                            // 静音时用红色，非静音时用primary默认蓝色（无需额外设置）
                            backgroundColor: !voiceEnabled ? "#ff4d4f" : undefined,
                            borderColor: !voiceEnabled ? "#ff4d4f" : undefined,
                            // 优化hover效果：静音状态下hover时颜色加深（符合视觉交互逻辑）
                            ":hover": {
                                backgroundColor: !voiceEnabled ? "#f5222d" : undefined,
                                borderColor: !voiceEnabled ? "#f5222d" : undefined
                            }
                        }
                    }),

                    // 抽屉组件
                    CAT_UI.Drawer(
                        // 抽屉内容
                        CAT_UI.createElement("div", { style: { textAlign: "left" } }, [
                            CAT_UI.Input({          // 输入框
                                value: "测试输入框",
                                onChange(val) {
                                },
                                style: { flex: 1, marginBottom: "8px" }   // 占满剩余空间并加底部间距
                            }),
                            CAT_UI.createElement(
                                "h3", {
                                style: { marginBottom: "16px", textAlign: "left", whiteSpace: "pre-line" }
                            },
                                "使用说明:\n1. 配置好pushUrl和pushToken后，点击运行状态按钮启动Gotify推送监听\n2. 根据需要开启或关闭语音播报功能\n3. 日志区域会显示最近的监控日志，方便查看脚本运行状态",
                            ),
                            CAT_UI.Divider("高级设置"),  // 带文本的分隔线
                            CAT_UI.createElement(
                                "div",
                                {
                                    style: {
                                        display: "flex",          // 弹性布局
                                        justifyContent: "space-between",  // 水平方向两端对齐
                                        alignItems: "center",     // 垂直方向居中对齐
                                    },
                                },
                                [   // 子元素数组
                                    CAT_UI.Text("pushUrl："),  // 文本提示
                                    CAT_UI.Input({          // 输入框
                                        value: pushUrl,
                                        onChange(val) {
                                            patchAllvalue({ pushUrl: val });
                                        },
                                        style: { flex: 1, marginBottom: "8px" }   // 占满剩余空间并加底部间距
                                    }),
                                ]
                            ),
                            CAT_UI.createElement(
                                "div",
                                {
                                    style: {
                                        display: "flex",          // 弹性布局
                                        justifyContent: "space-between",  // 水平方向两端对齐
                                        alignItems: "center",     // 垂直方向居中对齐
                                    },
                                },
                                [   // 子元素数组
                                    CAT_UI.Text("pushToken："),  // 文本提示
                                    CAT_UI.Input({          // 输入框
                                        value: pushToken,
                                        onChange(val) {
                                            patchAllvalue({ pushToken: val });
                                        },
                                        style: { flex: 1, marginBottom: "8px" }   // 占满剩余空间并加底部间距
                                    }),
                                ]
                            ),
                            CAT_UI.createElement(
                                "div",
                                {
                                    style: {
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                    },
                                },
                                [
                                    CAT_UI.Text("commonPhraseUrl："),
                                    CAT_UI.Input({
                                        value: commonPhraseUrl,
                                        onChange(val) {
                                            patchAllvalue({ commonPhraseUrl: val });
                                        },
                                        style: { flex: 1, marginBottom: "8px" }   // 占满剩余空间并加底部间距
                                    }),
                                ]
                            ),

                            CAT_UI.Divider("其他设置"),  // 带文本的分隔线
                            CAT_UI.Text("脚本猫的UI框架: " + pushUrl),
                            CAT_UI.Button("我是按钮", {
                                type: "primary",
                                onClick() {
                                    CAT_UI.Message.info("我被点击了,你输入了: " + pushUrl);
                                },
                            }),
                            // 日志显示区域
                            CAT_UI.Divider("日志内容"),  // 日志标题分隔线
                            CAT_UI.createElement(
                                "pre",
                                {
                                    style: {
                                        whiteSpace: "pre-wrap",
                                        wordBreak: "break-word",
                                        maxHeight: "300px",
                                        overflowY: "auto",
                                        backgroundColor: "#f5f5f5",
                                        padding: "10px",
                                        borderRadius: "4px"
                                    }
                                },
                                logEntries.map(entry => `${entry.timestamp} - ${entry.message}`).join("\n")
                            ),
                        ]),
                        {
                            title: "设置菜单",  // 抽屉标题
                            visible,  // 控制显示/隐藏
                            width: 400,  // 抽屉宽度（像素）
                            focusLock: true,  // 聚焦锁定
                            autoFocus: true,  // 自动聚焦
                            zIndex: 10000,  // 层级
                            onOk: () => { setVisible(false); },  // 确定按钮回调
                            onCancel: () => { setVisible(false); },  // 取消按钮回调
                        }
                    )
                ],
                {
                    direction: "horizontal", // 横向排列（默认值，可省略）
                    size: "middle", // 元素间间距（可选：small/middle/large，默认middle）
                    style: { marginBottom: "8px" } // 可选：给这一行加底部间距，避免与下方元素拥挤
                }
            ),
            [
                CAT_UI.Button("常用语(未完成)", {
                    type: "primary",
                    onClick() {

                    },
                }),
            ]
        ],
        {
            direction: "vertical",
        }
    );
}

CAT_UI.createPanel({
    // 强制固定Drawer和Panel位置
    appendStyle: `.arco-drawer-wrapper {
    position: fixed !important;
  }
  .scriptcat-panel {
    position: fixed !important;
  }`,
    header: {
        title: CAT_UI.Space(
            [
                CAT_UI.Icon.ScriptCat({
                    style: { width: "24px", verticalAlign: "middle" },
                    draggable: "false",
                }),
                CAT_UI.Text("征纳互动监控", {
                    style: { fontSize: "16px" },
                }),
            ],
            { style: { marginLeft: "5px" } }
        ),
        style: {
            borderBottom: "1px solid var(--color-neutral-3)"
        },
    },
    render: DM,

    // 面板初始位置
    point: {
        x: window.screen.width - 500,  // 距离右侧400px
        y: 20  // 距离顶部20px
    },

});







// ==========监控部分==========
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

// 缓存DOM元素引用
const domCache = {
    ocurrentElement: null,
    offlineElement: null
};

// 修改主要检测函数
function checkCount() {
    if (!isWorkingHours()) {
        addLog('当前不在工作时间，已停止脚本', 'warning');
        return;
    }
    try {
        // 获取等待人数 - 使用更灵活的选择器
        if (!domCache.ocurrentElement) {
            // 尝试多种选择器来找到人数元素
            domCache.ocurrentElement = document.querySelector('.count:nth-child(2)')
        }

        const ocurrentElement = domCache.ocurrentElement;
        if (!ocurrentElement) {
            addLog('找不到人数元素', 'warning');
            //speak("找不到人数元素");
            return;
        }

        const currentCount = parseInt(ocurrentElement.textContent.trim());
        // 检查currentCount是否为有效数字
        if (isNaN(currentCount)) {
            addLog(`无法解析等待人数，元素内容: "${ocurrentElement.textContent.trim()}"`, 'warning');
            return;
        }

        if (currentCount === 0) {
            addLog('当前等待人数为0', 'success');
        } else if (currentCount < 10) { // 使用具体数字替代length比较
            addLog(`当前等待人数: ${currentCount}`, 'info');
            speak("征纳互动有人来了");
        }

        // 检查离线状态 - 使用更灵活的选择器
        if (!domCache.offlineElement) {
            domCache.offlineElement = document.querySelector('.t-dialog__body__icon:nth-child(2)') ||
                document.querySelector('.t-dialog__body__icon') ||
                document.querySelector('[class*="dialog"][class*="icon"]');
        }

        const offlineElement = domCache.offlineElement;
        if (offlineElement && offlineElement.textContent.trim().includes('离线')) {
            addLog('征纳互动已离线', 'warning');
            speak("征纳互动已离线");
        }
    } catch (error) {
        addLog(`检测错误: ${error.message}`, 'warning');
    }
}

// 语音播报函数
const speechQueue = [];
let isSpeaking = false;

function speak(text) {
    // 从localStorage获取语音状态
    const savedData = loadAllvalue();
    const voiceEnabled = savedData.voiceEnabled;

    if (!voiceEnabled || !('speechSynthesis' in window)) { return; }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.0;

    // 添加到队列
    speechQueue.push(utterance);
    processSpeechQueue();
}

// 处理语音队列
function processSpeechQueue() {
    if (isSpeaking || speechQueue.length === 0) { return; }

    isSpeaking = true;
    const utterance = speechQueue.shift();

    utterance.onend = () => {
        isSpeaking = false;
        processSpeechQueue();
    };

    utterance.onerror = (event) => {
        isSpeaking = false;
        // 如果是not-allowed错误，清空队列避免堆积
        if (event.error === 'not-allowed') {
            speechQueue.length = 0;
        } else {
            processSpeechQueue();
        }
    };

    // 在播放前确保语音合成已恢复（某些浏览器会暂停）
    if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
    }
    window.speechSynthesis.speak(utterance);
}



// 页面加载完成后启动监控
function startMonitoring() {
    // 立即执行一次检查
    checkCount();
    // 启动定时检查
    setInterval(checkCount, CONFIG.CHECK_INTERVAL);
}


// ========== Gotify WebSocket 推送集成 ==========
let gotifyWS = null;
let gotifyReconnectTimer = null;
const GOTIFY_RECONNECT_INTERVAL = 3000;
let gotifyEnabled = false; // 控制是否允许重连
let gotifyConfigKey = '';

// 安全复制工具：仅在页面聚焦且支持 clipboard 时尝试复制
function safeCopyText(text) {
    if (!text) return;
    // 1) 优先使用 GM_setClipboard（无需焦点）
    if (typeof GM_setClipboard === 'function') {
        try {
            GM_setClipboard(text);
            console.log('[Gotify] 已复制到剪贴板 (GM_setClipboard)');
            //成功的提示音
            const player = new Audio();
            player.src = 'https://proxy.gitwarp.com/https://raw.githubusercontent.com/Run-os/UserScript/refs/heads/main/znhd/dida.mp3'; // 纠正后的地址
            const p = player.play();
            return;
        } catch (e) {
            console.error('[Gotify] GM_setClipboard 失败，尝试浏览器 API:', e);
        }
    }

    // 2) 浏览器异步 clipboard API
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text).then(() => {
            console.log('[Gotify] 已复制到剪贴板 (navigator.clipboard)');
            //成功的提示音
            const player = new Audio();
            player.src = 'https://proxy.gitwarp.com/https://raw.githubusercontent.com/Run-os/UserScript/refs/heads/main/znhd/dida.mp3'; // 纠正后的地址
            const p = player.play();

        }).catch(err => {
            console.error('[Gotify] 复制到剪贴板失败，结束:', err);
        });
        return;
    }
}

function connectGotifyWebSocket(pushUrl, pushToken) {
    if (gotifyReconnectTimer) {
        clearTimeout(gotifyReconnectTimer);
        gotifyReconnectTimer = null;
    }
    if (!pushUrl || !pushToken) {
        gotifyEnabled = false;
        CAT_UI.Message.warning('未配置 Gotify pushUrl 或 pushToken，跳过推送监听');
        console.warn('未配置 Gotify pushUrl 或 pushToken，跳过推送监听');
        // 关闭可能存在的旧连接，避免使用过期配置重连
        if (gotifyWS) {
            try { gotifyWS.close(1000, '配置缺失，停止推送'); } catch (e) { }
            gotifyWS = null;
        }
        return;
    }
    const configKey = `${pushUrl}|${pushToken}`;
    // 如果当前配置已在连接中或已连接，避免重复创建导致的闪断
    if (gotifyWS && (gotifyWS.readyState === WebSocket.CONNECTING || gotifyWS.readyState === WebSocket.OPEN) && gotifyConfigKey === configKey) {
        return;
    }

    gotifyEnabled = true;
    gotifyConfigKey = configKey;
    // 关闭已有连接
    if (gotifyWS) {
        try { gotifyWS.close(1000, '重连'); } catch (e) { }
        gotifyWS = null;
    }
    // 构造 ws 地址
    try {
        const urlObj = new URL('/stream', pushUrl.replace(/\/$/, ''));
        urlObj.protocol = urlObj.protocol === 'https:' ? 'wss:' : 'ws:';
        urlObj.searchParams.set('token', pushToken);
        gotifyWS = new window.WebSocket(urlObj.href);
        console.log('[Gotify] 尝试连接: ', urlObj.href);
    } catch (e) {
        console.error('[Gotify] 地址格式错误:', e);
        return;
    }
    gotifyWS.onopen = () => {
        CAT_UI.Message.success('Gotify WebSocket 连接成功');
        console.log('[Gotify] WebSocket 连接成功');
    };
    gotifyWS.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            const { id, title, message: text, priority, date } = msg;
            CAT_UI.Message.success(`收到Gotify推送：${title}`);
            console.log('[Gotify] 收到消息:', msg);
            if (text) {
                safeCopyText(text);
            }
        } catch (err) {
            console.error('[Gotify] 消息解析失败:', err, event.data);
        }
    };
    gotifyWS.onerror = (error) => {
        CAT_UI.Message.error('Gotify WebSocket 发生错误，查看控制台详情');
        console.error('[Gotify] WebSocket 错误:', error);
    };
    gotifyWS.onclose = (event) => {
        CAT_UI.Message.info('Gotify WebSocket 连接关闭');
        gotifyWS = null;
        if (!gotifyEnabled) { return; }
        if (gotifyReconnectTimer) clearTimeout(gotifyReconnectTimer);
        gotifyReconnectTimer = setTimeout(() => connectGotifyWebSocket(pushUrl, pushToken), GOTIFY_RECONNECT_INTERVAL);
    };
}

// 初始化 Gotify 监听（根据配置）
function initPushCatDevice(enabled, pushUrl, pushToken) {
    if (!enabled) {
        gotifyEnabled = false;
        gotifyConfigKey = '';
        if (gotifyWS) {
            try { gotifyWS.close(1000, '手动关闭'); } catch (e) { }
            gotifyWS = null;
        }
        if (gotifyReconnectTimer) {
            clearTimeout(gotifyReconnectTimer);
            gotifyReconnectTimer = null;
        }
        return;
    }

    if (!pushUrl || !pushToken) {
        gotifyEnabled = false;
        gotifyConfigKey = '';
        CAT_UI.Message.warning('未配置 Gotify pushUrl 或 pushToken，未启动推送监听');
        if (gotifyWS) {
            try { gotifyWS.close(1000, '配置缺失，停止推送'); } catch (e) { }
            gotifyWS = null;
        }
        if (gotifyReconnectTimer) {
            clearTimeout(gotifyReconnectTimer);
            gotifyReconnectTimer = null;
        }
        return;
    }

    connectGotifyWebSocket(pushUrl, pushToken);
}

// 页面关闭时断开连接
window.addEventListener('unload', () => {
    if (gotifyWS) try { gotifyWS.close(1000, '页面关闭'); } catch (e) { }
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startMonitoring);
} else {
    startMonitoring();

}
