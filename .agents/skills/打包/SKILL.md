---
name: 打包
description: 在本原型仓库中，当用户说“打包”“打个包”“导出 zip”“发给别人”等，要把某个原型目录打成 zip 时使用；先确定目录，再自动排除 node_modules、.git、系统垃圾文件，输出 zip 的绝对路径。Windows 和 macOS 通用。
---

# 打包

## 1. 确定目录

- 用户点名了目录（如“打包 HR”），就在仓库里找对应目录（如 `kaispan/hr`）。
- 没说清楚时，列出仓库里的原型目录（`kaispan/*`、`fujigawa` 等顶层目录）请用户选一个，选定后再继续。
- 找到多个可能的目录时同样先问，不要猜。

## 2. 打包

在仓库根目录执行（macOS 用 `python3`，Windows 上没有 `python3` 时用 `python`）：

```bash
python3 .agents/skills/打包/scripts/pack.py <目录>
```

脚本会自动排除：`.git`、`node_modules`、`__MACOSX`、`dist`、构建/测试缓存目录，`.DS_Store`、`Thumbs.db`、`._*` 等系统文件，以及日志。zip 默认放在仓库根目录的 `dist/`（已被 git 忽略），文件名带时间。

## 3. 回复

用一两句话告诉用户：打包了哪个目录、多少文件、多大，然后单独一行给出脚本最后打印的 **zip 绝对路径**。收到包的人需要先运行 `pnpm install` 才能启动（如果目录里有 `package.json`）。
