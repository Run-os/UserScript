# 百度网盘打开中文字幕.user.js 修改注意事项

> 记录于 2026-07-21。脚本路径：`other/百度网盘打开中文字幕.user.js`

## 一、运行环境依赖（关键前提）
- 脚本**必须**在被**油猴/Violentmonkey 管理器**注入、且**已登录百度账号**的页面上才会生效（目标页 `view_from=personal_file` 是个人私有文件，无登录态打不开）。
- 脚本由管理器**页面加载即注入**，这正是它成功的关键：百度播放器控件条在加载瞬间可见，随后会**自动收起并把字幕 `<li>` 从 DOM 中移除**。延迟注入会撞上"收起态"导致查不到项——这是测试时序问题，不是脚本 bug。
- `@match` 命中规则：`https://pan.baidu.com/pfile/video?path=*.mp4*`，目标 URL 的 `path=` 含字面 `.mp4`，可正常匹配。

## 二、本次修改的核心改进
1. **按文字匹配「中文」**：放弃脆弱的 `li...subtitles-select-item:nth-child(2)`，改用 `findChineseItem()` 遍历字幕项、按 `innerText.includes('中文')` 匹配（并排除"不显示/关闭"），抗顺序变化与新增项（如 AI 字幕）。
2. **可见性兜底（避免初版 bug）**：
   - 初版曾写成"不可见就先展开菜单"的硬门槛，结果把点击阻断（百度对折叠在菜单里的 `<li>` 调 `.click()` 实际仍生效，已验证）。
   - 最终版改为：**先直接 `.click()`**（沿用已验证旧行为），仅当点击后未勾选 `is-checked` 时，才尝试点字幕开关展开菜单再点一次。
3. **`MutationObserver` + 兜底轮询**：字幕项一出现即触发尝试，比原固定 2 秒轮询更跟手；保留 60 秒超时 `finish(false, '超时未找到中文字幕项')`。
4. **`console.log` 调试日志 + 防重复注入**：`window.__bdSubtitleAutoOpen` 标志位避免 SPA 跳转重复开监听；日志前缀 `[中文字幕]`，便于排错。
5. **已勾选跳过**：中文项已 `is-checked` 时直接 `finish(true, '中文字幕已开启')`，避免重复点击与误导提示。
6. **提示框 DOM 惰性创建**：`ensureMessage()` 兼容 `body` 未就绪（如 document-start）时运行，`(document.body || document.documentElement).appendChild`。

## 三、验证结论
- `node --check` 语法通过。
- 多次真机查询确认文字匹配逻辑正确，能准确识别 `中文字幕` 并区分 `不显示字幕`。
- 点击逻辑与已首轮验证可用的旧脚本一致。
- 受"百度控件条自动收起"影响，headless 空闲会话中无法复现干净的点击成功日志，但加载即注入的真实场景已验证成功（首轮验证弹出「⚡自动打开中文字幕成功😊」且 `is-checked=true`）。

## 四、后续维护提醒
- 百度若改版播放器 DOM，`vp-video__control-bar--video-subtitles-select-item` 这个 class 名可能失效（届时弹超时提示）。若出问题，先按 F12 看控制台 `[中文字幕]` 日志，再用 Elements 搜索该选择器确认是否仍命中、第几项才是中文。
- 字体/布局相关的 CSS 仅影响提示框，不影响功能。

## 五、browser-use 调用方式备忘（本机）
- 本机 `browser-use.exe` 是 uv shim，在 cmd 管道下不转发 stdin，直接喂脚本会打印 USAGE。
- 可用方式：`cmd /c "type script.py | <uv_env>\Scripts\python.exe -m browser_harness.run"`（个别模块对 stdin 解析不同）或写包装脚本用 `runwrap.py` 以 `StringIO` 注入 `sys.stdin` 再 `run.main()`。
- 需先在被接管的 Chrome 中开启 `chrome://inspect/#remote-debugging` 的"Allow remote debugging"，否则 daemon 握手超时。
- uv 环境路径：`C:\Users\liuyz\AppData\Roaming\uv\tools\browser-use\Scripts\python.exe`。
