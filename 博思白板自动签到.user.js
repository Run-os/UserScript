// ==UserScript==
// @name         博思白板自动签到
// @namespace    https://raw.githubusercontent.com/liuyz0112/UserScript/main/%E5%8D%9A%E6%80%9D%E7%99%BD%E6%9D%BF%E8%87%AA%E5%8A%A8%E7%AD%BE%E5%88%B0.uesr.js
// @version      0.1.0
// @description  尝试自动签到博思白板获取AI点数
// @author       Runos
// @match        https://boardmix.cn/app/editor/.*
// ==/UserScript==

// 读取上次运行时间
var lastRunTime = localStorage.getItem("lastRunTime");

// 获取当前时间
var currentTime = new Date().getTime();

// 如果上次运行时间不存在，或者距离上次运行时间已经过去6小时以上，就运行脚本
if (!lastRunTime || currentTime - lastRunTime > 6 * 60 * 60 * 1000) {
  // 运行脚本代码
  function clickExpandSign() {
    var expandSign = document.querySelector(".toolBarAi--expand-sign");
    if (expandSign) {
      expandSign.click();
      setTimeout(function() {
        var signInButton = document.querySelector(".ed-button__primary.ai-sign-in--content-sign-btn__disabled");
        if (signInButton) {
          var closeButton = document.querySelector(".ai-sign-in--title-right-close");
          if (closeButton) {
            closeButton.click();
          }
        }
      }, 1000);
    } else {
      setTimeout(clickExpandSign, 1000);
    }
  }

  clickExpandSign();

  // 保存本次运行时间
  localStorage.setItem("lastRunTime", currentTime);
}


