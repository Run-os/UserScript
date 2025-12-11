// ==UserScript==
// @name        征纳互动人数和在线监控
// @namespace   https://scriptcat.org/
// @description 监控征纳互动等待人数和在线状态，支持语音播报和Gotify推送通知。详细配置请点击脚本猫面板中的设置按钮。详细说明见：
// @version     2.0
// @author      runos
// @match       https://znhd.hunan.chinatax.gov.cn:8443/*
// @match       https://example.com/*
// @icon        https://znhd.hunan.chinatax.gov.cn:8443/favicon.ico
// @grant       GM_addStyle
// @grant       unsafeWindow
// @grant       GM_xmlhttpRequest
// @grant       GM_setClipboard
// @connect     sct.icodef.com
// @connect     file.122050.xyz
// @connect     *
// @grant       GM_notification
// @homepage    https://scriptcat.org/zh-CN/script-show-page/3650
// @require     https://scriptcat.org/lib/1167/1.0.0/%E8%84%9A%E6%9C%AC%E7%8C%ABUI%E5%BA%93.js?sha384-jXdR3hCwnDJf53Ue6XHAi6tApeudgS/wXnMYBD/ZJcgge8Xnzu/s7bkEf2tPi2KS
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
    MAX_LOG_ENTRIES: 10,
    WORKING_HOURS: {
        MORNING: { START: 9, END: 12 },
        AFTERNOON: { START: 13.5, END: 18 }
    },
    didaUrl: 'https://cdn.jsdelivr.net/gh/Run-os/UserScript/znhd/dida.mp3',
};

// ==========日志管理==========
// 全局日志状态管理
let setLogEntriesCallback = null;
// 存储上一次的日志文本（用于重复内容检测）
let lastLogMessage = null;

// 添加日志条目函数
function addLog(message, type = 'info', logenabled = false) {
    const timestamp = new Date().toTimeString().slice(0, 8);

    // 检查是否为重复内容（忽略事件等动态信息）
    const pureMessage = message;
    if (lastLogMessage && pureMessage === lastLogMessage) {
        // 如果内容相同（忽略事件），不输出本次内容
        console.log('[监控] 重复日志，已忽略:', message);
        return;
    }

    // 更新上一次的日志文本
    lastLogMessage = pureMessage;

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
    getwebhookStatus: true,
    webhookUrl: "",
    webhookToken: "",
    JsonUrl: "",
    postToken: "",
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
    const { voiceEnabled, getwebhookStatus, webhookUrl, webhookToken, postToken, JsonUrl } = Allvalue;

    const voiceEnabledText = voiceEnabled ? "🔊 语音" : "🔇 静音";
    const getwebhookStatusText = getwebhookStatus ? "▶️ 运行中" : "⏸️ 已停止";

    // 设置抽屉显示状态管理
    const [visible, setVisible] = CAT_UI.useState(false);
    // 常用语抽屉显示状态管理
    const [commonPhrasesVisible, setCommonPhrasesVisible] = CAT_UI.useState(false);
    // 日志条目状态管理
    const [logEntries, setLogEntries] = CAT_UI.useState([]);
    // 常用语数据状态管理
    const [phrasesData, setPhrasesData] = CAT_UI.useState({});
    // 常用语加载状态
    const [phrasesLoading, setPhrasesLoading] = CAT_UI.useState(false);

    // 设置日志回调函数
    CAT_UI.useEffect(() => {
        setLogEntriesCallback = setLogEntries;
        return () => {
            setLogEntriesCallback = null;
        };
    }, []);

    // webhook 配置变化时自动应用最新连接状态
    CAT_UI.useEffect(() => {
        if (!getwebhookStatus) {
            initwebhookCatDevice(false);
            return;
        }
        if (webhookUrl && webhookToken) {
            initwebhookCatDevice(true, webhookUrl, webhookToken);
        }
    }, [getwebhookStatus, webhookUrl, webhookToken]);

    // 加载常用语数据的函数
    const loadPhrasesData = () => {
        if (!JsonUrl) {
            CAT_UI.Message.warning('请先配置 JsonUrl');
            return;
        }

        setPhrasesLoading(true);
        GM_xmlhttpRequest({
            method: 'GET',
            url: JsonUrl,
            onload: function (response) {
                try {
                    const data = JSON.parse(response.responseText);
                    setPhrasesData(data);
                    CAT_UI.Message.success('常用语加载成功');
                } catch (error) {
                    console.error('JSON 解析失败:', error);
                    CAT_UI.Message.error('JSON 解析失败: ' + error.message);
                    setPhrasesData({});
                } finally {
                    setPhrasesLoading(false);
                }
            },
            onerror: function (error) {
                console.error('加载常用语失败:', error);
                CAT_UI.Message.error('加载常用语失败');
                setPhrasesLoading(false);
                setPhrasesData({});
            }
        });
    };

    // 当 JsonUrl 变化时自动加载数据
    CAT_UI.useEffect(() => {
        if (JsonUrl) {
            loadPhrasesData();
        }
    }, [JsonUrl]);

    // 主UI布局
    return CAT_UI.Space(
        [
            // 水平排列按钮和抽屉

            // webhook状态
            CAT_UI.Space(
                [
                    CAT_UI.Text("webhook运行状态: "),
                    CAT_UI.Button(getwebhookStatusText, {
                        type: "primary",
                        onClick() {
                            const newgetwebhookStatus = !getwebhookStatus;
                            patchAllvalue({ getwebhookStatus: newgetwebhookStatus });
                            initwebhookCatDevice(newgetwebhookStatus, webhookUrl, webhookToken);
                        },
                        style: {
                            //字体加粗
                            fontWeight: "bold",
                            // 动态样式：根据运行状态切换颜色
                            backgroundColor: !getwebhookStatus ? "#990018" : "#007e44",
                            borderColor: !getwebhookStatus ? "#990018" : "#007e44",
                        }
                    }),
                ],
                {
                    direction: "horizontal", // 横向排列（默认值，可省略）
                    size: "middle", // 元素间间距（可选：small/middle/large，默认middle）
                    style: { marginBottom: "8px" } // 可选：给这一行加底部间距，避免与下方元素拥挤
                }
            ),

            // 语音播报状态
            CAT_UI.Space(
                [
                    CAT_UI.Text("语音播报状态: "),
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
                            //字体加粗
                            fontWeight: "bold",
                            backgroundColor: !voiceEnabled ? "#990018" : "#007e44",
                            borderColor: !voiceEnabled ? "#990018" : "#007e44",
                        }
                    }),
                ]
            ),

            //设置抽屉
            CAT_UI.Space(
                [
                    CAT_UI.Button("设置", {
                        type: "primary",
                        onClick: () => setVisible(true),  // 显示抽屉
                    }),
                    // 抽屉组件
                    CAT_UI.Drawer(
                        // 抽屉内容
                        CAT_UI.createElement("div", { style: { textAlign: "left" } }, [
                            CAT_UI.Space(
                                [
                                    CAT_UI.Button("[脚本主页]", {
                                        type: "link",
                                        onClick: () => {
                                            window.open('https://scriptcat.org/zh-CN/script-show-page/3650', '_blank');
                                        },
                                        style: {
                                            padding: "0 8px"
                                            //蓝色字体
                                            , color: "#1890ff", fontWeight: "bold"
                                        }
                                    }),
                                    CAT_UI.Button("[使用教程]", {
                                        type: "link",
                                        onClick: () => {
                                            window.open('https://flowus.cn/runos/share/e48623a2-f273-4327-8597-639e08902be8?code=1YD5Z5', '_blank');
                                        },
                                        style: {
                                            padding: "0 8px"
                                            //蓝色字体
                                            , color: "#1890ff", fontWeight: "bold"
                                        }
                                    }),
                                    CAT_UI.Button("[post网页]", {
                                        type: "link",
                                        onClick: () => {
                                            window.open('https://gotify-post.zeabur.app?url=' + encodeURIComponent(webhookUrl) + "/message?token=" + encodeURIComponent(postToken), '_blank');
                                        },
                                        style: {
                                            padding: "0 8px"
                                            //蓝色字体
                                            , color: "#1890ff", fontWeight: "bold"
                                        }
                                    }),
                                    CAT_UI.Button("[生成配置]", {
                                        type: "link",
                                        onClick: () => {
                                            // 生成新的配置并写入状态
                                            const newWebhookUrl = "https://webhook-service.zeabur.app";
                                            const newWebhookToken = Math.random().toString(36).substring(2, 15);
                                            const newPostToken = btoa(newWebhookToken);
                                            patchAllvalue({ webhookUrl: newWebhookUrl, webhookToken: newWebhookToken, postToken: newPostToken });
                                            CAT_UI.Message.success('配置已生成，请保存');

                                        },
                                        style: {
                                            padding: "0 8px"
                                            //蓝色字体
                                            , color: "#1890ff", fontWeight: "bold"
                                        }
                                    }),
                                ],
                                { direction: "horizontal", size: "small" }
                            ),
                            CAT_UI.Divider("注意事项"),
                            CAT_UI.createElement(
                                "p",
                                {
                                    style: {
                                        marginBottom: "16px",
                                        color: "#666",
                                        lineHeight: "1.6",
                                        textAlign: "left",
                                        whiteSpace: "pre-line"
                                    }
                                },
                                "1. 配置好webhookUrl，webhookToken（即clientToken），postToken（即appToken）后，点击运行状态按钮启动Gotify推送监听\n2. 🔘[使用教程]里面有webhook-demo配置，可用于体验。注意：该配置仅供测试使用，如果需要长期使用，请自建Gotify服务\n3. 🔘[post网页]可以快速打开Gotify消息发送页面，方便测试",
                            ),
                            CAT_UI.Divider("webhook设置"),  // 带文本的分隔线
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
                                    CAT_UI.Text("webhookUrl："),  // 文本提示
                                    CAT_UI.Input({          // 输入框
                                        value: webhookUrl,
                                        onChange(val) {
                                            patchAllvalue({ webhookUrl: val });
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
                                    CAT_UI.Text("webhookToken："),  // 文本提示
                                    CAT_UI.Input({          // 输入框
                                        value: webhookToken,
                                        onChange(val) {
                                            patchAllvalue({ webhookToken: val });
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
                                    CAT_UI.Text("postToken："),  // 文本提示
                                    CAT_UI.Input({          // 输入框
                                        value: postToken,
                                        onChange(val) {
                                            patchAllvalue({ postToken: val });
                                        },
                                        style: { flex: 1, marginBottom: "8px" }   // 占满剩余空间并加底部间距
                                    }),
                                ]
                            ),

                            CAT_UI.Divider("其他设置"),  // 带文本的分隔线
                            // 日志显示区域
                            CAT_UI.Divider("日志内容"),  // 日志标题分隔线
                            CAT_UI.createElement(
                                "div",
                                {
                                    style: {
                                        whiteSpace: "pre-wrap",
                                        wordBreak: "break-word",
                                        maxHeight: "300px",
                                        overflowY: "auto",
                                        backgroundColor: "#f5f5f5",
                                        padding: "10px",
                                        borderRadius: "4px",
                                        fontFamily: "monospace",
                                        fontSize: "12px"
                                    }
                                },
                                logEntries.map((entry, index) => {
                                    // 根据日志类型定义颜色
                                    const colorMap = {
                                        info: "#1890ff",      // 蓝色
                                        warning: "#faad14",   // 橙黄色
                                        success: "#52c41a",   // 绿色
                                        error: "#ff4d4f"      // 红色
                                    };
                                    const color = colorMap[entry.type] || "#333333";
                                    return CAT_UI.createElement(
                                        "div",
                                        {
                                            key: index,
                                            style: {
                                                color: color,
                                                marginBottom: "4px",
                                                borderLeft: `3px solid ${color}`,
                                                paddingLeft: "8px",
                                                fontWeight: "bold"  // 加粗
                                            }
                                        },
                                        `${entry.timestamp} - ${entry.message}`
                                    );
                                })
                            ),
                        ]),
                        // 抽屉属性
                        {
                            title: "设置菜单",  // 抽屉标题
                            visible,  // 控制显示/隐藏
                            width: 400,  // 抽屉宽度（像素）
                            focusLock: true,  // 聚焦锁定
                            autoFocus: false,  // 禁用自动聚焦
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

            // 常用语按钮和抽屉
            CAT_UI.Space(
                [
                    CAT_UI.Button("常用语", {
                        type: "primary",
                        onClick() {
                            setCommonPhrasesVisible(true);
                        },
                    }),
                    // 常用语抽屉组件
                    CAT_UI.Drawer(
                        // 抽屉内容
                        CAT_UI.createElement("div", { style: { textAlign: "left" } }, [
                            // JsonUrl 配置输入框
                            CAT_UI.createElement(
                                "div",
                                {
                                    style: {
                                        display: "flex",          // 弹性布局
                                        justifyContent: "space-between",  // 水平方向两端对齐
                                        alignItems: "center",     // 垂直方向居中对齐
                                        marginBottom: "16px"
                                    },
                                },
                                [   // 子元素数组
                                    CAT_UI.Text("JsonUrl:"),  // 文本提示
                                    CAT_UI.Input({          // 输入框
                                        value: JsonUrl,
                                        onChange(val) {
                                            patchAllvalue({ JsonUrl: val });
                                        },
                                        style: { flex: 1, marginLeft: "8px" }   // 占满剩余空间并加左边距
                                    }),
                                ]
                            ),
                            // 重新加载按钮
                            CAT_UI.Button("重新加载常用语", {
                                type: "primary",
                                loading: phrasesLoading,
                                onClick: loadPhrasesData,
                                style: { marginBottom: "16px", width: "100%" }
                            }),
                            CAT_UI.Divider("使用说明"),
                            CAT_UI.createElement(
                                "p",
                                {
                                    style: {
                                        marginBottom: "16px",
                                        color: "#666",
                                        lineHeight: "1.6",
                                        textAlign: "left",
                                        whiteSpace: "pre-line"
                                    }
                                },
                                "JsonUrl 为一个 JSON 直链文件\nJSON 格式: {\"按钮文本\": \"复制内容\", ...}",
                            ),
                            CAT_UI.Divider("常用语列表"),
                            // 动态生成常用语按钮
                            phrasesLoading ?
                                CAT_UI.createElement("div", { style: { textAlign: "center", padding: "20px" } }, "加载中...") :
                                (Object.keys(phrasesData).length === 0 ?
                                    CAT_UI.createElement("div", { style: { textAlign: "center", padding: "20px", color: "#999" } }, "暂无常用语数据，请配置 JsonUrl 并加载") :
                                    CAT_UI.Space(
                                        Object.entries(phrasesData).map(([key, value]) =>
                                            CAT_UI.Button(key, {
                                                type: "default",
                                                onClick() {
                                                    safeCopyText(value);
                                                    CAT_UI.Message.success("已复制: " + key);
                                                    addLog(`常用语已复制: ${key}`, 'success');
                                                    setCommonPhrasesVisible(false);
                                                },
                                                style: { marginBottom: "8px", width: "100%" }
                                            })
                                        ),
                                        { direction: "vertical", style: { width: "100%" } }
                                    )
                                ),
                            CAT_UI.Divider(""),
                        ]),
                        // 抽屉属性
                        {
                            title: "常用语",
                            visible: commonPhrasesVisible,
                            width: 400,
                            focusLock: true,
                            autoFocus: false,
                            zIndex: 10001,  // 比设置抽屉层级高一点
                            onOk: () => { setCommonPhrasesVisible(false); },
                            onCancel: () => { setCommonPhrasesVisible(false); },
                        }
                    )
                ]
            ),
        ],
        { direction: "vertical" }  // 垂直排列
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
            speak("找不到人数元素");
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
            const player = new Audio();
            player.src = CONFIG.didaUrl;
            player.play();
            return;
        } catch (e) {
            console.error('[Gotify] GM_setClipboard 失败，尝试浏览器 API:', e);
        }
    }

    // 2) 浏览器异步 clipboard API
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text).then(() => {
            console.log('[Gotify] 已复制到剪贴板 (navigator.clipboard)');
            const player = new Audio();
            player.src = CONFIG.didaUrl;
            player.play();
        }).catch(err => {
            console.error('[Gotify] 复制到剪贴板失败，结束:', err);
        });
        return;
    }
}

function isBase64ImageString(text) {
    if (typeof text !== 'string') { return false; }
    const trimmed = text.trim();
    if (trimmed.startsWith('data:image/') && trimmed.includes(';base64,')) { return true; }
    if (trimmed.length < 100) { return false; }
    const cleaned = trimmed.replace(/\s+/g, '');
    return /^[A-Za-z0-9+/]+={0,2}$/.test(cleaned);
}

function buildDataUrlFromBase64(text) {
    if (text.startsWith('data:image/')) { return text; }
    return `data:image/png;base64,${text}`;
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function convertImageBlobToPng(blob) {
    try {
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    } catch (err) {
        console.error('[Gotify] 转换图片为 PNG 失败:', err);
        return blob; // 退化：返回原始 blob 继续尝试
    }
}

async function copyBase64ImageToClipboard(text) {
    try {
        const dataUrl = buildDataUrlFromBase64(text.trim());
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const pngBlob = await convertImageBlobToPng(blob);
        const mime = 'image/png';

        // 首选 Clipboard API（强制使用 PNG 以兼容多数实现）
        if (navigator.clipboard && typeof navigator.clipboard.write === 'function' && typeof window.ClipboardItem === 'function') {
            try {
                await navigator.clipboard.write([new ClipboardItem({ [mime]: pngBlob })]);
                const player = new Audio();
                player.src = CONFIG.didaUrl;
                player.play();
                addLog('图片已复制到剪贴板', 'success');
                return true;
            } catch (clipErr) {
                console.error('[Gotify] Clipboard API 图片写入失败:', clipErr);
            }
        }

        // 退化方案：尝试 GM_setClipboard 写入 dataURL
        if (typeof GM_setClipboard === 'function') {
            try {
                const b64DataUrl = await blobToBase64(pngBlob);
                GM_setClipboard(b64DataUrl, { type: 'image', mimetype: mime });
                const player = new Audio();
                player.src = CONFIG.didaUrl;
                player.play();
                addLog('图片已复制到剪贴板 (GM_setClipboard)', 'success');
                return true;
            } catch (gmErr) {
                console.error('[Gotify] GM_setClipboard 图片写入失败:', gmErr);
            }
        }

        addLog('当前环境不支持图片剪贴板写入', 'warning');
        return false;
    } catch (err) {
        console.error('[Gotify] 复制图片到剪贴板失败:', err);
        addLog(`复制图片到剪贴板失败: ${err && err.message ? err.message : '未知错误'}`, 'error');
        return false;
    }
}

function connectGotifyWebSocket(webhookUrl, webhookToken) {
    if (gotifyReconnectTimer) {
        clearTimeout(gotifyReconnectTimer);
        gotifyReconnectTimer = null;
    }
    if (!webhookUrl || !webhookToken) {
        gotifyEnabled = false;
        CAT_UI.Message.warning('未配置 Gotify webhookUrl 或 webhookToken，跳过推送监听');
        console.warn('未配置 Gotify webhookUrl 或 webhookToken，跳过推送监听');
        // 关闭可能存在的旧连接，避免使用过期配置重连
        if (gotifyWS) {
            try { gotifyWS.close(1000, '配置缺失，停止推送'); } catch (e) { }
            gotifyWS = null;
        }
        return;
    }
    const configKey = `${webhookUrl}|${webhookToken}`;
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
        const urlObj = new URL('/stream', webhookUrl.replace(/\/$/, ''));
        urlObj.protocol = urlObj.protocol === 'https:' ? 'wss:' : 'ws:';
        urlObj.searchParams.set('token', webhookToken);
        gotifyWS = new window.WebSocket(urlObj.href);
        console.log('[Gotify] 尝试连接: ', urlObj.href);
    } catch (e) {
        console.error('[Gotify] 地址格式错误:', e);
        return;
    }
    gotifyWS.onopen = () => {
        CAT_UI.Message.success('Gotify WebSocket 连接成功');
        console.log('[Gotify] WebSocket 连接成功');
        addLog('Gotify 推送监听已启动', 'success');
    };
    gotifyWS.onmessage = async (event) => {
        try {

            const msg = JSON.parse(event.data);
            const { id, title, message: text, priority, date } = msg;
            CAT_UI.Message.success(`收到Gotify推送：${text}`);
            console.log('[Gotify] 收到消息:', msg);

            if (text && isBase64ImageString(text)) {
                const copied = await copyBase64ImageToClipboard(text);
                addLog(copied ? 'Gotify消息：图片已复制到剪贴板' : 'Gotify消息：图片复制失败，已保留原文', copied ? 'success' : 'warning');
                if (!copied && text) {
                    safeCopyText(text);
                }
                return;
            }

            if (text) {
                safeCopyText(text);
                addLog(`Gotify消息：${text}`, 'success');
            }
        } catch (err) {
            console.error('[Gotify] 消息解析失败:', err, event.data);
        }
    };
    gotifyWS.onerror = (error) => {
        CAT_UI.Message.error('Gotify WebSocket 发生错误，查看控制台详情');
        console.error('[Gotify] WebSocket 错误:', error);
        addLog('Gotify WebSocket 发生错误，查看控制台详情', 'error');
    };
    gotifyWS.onclose = (event) => {
        CAT_UI.Message.error('Gotify WebSocket 连接关闭');
        addLog('Gotify WebSocket 连接关闭', 'warning');
        gotifyWS = null;
        if (!gotifyEnabled) { return; }
        if (gotifyReconnectTimer) clearTimeout(gotifyReconnectTimer);
        gotifyReconnectTimer = setTimeout(() => connectGotifyWebSocket(webhookUrl, webhookToken), GOTIFY_RECONNECT_INTERVAL);
    };
}

// 初始化 Gotify 监听（根据配置）
function initwebhookCatDevice(enabled, webhookUrl, webhookToken) {
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

    if (!webhookUrl || !webhookToken) {
        gotifyEnabled = false;
        gotifyConfigKey = '';
        CAT_UI.Message.warning('未配置 Gotify webhookUrl 或 webhookToken，未启动推送监听');
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

    connectGotifyWebSocket(webhookUrl, webhookToken);
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
