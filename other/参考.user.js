// ==UserScript==
// @name         ajaxHooker试用
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  ajaxHooker试用
// @author       woshilisisui (精简版)
// @match        https://znhd-service.zeabur.app/*  
// @icon         https://th.bing.com/th?id=ODLS.039b3eb8-253e-4d80-8727-6e7d039c3891&w=32&h=32&qlt=90&pcl=fffffa&o=6&pid=1.2
// @require      https://scriptcat.org/lib/637/1.4.8/ajaxHooker.js#sha256=dTF50feumqJW36kBpbf6+LguSLAtLr7CEs3oPmyfbiM=
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @license      GPL3
// ==/UserScript==



(function () {
    'use strict';  // 使用严格模式，避免一些JavaScript的不良写法

    ajaxHooker.hook(request => {

        request.response = res => {
            console.log(res);
            
        };

    })
})();