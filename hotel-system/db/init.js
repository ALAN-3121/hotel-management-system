/**
 * 数据库初始化脚本
 * 用法：npm run init
 * 作用：建库建表 + 灌入演示数据（房型 / 20 间客房 / 会员 / 覆盖各种状态的订单）
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DRIVER = (process.env.DB_DRIVER || 'sqlite').trim().toLowerCase();
const ROOT = path.join(__dirname, '..');

const { now, today, addDays } = require('../src/lib/time');
const { quote } = require('../src/lib/pricing');

// ----------------------------- 1. 建表 -----------------------------
async function buildSchema() {
  if (DRIVER === 'mysql') {
    const mysql = require('mysql2/promise');
    const sql = fs.readFileSync(path.join(__dirname, 'schema.mysql.sql'), 'utf8');
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true,
      charset: 'utf8mb4',
    });
    await conn.query(sql);
    await conn.end();
    console.log('[1/3] MySQL 建库建表完成');
  } else {
    const { DatabaseSync } = require('node:sqlite');
    const file = process.env.SQLITE_FILE || path.join(ROOT, 'data', 'hotel.db');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file)) fs.rmSync(file);
    const conn = new DatabaseSync(file);
    conn.exec(fs.readFileSync(path.join(__dirname, 'schema.sqlite.sql'), 'utf8'));
    conn.close();
    console.log('[1/3] SQLite 建库建表完成 ->', file);
  }
}

// ----------------------------- 2. 演示数据 -----------------------------
const USERS = [
  { username: 'admin', realName: '王云栖', phone: '13800000001', role: 'admin', vip: 0 },
  { username: 'zhangxy', realName: '张小雨', phone: '13800000002', role: 'guest', vip: 0 },
  { username: 'liwenbo', realName: '李文博', phone: '13800000003', role: 'guest', vip: 1 },
  { username: 'chenjing', realName: '陈静', phone: '13800000004', role: 'guest', vip: 2 },
  { username: 'zhaoym', realName: '赵一鸣', phone: '13800000005', role: 'guest', vip: 1 },
  { username: 'sunqi', realName: '孙琪', phone: '13800000006', role: 'guest', vip: 0 },
];

const TYPES = [
  {
    name: '云栖大床房',
    price: 688,
    capacity: 2,
    bed: '1.8m 特大床',
    area: 42,
    cover: 'img/deluxe-1.jpg',
    intro: '38 层高空视野，暖木色调与米白织物相衬。独立浴缸临窗而设，入夜可观城市灯河。',
    features: '独立浴缸,落地窗,智能马桶,免费迷你吧,胶囊咖啡机',
    photos: [
      ['img/deluxe-1.jpg', '卧室全景'],
      ['img/deluxe-2.jpg', '床区细节'],
      ['img/deluxe-3.jpg', '起居区'],
    ],
    pano: 'img/pano1.jpg',
    sort: 1,
    rooms: ['301', '302', '303', '305', '306', '307', '308', '309'],
  },
  {
    name: '行政双床房',
    price: 828,
    capacity: 2,
    bed: '两张 1.35m 单床',
    area: 46,
    cover: 'img/twin-1.jpg',
    intro: '为同行旅伴设计，双床分置互不打扰。行政楼层专享酒廊礼遇，含双人早餐。',
    features: '含双早,行政酒廊,双床分置,办公书桌,免费洗衣',
    photos: [
      ['img/twin-1.jpg', '双床布局'],
      ['img/twin-2.jpg', '会客区'],
      ['img/twin-3.jpg', '阳台'],
    ],
    pano: 'img/pano1.jpg',
    sort: 2,
    rooms: ['501', '502', '503', '505', '506', '507'],
  },
  {
    name: '家庭套房',
    price: 1288,
    capacity: 4,
    bed: '大床 + 沙发床',
    area: 68,
    cover: 'img/family-1.jpg',
    intro: '独立客厅与卧室分区，沙发床可加铺。儿童洗漱用品与帐篷玩具可提前预约。',
    features: '独立客厅,可加床,儿童用品,厨房角,洗衣烘干',
    photos: [
      ['img/family-1.jpg', '客厅'],
      ['img/family-2.jpg', '开放式起居'],
      ['img/family-3.jpg', '山景卧室'],
    ],
    pano: 'img/pano2.jpg',
    sort: 3,
    rooms: ['601', '602', '603'],
  },
  {
    name: '顶层江景套房',
    price: 1888,
    capacity: 3,
    bed: '2.0m 特大床',
    area: 85,
    cover: 'img/suite-1.jpg',
    intro: '整层仅三间，三面环幕落地窗。露台设户外浴缸，江景与山脊在晨雾中展开。',
    features: '三面落地窗,私属露台,户外浴缸,管家服务,专属电梯',
    photos: [
      ['img/suite-1.jpg', '露台视野'],
      ['img/suite-2.jpg', '廊道'],
      ['img/suite-3.jpg', '户外休闲区'],
    ],
    pano: 'img/pano2.jpg',
    sort: 4,
    rooms: ['801', '802', '803'],
  },
];

/** 订单场景：覆盖已退房 / 入住中 / 待入住 / 已取消四种状态 */
function buildBookings(idOf, roomIdOf) {
  const T = today();
  const d = (n) => addDays(T, n);
  return [
    // 历史订单（用于营收统计与曲线）
    { user: 'zhangxy', room: '301', in: d(-9), out: d(-7), status: 'checked_out', guests: 2, remark: '高楼层安静房' },
    { user: 'liwenbo', room: '501', in: d(-8), out: d(-6), status: 'checked_out', guests: 2 },
    { user: 'chenjing', room: '801', in: d(-6), out: d(-4), status: 'checked_out', guests: 2, remark: '纪念日布置' },
    { user: 'zhaoym', room: '601', in: d(-4), out: d(-2), status: 'checked_out', guests: 4 },
    { user: 'sunqi', room: '302', in: d(-3), out: d(-2), status: 'checked_out', guests: 1 },
    { user: 'chenjing', room: '802', in: d(-2), out: d(1), status: 'checked_out', guests: 3 },

    // 入住中
    { user: 'liwenbo', room: '502', in: d(-1), out: d(2), status: 'checked_in', guests: 2 },
    { user: 'chenjing', room: '803', in: d(0), out: d(3), status: 'checked_in', guests: 2, remark: '需要延迟退房' },
    { user: 'zhangxy', room: '305', in: d(-1), out: d(1), status: 'checked_in', guests: 2 },

    // 今日待入住（管理员可办理入住）
    { user: 'zhaoym', room: '303', in: d(0), out: d(2), status: 'pending', guests: 2 },
    { user: 'sunqi', room: '306', in: d(0), out: d(1), status: 'pending', guests: 1 },

    // 未来预订
    { user: 'zhangxy', room: '506', in: d(1), out: d(4), status: 'pending', guests: 2 },
    { user: 'liwenbo', room: '603', in: d(2), out: d(5), status: 'pending', guests: 3 },

    // 已取消
    { user: 'sunqi', room: '602', in: d(1), out: d(2), status: 'cancelled', guests: 2 },
  ].map((b) => ({ ...b, userId: idOf[b.user], roomId: roomIdOf[b.room] }));
}

// ----------------------------- 3. 执行 -----------------------------
async function main() {
  await buildSchema();
  const db = require('../src/db');

  // 用户
  const idOf = {};
  const hash = await bcrypt.hash('123456', 10);
  for (const u of USERS) {
    const { insertId } = await db.run(
      `INSERT INTO users (username, password, real_name, phone, role, vip_level, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [u.username, hash, u.realName, u.phone, u.role, u.vip, now()]
    );
    idOf[u.username] = insertId;
  }
  console.log(`[2/3] 用户 ${USERS.length} 个（默认密码 123456）`);

  // 房型 / 图片 / 房间
  const roomIdOf = {};
  let roomCount = 0;
  for (const t of TYPES) {
    const { insertId: typeId } = await db.run(
      `INSERT INTO room_types
         (name, price, capacity, bed_type, area, cover_img, intro, features,
          discount_vip1, discount_vip2, sort)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.95, 0.90, ?)`,
      [t.name, t.price, t.capacity, t.bed, t.area, t.cover, t.intro, t.features, t.sort]
    );

    let sort = 0;
    for (const [url, caption] of t.photos) {
      await db.run(
        'INSERT INTO room_images (type_id, url, caption, kind, sort) VALUES (?, ?, ?, ?, ?)',
        [typeId, url, caption, 'photo', sort++]
      );
    }
    await db.run(
      'INSERT INTO room_images (type_id, url, caption, kind, sort) VALUES (?, ?, ?, ?, ?)',
      [typeId, t.pano, '360° 全景看房', 'panorama', 0]
    );

    for (const roomNo of t.rooms) {
      const { insertId } = await db.run(
        'INSERT INTO rooms (room_no, type_id, floor, status) VALUES (?, ?, ?, ?)',
        [roomNo, typeId, Math.floor(Number(roomNo) / 100), 'idle']
      );
      roomIdOf[roomNo] = insertId;
      roomCount += 1;
    }
  }
  console.log(`[3/3] 房型 ${TYPES.length} 个 / 客房 ${roomCount} 间`);

  // 订单
  const typeByRoom = {};
  for (const t of TYPES) {
    const row = await db.get('SELECT id, price FROM room_types WHERE name = ?', [t.name]);
    for (const roomNo of t.rooms) typeByRoom[roomNo] = row;
  }

  const bookings = buildBookings(idOf, roomIdOf);
  let seq = 0;
  for (const b of bookings) {
    const type = typeByRoom[b.room];
    const user = USERS.find((u) => u.username === b.user);
    const q = quote({ price: type.price, discountVip1: 0.95, discountVip2: 0.9 }, b.in, b.out, user.vip);
    const orderNo = `H${b.in.replace(/-/g, '')}${String(1000 + seq++)}`;
    const checkedInAt = b.status === 'pending' || b.status === 'cancelled' ? null : `${b.in} 14:20:00`;
    const checkedOutAt = b.status === 'checked_out' ? `${b.out} 11:40:00` : null;

    await db.run(
      `INSERT INTO bookings
         (order_no, user_id, room_id, type_id, check_in, check_out, guests, status,
          amount, final_amount, remark, created_at, checked_in_at, checked_out_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderNo, b.userId, b.roomId, type.id, b.in, b.out, b.guests, b.status,
        q.amount, b.status === 'checked_out' ? q.amount : null, b.remark || null,
        `${b.in} 10:12:00`, checkedInAt, checkedOutAt,
      ]
    );
  }

  // 同步房间状态：入住中 -> occupied，今日到店待入住 -> booked
  await db.run(`UPDATE rooms SET status = 'idle' WHERE status IN ('occupied','booked')`);
  await db.run(`
    UPDATE rooms SET status = 'occupied' WHERE id IN (
      SELECT room_id FROM bookings WHERE status = 'checked_in'
    )`);
  await db.run(`
    UPDATE rooms SET status = 'booked' WHERE status = 'idle' AND id IN (
      SELECT room_id FROM bookings WHERE status = 'pending' AND check_in <= '${today()}'
    )`);
  await db.run("UPDATE rooms SET status = 'maintenance' WHERE room_no IN ('309','507')");

  console.log(`      订单 ${bookings.length} 条（覆盖已退房 / 入住中 / 待入住 / 已取消）`);
  console.log('\n初始化完成。启动服务：npm start');
  await db.close();
}

main().catch((err) => {
  console.error('初始化失败：', err);
  process.exit(1);
});
