// ==UserScript==
// @name         PushCat浏览器端
// @namespace    https://bbs.tampermonkey.net.cn/
// @version      0.1.0
// @description  PushCat浏览器端,可作为接收设备通知,也可以作为发送端推送消息至其它设备
// @author       王一之
// @background
// @connect      sct.icodef.com
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @grant        GM_log
// @require      https://scriptcat.org/lib/946/1.0.2/PushCat.js?sha384-oSlgx/WB23lLz4OArRxG+kpIkZnfokQmTboHl4CT/yG38oxllL9+O+bo7K2Icrja
// ==/UserScript==

// eslint-disable-next-line no-undef
const device = new PushCatDevice({
    name: "浏览器",
    accessKey: "jezgnaekix8djmqj",
});

device.onError(data => {
    GM_notification({
        title: "设备注册失败",
        text: data.msg,
    })
    GM_log("设备注册失败:" + data.msg);
});

device.onMessage(messages => {
    messages.forEach(msg => {
        GM_notification({
            title: msg.title,
            text: msg.content
        })
    });
    GM_log("收到消息:" + JSON.stringify(messages));
});

// const push = new PushCat({
//     accessKey: "jz5ud0hda4ahy9qp",
// });

// push.send("title", "content");