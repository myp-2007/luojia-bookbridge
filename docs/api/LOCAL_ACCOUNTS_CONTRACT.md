# 本机真实账户与页面改造合同（2026-11-09）

用户方向：真实注册、密码登录、独立页面与本机持久化。不在普通登录页展示演示账号；学校认证不接入，也不显示虚假已认证标识。现有数据保留。以下先定合同再实现，URL前缀/api/v1，JSON camelCase，错误code/message/details/requestId。

| 方法与路径 | 权限/输入 | 输出与失败 |
| --- | --- | --- |
| POST /auth/register | 公开；username 3-32位ASCII字母数字_.-，统一小写；password 8-128字符；nickname 1-80字默认小珞 | 201 UserRead并设置8小时HttpOnly Cookie；重复账号409，输入422 |
| POST /auth/login | 公开；username/password | 200 UserRead+Cookie；错误统一401，来源IP20次失败/15分钟后429 |
| POST /auth/logout | 任意 | 撤销当前会话 |
| POST /auth/password | 已登录；currentPassword/newPassword | 204，核验旧密码后修改，撤销全部会话；旧密码错误400 |
| GET /me | 登录 | UserRead，含id/username/nickname/role/college/contact/gender/bio/avatarUrl；无密码摘要 |
| PATCH /me | 登录；可选nickname/college/contact/gender/bio | UserRead；gender为undisclosed/male/female/other，bio最长500字，contact仅自己与获准交易对方可读 |
| POST /me/avatar | 登录；multipart file，2MB以内JPEG/PNG/WebP，内容校验 | UserRead；仅修改自己，头像重编码为最长512px JPEG并清除元信息；错误400 |
| DELETE /me/avatar | 登录 | 204，清除当前头像 |
| GET /me/stats | 登录 | published/reservations/completed/gifts整数，基于真实书籍与预约 |
| GET /users/{user_id} | 公开 | id/nickname/college/bio/avatarUrl，无账号、联系方式或性别 |
| GET /users/{user_id}/books | 公开；page/page_size | BookListResponse，仅在售/预约中且不受限制 |
| GET /me/favorites | 登录；page/page_size | BookListResponse，保留不可预约状态提示 |
| POST /books/{book_id}/favorite | 登录 | 204，幂等收藏 |
| DELETE /books/{book_id}/favorite | 登录 | 204，幂等取消 |

BookCreate/BookRead增加可选isbn（10或13位，输入去空格与连字符），BookRead增加isFavorite和sellerActive。真实运行中没有密码的旧版发布账号不可接受新交易，sellerActive=false，预约返回409；旧书籍和历史仍保留可浏览，管理员可正常下架。GET/books增加缩写兼容（高数/线代/大物/概统），书名作者出版社版本ISBN组合检索；C语言中空格不影响命中，保留已有筛选排序分页。搜索输入提交后进入独立URL，刷新/返回保留查询。

迁移b39e72ad05c4：users新增username唯一可空、password_hash、gender/bio/avatar_path/created_at；新增auth_throttles与book_favorites；books新增isbn。不删除旧数据和旧迁移。密码采用随机盐scrypt（N=32768,r=8,p=3）单向摘要。首次通过本机loopback注册、且尚无真实管理员时成为本机管理员，远程注册始终普通用户，请求不能指定role。演示账户旧会话在真实运行模式下失效；开发测试显式开启时仍兼容旧接口。

成功示例POST/auth/register {"username":"luojia","password":"<user-chosen-password>","nickname":"小珞"} -> 201 {"id":"...","username":"luojia","nickname":"小珞","role":"admin","college":"","contact":null,"gender":"undisclosed","bio":"","avatarUrl":null}。失败POST/auth/login错误凭据 -> 401 {"code":"HTTP_401","message":"账号或密码不正确","details":{},"requestId":"...","detail":"账号或密码不正确"}。PATCH/me {"bio":"喜欢数学与旧书","gender":"female"} -> 200更新后的资料。收藏不存在的书返回404，未登录写入401。

前端所有业务页面使用浏览器路径及历史记录，主导航为首页/发现/发布/记录/我的；登录后回到原操作页面。主要业务不再用遮罩弹窗，图片管理/AI/反馈/管理员同样有独立路由。静态服务对已知页面导航回退index.html，API和图片不存在时仍404。

正常启动入口start.cmd与infra/start-local.ps1（旧start-demo.ps1兼容转发），默认禁用演示登录、不初始化五个账号、不自动追加样例。继续使用现有本机数据库和图片路径避免丢数据。可选-SampleBooks仅显式导入带来源的样例，普通注册和发布均为真实记录。不新增云服务/数据库服务或收费依赖。

密码摘要参数参考[OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)。学校认证暂缓；正常运行不开放旧版身份请求头。
