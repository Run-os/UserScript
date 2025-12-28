// ==UserScript==
// @name         湖南学法网12348自动答题--自建题库版
// @namespace    http://tampermonkey.net/
// @version      25.12.28
// @description  自动处理法规页面答题并点击.next元素，支持新API查询答案，答题正确后自动上传题目到题库
// @author       runos
// @match        *://hn.12348.gov.cn/*
// @icon         http://hn.12348.gov.cn/favicon.ico
// @require      https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js
// @require      https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.min.js
// @require      https://cdn.jsdelivr.net/gh/Qalxry/atf/dist/atf.js
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_download
// @grant        GM_info
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
    'use strict';

    // 题库查询 API
    const API_URL = 'https://tiku.122050.xyz/adapter-service/search?use=local';
    // 题库创建题目 API
    const CREATE_URL = 'https://tiku.122050.xyz/adapter-service/questions';

    // 初始化 jQuery 的无冲突模式
    const jq = $.noConflict(true);

    // 初始化 ATF 框架
    const SCRIPT_ID = 'xfw-script';
    const ATF = AdvancedTampermonkeyFramework({
        jq: jq,
        fflate: fflate,
        scriptId: SCRIPT_ID,
        scriptName: GM_info.script.name,
        version: GM_info.script.version,
        githubRepo: '',
        iconCdnPrefix: "https://unpkg.com/lucide-static@latest/icons/",
    });

    // 配置结构：全部在 Settings 页面展示与管理
    const DEFAULT_CONFIG = {
        general: {
            groupName: '通用设置',
            settings: {
                useTextReplace: {
                    label: '统一替换中文符号为半角',
                    type: 'checkbox',
                    default: true,
                    description: '提高题干与选项匹配准确度'
                },
                autoStart: {
                    label: '页面加载后自动开始监控',
                    type: 'checkbox',
                    default: false,
                    description: '进入法规题页面后自动启动监控'
                }
            }
        },
        behavior: {
            groupName: '行为与延时',
            settings: {
                checkInterval: {
                    label: '监控检查间隔 (毫秒)',
                    type: 'number',
                    default: 500,
                    description: '主循环检查节奏'
                },
                maxNotFound: {
                    label: '连续未找到.next上限',
                    type: 'number',
                    default: 10,
                    description: '达到上限后停止监控'
                },
                answerDelay: {
                    label: '每题选择后等待 (毫秒)',
                    type: 'number',
                    default: 500,
                    description: '避免选择过快导致异常'
                },
                pageLoadDelay: {
                    label: '页面切换后恢复监控延时 (毫秒)',
                    type: 'number',
                    default: 1000,
                    description: '等待新页面 DOM 就绪'
                },
                resultCheckDelay: {
                    label: '提交后结果轮询间隔 (毫秒)',
                    type: 'number',
                    default: 500,
                    description: '检测答题结果的间隔'
                },
                maxResultChecks: {
                    label: '结果轮询最大次数',
                    type: 'number',
                    default: 5,
                    description: '超过则视为超时，继续流程'
                }
            }
        }
    };

    const atf = ATF.init({
        config: DEFAULT_CONFIG,
        ui: {
            title: '湖南学法网助手',
            panel_icon: { name: 'layout-dashboard', size: 21 },
            entry_icon: { name: 'zap', size: 26 }
        },
        corePages: { logs: true, settings: true, about: true }
    });

    // ATF 主页面：监控控制 + 导出日志入口
    const mainPage = {
        id: 'main',
        title: '主页',
        icon: 'house',
        onShow: ($container) => {
            if ($container.children().length > 0) return;
            const enableTextReplace = cfg('general.useTextReplace');
            $container.css('display', 'block').html(`
                <h1>法规题自动处理-自建题库版</h3>
                <p>请在法规题页面使用本脚本。</p>
                <p>本代码使用自建题库进行答题，遇到题库中没有的题目，会自动上传到题库。</p>
                <p>-------</p>
                <button id="${SCRIPT_ID}-monitor-btn" class="${SCRIPT_ID}-dialog-button primary">${state.isStopped ? '开始监控' : '停止监控'}</button>
            `);

            $container.find(`#${SCRIPT_ID}-monitor-btn`).on('click', (e) => {
                e.preventDefault();
                if (state.isStopped) {
                    controller.startMonitoring();
                } else {
                    controller.stop();
                }
            });
            $container.find(`#${SCRIPT_ID}-goto-settings`).on('click', () => atf.UIManager.showPanel('settings'));
            $container.find(`#${SCRIPT_ID}-goto-logs`).on('click', () => atf.UIManager.showPanel('logs'));
        }
    };

    atf.UIManager.addPage(mainPage);
    atf.UIManager.addPage(ATF.pages.logPage);
    atf.UIManager.addPage(ATF.pages.settingsPage);

    // 运行态（不持久化 UI 状态）
    const state = {
        checkInterval: null,
        notFoundCount: 0,
        isProcessing: false,
        isStopped: true,
        pageChangeCount: 0
    };

    // 便捷配置读取
    const cfg = (path) => atf.ConfigManager.get(path);

    // 已上传题目记录（使用 localStorage）
    const UPLOADED_KEY = `${SCRIPT_ID}_uploaded_questions`;
    function getUploadedQuestions() {
        try { return JSON.parse(localStorage.getItem(UPLOADED_KEY) || '[]'); } catch { return []; }
    }
    function isQuestionUploaded(questionText) {
        const uploaded = getUploadedQuestions();
        return uploaded.some(uq => uq === questionText);
    }
    function markQuestionUploaded(questionText) {
        const uploaded = getUploadedQuestions();
        if (!uploaded.includes(questionText)) {
            uploaded.push(questionText);
            localStorage.setItem(UPLOADED_KEY, JSON.stringify(uploaded));
        }
    }

    /**
     * 上传题目到题库
     * @param {Object} question 题目对象
     * @param {Array} answers 正确答案数组
     * @returns {Promise<boolean>} 是否上传成功
     */
    async function uploadQuestion(question, answers) {
        if (state.isStopped) return false;
        const questionText = cfg('general.useTextReplace') ? textReplace(question.text) : question.text;

        // 检查是否已上传
        if (isQuestionUploaded(questionText)) {
            atf.Logger.debug(`题目已上传过，跳过: ${questionText.substring(0, 30)}...`);
            return true;
        }

        return new Promise((resolve) => {
            const payload = [{
                question: questionText,
                options: JSON.stringify(question.options.map(o => cfg('general.useTextReplace') ? textReplace(o.text) : o.text)),
                answer: JSON.stringify(answers),
                type: question.options.some(opt => (opt.element?.type || '').toLowerCase() === 'checkbox') ? 1 : 0,
                plat: 0,
                course_name: '湖南学法网',
                extra: `上传时间:${new Date().toLocaleString()}`
            }];

            GM_xmlhttpRequest({
                method: 'POST',
                url: CREATE_URL,
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                data: JSON.stringify(payload),
                onload: (res) => {
                    if (state.isStopped) return resolve(false);
                    try {
                        const result = JSON.parse(res.responseText);
                        if (result.message && result.message.includes('成功')) {
                            markQuestionUploaded(questionText);
                            atf.Logger.debug(`题目上传成功: ${questionText.substring(0, 30)}...`);
                            resolve(true);
                        } else {
                            atf.Logger.warn(`题目上传失败: ${result.message || res.responseText}`);
                            resolve(false);
                        }
                    } catch (e) {
                        atf.Logger.error(`解析上传结果失败: ${e.message}`);
                        resolve(false);
                    }
                },
                onerror: (e) => { atf.Logger.error(`上传题目失败: ${e.message}`); resolve(false); },
                ontimeout: () => { atf.Logger.error('上传题目超时'); resolve(false); }
            });
        });
    }

    /**
     * 文本符号统一替换
     * 处理中文符号，统一为半角形式，提升匹配准确性。
     * @param {string} str 原始文本
     * @returns {string} 替换后的文本
     */
    function textReplace(str) {
        return str
            .replace(/；/g, ';')
            .replace(/（/g, '(')
            .replace(/）/g, ')')
            .replace(/：/g, ':');
    }

    /**
     * 题目处理器
     * - extract(): 解析题目与选项结构。
     * - extractOptions(container): 提取选项文本与输入元素。
     * - query(question): 向外部接口查询答案。
     * - process(question, answerData): 根据答案选择选项。
     */
    const questionHandler = {
        /**
         * 解析页面题目与选项容器
         * 步骤：
         * 1) 定位题目整体容器（兼容多种选择器）。
         * 2) 遍历题目元素，清洗题干文本（必要时执行符号替换）。
         * 3) 定位选项容器（优先同级 `neiinput`，否则在题目内查找）。
         * 4) 聚合题目信息（题干、选项、原始 DOM）。
         * 边界：容器缺失或题目为空时返回空数组并记录警告。
         * @returns {Array<{element: Element, text: string, options: Array, qid: string, container: Element}>}
         */
        extract() {
            if (state.isStopped) return [];
            const container = document.getElementById('question') || document.querySelector('form.questions');
            if (!container) return [];

            const questions = [];
            const questionElements = container.querySelectorAll('.question, .question2, .question-item');
            if (questionElements.length === 0) {
                atf.Logger.warn(`题目容器存在但未找到题目元素: ${container.textContent.substring(0, 50)}...`);
                return [];
            }

            questionElements.forEach(el => {
                let text = el.textContent.replace(/^\d+\.\s*（.*?）/, '').trim();
                if (cfg('general.useTextReplace')) text = textReplace(text);

                const optionsContainer = el.nextElementSibling?.classList?.contains('neiinput')
                    ? el.nextElementSibling
                    : el.querySelector('.options, .neiinput');

                if (!optionsContainer) {
                    atf.Logger.warn(`未找到题目选项容器: ${text.substring(0, 30)}...`);
                    return;
                }

                const options = this.extractOptions(optionsContainer);
                if (options.length > 0) {
                    options.forEach(option => {
                        option.text = option.text.replace(/^\s*[A-J]\s*/i, '').trim();
                    });
                    questions.push({
                        element: el,
                        text,
                        options,
                        qid: el.getAttribute('qid') || '',
                        container: optionsContainer
                    });
                    atf.Logger.debug(`提取题目: ${text}    选项: ${options.map(o => o.text).join(', ')}`);
                }
            });

            return questions;
        },

        /**
         * 提取选项与显示文本
         * 优先在容器内通过 `label[for]` 关联文本；若不存在，则遍历紧邻文本节点直到 `BR`。
         * 清洗：去除选项字母前缀与首尾空白；在启用时执行符号替换。
         * @param {Element} container 选项容器
         * @returns {Array<{letter: string, text: string, element: HTMLInputElement}>}
         */
        extractOptions(container) {
            return Array.from(container.querySelectorAll('input[type="radio"], input[type="checkbox"]'))
                .map(input => {
                    const label = container.querySelector(`label[for="${input.id}"]`);
                    const rawText = label
                        ? label.textContent
                        : (() => {
                            let s = input.nextSibling, buf = '';
                            while (s && s.tagName !== 'BR') {
                                if (s.nodeType === Node.TEXT_NODE) buf += s.textContent;
                                s = s.nextSibling;
                            }
                            return buf;
                        })();
                    let text = rawText.replace(/^[A-Za-z]\s*/, '').trim();
                    if (cfg('general.useTextReplace')) text = textReplace(text);
                    return { letter: input.value, text, element: input };
                });
        },

        /**
         * 查询外部题库答案
         * 通过 POST 接口提交题干、选项与题型，并解析 `answer.allAnswer`。
         * @param {{text: string}} question 题目对象（需包含题干）
         * @returns {Promise<{answer: {answerKey: string[]}}>} 结果对象
         */
        async query(question) {
            if (state.isStopped) throw new Error('脚本已停止');
            return new Promise((resolve, reject) => {
                const isMulti = question.options.some(opt => (opt.element?.type || '').toLowerCase() === 'checkbox');
                const payload = {
                    question: cfg('general.useTextReplace') ? textReplace(question.text) : question.text,
                    options: question.options.map(o => cfg('general.useTextReplace') ? textReplace(o.text) : o.text),
                    type: isMulti ? 1 : 0
                };
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: API_URL,
                    headers: { 'Content-Type': 'application/json; charset=utf-8' },
                    data: JSON.stringify(payload),
                    onload: (res) => {
                        if (state.isStopped) return reject(new Error('脚本已停止'));
                        atf.Logger.debug(`API请求: ${JSON.stringify(payload)}`);
                        try {
                            const result = JSON.parse(res.responseText);
                            const allAnswer = result?.answer?.allAnswer;
                            const texts = Array.isArray(allAnswer)
                                ? Array.from(new Set(allAnswer.flat().filter(Boolean).map(t => String(t))))
                                : [];
                            if (texts.length > 0) {
                                atf.Logger.debug(`API返回答案: ${texts.join(', ')}`);
                                resolve({ answer: { answerKey: texts } });
                            } else {
                                atf.Logger.warn('未找到答案或答案为空，标记到本地');
                                atf.UIManager.showNotification('未找到答案或答案为空', { type: "warning", duration: 4000 });
                                // 标记未找到的题目
                                markQuestionUploaded(question.text);
                                resolve({ answer: { answerKey: [] } });
                            }
                        } catch (e) {
                            atf.Logger.error(`解析答案失败: ${e.message}`);
                            reject(e);
                        }
                    },
                    onabort: () => { if (!state.isStopped) atf.Logger.error('API请求已取消'); reject(new Error('请求已取消')); },
                    onerror: (e) => { if (!state.isStopped) atf.Logger.error(`API请求失败: ${e && (e.statusText || e.status || e.error) || '未知错误'}`); reject(e); },
                    ontimeout: () => { if (!state.isStopped) atf.Logger.error('API请求超时'); reject(new Error('请求超时')); }
                });
            });
        },

        /**
         * 根据答案选择选项
         * 使用二元语法（bigram）Dice 系数进行相似度匹配；阈值 90%。
         * 单选：选择最佳相似度选项；多选：选择所有达到阈值的选项。
         * 边界：答案为空时触发停止（避免错误提交）。
         * 并输出每次比较的原文、归一化文本和相似度百分比。
         * @param {Object} question 题目对象（包含选项与容器）
         * @param {{answer?: {answerKey?: string[]}}} answerData 查询结果
         * @returns {Promise<boolean>} 是否继续流程
         */
        async process(question, answerData) {
            if (state.isStopped) return false;
            const answers = answerData?.answer?.answerKey || [];
            if (!answers.length) {
                atf.Logger.warn('答案为空，已停止以避免误选');
                controller.stop();
                return false;
            }

            const normalize = (s) => {
                let t = String(s || '').trim().toLowerCase();
                if (state.useTextReplace) t = textReplace(t);
                t = t.replace(/[\s\r\n\t]+/g, '');
                t = t.replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '');
                return t;
            };
            const bigrams = (s) => {
                const n = s.length;
                if (n <= 1) return [s];
                const arr = [];
                for (let i = 0; i < n - 1; i++) arr.push(s.slice(i, i + 2));
                return arr;
            };
            const similarity = (a, b) => {
                const A = bigrams(normalize(a));
                const B = bigrams(normalize(b));
                if (A.length === 0 || B.length === 0) return 0;
                const mapB = new Map();
                B.forEach(x => mapB.set(x, (mapB.get(x) || 0) + 1));
                let inter = 0;
                A.forEach(x => {
                    const c = mapB.get(x);
                    if (c > 0) { inter++; mapB.set(x, c - 1); }
                });
                return (2 * inter) / (A.length + B.length);
            };

            const isMulti = question.options.some(opt => (opt.element?.type || '').toLowerCase() === 'checkbox');
            const THRESHOLD = 0.9;
            // 处理多选
            if (isMulti) {
                question.options.forEach(opt => {
                    const sims = answers.map(ans => {
                        const sim = similarity(opt.text, ans);
                        //logger.info(`[比较] 选项="${opt.text}" vs 答案="${ans}" => 相似度 ${Math.round(sim * 100)}%;
                        return sim;
                    });
                    const bestSim = Math.max(...sims);
                    atf.Logger.debug(`[结果] 选项="${opt.text}" 答案=“${answers.join('、')}” 最佳相似度 ${Math.round(bestSim * 100)}%`);
                    // 相似度超过阈值且未被选中时，点击选择
                    if (bestSim >= THRESHOLD && !opt.element.checked) {
                        opt.element.click();
                        atf.Logger.debug(`已选择选项(相似度${Math.round(bestSim * 100)}%): ${opt.text}`);
                    }
                });
            } else {
                // 处理单选
                let best = { opt: null, sim: 0 };
                question.options.forEach(opt => {
                    const sims = answers.map(ans => {
                        const sim = similarity(opt.text, ans);
                        //logger.info(`[比较] 选项="${opt.text}" vs 答案="${ans}" => 相似度 ${Math.round(sim * 100)}%;
                        return sim;
                    });
                    const sim = Math.max(...sims);
                    atf.Logger.debug(`[结果] 选项="${opt.text}" 答案=“${answers.join('、')}” 最佳相似度 ${Math.round(sim * 100)}%`);
                    if (sim > best.sim) best = { opt, sim };
                });
                // 修复逻辑冗余并统一格式
                if (best.opt && best.sim >= THRESHOLD) {
                    if (!best.opt.element.checked) {
                        best.opt.element.click();
                        atf.Logger.debug(`已选择选项(相似度${Math.round(best.sim * 100)}%): ${best.opt.text}`);
                    } else {
                        atf.Logger.debug(`选项 "${best.opt.text}" 相似度 ${Math.round(best.sim * 100)}% 超过阈值 ${THRESHOLD * 100}%，已选中`);
                    }
                } else {
                    atf.Logger.warn('未找到满足相似度阈值的选项');
                }
            }

            return true;
        }
    };

    // ========== 控制器 ==========
    function setControlBtnText(text) {
        // 在 ATF 主页面中动态更新按钮文本（如果按钮存在）
        const btn = document.getElementById(`${SCRIPT_ID}-monitor-btn`);
        if (btn) btn.textContent = text;
    }

    /**
     * 主流程控制器
     * 职责：调度监控定时器、题目解析与提交流程、页面跳转与停止策略。
     */
    const controller = {
        /**
         * 开始监控
         * 建立定时器按 `CONFIG.checkInterval` 触发主流程；更新按钮文案。
         */
        startMonitoring() {
            if (state.isStopped) state.isStopped = false;
            if (state.checkInterval) clearInterval(state.checkInterval);
            setControlBtnText('停止监控');
            state.checkInterval = setInterval(() => {
                if (!state.isProcessing && !state.isStopped) {
                    this.mainProcess();
                }
            }, Number(cfg('behavior.checkInterval') || 500));
        },

        /**
         * 停止监控
         * 清理定时器并设置停止状态；更新按钮文案。
         */
        stop() {
            if (state.isStopped) return;
            state.isStopped = true;
            if (state.checkInterval) {
                clearInterval(state.checkInterval);
                state.checkInterval = null;
            }
            setControlBtnText('开始监控');
            atf.Logger.info('停止监控');
            atf.UIManager.showNotification("停止监控", { type: "error", duration: 4000 });
        },

        /**
         * 重启监控
         * 清除停止标志并立即重新开始监控。
         */
        restart() {
            state.isStopped = false;
            setControlBtnText('停止监控');
            atf.Logger.info('手动重启监测');
            this.startMonitoring();
        },

        /**
         * 提交答案并轮询结果
         * 策略：通过 DOM 标记 `.answertrue/.answerfalse` 判断正确性；
         * 超时（最大轮询次数）则继续流程以避免卡死。
         * @param {Array} questions 当前页面题目集合
         * @returns {Promise<boolean>} 是否继续下一步流程
         */
        async submitAnswers(questions) {
            if (state.isStopped) return false;
            const submitBtn = document.querySelector('.tijiao');
            if (!submitBtn) {
                atf.Logger.warn('未找到提交按钮，尝试继续');
                return true;
            }
            atf.Logger.info('提交答案');
            submitBtn.click();

            return new Promise(resolve => {
                let checkCount = 0;
                const checkResults = () => {
                    if (state.isStopped) return resolve(false);
                    checkCount++;
                    const hasError = questions.some(q => q.container.querySelector('.empty.an.answerfalse'));
                    const hasTrue = questions.some(q => q.container.querySelector('.empty.an.answertrue'));
                    const hasResults = hasError || hasTrue;

                    if (hasResults) {
                        if (hasError) {
                            atf.Logger.error('发现错误答案，停止处理');
                            atf.UIManager.showNotification("发现错误答案，停止处理", { type: "error", duration: 4000 });
                            resolve(false);
                        } else {
                            atf.Logger.info('所有题目回答正确');
                            // 答题正确后，上传未收录的题目到题库
                            (async () => {
                                for (const q of questions) {
                                    if (q.container.querySelector('.empty.an.answertrue')) {
                                        const answer = await questionHandler.query(q);
                                        const answers = answer?.answer?.answerKey || [];
                                        if (answers.length > 0) {
                                            await uploadQuestion(q, answers);
                                        }
                                    }
                                }
                            })();
                            resolve(true);
                        }
                        return;
                    }

                    if (checkCount >= Number(cfg('behavior.maxResultChecks') || 5)) {
                        resolve(true);
                        return;
                    }
                    setTimeout(checkResults, Number(cfg('behavior.resultCheckDelay') || 500));
                };
                setTimeout(checkResults, 1000);
            });
        },

        /**
         * 查找并点击下一页按钮
         * 兼容多种选择器；遇到禁用状态立即停止以规避错误操作；
         * 连续未找到达到上限后停止。
         */
        findAndClickNext() {
            if (state.isStopped) return;
            const disabledEl = document.querySelector(
                '.next.on, .next.disabled, .next[disabled], '
                + '.next-btn.on, .next-btn.disabled, .next-btn[disabled], '
                + '.btn-next.on, .btn-next.disabled, .btn-next[disabled]'
            );
            const clickable = document.querySelector(
                '.next:not(.on):not(.disabled):not([disabled]), '
                + '.next-btn:not(.on):not(.disabled):not([disabled]), '
                + '.btn-next:not(.on):not(.disabled):not([disabled])'
            );

            if (disabledEl) {
                this.stop();
                atf.Logger.error('发现不可点击的.next元素，已停止');
                atf.UIManager.showNotification("发现不可点击的.next元素，已停止", { type: "error", duration: 4000 });
                return;
            }

            const remaining = Number(cfg('behavior.maxNotFound') || 20) - state.notFoundCount;
            if (clickable) {
                clearInterval(state.checkInterval);
                state.checkInterval = null;

                setTimeout(() => {
                    if (state.isStopped) return;
                    clickable.click();
                    state.pageChangeCount++;
                    state.notFoundCount = 0;
                    atf.Logger.info(`点击.next，页面切换计数: ${state.pageChangeCount}`);
                    setTimeout(() => { !state.isStopped && this.startMonitoring(); }, Number(cfg('behavior.pageLoadDelay') || 1000));
                }, 500);
            } else {
                state.notFoundCount++;
                if (remaining <= 0) {
                    this.stop();
                    atf.Logger.error(`连续${cfg('behavior.maxNotFound')}次未找到.next，已停止`);
                    atf.UIManager.showNotification(`连续${cfg('behavior.maxNotFound')}次未找到.next，已停止`, { type: "error", duration: 4000 });
                } else {
                    atf.Logger.debug(`未找到.next，连续${state.notFoundCount}次，剩余${remaining}次`);
                }
            }
        },

        /**
         * 核心主流程
         * 步骤：
         * 1) 定位题目容器；缺失则尝试跳转下一页。
         * 2) 滚动到底部以触发懒加载。
         * 3) 解析题目并逐题查询与选择；异常安全处理。
         * 4) 提交答案并根据结果决定是否停止或继续。
         * 边界：全程检查 `state.isStopped` 与并发标志；确保 finally 重置。
         */
        async mainProcess() {
            if (state.isStopped) return;
            state.isProcessing = true;
            try {
                //获取css为s_flzs_fbiao ContentTitle的文本
                const title = document.querySelector('.s_flzs_fbiao.ContentTitle')?.textContent?.trim() || '';
                atf.Logger.error('💡当前页面标题:', title);
                const container =
                    document.getElementById('question') ||
                    document.querySelector('.question-container') ||
                    document.querySelector('form.questions');

                if (!container) {
                    atf.Logger.info('未找到题目容器，继续查找.next');
                    state.isProcessing = false;
                    this.findAndClickNext();
                    return;
                }

                // 处理题目前滚动到底部，确保懒加载内容可见
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

                atf.Logger.info('发现题目，开始处理');
                const questions = questionHandler.extract();

                if (questions.length === 0) {
                    atf.Logger.warn('未找到题目，自动点击.next');
                    state.isProcessing = false;
                    this.findAndClickNext();
                    return;
                }

                for (const question of questions) {
                    if (state.isStopped) break;

                    // 已答对跳过
                    if (question.container.querySelector('.test.an.answertrue')) {
                        atf.Logger.info('本题已答对，跳过');
                        continue;
                    }

                    try {
                        const answer = await questionHandler.query(question);
                        const success = await questionHandler.process(question, answer);
                        if (!success) break;
                        await new Promise(r => setTimeout(r, Number(cfg('behavior.answerDelay') || 500)));
                    } catch (e) {
                        atf.Logger.error(`处理题目出错: ${e.message}`);
                        atf.UIManager.showNotification(`处理题目出错: ${e.message}`, { type: "error", duration: 4000 });
                    }
                }

                if (!state.isStopped) {
                    const submitSuccess = await this.submitAnswers(questions);
                    if (!submitSuccess) {
                        this.stop();
                        return;
                    }
                    this.findAndClickNext();
                }
            } catch (e) {
                !state.isStopped && atf.Logger.error(`处理过程出错: ${e.message}`);
            } finally {
                state.isProcessing = false;
            }
        }
    };



    // 初始化与页面变化监听（仅在法规题页）
    function main() {
        const currentUrl = location.href;
        if (/fx_regulations\.html\?objId=/.test(currentUrl)) {
            atf.Logger.info('初始化完成，可通过面板开始监控');
            if (cfg('general.autoStart')) controller.startMonitoring();
            new MutationObserver(() => {
                if (!state.isStopped && !state.checkInterval) {
                    atf.Logger.info('检测到页面变化，重启监测');
                    controller.startMonitoring();
                }
            }).observe(document.body, { childList: true, subtree: true });
        } else {
            atf.Logger.warn('当前页面非法规题页面，功能未启用');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main, { once: true });
    } else {
        main();
    }
})();