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


## 书架筛选和排序

`GET /api/v1/books?q=高等数学&max_price_cents=3000&has_notes=true&available_only=true&sort=price_asc&page=1&page_size=12` 为公开查询。新增可选条件 `min_price_cents`、`max_price_cents`、`condition`、`has_notes`、`available_only` 和 `sort`。价格以整数分表示。默认 `relevance` 有关键词时按匹配度，无关键词时按最新发布。排序也可选 `newest`、`price_asc`、`price_desc`。成功返回 `items/page/pageSize/total`，价格倒置返回400，参数格式错误返回422。无需迁移。

## 图片管理与书籍审核（2026-11-08）

以下均以 `/api/v1` 为前缀。先定合同，再实现前后端；新增迁移 `a82d61b904e3`，仅增加字段，不删除历史数据。

| 方法 | 路径 | 权限与请求 | 成功响应 |
| --- | --- | --- | --- |
| DELETE | /books/{book_id}/images/{image_id} | 发布者，可编辑状态，非管理限制中；无请求体 | 204，无响应体；删除封面后下一张成为封面 |
| POST | /books/{book_id}/images/{image_id}/cover | 同上；无请求体 | 200，按封面在前排列的 BookImageRead 数组 |
| GET | /admin/books | 管理员；q（书名/作者/发布者，最长100），suspended（可选布尔），page/page_size | BookListResponse，含所有状态，稳定按最新与ID排序 |
| POST | /admin/books/{book_id}/moderation | 管理员；`{suspended: boolean, reason: string}`，说明1至500字且不能全空格 | BookRead；限制/解除均写审计日志 |
| GET | /admin/audit-logs | 管理员；page/page_size（默认20，最多100） | items/page/pageSize/total，按时间与ID倒序 |

BookRead 增加 `isSuspended: boolean` 和 `moderationReason: string | null`。管理员限制后，书籍从公开搜索隐藏，禁止重新发布、编辑、图片增删和新预约；详情保留限制提示以便已有交易核实。可编辑书籍转为offline；reserved/completed原状态和历史保留，既有交易仍可继续交接或争议。受限预约被取消、拒绝、到期或管理员取消争议时，书籍回offline，避免自动恢复在售。解除限制后不自动重新发布，卖家自行确认后上架；有进行中交易的状态仍保留。reason不含私密信息，只填写可向发布者展示的处理原因。

BookImage增加内部sort_order整数字段，旧图默认0，按sort_order/created_at/id稳定排序。上传顺序追加；设封面只改变排序；删除图片先提交数据库再清理本机文件（失败记服务器日志，可能残留孤立文件）。图片编辑与AI任务创建使用同一书籍锁；90秒内queued/running任务期间拒绝删除/更换封面，避免模型读取期间删除源文件，过期任务不阻塞操作。

成功示例：`POST /admin/books/{id}/moderation {"suspended":true,"reason":"图片与书籍描述不符，核实后可解除"}` 返回 `{"id":"...","status":"offline","isSuspended":true,"moderationReason":"图片与书籍描述不符，核实后可解除", ...}`。`POST /books/{id}/images/{imageId}/cover` 返回 `[{"id":"imageId","bookId":"...","url":"/storage/...", ...}]`。

失败示例：未登录401，普通同学访问管理接口403，跨书籍图片ID返回404，预约中修改图片/受限书籍编辑/AI任务未结束返回409：`{"code":"HTTP_409","message":"识别任务进行中，请稍后管理图片","details":{},"requestId":"...","detail":"识别任务进行中，请稍后管理图片"}`。重复删除返回404；重复限制为幂等状态设置，但仍记录提交的处理说明。请求完成后客户端重新读取列表，不在失败时假定操作成功。

免费赠书校验：创建或完整编辑时category=donation要求有效priceCents为0（优先于兼容price），否则422。前端选择免费赠书时自动将金额设为0；后续仍复用预约、线下交接与双方确认状态机。上传图片也使用同一AI活跃任务检查，冲突返回409。

AI新建任务仅在草稿/在售/下架且非管理限制时允许，预约中或完成状态返回409，防止生成无法保存的候选；界面对应隐藏不可编辑状态的识别按钮。

时间统一按UTC存储和带时区的ISO 8601输出（Z或+00:00），浏览器再按本地时区展示。proposedTime输入带偏移时先转换UTC，兼容无偏移的旧请求按UTC解释。SQLite已有服务端时间按UTC补齐时区，无需迁移。旧版本若曾传入非UTC偏移并保存的proposedTime已丢失偏移，无法自动推断原时区；当前本机旧库没有预约记录。
