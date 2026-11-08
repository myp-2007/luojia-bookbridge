# 珞珈书桥 · Luojia BookBridge

一个可以在个人电脑上运行的校园二手书网站。支持真实注册和密码登录、搜索、发布、个人资料与头像、收藏、预约及双方交接确认。网页、API、数据库和图片都由你的电脑提供，不要求购买云服务器。

## 打开网站

Windows直接双击仓库根目录的 **start.cmd**。首次缺少工程依赖时自动安装（电脑需先安装Python 3.12+、Node.js及npm），之后构建网页、备份旧数据、执行数据库升级，再启动服务。保持窗口打开，浏览器访问 **http://localhost:8000**。

也可以在PowerShell运行：

```powershell
./infra/start-local.ps1
# 如需重装依赖：
./infra/start-local.ps1 -Setup
# 修改端口：
./infra/start-local.ps1 -Port 8080
```

先点“立即注册”，设置自己的账号和密码。登录页只有普通账号密码表单，不再提供五个演示账号。首次从主机localhost注册且尚无真实管理员的账号成为本机管理员，其他注册账号为普通用户；无默认通用密码。学校认证暂未接入，不显示假认证标识。

其他设备连接同一可互访局域网，打开启动窗口列出的主机IP地址。主机需保持运行。不同设备、不同浏览器或浏览器配置使用独立账号；普通标签页共享当前登录。Ctrl+C停止服务，重新启动后保留账户、书籍、头像和交易。

## 已实现

- 首页、发现、发布、记录、个人中心、详情、设置均为独立页面，支持网址直达、刷新和返回。
- 注册、密码登录、8小时HttpOnly会话、退出、改密并撤销全部会话；登录失败限流；随机盐scrypt密码摘要。
- 个人头像上传、性别、院系、简介、私密联系方式；个人发布、收藏和真实统计。
- 书名、作者、出版社、版本、ISBN检索；支持“高数”“线代”等简称；价格/品相/笔记筛选、排序、分页。
- 发布最多3张照片、完整资料编辑、上下架、相册、删除图片与设封面。
- 预约、接受/拒绝、取消、双方交接确认、争议、举报和管理员审核及审计。
- 免费赠书强制零元；书架和交易记录5秒同步；断线保留已读取内容并重试。
- 真实图片识别任务与人工确认保存。现有本机AI配置保留，新环境未配置时手动录入，不回显假识别结果。

旧样例书籍和历史数据保留；没有启用真实密码的旧账号不能接收新预约。真实交易应使用注册账号发布的书籍。普通启动不再初始化演示账号或自动追加样例。可选 `-SampleBooks` 仅显式导入带来源的浏览样例。

## 数据和资源

为兼容旧数据，继续使用 `apps/api/demo_bookbridge.db` 和 `apps/api/storage/demo-uploads`（包含书籍图片与头像）。这些历史文件名不表示模拟数据。启动前备份位于 `apps/api/backups`，以上数据及本机.env均不进入Git。

React + TypeScript + Vite，FastAPI + SQLAlchemy + Alembic，模块化单体。本机默认SQLite；PostgreSQL保留为可选开发路径。无Redis、微服务或额外付费存储。账号与资料接口合同见[真实账户合同](docs/api/LOCAL_ACCOUNTS_CONTRACT.md)，完整合同见[OpenAPI](docs/api/openapi.yaml)。

[使用与恢复指南](docs/LOCAL_USAGE.md) · [验收清单](docs/ACCEPTANCE.md) · [开发状态](docs/DEVELOPMENT_STATUS.md) · [素材来源](apps/web/src/assets/SOURCES.md)

## 开发检查

```powershell
cd apps/api
./.venv/Scripts/python.exe -m pytest -q
cd ../web
npm.cmd run build
npm.cmd run lint
npm.cmd run test:e2e
```

浏览器测试使用Microsoft Edge、独立临时SQLite与上传目录。通过真实注册和密码登录操作网页，测试不修改实际站点数据、不调用付费AI。单独前端开发可使用 `npm.cmd run dev`，代理/API与图片到本机8000端口；已移除离线Mock网页模式。

开始修改前请读[AGENTS.md](AGENTS.md)、[CONTRIBUTING.md](CONTRIBUTING.md)和[技术架构方案](珞珈书桥技术架构方案.md)。
