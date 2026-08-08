# Lumen Pass · 付费内容解锁平台

一个桌面优先、移动端响应式的多商户加密付费内容网站本地演示，围绕“创建内容 → 生成公开链接 → 买家支付 → 创建临时授权 → 解锁内容”的主链路设计。

## 运行

直接用浏览器打开 `index.html` 即可体验核心交互。若希望测试 PWA 离线缓存，可以在项目目录启动静态服务器：

```bash
python3 -m http.server 4173
```

## 当前版本

- 网站工作台：通过顶部网站导航进入内容、订单、数据、收款、设置五个工作区
- 四种内容模式：自动模糊图片、支付前后双图、网址 / 普通文字、付费密码文字
- 分享预览：买家未支付时只能看到模糊预览、二维码、金额与支付提示
- Mock Payment Provider：支付处理中、成功、失败、授权过期等状态可在本地演示
- 访问规则：支付后可查看、仅查看一次、2 小时有效
- 内容创建向导：设置模式、标题、金额、访问规则与创作者寄语，并生成公开链接
- 真实公开访问路由：分享链接使用当前域名的 `/p/:id`，买家可直接进入支付页
- 使用 `localStorage` 保存当前内容与本地演示订单
- 提供基础 PWA manifest 和 Service Worker
- 独立管理员后台：访问 `/admin`，支持运营总览、内容审核、用户管理、交易风控和系统设置
- 管理员演示账号：`admin@lumenpass.com` / `admin123`

## MySQL 后端

管理员后台和公开付费链路已提供 Node.js API，业务数据统一写入 MySQL：管理员、创作者、内容、图片原图与预览图、订单、访问授权、举报、平台设置和操作日志分别落在数据库表中。图片暂以 MySQL `MEDIUMBLOB` 保存，后续可以无缝替换为对象存储。

本地启动完整服务：

```bash
COMPOSE_PROJECT_NAME=lumen-pass docker-compose up --build
```

启动后访问 `http://127.0.0.1:8787/admin`。API 健康检查为 `/api/health`。数据库迁移和演示数据会在 API 容器启动时自动执行；管理员账号仍为 `admin@lumenpass.com` / `admin123`，演示创作者账号可使用 `hello@lumenpass.com` / `creator123`。

如果单独运行 API，先复制 `server/.env.example` 为 `server/.env`，再执行 `npm install`、`npm run migrate`、`npm run seed` 和 `npm start`。生产环境必须替换 `JWT_SECRET`、MySQL 密码，并通过部署环境注入 `MYSQL_*` 配置，不把密钥提交到仓库。

## 测试

服务端语法和内容交付规则测试：

```bash
cd server
npm run check
npm test
```

启动完整 Docker Compose 环境后，可执行 40 项 API 端到端回归，覆盖登录、权限隔离、内容交付、支付解锁、一次性与两小时授权、图片下载、管理员统计和异常输入：

```bash
cd server
npm run smoke
```

演示种子只补充缺失的演示数据和素材，不会在服务重启或再次部署时覆盖管理员审核状态、创作者资料、订单状态或既有内容。
