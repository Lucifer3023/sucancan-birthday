# 小苏的星河生日网页

纯静态 WebGL 生日网页：银河、粒子地球、河南、生日蛋糕、烟花和随机爱心祝福。

## GitHub Pages

在 Settings → Pages 中选择 Deploy from a branch，分支 main，目录 /(root)。

网页入口为 index.html；.nojekyll 保证按静态文件发布。所有脚本、图片和地理数据均在仓库内，无需 ChatGPT 登录，也没有本机地址依赖。

支持手机和电脑，需要浏览器支持 WebGL。直接双击多文件 HTML 可能受浏览器本地读取限制，请使用 Pages 的 HTTPS 地址。

后续可在 GitHub Pages 或 Cloudflare 中配置自己的域名；当前未添加 CNAME，避免在域名解析完成前重定向到未配置的网站。

Three.js 许可和图片来源说明保留在 vendor/ 与 assets/。
