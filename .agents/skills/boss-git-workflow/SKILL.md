---
name: boss-git-workflow
description: 在本原型仓库中，当用户说“保存一下”“存一下”“上传一下”“上传本地”“发到 GitHub”“同步最新”“同步正式版”等非技术表达时，执行老板专用 Git 流程；老板只使用 develop，master 仅作为 Xiao 维护的正式 UI 来源。
metadata:
  tags: git, prototype, boss-workflow, commit, push, sync
---

# 老板原型 Git 工作流

把 Git 操作翻译成三个用户场景。用户不需要理解分支、commit、pull、push 或冲突；先说明结果，再按本文件完成底层操作。

## 固定边界

- `develop` 是老板唯一工作的原型分支。
- `master` 是 Xiao 维护的正式 UI；老板侧只读取 `origin/master`，不切换、不提交、不推送 `master`。
- “上传”只授权推送 `develop`；“保存”和“同步最新”都不授权推送。
- 同步正式版固定使用 `git fetch`、显式比较、用户选择、合并这条可观察路径。
- 绝不 force-push，不丢弃未提交修改，不自动删除预览 worktree。
- 如果远端缺少 `master` 或 `develop`，停止并说明“仓库初始化尚未完成，需要 Xiao 处理”，不自行创建远端分支。

开始任何场景前，读取仓库适用的 `AGENTS.md`（如存在），然后检查：

```powershell
git status --short --branch
git remote -v
git branch --show-current
```

工作区干净时可以切回 `develop`；存在修改且当前不是 `develop` 时停止，说明当前分支和修改文件，请 Xiao 处理。

## 场景一：保存

触发示例：`保存一下`、`存一下`、`保存当前修改`。

1. 查看 `git status --short`、`git diff --stat` 和实际 diff。
2. 排除临时文件、系统文件、密钥和与本次工作无关的修改。
3. 按一个可理解的 UI 主题提交；明显不同的页面或目的分别提交。
4. 使用简短标题和 2–5 条正文说明“改了什么、为什么”。
5. 提交后检查 `git status --short`。

没有修改时不创建空 commit，直接说“当前内容已经保存”。完成标准：本次修改已形成 commit；是否仍有未保存文件已明确说明；没有 push。

## 场景二：上传

触发示例：`上传一下`、`上传本地`、`发到 GitHub`、`让 Xiao 看一下`。

1. 如果存在未保存修改，先执行“保存”。
2. 确认当前分支是 `develop`。
3. 执行 `git fetch origin`，比较本地 `develop` 与 `origin/develop`。
4. 远端只有新提交时，用 fast-forward 更新本地；两边都有新提交时，先汇总双方变化、作者、时间和影响文件，再提供三个选择：隔离打开远端版本、合并远端版本、停止并询问 Xiao。隔离预览不改变 `develop`；只有用户选择合并后才处理分歧。
5. 执行 `git push origin develop`。
6. 检查本地与 `origin/develop` 指向同一提交。

完成标准：本次内容已提交并存在于 `origin/develop`；报告上传的主题和提交，不用 Git 行话冒充用户结果。

## 场景三：同步正式版

触发示例：`同步最新`、`同步正式版`、`把 Xiao 最新修改拿下来`。

1. 如果存在未保存修改，先执行“保存”。
2. 确认当前分支是 `develop`，执行 `git fetch origin`。
3. 先同步 `origin/develop`；若本地与远端双方都有新提交，按“上传”的分歧流程停下。
4. 比较 `develop` 与 `origin/master`。没有新变化时直接说“正式版已经是最新的”。
5. 有变化时，先给用户一份场景化摘要，再等待选择，不立即合并。

摘要必须回答：

- 具体改了什么页面、样式或交互；
- 每组修改是谁提交的、什么时候提交的；
- 会影响老板当前哪些文件或页面；
- 是否预计与当前原型发生冲突，以及冲突点是什么。

然后只提供三个选择：

1. **先打开看看**：从 `origin/master` 创建唯一命名的本地预览分支和隔离 worktree，在那里落盘并打开相关 HTML；保持当前 `develop` 不变，也不推送预览分支。
2. **合并到我的版本**：把 `origin/master` 合入 `develop`。先保存当前状态；逐项处理可确定的冲突并运行相关检查。若两边表达了互斥的 UI 决策、无法判断应保留哪边，停止合并并转入选项 3。
3. **先不动，询问 Xiao**：保持 `develop` 不变，把变化摘要和待决定的问题整理成老板可以直接转发给 Xiao 的中文。

选择 1 的完成标准：预览 worktree 路径、打开的入口页面和查看方式已给出，`develop` 未变化。

选择 2 的完成标准：合并完成、相关检查通过、`develop` 工作区状态明确；没有 push，除非用户随后明确说“上传”。

选择 3 的完成标准：没有改变 `develop`，并给出包含修改人、时间、变化、影响和问题的可转发摘要。

## 冲突处理

冲突不是一句“需要 Xiao 处理”。在改变 `develop` 前，先用提交记录和文件差异还原双方变化：

```powershell
git log --date=iso --format="%h%x09%an%x09%ad%x09%s" develop..origin/master
git diff --stat develop...origin/master
git diff --name-status develop...origin/master
```

如果一次合并尝试产生冲突，先记录冲突文件和双方意图，再把工作区恢复到合并前的干净状态。随后重新给出“先打开看看 / 合并到我的版本 / 先不动，询问 Xiao”三个选择。只有用户再次选择合并，且取舍依据明确时才解决冲突。

## 面向老板的回复

先说用户结果，随后最多补充必要证据。例如：

- `已保存：供应商库存页面的筛选和表格调整，共 1 次保存记录；尚未上传。`
- `已上传：Xiao 现在可以在 develop 看到库存页面更新。`
- `正式版有 2 组新变化：Xiao 今天修改了导航和按钮样式。它们可能影响你正在调整的页头。你可以先打开看看、合并到你的版本，或者先不动并询问 Xiao。`

只有需要 Xiao 介入时才保留 Git 细节；正常结果不向老板讲解命令执行过程。
