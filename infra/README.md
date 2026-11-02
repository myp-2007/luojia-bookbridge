# Infrastructure

本机演示入口为 `./infra/start-demo.ps1 -Setup`，以后使用 `./infra/start-demo.ps1`。它构建前端并由 FastAPI 提供网页与 API，默认使用独立 SQLite 演示库，启动前备份，执行迁移并幂等初始化虚构数据。详细步骤与恢复方式见 [本机演示指南](../docs/LOCAL_DEMO.md)。

`docker-compose.yml` 保留 PostgreSQL + API 的开发演示路径。运行 `docker compose -f infra/docker-compose.yml up --build` 后单独启动 Vite 前端。真实 PostgreSQL、Caddy/HTTPS 和生产部署需后续验收。当前演示登录适用于虚构数据的受控本地环境。
