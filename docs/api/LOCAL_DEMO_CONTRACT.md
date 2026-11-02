# 本机比赛演示接口增量合同

本轮由 AI 维护者实现前后端和本机演示集成，原接口保持兼容。金额新增 priceCents（整数分），旧 price（元）继续返回。错误新增 code/message/details/requestId，并保留旧 detail。所有认证写操作使用 HttpOnly 会话 Cookie。测试身份请求头仅在显式 ALLOW_LEGACY_HEADERS=true 的开发测试中兼容。

| 方法 | 路径（前缀 /api/v1） | 权限 | 成功行为 |
| --- | --- | --- | --- |
| GET | /auth/demo-accounts | 开发演示开启 | 返回已初始化的演示账号 |
| POST | /auth/dev-login | 开发演示开启 | userId -> 设置8小时会话Cookie并返回用户 |
| POST | /auth/logout | 任意 | 撤销会话并清理Cookie |
| GET | /me | 已登录 | id/nickname/role/college/contact |
| PATCH | /me | 已登录 | 更新nickname/contact，每项最长80/200字 |
| GET | /books/mine | 已登录 | items/page/pageSize/total |
| PATCH | /books/{id} | 发布者 | 更新书籍完整表单，仅在在售/草稿/下架时允许 |
| POST | /books/{id}/offline | 发布者 | 可编辑状态改为offline，保留历史 |
| POST | /books/{id}/publish | 发布者 | draft/offline -> available |
| POST | /reservations/{id}/dispute | 交易参与者 | confirmed -> disputed，冻结书籍占用 |
| GET | /reservations/{id}/contact | 交易参与者 | confirmed/completed/disputed时返回对方主动设置的contact |
| GET | /pickup-points | 公开 | items/page/pageSize/total |

预约新增bookTitle/sellerId，确认操作幂等但始终先验证对应参与者。24小时到期只适用于pending，卖家接受后expiresAt置空。一方确认交接后禁止取消，需要争议处理。争议入口同时创建关联举报。管理员通过该举报处理接口提交outcome（complete/cancel）解决争议，写audit_logs。争议的取消释放书籍，完成同时记录双方确认时间和完成时间。

示例成功 `POST /auth/dev-login {"userId":"demo-buyer"}` 返回 `{"id":"demo-buyer","nickname":"小桥","role":"student","college":"演示学院","contact":null}`。失败未登录返回401 `{"code":"HTTP_401","message":"请先登录","details":{},"requestId":"...","detail":"请先登录"}`。普通用户处理举报返回403。编辑预约中书籍返回409。

数据库通过新的Alembic迁移增加users、user_sessions、audit_logs，旧书籍和预约记录保留。退出/过期会话不能继续操作。演示登录只在development/test和ALLOW_DEV_AUTH=true可用。

AI目前仍为模拟候选，明确标注回显用户已有数据，不宣称读取了图片。外部模型和学校SSO待资源接入。本机提供按需预约过期清理，适配小规模演示，无独立任务进程。

BookRead额外返回coverUrl（相对/storage路径或null），列表和详情可直接显示首张封面。图片类型按内容与MIME共同校验，每本最多三张。

AI任务新增 POST /books/{bookId}/ai-tasks（202，发布者权限）、GET /books/{bookId}/ai-tasks/{taskId}（任务创建者权限），返回id/bookId/status/result/error/createdAt/finishedAt。result为title/author/publisher/edition的value/confidence字段、warnings数组和provider。重复提交会复用尚在运行的任务，查询时清理90秒超时任务。失败示例为status=failed，error包含可公开提示，不回传模型原始异常或Key。用户确认后通过已有PATCH /books/{id}保存候选。新增迁移f7c924a6de10创建ai_tasks。
