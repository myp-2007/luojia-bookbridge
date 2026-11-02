# API

FastAPI + SQLAlchemy + Alembic。使用本机完整演示时从仓库根目录执行 `./infra/start-demo.ps1 -Setup`。单独开发可在本目录创建 .venv 并安装 requirements.txt，配置数据库后运行 `python -m alembic upgrade head`、`python -m app.demo_seed` 和 `python -m uvicorn app.main:app --reload`。

API 文档在 `/docs`，共享合同位于 `docs/api/openapi.yaml`，本轮接口语义补充见 `docs/api/LOCAL_DEMO_CONTRACT.md`。Cookie 会话为默认身份来源。`ALLOW_LEGACY_HEADERS=false` 禁止开发身份请求头。`ALLOW_DEV_AUTH` 控制开发演示登录，production 环境禁用演示账号入口。

运行 `.venv/Scripts/python.exe -m pytest -q`。测试默认使用独立 test_bookbridge.db，不连接演示库。包含会话、权限、交易状态机、SQLite并发、图片、审计与备份恢复测试。

本机演示SQLite事务使用BEGIN IMMEDIATE串行化，PostgreSQL仍通过行锁和有效预约唯一键保证一致性。预约过期在读取列表和创建预约时按需清理，未来可在独立定时任务中复用expire_pending。
