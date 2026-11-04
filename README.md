# 珞珈书桥 · Luojia BookBridge

校园二手书交易与线下交接平台。当前交付面向小型比赛本机演示，四个学生账号和一个管理员账号可分别在不同浏览器或设备使用。

## 本机演示

需要已安装 Python 3.12+、Node.js 和 npm。在仓库根目录打开 PowerShell，首次运行

```powershell
./infra/start-demo.ps1 -Setup
```

以后运行

```powershell
./infra/start-demo.ps1
```

浏览器打开 <http://localhost:8000>。点击“我的”选择演示账号。小珞拥有初始化的教材，小桥、小书、小林可以预约，演示管理员处理反馈。每台设备或不同浏览器使用各自的 Cookie 会话，刷新页面会保留登录。

启动脚本构建网页、执行 Alembic 迁移、幂等初始化数据，并在同一端口启动网页和 API。默认演示使用独立的 `apps/api/demo_bookbridge.db` SQLite 文件和 `storage/demo-uploads`。重启前备份保存在 `apps/api/backups`。PostgreSQL 配置仍在 `infra/docker-compose.yml` 中，本机少量演示可先使用 SQLite。

其他设备连接同一个可互访的 Wi-Fi，访问 `http://电脑的局域网IP:8000`。需提前实测校园网络是否隔离设备、Windows 是否允许访问该端口。现场也可以使用同一电脑的不同浏览器或独立浏览器配置演示。按 Ctrl+C 停止服务，数据保留。

完整操作与恢复步骤见 [本机演示指南](docs/LOCAL_DEMO.md)。任务分工见 [开发交接](docs/DEVELOPMENT_STATUS.md)。

## 当前能力

- 演示账号登录、8小时会话、退出、个人昵称和自愿提供的联系方式。
- 书籍发布、书名/作者/出版社搜索、分类、详情、图片上传与封面展示。
- 我的发布、编辑、上下架，预约中和已完成书籍禁止编辑。
- 买卖双方预约管理、接受/拒绝、取消、24小时待接受预约过期清理。
- 书架与业务列表每5秒自动同步其他参与者的操作，断线保留数据并自动重试。
- 线下交接二次确认、双方完成、幂等确认、争议冻结与管理员核实处理。
- 预约接受后向交易对方展示主动设置的联系方式。
- 反馈记录、举报处理和后台审计日志接口。
- 本机启动、演示数据、数据库迁移和本地备份。

AI已具备持久化任务、状态轮询、超时恢复和人工确认保存，以及可配置的OpenAI兼容视觉接口适配器。默认模拟模式仅回显已有资料。真实服务需要配置模型与Key并完成实图验收，学校认证需要接入资源。地图路线、正式公益捐赠审核和课程语义推荐仍为后续任务，免费赠书分类可通过当前书籍预约流程演示。

## 开发与测试

```powershell
cd apps/api
.venv/Scripts/python.exe -m pytest -q
cd ../web
npm ci
npm run build
npm run lint
npm run test:e2e
```

浏览器测试使用本机 Microsoft Edge，启动独立 FastAPI/SQLite 测试实例与 Vite，通过真实 HTTP 验证用户操作。测试数据库和上传目录位于临时目录，不使用演示数据。Playwright 启动命令当前按 Windows 路径配置。

前端单独开发时运行 `npm run dev`，Vite 代理 `/api` 和 `/storage` 到本机8000端口。`VITE_API_BASE_URL` 默认 `/api/v1`，`VITE_USE_API=false` 可显式切到离线界面预览。

技术基线为 React + TypeScript + Vite、FastAPI + SQLAlchemy + Alembic、PostgreSQL，采用模块化单体架构。首版在线下付款和交接。

开始修改前请阅读 [AGENTS.md](AGENTS.md)、[CONTRIBUTING.md](CONTRIBUTING.md) 和 [技术架构方案](珞珈书桥技术架构方案.md)。
