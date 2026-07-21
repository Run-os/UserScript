# 项目长期笔记：UserScript 油猴脚本仓库

## 目录组织约定（用户明确偏好）
- **按用途分层**：顶层 `工作/` `考试/` `工具/`。**不要**按状态分层（scripts 在用 / archived 失效）。失效脚本按其用途归入对应目录，状态在 README 标注，不单独归档。
- 脚本命名规范：统一 `.user.js`；文件名尽量与 `@name` 保持一致。
- 仓库根无 `.gitignore`，`.workbuddy/` 不应入库，应忽略。

## 操作坑（Windows + 中文路径 git）
- `git mv` 在「已暂存的中文重命名 + Windows」下易报 `No such file or directory`，或残留同名未跟踪副本（Unicode 规范化 NFC/NFD 不一致）。稳妥流程：`git reset -q`（不动工作区）→ bash `mv` 移动 → `git add -u`（保留 R 历史、避免旧结构文件被「复活」回仓库）。
- 用 `git show HEAD:旧路径` 可从对象库恢复误删 / 丢失文件（即使工作区已无）。
- `git add -u` 会顺带暂存所有「本地已删未提交」的旧文件（D）；若只想暂存本次改动，需事后 `git restore --staged <path>` 取消。

## 已知文件
- 失效/旧版：`考试/学法网-全能题库版.user.js`（@name「湖南学法网12348自动答题--全能题库版」），已被「自建题库版」取代，仅供存档。
- 配套文档：`考试/自建题库API文档.md`。
