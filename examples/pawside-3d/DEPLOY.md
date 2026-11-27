# Pawside v2.4.0 部署

## 从 GitHub 自动部署

在 Cloudflare 控制台进入 **Workers & Pages → Create application → Pages → Connect to Git**。授权 Cloudflare 访问 `xiaohuan-M/BongoCat`，选中该仓库后填写下列设置。

| 设置 | 值 |
| --- | --- |
| 生产分支 | `feat/pawside-3d-companion` |
| 框架预设 | `None` |
| 根目录 | `examples/pawside-3d` |
| 构建命令 | `npm run build:pages` |
| 构建输出目录 | `dist` |
| 构建环境变量 | `SKIP_DEPENDENCY_INSTALL=1` |

点击 **Save and Deploy**。之后推送到生产分支时会自动触发部署。已有 Direct Upload 类型的 Pages 项目需要另建一个 Git 集成的 Pages 项目。[Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)

构建命令安装锁定版本的生产依赖，下载并校验 Electron 的 Windows x64 和 macOS Apple Silicon 运行时。它同时生成官网、`/studio/` 工作室和四个下载入口。每个下载分片最多 16 MiB，按 SHA-256 存放并支持断点续传。

从该目录运行 `npm run build:pages` 可以在本机生成相同结构的部署目录。运行 `npx wrangler pages dev ./dist` 可预览官网和下载功能。

## 直接上传已构建的 ZIP

1. 打开 Cloudflare 控制台的「Workers & Pages」。
2. 创建应用，选择 Pages 的直接上传方式（Drag and drop your files）。已有直接上传的 Pages 项目可以选择「Create a new deployment」。
3. 把 `Pawside-Cloudflare-v2.4.0.zip` 直接拖进上传区域，然后点击「Deploy site」。也可以解压后上传文件夹，确认打开文件夹就能看到 `index.html` 和 `_worker.js`。
4. 打开控制台给出的 `*.pages.dev` 网址。首页可直接试玩，`/studio/` 是完整工作室。

压缩包已构建好，控制台无需填写构建命令或安装依赖。四个下载入口随包提供。Windows 和 macOS 安装包各拆成若干 16 MiB 的静态资源，由 Pages 在下载时按原顺序流式送出。浏览器会下载到一个完整 ZIP，支持断点续传。部署不需要 R2、数据库或额外密钥。

控制台步骤与文件限制见 [Cloudflare Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)。

## 命令行

把压缩包解到一个空目录，比如 `dist`。在它的上一级执行：

```sh
npx wrangler pages dev ./dist
npx wrangler pages deploy ./dist --project-name pawside
```

把 `pawside` 换成自己的 Pages 项目名。首次使用 CLI 按提示登录 Cloudflare。部署整个 `dist`，其中包含下载处理脚本和所有分片。

## 以后从源码打包

保留任一已发布版本中的 `Pawside-Windows-x64.zip` 与 `Pawside-macOS-Apple-Silicon.zip`，作为 Windows 和 Mac 的运行时底包。在 Pawside 源码根目录执行：

```sh
python3 tools/package-cloudflare.py --runtimes ./previous-releases --out ./release-v2.4.0
```

脚本保留两端运行时，更新其中的 Pawside 实现和版本信息，再生成 `dist`、Pages 压缩包、离线工作室、原始下载包与校验和。省略 `--runtimes` 时从锁定的上游运行时构建。官网源码在 `site/`，网站与桌面共用的工作室和渲染代码在 `web/`。
