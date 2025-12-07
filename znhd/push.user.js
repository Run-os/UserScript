// ==UserScript==
// @name         Gotify 实时接收推送（WebSocket）
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  油猴脚本通过WebSocket监听Gotify推送，获取文本内容
// @author       You
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ========== 配置项（替换为你的Gotify信息） ==========
    const GOTIFY_SERVER = 'https://push.122050.xyz'; // Gotify服务地址（不要以/结尾）
    // ⚠️ 重要：接收消息必须使用 clientToken（不是 appToken）
    // - clientToken: 用于接收消息，管理令牌、删除消息等（如手机 app、油猴脚本）
    // - appToken: 用于发送消息（如 Shell 脚本、自动化工具）
    const CLIENT_TOKEN = 'CVttiv_xkYv_yaP'; // 你的客户端Token（接收消息用）
    const RECONNECT_INTERVAL = 3000; // 断线重连间隔（毫秒）

    // ========== WebSocket连接核心逻辑 ==========
    let ws; // WebSocket实例

    // 创建WebSocket连接
    function connectGotify() {

        // Gotify WebSocket地址格式：wss://{服务地址}/stream?token={clientToken}
        const urlObj = new URL('/stream', GOTIFY_SERVER);
        urlObj.protocol = urlObj.protocol === 'https:' ? 'wss:' : 'ws:';
        urlObj.searchParams.set('token', CLIENT_TOKEN);
        ws = new WebSocket(urlObj.href);

        // 1. 连接成功回调
        ws.onopen = () => {
            console.log('✅ Gotify WebSocket 连接成功');
        };

        // 2. 接收推送消息（核心：解析文本内容）
        ws.onmessage = (event) => {
            try {
                // 原始数据先输出，便于调试
                console.log('📨 WebSocket 原始数据：', event.data);

                // Gotify WebSocket 直接返回消息对象（非嵌套结构）
                // 字段说明：https://gotify.net/api-docs#tag/message-stream
                const msg = JSON.parse(event.data);

                // Gotify 推送消息的字段：id, title, message, priority, date, appid
                const { id, title, message: text, priority, date } = msg;

                // ========== 业务逻辑：处理接收到的文本 ==========
                console.log('📩 收到Gotify推送：', {
                    消息ID: id,
                    标题: title,
                    内容: text,
                    优先级: priority,
                    时间: date
                });

                // 示例：弹窗提示推送内容
                if (text) { // 确保有内容才弹窗
                    alert(`【Gotify推送】\n标题：${title || '无'}\n内容：${text}`);
                }

                // 示例：将文本插入到网页中
                document.body.insertAdjacentHTML('beforeend', `
                    <div style="position:fixed;top:20px;right:20px;background:#fff;padding:10px;border:1px solid #ccc;z-index:9999;max-width:300px;border-left:4px solid #1890ff;">
                        <h4 style="margin:0 0 8px 0;">${title || '新消息'}</h4>
                        <p style="margin:0;">${text || '无内容'}</p>
                        <small style="color:#999;">${new Date(date).toLocaleTimeString()}</small>
                    </div>
                `);
            } catch (err) {
                console.error('❌ 解析Gotify消息失败，原始数据可能格式不正确：', err);
                console.error('原始数据内容：', event.data);
            }
        };

        // 3. 错误处理
        ws.onerror = (error) => {
            console.error('❌ Gotify WebSocket 错误：', {
                error,
                readyState: ws?.readyState,
                url: ws?.url,
                note: '若持续 readyState=3，常见原因：证书问题 / 反向代理未透传 WebSocket / token 无效（参见 Gotify docs stream）'
            });
        };

        // 4. 断线重连（关键：保证连接稳定性）
        ws.onclose = (event) => {
            console.log(`🔌 Gotify连接关闭（码：${event.code}，原因：${event.reason || '无'}），${RECONNECT_INTERVAL / 1000}秒后重连...`);
            setTimeout(connectGotify, RECONNECT_INTERVAL); // 自动重连
        };
    }

    // 初始化连接
    connectGotify();

    // 脚本卸载/页面关闭时，关闭WebSocket连接（避免内存泄漏）
    window.addEventListener('unload', () => {
        if (ws) ws.close(1000, '脚本卸载，主动关闭连接');
    });
})();