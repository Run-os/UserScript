// ==UserScript==
// @name         保密教育自动点击播放
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  保密教育自动点击播放
// @author       Run-os
// @match        https://www.baomi.org.cn/bmVideo?*
// @icon         https://th.bing.com/th?id=ODLS.039b3eb8-253e-4d80-8727-6e7d039c3891&w=32&h=32&qlt=90&pcl=fffffa&o=6&pid=1.2
// @grant        none
// @license      MIT
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
    }, 1000);
}

(function () {
    'use strict';

    var maxWaitTime = 60000; // 最多等待1分钟
    var intervalTime = 2000; // 每2秒检查一次
    var startTime = Date.now();

    // 主函数，用于定期检查播放按钮是否存在
    function checkButton() {
        var targetButton = document.querySelector('.prism-play-btn');
        if (targetButton) {
            // 如果找到播放按钮，则停止检测并触发点击事件
            clearInterval(interval);

            const id = targetButton.id;
            const classes = Array.from(targetButton.classList).join('.');
            const buttonCss = `#${id}.${classes}`;
            targetButton.addEventListener('click', () => console.log(buttonCss))
            targetButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

            setTimeout(function () {
                if (document.querySelector('.prism-play-btn.playing')) {
                    toast("⚡自动播放成功😊");
                } else {
                    toast("⚡自动播放失败😢");
                }
            }, 1000); // 点击后再等待1秒进行检查
        } else if (Date.now() - startTime > maxWaitTime) {
            // 如果超过最大等待时间仍未找到播放按钮，则停止检测
            clearInterval(interval);
            toast("⚡超时未找到指定的元素😢");
        }
    }

    // 设置定时器，每隔一定时间检查一次播放按钮
    var interval = setInterval(checkButton, intervalTime);
})();
