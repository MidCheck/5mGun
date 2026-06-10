# 运行指南

## 环境要求
- Node.js ≥ 20（开发用 25 验证通过）
- npm ≥ 10

## 安装
```bash
npm install
```
> monorepo（npm workspaces）：一次安装 `shared` / `server` / `client` 三个包。

## 开发模式（同时启动前后端）
```bash
npm run dev
```
- 服务器：`ws://localhost:2567`（Colyseus 权威服务器）
- 客户端：`http://localhost:5173`（Vite）

浏览器打开 **http://localhost:5173** 即可：
1. 输入昵称（或留空用随机名）
2. 选 **PvP 团队歼灭** 或 **PvE 刷丧尸**
3. 点 **单人快速开打**（PvP 自动人机补位 / PvE 按 1 人难度起）
4. 或 **创建房间** 拿到房间码，发给好友点 **加入** 联机

## 只启动其中一个
```bash
npm run dev:server   # 仅服务器
npm run dev:client   # 仅客户端（需服务器已起）
```

## 生产构建
```bash
npm run build        # 构建 client 静态产物到 client/dist
npm run start        # 启动服务器（生产）
```
- 客户端静态文件（`client/dist`）部署到 CDN / 静态托管。
- 服务器进程部署到云主机，前面用 Nginx 反代 + WSS。
- 生产环境把客户端连接地址（`client/src/net.ts` 中的 host/port）改为你的服务器域名。

## 操作

**PC（键鼠）**
| 操作 | 键 |
|---|---|
| 移动 | W A S D |
| 视角 | 鼠标（点画面锁定指针） |
| 开火 | 鼠标左键 |
| 瞄准 | 鼠标右键 |
| 换弹 | R |
| 换枪 | Q |
| 疾跑 | Shift |
| 跳 / 蹲 | 空格 / Ctrl |
| 互动·扶人(PvE) | F |
| 升级商店(PvE) | B |

**移动端**：左下虚拟摇杆移动，右屏滑动转视角，右下按钮开火/换弹/跳/瞄准/换枪。

## 已知占位 / 后续替换
- **美术/音效目前为程序化占位**（几何体 + WebAudio 合成枪声），无需下载素材即可跑。
  正式上线前按 [docs/04-assets.md](docs/04-assets.md) 替换为 CC/原创素材。
- 数值在 `shared/src/config/` 下（武器/丧尸/缩放/升级），可直接热调。
