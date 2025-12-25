// ==UserScript==
// @name         数据剔除
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  自动创建可拖动控制面板，填充指定日期到目标输入框，并支持日期递增与面板关闭（现代化轻量化UI）
// @author       Your Name
// @match        https://example.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // 初始化日期，默认设置为昨天
    var time = new Date();
    time.setDate(time.getDate() - 1);

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
        // 创建iframe元素（大幅缩小尺寸，优化初始定位）
        const iframe = document.createElement('iframe');
        Object.assign(iframe.style, {
            position: 'fixed',
            right: '20px',
            top: '20px',
            width: '220px', // 保持宽度不变
            height: '240px', // 增加高度以显示所有内容
            zIndex: '9999',
            border: 'none',
            backdropFilter: 'blur(12px)', // 更细腻的毛玻璃效果
            backgroundColor: 'rgba(255, 255, 255, 0.85)', // 浅色系更显现代，同时保证通透
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)', // 柔和阴影，提升层次感
            borderRadius: '16px', // 圆润边角，更具现代感
            cursor: 'move',
            overflow: 'hidden' // 隐藏溢出内容，保持整洁
        });
        document.body.appendChild(iframe);

        // 在iframe中添加现代化样式
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        const style = iframeDoc.createElement('style');
        style.textContent = `
            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            body {
                display: grid;
                grid-template-columns: 1fr 1fr; /* 双列布局，紧凑高效 */
                grid-template-rows: auto auto auto auto;
                gap: 8px; /* 缩小间距，减少占用 */
                padding: 16px;
                background: transparent;
                height: 100%;
            }
            .title {
                grid-column: 1 / 3; /* 跨两列显示标题 */
                font-size: 16px;
                font-weight: 600;
                color: #1f2937;
                text-align: center;
                margin-bottom: 4px;
                letter-spacing: 0.2px;
            }
            .date-picker {
                grid-column: 1 / 3; /* 跨两列显示日期选择器 */
                width: 100%;
                height: 32px;
                padding: 0 12px;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                background-color: #ffffff;
                color: #1f2937;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .date-picker:hover {
                border-color: #3b82f6;
                box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
            }
            .date-picker::-webkit-calendar-picker-indicator {
                cursor: pointer;
                color: #3b82f6;
                opacity: 0.8;
            }
            .btn {
                width: 100%;
                height: 32px;
                padding: 0 8px;
                border: none;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .btn-primary {
                background-color: #3b82f6;
                color: #ffffff;
            }
            .btn-primary:hover {
                background-color: #2563eb;
                box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2);
            }
            .btn-secondary {
                background-color: #f3f4f6;
                color: #1f2937;
            }
            .btn-secondary:hover {
                background-color: #e5e7eb;
            }
            .btn-danger {
                background-color: #ef4444;
                color: #ffffff;
            }
            .btn-danger:hover {
                background-color: #dc2626;
            }
            .divider {
                grid-column: 1 / 3;
                height: 1px;
                background-color: #e5e7eb;
                margin: 4px 0;
            }
        `;
        iframeDoc.head.appendChild(style);

        // 添加标题（轻量化样式）
        const title = iframeDoc.createElement('h3');
        title.className = 'title';
        title.innerText = '数据剔除';
        iframeDoc.body.appendChild(title);

        // 添加日期选择器（紧凑化）
        const datePicker = iframeDoc.createElement('input');
        datePicker.type = 'date';
        datePicker.id = 'datePicker';
        datePicker.className = 'date-picker';
        datePicker.value = formatDate(time);
        iframeDoc.body.appendChild(datePicker);

        // 添加核心操作按钮（双列布局，节省空间）
        const runButton = iframeDoc.createElement('button');
        runButton.innerText = '点击①';
        runButton.className = 'btn btn-primary';
        iframeDoc.body.appendChild(runButton);

        const runButton2 = iframeDoc.createElement('button');
        runButton2.innerText = '点击②';
        runButton2.className = 'btn btn-primary';
        iframeDoc.body.appendChild(runButton2);

        // 添加辅助按钮（双列布局）
        const decrementButton = iframeDoc.createElement('button');
        decrementButton.innerText = '减一天';
        decrementButton.className = 'btn btn-secondary';
        iframeDoc.body.appendChild(decrementButton);

        const openButton = iframeDoc.createElement('button');
        openButton.innerText = '打开网址';
        openButton.className = 'btn btn-secondary';
        iframeDoc.body.appendChild(openButton);

        // 添加分隔线
        const divider = iframeDoc.createElement('div');
        divider.className = 'divider';
        iframeDoc.body.appendChild(divider);

        // 添加结束按钮（跨列显示，突出功能）
        const closeButton = iframeDoc.createElement('button');
        closeButton.innerText = '结束';
        closeButton.className = 'btn btn-danger';
        // 让结束按钮跨两列
        closeButton.style.gridColumn = '1 / 3';
        iframeDoc.body.appendChild(closeButton);

        // 使iframe可拖动（保留原有功能，优化流畅度）
        let isDragging = false;
        let offsetX, offsetY;

        iframe.addEventListener('mousedown', function (e) {
            // 避免点击按钮时触发拖动
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') {
                return;
            }
            isDragging = true;
            offsetX = e.clientX - iframe.getBoundingClientRect().left;
            offsetY = e.clientY - iframe.getBoundingClientRect().top;
            iframe.style.transition = 'none';
            // 拖动时提升层级，避免被遮挡
            iframe.style.zIndex = '10000';
        });

        document.addEventListener('mousemove', function (e) {
            if (isDragging) {
                iframe.style.left = `${e.clientX - offsetX}px`;
                iframe.style.top = `${e.clientY - offsetY}px`;
                iframe.style.right = 'auto';
                iframe.style.bottom = 'auto';
            }
        });

        document.addEventListener('mouseup', function () {
            if (isDragging) {
                isDragging = false;
                iframe.style.transition = 'all 0.2s ease';
                iframe.style.zIndex = '9999';
            }
        });

        // 按钮点击事件：点击①（保留原有功能）
        runButton.addEventListener('click', function () {
            var entryiframe = document.querySelector("iframe[name^='KJD']");
            if (!entryiframe) {
                console.log("没有找到符合条件的iframe");
                return;
            }
            const iframeDocument = entryiframe.contentDocument || entryiframe.contentWindow.document;

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

                var selecysyy = iframeDocument.querySelector("#ysyy");
                if (selecysyy) {
                    selecysyy.selectedIndex = 3;
                }

                var whyList = iframeDocument.querySelectorAll("#jxxx");
                whyList.forEach(function (why) {
                    why.value = "由于系统原因，部分业务无法网上办理，只能在线下窗口办理。";
                });

                time.setDate(time.getDate() + 1);
                datePicker.value = formatDate(time);
                console.log("当前日期已更新为：", formatDate(time));
            } else {
                console.log("没有找到sendDate元素");
            }
        });

        // 按钮点击事件：点击②（保留原有功能）
        runButton2.addEventListener('click', function () {
            var continuebut = document.querySelector("#bu");
            if (continuebut) {
                continuebut.click();
            }
            var continueiframe = document.querySelector("iframe[name^='33D']");
            if (!continueiframe) {
                console.log("没有找到符合条件的33D开头iframe");
                return;
            } else {
                console.log("找到符合条件的33D开头iframe");
                var continueiframeDocument = continueiframe.contentDocument || continueiframe.contentWindow.document;
                var continuefile = continueiframeDocument.querySelector("#file");
                if (continuefile) {
                    continuefile.click();
                }
            }
        });

        // 结束按钮点击事件（保留原有功能）
        closeButton.addEventListener('click', function () {
            if (iframe && iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
            }
        });

        // 日期选择器事件监听（保留原有功能）
        datePicker.addEventListener('change', function () {
            time = new Date(this.value);
            console.log("当前日期已更新为：", formatDate(time));
        });

        // 减一天按钮点击事件（保留原有功能）
        decrementButton.addEventListener('click', function () {
            time.setDate(time.getDate() - 1);
            datePicker.value = formatDate(time);
            console.log("当前日期已更新为：", formatDate(time));
        });

        // 打开网址按钮点击事件（保留原有功能）
        openButton.addEventListener('click', function () {
            window.open('https://example.com', '_blank');
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
        setTimeout(buttonclick, 1000);
    } else {
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(buttonclick, 1000);
        });
    }

})();