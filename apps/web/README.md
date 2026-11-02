# Web

React + TypeScript + Vite。默认连接相对 `/api/v1`，Vite代理到本机8000，完整本机演示由FastAPI同端口托管dist。使用当前登录用户的Cookie会话，买入/卖出面板属于同一个用户。离线预览可以显式设置VITE_USE_API=false。

```powershell
npm ci
npm run dev
npm run build
npm run lint
npm run test:e2e
```

浏览器测试使用本机Edge，启动独立FastAPI/临时SQLite实例和Vite，验证真实HTTP发布、预约、跨浏览器双确认、资料、错误重试、管理员处理、编辑上下架及图片上传。测试使用端口8001和5174，结果和截图在忽略的test-results目录。Windows测试启动命令依赖apps/api/.venv。完整多人演示见docs/LOCAL_DEMO.md。
