// ==UserScript==
// @name         数据剔除
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  自动创建可拖动控制面板，填充指定日期到目标输入框，并支持日期递增与面板关闭
// @author       Your Name
// @match        https://example.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // 初始化日期
    var time = new Date('2024-11-12');

    // 日期格式化函数
    function formatDate(date) {
        var d = new Date(date),
            month = '' + (d.getMonth() + 1),
            day = '' + d.getDate(),
            year = d.getFullYear();

        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;

        return [year, month, day].join('-');
    }

    // 核心功能函数
    function buttonclick() {
        // 创建iframe元素
        const iframe = document.createElement('iframe');
        Object.assign(iframe.style, {
            position: 'fixed',
            right: '30%',
            bottom: '90%',
            width: '300px',
            height: '50px',
            zIndex: '9999', // 确保iframe在最顶层
            border: 'none',
            backdropFilter: 'blur(5px)', // 亚克力效果
            backgroundColor: 'rgba(0, 0, 0, 0.5)', // 半透明白色背景
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)', // 阴影效果
            borderRadius: '10px', // 圆角
            cursor: 'move' // 鼠标悬停时显示移动光标
        });
        // 油猴环境下使用document.body，无需top.document
        document.body.appendChild(iframe);

        // 在iframe中添加样式以居中按钮
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        const style = iframeDoc.createElement('style');
        style.textContent = `
            body {
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100%;
                margin: 0;
                background: rgba(255, 255, 255, 0.1); // 背景颜色
            }
            button {
                margin: 5px;
                font-size: 15px; // 修改按钮文本字体大小
                padding: 10px 20px; // 按钮内边距
                border: none; // 去掉边框
                border-radius: 50%; // 按钮圆角
                background-color: rgba(255, 255, 255, 0.8); // 按钮背景颜色
                color: #000; // 按钮文本颜色
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); // 按钮阴影
                cursor: pointer; // 鼠标悬停时显示手型光标
            }
            button:hover {
                background-color: rgb(153, 103, 103); // 按钮悬停背景颜色
            }
        `;
        iframeDoc.head.appendChild(style);


        // 添加打开网址按钮
        const openButton = iframeDoc.createElement('button');
        openButton.innerText = '打开网址';
        iframeDoc.body.appendChild(openButton);

        // 为打开网址按钮添加点击事件
        openButton.addEventListener('click', function () {
            window.open('https://example.com', '_blank'); // 替换为实际网址
        });

        // 添加继续按钮
        const runButton = iframeDoc.createElement('button');
        runButton.innerText = '点击①';
        iframeDoc.body.appendChild(runButton);

        // 添加继续2按钮
        const runButton2 = iframeDoc.createElement('button');
        runButton2.innerText = '点击②';
        iframeDoc.body.appendChild(runButton2);

        // 添加减一天按钮
        const decrementButton = iframeDoc.createElement('button');
        decrementButton.innerText = '减一天';
        iframeDoc.body.appendChild(decrementButton);

        // 添加结束按钮
        const closeButton = iframeDoc.createElement('button');
        closeButton.innerText = '结束';
        iframeDoc.body.appendChild(closeButton);



        // 使iframe可拖动
        let isDragging = false;
        let offsetX, offsetY;

        iframe.addEventListener('mousedown', function (e) {
            isDragging = true;
            offsetX = e.clientX - iframe.getBoundingClientRect().left;
            offsetY = e.clientY - iframe.getBoundingClientRect().top;
            iframe.style.transition = 'none'; // 禁用过渡效果
        });

        document.addEventListener('mousemove', function (e) {
            if (isDragging) {
                iframe.style.left = `${e.clientX - offsetX}px`;
                iframe.style.top = `${e.clientY - offsetY}px`;
                // 清除原有right和bottom样式，避免定位冲突
                iframe.style.right = 'auto';
                iframe.style.bottom = 'auto';
            }
        });

        document.addEventListener('mouseup', function () {
            isDragging = false;
            iframe.style.transition = ''; // 恢复过渡效果
        });

        // 按钮点击事件：点击①
        runButton.addEventListener('click', function () {
            //找到一个iframe，其name的开头为KJD，后续所有的点击事件都在这个iframe中执行
            var entryiframe = document.querySelector("iframe[name^='KJD']");
            if (!entryiframe) {
                console.log("没有找到符合条件的iframe");
                return;
            }
            // 等待 iframe 加载完成 
            const iframeDocument = entryiframe.contentDocument || entryiframe.contentWindow.document;

            // 找到所有的日期输入框
            var sendDates = iframeDocument.querySelectorAll("#sendDate");
            if (sendDates.length > 0) {
                console.log("sendDates的数量：", sendDates.length);
                sendDates.forEach(function (sendDate) {
                    sendDate.value = formatDate(time);
                });

                var sendDates2 = iframeDocument.querySelectorAll("#jsSj");
                console.log("sendDates2的数量：", sendDates2.length);
                sendDates2.forEach(function (sendDate) {
                    sendDate.value = formatDate(time);
                });

                // 选择选项 
                var selectitle = iframeDocument.querySelector("#sendTitle");
                if (selectitle) {
                    var options = selectitle.options;
                    for (var j = 0; j < options.length; j++) {
                        if (options[j].text === '线上业务剔除报备') {
                            selectitle.selectedIndex = j;
                            var event = new Event('change', { bubbles: true });
                            selectitle.dispatchEvent(event);
                            break;
                        }
                    }
                }

                // 选择选项:其他（修复原代码错误，应该操作selecysyy而非selectitle）
                var selecysyy = iframeDocument.querySelector("#ysyy");
                if (selecysyy) {
                    selecysyy.selectedIndex = 3; // 修正原代码的变量名错误
                }

                //填写原因（修复原代码错误，querySelectorAll返回数组，需遍历）
                var whyList = iframeDocument.querySelectorAll("#jxxx");
                whyList.forEach(function (why) {
                    why.value = "由于系统原因，部分业务无法网上办理，只能在线下窗口办理。";
                });

                // 日期+1
                time.setDate(time.getDate() + 1);
                console.log("当前日期已更新为：", formatDate(time));
            } else {
                console.log("没有找到sendDate元素");
            }
        });

        // 按钮点击事件：点击②
        runButton2.addEventListener('click', function () {
            //点击录入
            var continuebut = document.querySelector("#bu");
            if (continuebut) {
                continuebut.click();
            }
            // 等待一个iframe加载完成
            var continueiframe = document.querySelector("iframe[name^='33D']");
            if (!continueiframe) {
                console.log("没有找到符合条件的33D开头iframe");
                return;
            } else {
                console.log("找到符合条件的33D开头iframe");
                var continueiframeDocument = continueiframe.contentDocument || continueiframe.contentWindow.document;
                // 点击选择文件按钮
                var continuefile = continueiframeDocument.querySelector("#file");
                if (continuefile) {
                    continuefile.click();
                }
            }
        });

        // 结束按钮点击事件
        closeButton.addEventListener('click', function () {
            // 先判断元素是否存在，避免报错
            if (iframe && iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
            }
        });

        // 减一天按钮点击事件
        decrementButton.addEventListener('click', function () {
            time.setDate(time.getDate() - 1);
            console.log("当前日期已更新为：", formatDate(time));
        });

        // 使用MutationObserver监听DOM变化，确保iframe始终在最顶层
        const observer = new MutationObserver(function () {
            if (iframe) {
                iframe.style.zIndex = '9999';
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // 页面加载完成后执行（兼容异步加载场景）
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(buttonclick, 1000); // 延迟1秒执行，确保页面元素加载完整
    } else {
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(buttonclick, 1000);
        });
    }

})();