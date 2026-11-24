# KuroCat 经典分支

本分支固定使用 qianyiai/kurocat 的完整项目。上游源码、皮肤、素材、桌面菜单和原生窗口都在 `upstream/`，由 Git 子模块锁定提交。经典 Canvas 画面与键鼠动作直接调用该版本的 KuroCatEngine 和小黑猫配置。

从仓库根目录运行：

```sh
git submodule update --init --recursive
cd examples/kurocat-classic
npm ci
npm run build
```

双击生成的 `KuroCat-Classic.html`。在页面内打字、握鼠、滚轮或揉额头；隐私试打框只向引擎传入焦点状态，移开焦点会清空该框。标签页隐藏会暂停绘制，失焦会释放按住的键和鼠标按钮。单文件内包含所需资源，无需连接网络。

桌面版从 `upstream/` 按其 README 的平台步骤构建或安装，并可在上游的菜单切换渲染模式。浏览器预览使用经典二维模式，接收本页事件。

上游项目与许可证见 [qianyiai/kurocat](https://github.com/qianyiai/kurocat) 和 [MIT](upstream/LICENSE)。离线 HTML 同时包含引擎与嵌入素材的版权说明。
