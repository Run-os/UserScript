// ==UserScript==
// @name         数据剔除
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  自动创建控制面板，填充指定日期到目标输入框，并支持日期递增与面板关闭（现代化轻量化UI）
// @author       runos
// @match        http://85.16.18.180:8080/*
// @match        https://example.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // 检查是否在顶层窗口，如果是iframe则不执行
    if (window.self !== window.top) {
        return;
    }

    // 初始化日期，默认设置为昨天（合并为一行）
    var time = new Date(); time.setDate(time.getDate() - 1);

    /**
     * 格式化日期为 YYYY-MM-DD 格式（确保月份和日期为两位数）
     * @param {Date|number|string} date - 要格式化的日期（Date对象/时间戳/日期字符串）
     * @returns {string} 格式化后的日期字符串，格式为 YYYY-MM-DD
     */
    function formatDate(date) {
        // 处理入参，统一转为 Date 对象
        const targetDate = new Date(date);

        // 校验日期有效性
        if (isNaN(targetDate.getTime())) {
            throw new Error('传入的参数不是有效的日期');
        }

        // 获取年、月、日（月份从 0 开始，需要 +1）
        const year = targetDate.getFullYear();
        // 补零：确保月份是两位数（如 1 → 01）
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        // 补零：确保日期是两位数（如 5 → 05）
        const day = String(targetDate.getDate()).padStart(2, '0');

        // 拼接成 YYYY-MM-DD 格式
        return `${year}-${month}-${day}`;
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

        /*
        * 样式应用
        */
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
        runButton2.innerText = '点击×';
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


        /*
        * 按钮点击事件
        * 点击①：核心数据填充功能
        * 点击②：上传附件
        */
        // 按钮点击事件：点击①（核心数据填充功能）
        runButton.addEventListener('click', function () {
            // 1. 查找名称以'KJD'开头的iframe（目标业务iframe）
            var entryiframe = document.querySelector("iframe[name^='JDG']");

            // 2. 检查是否找到目标iframe，未找到则退出并打印日志
            if (!entryiframe) {
                console.log("没有找到符合条件的iframe");
                return;
            }

            // 3. 获取iframe内部的文档对象（兼容不同浏览器）
            const iframeDocument = entryiframe.contentDocument || entryiframe.contentWindow.document;

            // 4. 查找所有id为'sendDate'的输入框元素
            var sendDates = iframeDocument.querySelectorAll("#sendDate");

            // 5. 如果找到sendDate元素，则执行数据填充操作
            if (sendDates.length > 0) {
                console.log("sendDates的数量：", sendDates.length);

                // 5.1 为所有sendDate输入框填充当前格式化后的日期
                sendDates.forEach(function (sendDate) {
                    sendDate.value = formatDate(time);
                });

                // 5.2 查找所有id为'jsSj'的输入框元素
                var sendDates2 = iframeDocument.querySelectorAll("#jsSj");
                console.log("sendDates2的数量：", sendDates2.length);

                // 5.3 为所有jsSj输入框填充当前格式化后的日期
                sendDates2.forEach(function (sendDate) {
                    sendDate.value = formatDate(time);
                });

                // 5.4 查找id为'sendTitle'的下拉选择框
                var selectitle = iframeDocument.querySelector("#sendTitle");
                if (selectitle) {
                    // 5.4.1 遍历下拉选项，查找文本为'线上业务剔除报备'的选项
                    var options = selectitle.options;
                    for (var j = 0; j < options.length; j++) {
                        if (options[j].text === '线上业务剔除报备') {
                            // 5.4.2 选中该选项
                            selectitle.selectedIndex = j;
                            // 5.4.3 创建并触发change事件，确保页面响应选择变化
                            var event = new Event('change', { bubbles: true });
                            selectitle.dispatchEvent(event);
                            break;
                        }
                    }
                }

                // 5.5 查找id为'yxyy'的下拉选择框
                var selecysyy = iframeDocument.querySelector("#yxyy");
                if (selecysyy) {
                    // 5.5.1 选中索引为3的选项（通常为预设的原因选项）
                    selecysyy.selectedIndex = 3;
                }

                // 5.6 查找所有id为'jxxx'的文本输入框
                var whyList = iframeDocument.querySelector("#sendContent");

                // 5.6.1 为所有jxxx输入框填充固定的原因文本
                whyList.value = "由于系统原因，部分业务不能通过网上办理，只能线下办理"

                // 6. 将当前日期自动增加1天（为下一次操作做准备）
                time.setDate(time.getDate() + 1);

                // 7. 更新控制面板中的日期选择器显示
                datePicker.value = formatDate(time);

                // 8. 打印日志，记录当前操作后的日期
                console.log("当前日期已更新为：", formatDate(time));
            } else {
                // 如果未找到sendDate元素，打印日志提示
                console.log("没有找到sendDate元素");
            }
        });

        // 按钮点击事件：点击②（上传附件）
        runButton2.addEventListener('click', function () {

        });

        // 按钮点击事件：结束（控制面板关闭功能）
        closeButton.addEventListener('click', function () {
            // 1. 安全检查：确保iframe存在且有父节点
            // 这是一个防御性编程措施，防止在iframe已被移除的情况下尝试访问
            if (iframe && iframe.parentNode) {
                // 2. 从DOM中移除iframe元素，关闭控制面板
                iframe.parentNode.removeChild(iframe);
            }
        });


        /* 事件监听 */
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
            window.open('http://85.16.18.180:8080/hnsw/wFeedbackConditionController.do?list&clickFunctionId=158c21a26e9ed536016e9efd7358000a&clickFunctionId=158c21a26e9ed536016e9efd7358000a#', '_blank');
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

})();// ==UserScript==
// @name         数据剔除
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  自动创建控制面板，填充指定日期到目标输入框，并支持日期递增与面板关闭（现代化轻量化UI）
// @author       runos
// @match        http://85.16.18.180:8080/*
// @match        https://example.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // 检查是否在顶层窗口，如果是iframe则不执行
    if (window.self !== window.top) {
        return;
    }

    // 初始化日期，默认设置为昨天（合并为一行）
    var time = new Date(); time.setDate(time.getDate() - 1);

    /**
     * 格式化日期为 YYYY-MM-DD 格式（确保月份和日期为两位数）
     * @param {Date|number|string} date - 要格式化的日期（Date对象/时间戳/日期字符串）
     * @returns {string} 格式化后的日期字符串，格式为 YYYY-MM-DD
     */
    function formatDate(date) {
        // 处理入参，统一转为 Date 对象
        const targetDate = new Date(date);

        // 校验日期有效性
        if (isNaN(targetDate.getTime())) {
            throw new Error('传入的参数不是有效的日期');
        }

        // 获取年、月、日（月份从 0 开始，需要 +1）
        const year = targetDate.getFullYear();
        // 补零：确保月份是两位数（如 1 → 01）
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        // 补零：确保日期是两位数（如 5 → 05）
        const day = String(targetDate.getDate()).padStart(2, '0');

        // 拼接成 YYYY-MM-DD 格式
        return `${year}-${month}-${day}`;
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

        /*
        * 样式应用
        */
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
        runButton2.innerText = '点击×';
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


        /*
        * 按钮点击事件
        * 点击①：核心数据填充功能
        * 点击②：上传附件
        */
        // 按钮点击事件：点击①（核心数据填充功能）
        runButton.addEventListener('click', function () {
            // 1. 查找名称以'KJD'开头的iframe（目标业务iframe）
            var entryiframe = document.querySelector("iframe[name^='JDG']");

            // 2. 检查是否找到目标iframe，未找到则退出并打印日志
            if (!entryiframe) {
                console.log("没有找到符合条件的iframe");
                return;
            }

            // 3. 获取iframe内部的文档对象（兼容不同浏览器）
            const iframeDocument = entryiframe.contentDocument || entryiframe.contentWindow.document;

            // 4. 查找所有id为'sendDate'的输入框元素
            var sendDates = iframeDocument.querySelectorAll("#sendDate");

            // 5. 如果找到sendDate元素，则执行数据填充操作
            if (sendDates.length > 0) {
                console.log("sendDates的数量：", sendDates.length);

                // 5.1 为所有sendDate输入框填充当前格式化后的日期
                sendDates.forEach(function (sendDate) {
                    sendDate.value = formatDate(time);
                });

                // 5.2 查找所有id为'jsSj'的输入框元素
                var sendDates2 = iframeDocument.querySelectorAll("#jsSj");
                console.log("sendDates2的数量：", sendDates2.length);

                // 5.3 为所有jsSj输入框填充当前格式化后的日期
                sendDates2.forEach(function (sendDate) {
                    sendDate.value = formatDate(time);
                });

                // 5.4 查找id为'sendTitle'的下拉选择框
                var selectitle = iframeDocument.querySelector("#sendTitle");
                if (selectitle) {
                    // 5.4.1 遍历下拉选项，查找文本为'线上业务剔除报备'的选项
                    var options = selectitle.options;
                    for (var j = 0; j < options.length; j++) {
                        if (options[j].text === '线上业务剔除报备') {
                            // 5.4.2 选中该选项
                            selectitle.selectedIndex = j;
                            // 5.4.3 创建并触发change事件，确保页面响应选择变化
                            var event = new Event('change', { bubbles: true });
                            selectitle.dispatchEvent(event);
                            break;
                        }
                    }
                }

                // 5.5 查找id为'yxyy'的下拉选择框
                var selecysyy = iframeDocument.querySelector("#yxyy");
                if (selecysyy) {
                    // 5.5.1 选中索引为3的选项（通常为预设的原因选项）
                    selecysyy.selectedIndex = 3;
                }

                // 5.6 查找所有id为'jxxx'的文本输入框
                var whyList = iframeDocument.querySelector("#sendContent");

                // 5.6.1 为所有jxxx输入框填充固定的原因文本
                whyList.value = "由于系统原因，部分业务不能通过网上办理，只能线下办理"

                // 6. 将当前日期自动增加1天（为下一次操作做准备）
                time.setDate(time.getDate() + 1);

                // 7. 更新控制面板中的日期选择器显示
                datePicker.value = formatDate(time);

                // 8. 打印日志，记录当前操作后的日期
                console.log("当前日期已更新为：", formatDate(time));
            } else {
                // 如果未找到sendDate元素，打印日志提示
                console.log("没有找到sendDate元素");
            }
        });

        // 按钮点击事件：点击②（上传附件）
        runButton2.addEventListener('click', function () {

        });

        // 按钮点击事件：结束（控制面板关闭功能）
        closeButton.addEventListener('click', function () {
            // 1. 安全检查：确保iframe存在且有父节点
            // 这是一个防御性编程措施，防止在iframe已被移除的情况下尝试访问
            if (iframe && iframe.parentNode) {
                // 2. 从DOM中移除iframe元素，关闭控制面板
                iframe.parentNode.removeChild(iframe);
            }
        });


        /* 事件监听 */
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
            window.open('http://85.16.18.180:8080/hnsw/wFeedbackConditionController.do?list&clickFunctionId=158c21a26e9ed536016e9efd7358000a&clickFunctionId=158c21a26e9ed536016e9efd7358000a#', '_blank');
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