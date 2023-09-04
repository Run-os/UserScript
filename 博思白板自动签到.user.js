// ==UserScript==
// @name         博思白板自动签到
// @namespace    https://raw.githubusercontent.com/liuyz0112/UserScript/main/%E5%8D%9A%E6%80%9D%E7%99%BD%E6%9D%BF%E8%87%AA%E5%8A%A8%E7%AD%BE%E5%88%B0.uesr.js
// @version      0.1.0
// @description  尝试自动签到博思白板获取AI点数
// @author       Runos
// @match        https://boardmix.cn/app/editor/.*
// ==/UserScript==

// 读取上次运行时间
var lastRunTime = localStorage.getItem("boardmix-lastRunTime");

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
        setTimeout(function() {
            var primaryButton = document.querySelector(".ai-sign-in--content-sign .ed-button__primary");//签到
            var signInButton = document.querySelector(".ed-button__primary.ai-sign-in--content-sign-btn__disabled");//已签到
            var closeButton = document.querySelector(".ai-sign-in--title-right-close");//关闭签到界面
            //如果已经签到则退出界面
            if(signInButton) {
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
            setTimeout(function() {
                if(signInButton) {
                    //如果已经签到则关闭界面
                    if (closeButton) {
                        //关闭签到界面
                        closeButton.click();
                        }
                    } else {
                        //如果没有签到则表明签到失败，停止脚本
                        stopScript = true
                    }
                } , 3000)
            // 保存本次运行时间
            localStorage.setItem("boardmix-lastRunTime", currentTime);
            }
        } , 1000);
    } else {
        //循环寻找打开签到界面的按钮直到找到
        setTimeout(clickExpandSign, 1000);
        }
    }
    clickExpandSign();
    // 保存本次运行时间
    localStorage.setItem("boardmix-lastRunTime", currentTime);
}

