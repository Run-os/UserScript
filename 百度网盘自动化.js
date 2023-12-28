// ==UserScript==
// @name         百度网盘打开中文字幕
// @namespace    http://tampermonkey.net/
// @version      2023-12-28
// @description  百度网盘自动打开中文字幕
// @author       You
// @match        https://pan.baidu.com/pfile/video?path=*.mp4*
// @icon         https://nd-static.bdstatic.com/m-static/v20-main/home/img/icon-home-new.b4083345.png
// @grant        none
// ==/UserScript==

// 创建一个 div 元素作为提示框的容器
var message = document.createElement("div");
// 设置提示框的样式
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
message.style.fontSize = "16px"
message.style.display = "none"; // 初始状态下不显示
// 将提示框添加到页面中
document.body.appendChild(message);

//提示框
function toast(wenzi) {
    message.textContent = wenzi;
    message.style.display = "block";
    setTimeout(function () {
        message.style.display = "none";
    }, 2000);
}

(function () {
    'use strict';

    // 等待10秒后触发指定的class
    setTimeout(function () {
        document.querySelector('li.vp-video__control-bar--video-subtitles-select-item:nth-child(2)').click();

        // 检查是否成功
        setTimeout(function () {
            if (document.querySelector('li.vp-video__control-bar--video-subtitles-select-item:nth-child(2)').classList.contains('is-checked')) {
                toast("⚡自动打开中文字幕成功😊");
            } else {
                toast("⚡自动打开中文字幕失败😢");
            }

        }, 1000); // 在点击后再等待1秒进行检查

    }, 5000); // 等待5秒后触发
})();

