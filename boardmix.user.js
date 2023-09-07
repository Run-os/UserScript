// ==UserScript==
// @name         博思白板自动签到
// @namespace    https://greasyfork.org/zh-CN/scripts/474533
// @homepageURL  https://github.com/liuyz0112/UserScript
// @version      1.1.6
// @description  尝试自动签到博思白板获取AI点数
// @author       Runos
// @match        https://boardmix.cn/app/editor/*
// @license      GPL-3.0 License
// @lasttime     2023-09-07 17:01:54
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
message.style.padding = "10px";
message.style.borderRadius = "5px";
message.style.boxShadow = "2px 2px 5px rgba(0, 0, 0, 0.3)";
message.style.zIndex = "9999";
message.style.display = "none"; // 初始状态下不显示
// 将提示框添加到页面中
document.body.appendChild(message);


// 读取上次运行时间
var lastRunTime = localStorage.getItem("boardmix-lastRunTime");
// 将时间戳转换为 Date 对象
var date = new Date(parseInt(lastRunTime));
// 将日期格式化为几点几分的字符串
var time = ("0" + date.getHours()).slice(-2) + ":" + ("0" + date.getMinutes()).slice(-2);

// 获取当前时间
var currentTime = new Date().getTime();

// 如果上次运行时间不存在，或者距离上次运行时间已经过去一天以上，就运行脚本
if (!lastRunTime || currentTime - lastRunTime > 24 * 60 * 60 * 1000) {
    // 运行脚本代码
    function clickExpandSign() {
        //打开签到界面
        var expandSign = document.querySelector(".toolBarAi--expand-sign");
        if (expandSign) {
            expandSign.click();
            setTimeout(function () {
                var primaryButton = document.querySelector(".ai-sign-in--content-sign .ed-button__primary");//签到
                var signInButton = document.querySelector(".ed-button__primary.ai-sign-in--content-sign-btn__disabled");//已签到
                var closeButton = document.querySelector(".ai-sign-in--title-right-close");//关闭签到界面
                //如果已经签到则退出界面
                if (signInButton) {
                    //关闭签到界面
                    if (closeButton) {
                        closeButton.click();
                    }
                    // 保存本次运行时间
                    localStorage.setItem("boardmix-lastRunTime", currentTime);
                    stopScript = true
                }
                //还没有签到则点击签到
                if (primaryButton) {
                    primaryButton.click();
                    // 显示提示框，并在 2 秒后隐藏
                    message.textContent = "签到成功😀";
                    message.style.display = "block";
                    setTimeout(function () {
                        message.style.display = "none";
                    }, 2000);

                    setTimeout(function () {
                        if (signInButton) {
                            //如果已经签到则关闭界面
                            if (closeButton) {
                                //关闭签到界面
                                closeButton.click();
                            }
                        } else {
                            //如果没有签到则表明签到失败，停止脚本
                            // 显示提示框，并在 2 秒后隐藏
                            message.textContent = "签到失败/(ㄒoㄒ)/~~";
                            message.style.display = "block";
                            setTimeout(function () {
                                message.style.display = "none";
                            }, 2000);
                            stopScript = true
                            return; // 退出函数
                        }
                    }, 3000)
                    // 保存本次运行时间
                    localStorage.setItem("boardmix-lastRunTime", currentTime);
                }
            }, 1000);
        } else {
            //循环寻找打开签到界面的按钮直到找到
            setTimeout(clickExpandSign, 1000);
        }
    }
    clickExpandSign();
    // 保存本次运行时间
    localStorage.setItem("boardmix-lastRunTime", currentTime);
} else {
    // 显示提示框，并在 2 秒后隐藏
    message.textContent = "今天" + time + "已经签到过了哦😀";
    message.style.display = "block";
    setTimeout(function () {
        message.style.display = "none";
    }, 2000);

}

