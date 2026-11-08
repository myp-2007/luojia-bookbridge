# 本机运行

双击根目录start.cmd或运行 `./infra/start-local.ps1`。脚本自动检查依赖、构建前端、备份并升级现有SQLite、初始化公共交接点，然后在同一端口提供网页、API和图片。默认关闭演示登录，不创建五个固定账户，不自动追加样例。新用户自行注册密码账户。

参数：-Setup重新安装依赖，-Port 8080修改端口，-SampleBooks仅显式导入不可交易的历史浏览样例。start-demo.ps1仅为兼容转发。数据沿用原路径避免丢失，详见[使用指南](../docs/LOCAL_USAGE.md)。

PostgreSQL的docker-compose.yml保留为历史开发配置，当前用户使用路径不依赖Docker、Caddy或云服务。真实PostgreSQL并发、恢复及外网HTTPS需单独验收，不能把本机SQLite结果当作已验证。
