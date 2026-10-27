# 云栖酒店客房管理系统

《网页设计与网站建设》分组作业 · 选题 3「酒店客房管理系统」

一个可完整运行的前后端分离式 Web 系统：游客浏览房型 → 注册登录 → 在线订房 → 管理员确认入住 → 退房按 12 点规则结算。包含 360° 全景看房（指定设计）、VIP 分级折扣、入住率曲线（进阶版）。

---

## 一、运行方式

### 方式 A：双击启动（最简单，演示用这个）

双击项目根目录下的 **`启动演示.bat`**。

脚本会自动完成：查找 Node.js 运行环境 → 检查依赖 → 检查演示数据 → 启动服务 → 3 秒后打开浏览器。

- 服务地址：<http://localhost:3000>
- 停止服务：关闭那个黑色命令行窗口，或按 `Ctrl + C`
- 重置数据：先关掉服务窗口，再双击 `重置演示数据.bat`

> 如果提示「没有找到 Node.js」，说明这台电脑没装 Node.js。到 <https://nodejs.org/zh-cn> 下载安装（全部默认选项），装完重新双击即可。脚本会优先使用系统 PATH 里的 Node，找不到时才回退到 WorkBuddy 自带的运行时。

### 方式 B：命令行启动（需要 Node.js 已加入系统 PATH）

在项目目录打开 PowerShell 或 CMD：

```bash
npm install      # 仅首次需要，已装过可跳过
npm run init     # 仅首次需要，建库建表并灌入演示数据
npm start        # 启动服务，浏览器访问 http://localhost:3000
```

> **常见报错：`npm : 无法将"npm"项识别为 cmdlet…`**
> 这不是项目的问题，而是当前电脑没有安装 Node.js，或安装后没有加入系统 PATH。
> 请改用方式 A 双击启动，或安装 Node.js 后重启命令行窗口。

### 方式 C：使用 MySQL（与报告中的建表 SQL 一致）

1. 复制 `.env.example` 为 `.env`，把 `DB_DRIVER` 改为 `mysql`，并填写数据库账号密码：

```ini
DB_DRIVER=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的密码
DB_NAME=hotel_system
```

2. 双击 `启动演示.bat`（或执行 `npm run init` 后 `npm start`），会自动建库、建表、灌数据。

也可以直接在 Navicat 中执行 `db/schema.mysql.sql` 手动建表。

> 默认配置使用内置 SQLite，数据文件在 `data/hotel.db`，不需要安装任何数据库即可演示。
> 两种数据库的表结构与业务代码完全一致，切换只需改 `.env` 里的 `DB_DRIVER`。

### 演示账号

| 角色 | 账号 | 密码 | 说明 |
|---|---|---|---|
| 管理员 | `admin` | `123456` | 可进入后台 |
| 普通用户 | `zhangxy` | `123456` | 普通会员 |
| 普通用户 | `liwenbo` | `123456` | 银卡会员（95 折） |
| 普通用户 | `chenjing` | `123456` | 金卡会员（9 折，14:00 退房） |
| 普通用户 | `zhaoym` | `123456` | 银卡会员 |
| 普通用户 | `sunqi` | `123456` | 普通会员 |

---

## 二、题目要求完成情况

### 基础版

| 题目要求 | 实现位置 |
|---|---|
| 用户分管理者、个人用户两类 | `users.role`（admin / guest），后台接口统一 `requireAdmin` 校验 |
| 游客可浏览，订房时才需注册登录 | 首页与房型列表对游客开放；`POST /api/bookings` 需登录 |
| 管理者可调整客房数量 | 后台「客房管理」支持新增 / 编辑 / 删除房间，停用前校验未完成订单 |
| 管理者与用户使用同一客房页面，但不可订房 | 管理员登录后前台页面正常浏览；后台入口仅管理员可见 |
| 管理员确认入住、确认退房 | `POST /api/admin/bookings/:id/checkin`、`.../checkout` |
| 退房后可用房间信息更新 | 退房事务内将房间状态置回 `idle`，可售房量实时变化 |
| 房费以中午 12 点为界计算天数 | `src/lib/pricing.js`，见下方「核心规则」 |
| **指定设计：查看详情可看多角度照片 / VR 看房** | `room.html` 图集切换 + Pannellum 360° 全景查看器（`img/pano1.jpg`、`pano2.jpg` 为等距柱状投影图） |

### 进阶版

| 题目要求 | 实现位置 |
|---|---|
| 用户分不同 VIP 等级，不同房型折扣不同 | `users.vip_level` + `room_types.discount_vip1/vip2`，可按房型单独配置 |
| VIP 用户退房时间延长至 14:00 | `pricing.checkoutLimitHour()`，金卡 14:00、其余 12:00 |
| 管理员查看所有房间可用情况 | 后台「经营概览」KPI + 「客房管理」全量房间状态 |
| 不同房型空置曲线 | ECharts 近 7 天入住率折线 + 各房型今日占用堆叠条形图 |

---

## 三、核心规则

### 1. 日期区间冲突检测（防一房两卖）

```sql
SELECT room_id FROM bookings
 WHERE status IN ('pending','checked_in')
   AND check_in < ?checkOut      -- 已有区间起点 早于 新区间终点
   AND check_out > ?checkIn;     -- 已有区间终点 晚于 新区间起点
```

两条同时成立即为重叠。`cancelled` / `checked_out` 不占用房间，天然被排除。

### 2. 12 点边界计费

```
基础天数 = 离店日期 - 入住日期，最少按 1 天计
实际退房时刻 > 12:00  → 加收 1 天（金卡宽限至 14:00）
实收金额 = 天数 × 门市价 × VIP 折扣
```

下单时给出预估金额，退房时按实际时刻重新结算并写入 `final_amount`。

### 3. 权限模型

- 前端只做展示层隐藏，**所有写操作在后端校验**（`requireLogin` / `requireAdmin`）。
- 密码使用 bcrypt 哈希存储，登录失败不区分「账号不存在」与「密码错误」，避免账号枚举。
- 会话仅保存 `userId`，每次请求重新查库，管理员调整 VIP 后用户端立即生效。

---

## 四、目录结构

```
hotel-system/
├── 启动演示.bat                # 双击启动（自动找 Node、检查依赖、开浏览器）
├── 重置演示数据.bat            # 双击重置为初始演示数据
├── server.js                  # 服务入口：中间件、路由挂载、错误处理
├── .env.example               # 环境变量模板
├── db/
│   ├── schema.mysql.sql       # MySQL 建表脚本（可直接在 Navicat 执行）
│   ├── schema.sqlite.sql      # SQLite 建表脚本（方言适配版）
│   └── init.js                # 初始化：建表 + 灌入演示数据
├── src/
│   ├── db.js                  # 数据访问适配器（MySQL / SQLite 双驱动）
│   ├── middleware/auth.js     # 登录态、权限中间件
│   ├── services/availability.js  # 可用房判定（冲突检测）
│   ├── lib/
│   │   ├── pricing.js         # 计费规则
│   │   ├── time.js            # 日期工具
│   │   └── http.js            # 统一异常
│   └── routes/
│       ├── auth.js            # 注册 / 登录 / 退出 / 改密
│       ├── rooms.js           # 房型浏览、可用房查询
│       ├── bookings.js        # 下单、我的订单、取消
│       └── admin.js           # 概览、房间、订单、会员
└── public/
    ├── index.html             # 首页（Hero + 日期查询 + 房型推荐）
    ├── rooms.html             # 房型列表（日期筛选、实时房量、排序）
    ├── room.html              # 房型详情（图集 + 360° 全景 + 预订面板）
    ├── login.html             # 登录 / 注册
    ├── orders.html            # 我的订单
    ├── admin/                 # 后台四个页面
    ├── css/                   # base / site / admin 三套样式
    ├── js/                    # 按页面拆分的脚本
    ├── img/                   # 房型实拍图与全景图
    └── vendor/                # Pannellum、ECharts（本地化，断网可用）
```

---

## 五、数据库表

| 表 | 说明 |
|---|---|
| `users` | 用户，含角色与 VIP 等级 |
| `room_types` | 房型，含门市价与两级 VIP 折扣 |
| `rooms` | 具体房间，含楼层与状态机 |
| `room_images` | 房型图片，`kind` 区分实拍图与 360° 全景 |
| `bookings` | 订单，含预估金额与结算金额 |

房间状态机：`idle` 空闲 → `booked` 已预订 → `occupied` 入住中 → `idle`；另有 `cleaning` 待清洁、`maintenance` 维修停用（停用时不可售）。

---

## 六、已知限制与改进方向

1. **并发下单**：当前靠事务 + 冲突检测保证一致性。高并发下 MySQL 可改用 `SELECT ... FOR UPDATE` 锁住房源行；SQLite 本身串行写入，不存在该问题。
2. **会话存储**：使用 express-session 默认内存存储，重启后需重新登录。生产环境应换 Redis。
3. **支付**：未接入支付渠道，订单金额仅作模拟结算。
4. **图片**：实拍图来自 Unsplash（免费授权），全景图来自 Poly Haven（CC0），仅用于课程演示。
