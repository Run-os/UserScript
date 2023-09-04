// ==UserScript==
// @name         博思白板自动签到
// @namespace    https://github.com/liuyz0112/UserScript
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


