// ==UserScript==
// @name        ceshi脚本猫UI库测试
// @namespace   https://scriptcat.org/
// @description 基于Arco做的UI库, 用于快速开发脚本的UI界面
// @version     25.12.06-1
// @author      Runos
// @match       https://www.52pojie.cn/*
// @icon        https://znhd.hunan.chinatax.gov.cn:8443/favicon.ico
// @grant       GM_addStyle
// @grant       unsafeWindow
// @grant       GM_xmlhttpRequest
// @require     https://scriptcat.org/lib/1167/1.0.0/%E8%84%9A%E6%9C%AC%E7%8C%ABUI%E5%BA%93.js  // 引入脚本猫UI库
// @require     https://scriptcat.org/lib/946/1.0.2/PushCat.js?sha384-oSlgx/WB23lLz4OArRxG+kpIkZnfokQmTboHl4CT/yG38oxllL9+O+bo7K2Icrja
// @require     https://scriptcat.org/lib/4521/1.0.2/WebDAVClient.js?sha384-tB6ti4GhpFScW10JSgHEfmZjNRQcX6B+u5oAUnwiTi3oxmTCMCF+ffVl9hF/a4fP
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

// 从localStorage加载Allvalue数据
function loadAllvalue() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            return {
                voiceEnabled: parsed.voiceEnabled !== false, // 默认为true
                getWebTextRunStatus: parsed.getWebTextRunStatus !== false, // 默认为true
                webdavurl: parsed.webdavurl || "https://dav.jianguoyun.com/dav/",
                webdavemail: parsed.webdavemail || "",
                webdavpassword: parsed.webdavpassword || "",
                webdavpath: parsed.webdavpath || "",
            };
        }

    } catch (error) {
        console.error('加载存储数据失败:', error);
    }
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

    // 解构状态变量，方便后续使用
    const { voiceEnabled, getWebTextRunStatus, webdavurl, webdavemail, webdavpassword, webdavpath } = Allvalue;

    const voiceEnabledText = voiceEnabled ? "🔊 语音" : "🔇 静音";
    const getWebTextRunStatusText = getWebTextRunStatus ? "▶️ 运行中" : "⏸️ 已停止";

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

    return CAT_UI.Space(
        [
            // 水平排列按钮和抽屉
            // 打开抽屉按钮
            CAT_UI.Space(
                [
                    CAT_UI.Text("webhook运行状态: "),
                    CAT_UI.Button(getWebTextRunStatusText, {
                        type: "primary",
                        onClick() {
                            const newGetWebTextRunStatus = !getWebTextRunStatus;
                            updateAllvalue({ ...Allvalue, getWebTextRunStatus: newGetWebTextRunStatus });
                        },
                        style: {
                            backgroundColor: getWebTextRunStatusText === "⏸️ 已停止" ? "#ff4d4f" : undefined,
                            borderColor: getWebTextRunStatusText === "⏸️ 已停止" ? "#ff4d4f" : undefined,
                            ":hover": {
                                backgroundColor: getWebTextRunStatusText === "⏸️ 已停止" ? "#f5222d" : undefined,
                                borderColor: getWebTextRunStatusText === "⏸️ 已停止" ? "#f5222d" : undefined
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
                            updateAllvalue({ ...Allvalue, voiceEnabled: newVoiceEnabled });  // 更新状态，触发重新渲染

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
                            backgroundColor: voiceEnabledText === "🔇 静音" ? "#ff4d4f" : undefined,
                            borderColor: voiceEnabledText === "🔇 静音" ? "#ff4d4f" : undefined,
                            // 优化hover效果：静音状态下hover时颜色加深（符合视觉交互逻辑）
                            ":hover": {
                                backgroundColor: voiceEnabledText === "🔇 静音" ? "#f5222d" : undefined,
                                borderColor: voiceEnabledText === "🔇 静音" ? "#f5222d" : undefined
                            }
                        }
                    }),

                    // 抽屉组件
                    CAT_UI.Drawer(
                        // 抽屉内容
                        CAT_UI.createElement("div", { style: { textAlign: "left" } }, [
                            CAT_UI.Divider("webdav设置"),  // 带文本的分隔线
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
                                    CAT_UI.Text("Url："),  // 文本提示
                                    CAT_UI.Input({          // 输入框
                                        value: webdavurl,
                                        onChange(val) {
                                            updateAllvalue({ ...Allvalue, webdavurl: val });
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
                                    CAT_UI.Text("email："),
                                    CAT_UI.Input({
                                        value: webdavemail,
                                        onChange(val) {
                                            updateAllvalue({ ...Allvalue, webdavemail: val });
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
                                    CAT_UI.Text("pw："),
                                    CAT_UI.Input({
                                        value: webdavpassword,
                                        type: "password",
                                        onChange(val) {
                                            updateAllvalue({ ...Allvalue, webdavpassword: val });
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
                                    CAT_UI.Text("path："),
                                    CAT_UI.Input({
                                        value: webdavpath,
                                        onChange(val) {
                                            updateAllvalue({ ...Allvalue, webdavpath: val });
                                        }
                                        ,
                                        style: { flex: 1, marginBottom: "8px" }   // 占满剩余空间并加底部间距
                                    }),
                                ]
                            ),

                            CAT_UI.Divider("其他设置"),  // 带文本的分隔线
                            CAT_UI.Text("脚本猫的UI框架: " + webdavurl),
                            CAT_UI.Button("我是按钮", {
                                type: "primary",
                                onClick() {
                                    CAT_UI.Message.info("我被点击了,你输入了: " + webdavurl);
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
                CAT_UI.Text("脚本猫的UI框架: " + (voiceEnabled ? "语音开启" : "语音关闭")),
                CAT_UI.Button("常用语", {
                    type: "primary",
                    onClick() {
                        (async () => {
                            try {
                                // 从localStorage重新读取最新的数据，确保获得最新值
                                const currentData = loadAllvalue();
                                const { webdavurl: url, webdavemail: email, webdavpassword: password, webdavpath: path } = currentData;

                                addLog('WebDAV参数 - URL: ' + url + ', Email: ' + email + ', Path: ' + path, 'info', true);

                                const client = new WebDAVClient({
                                    url: url,
                                    username: email,
                                    password: password // 不要把密码硬编码
                                });

                                const isexists = await client.exists(path);
                                if (!isexists) {
                                    addLog('文件不存在', 'info', true);
                                    addLog("文件链接：" + url + path, 'info', true);
                                } else {
                                    addLog('文件已存在', 'info', true);
                                    // 读文件
                                    const text = await client.getFileContents(path);
                                    addLog('读取文件内容: ' + text, 'info', true);
                                }
                            } catch (err) {
                                addLog('WebDAV 操作出错: ' + err.message, 'warning', true);
                            }
                        })();
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startMonitoring);
} else {
    startMonitoring();
}
