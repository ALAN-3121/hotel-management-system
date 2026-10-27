/** 后台管理接口：概览、房间维护、订单管理、会员管理（均需管理员权限） */
const express = require('express');
const db = require('../db');
const { wrap, badRequest, notFound, conflict } = require('../lib/http');
const { requireAdmin } = require('../middleware/auth');
const { settle } = require('../lib/pricing');
const { today, addDays, now } = require('../lib/time');

const router = express.Router();
router.use(requireAdmin);

// ----------------------------- 概览 -----------------------------
router.get(
  '/overview',
  wrap(async (req, res) => {
    const totalRooms = await db.get(
      "SELECT COUNT(*) AS c FROM rooms WHERE status <> 'maintenance'"
    );
    const byStatus = await db.all('SELECT status, COUNT(*) AS c FROM rooms GROUP BY status');
    const statusMap = Object.fromEntries(byStatus.map((r) => [r.status, r.c]));

    const t = today();
    const todayIn = await db.get(
      "SELECT COUNT(*) AS c FROM bookings WHERE check_in = ? AND status = 'pending'",
      [t]
    );
    const todayOut = await db.get(
      "SELECT COUNT(*) AS c FROM bookings WHERE check_out = ? AND status = 'checked_in'",
      [t]
    );
    const pending = await db.get("SELECT COUNT(*) AS c FROM bookings WHERE status = 'pending'");

    const revenue = await db.get(
      "SELECT COALESCE(SUM(COALESCE(final_amount, amount)), 0) AS s FROM bookings WHERE status = 'checked_out'"
    );

    // 近 7 天空置/入住曲线
    const trend = [];
    for (let i = 6; i >= 0; i -= 1) {
      const day = addDays(t, -i);
      const row = await db.get(
        `SELECT COUNT(DISTINCT room_id) AS c FROM bookings
          WHERE status IN ('pending','checked_in','checked_out')
            AND check_in <= ? AND check_out > ?`,
        [day, day]
      );
      trend.push({
        date: day.slice(5),
        occupied: row.c,
        rate: totalRooms.c ? Math.round((row.c / totalRooms.c) * 1000) / 10 : 0,
      });
    }

    // 各房型今日入住率
    const typeStats = await db.all(`
      SELECT t.id, t.name,
             (SELECT COUNT(*) FROM rooms r WHERE r.type_id = t.id AND r.status <> 'maintenance') AS total,
             (SELECT COUNT(DISTINCT b.room_id) FROM bookings b
                WHERE b.type_id = t.id AND b.status IN ('pending','checked_in')
                  AND b.check_in <= ? AND b.check_out > ?) AS used
        FROM room_types t
       ORDER BY t.sort, t.id
    `, [t, t]);

    res.json({
      totalRooms: totalRooms.c,
      idle: statusMap.idle || 0,
      occupied: statusMap.occupied || 0,
      booked: statusMap.booked || 0,
      maintenance: statusMap.maintenance || 0,
      occupancyRate: totalRooms.c ? Math.round(((statusMap.occupied || 0) / totalRooms.c) * 1000) / 10 : 0,
      todayCheckIn: todayIn.c,
      todayCheckOut: todayOut.c,
      pending: pending.c,
      revenue: Number(revenue.s),
      trend,
      typeStats: typeStats.map((r) => ({
        ...r,
        rate: r.total ? Math.round((r.used / r.total) * 1000) / 10 : 0,
      })),
    });
  })
);

// ----------------------------- 房间维护 -----------------------------
router.get(
  '/rooms',
  wrap(async (req, res) => {
    const rows = await db.all(`
      SELECT r.id, r.room_no, r.floor, r.status, r.type_id, t.name AS type_name, t.price
        FROM rooms r JOIN room_types t ON t.id = r.type_id
       ORDER BY r.floor, r.room_no
    `);
    const types = await db.all('SELECT id, name, capacity, price FROM room_types ORDER BY sort, id');
    res.json({ list: rows, types });
  })
);

router.post(
  '/rooms',
  wrap(async (req, res) => {
    const roomNo = String(req.body.roomNo || '').trim();
    const typeId = Number(req.body.typeId);
    const floor = Number(req.body.floor || 1);
    const status = req.body.status || 'idle';

    if (!/^[0-9A-Za-z-]{2,10}$/.test(roomNo)) throw badRequest('房间号需为 2-10 位字母数字');
    if (!typeId) throw badRequest('请选择房型');
    if (floor < 1 || floor > 99) throw badRequest('楼层不合法');

    const type = await db.get('SELECT id FROM room_types WHERE id = ?', [typeId]);
    if (!type) throw notFound('房型不存在');

    const dup = await db.get('SELECT id FROM rooms WHERE room_no = ?', [roomNo]);
    if (dup) throw conflict('房间号已存在');

    const { insertId } = await db.run(
      'INSERT INTO rooms (room_no, type_id, floor, status) VALUES (?, ?, ?, ?)',
      [roomNo, typeId, floor, status]
    );
    res.status(201).json({ id: insertId });
  })
);

router.put(
  '/rooms/:id',
  wrap(async (req, res) => {
    const row = await db.get('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (!row) throw notFound('房间不存在');

    const roomNo = String(req.body.roomNo ?? row.roomNo).trim();
    const typeId = Number(req.body.typeId ?? row.typeId);
    const floor = Number(req.body.floor ?? row.floor);
    const status = req.body.status || row.status;

    if (roomNo !== row.roomNo) {
      const dup = await db.get('SELECT id FROM rooms WHERE room_no = ? AND id <> ?', [roomNo, row.id]);
      if (dup) throw conflict('房间号已存在');
    }
    if (status === 'maintenance') {
      const active = await db.get(
        "SELECT id FROM bookings WHERE room_id = ? AND status IN ('pending','checked_in')",
        [row.id]
      );
      if (active) throw conflict('该房间还有未完成订单，不能停用');
    }

    await db.run(
      'UPDATE rooms SET room_no = ?, type_id = ?, floor = ?, status = ? WHERE id = ?',
      [roomNo, typeId, floor, status, row.id]
    );
    res.json({ ok: true });
  })
);

router.delete(
  '/rooms/:id',
  wrap(async (req, res) => {
    const active = await db.get(
      "SELECT id FROM bookings WHERE room_id = ? AND status IN ('pending','checked_in')",
      [req.params.id]
    );
    if (active) throw conflict('该房间存在未完成订单，无法删除');
    const { changes } = await db.run('DELETE FROM rooms WHERE id = ?', [req.params.id]);
    if (!changes) throw notFound('房间不存在');
    res.json({ ok: true });
  })
);

// ----------------------------- 订单管理 -----------------------------
router.get(
  '/bookings',
  wrap(async (req, res) => {
    const { status, keyword } = req.query;
    const where = [];
    const params = [];

    if (status && status !== 'all') {
      where.push('b.status = ?');
      params.push(status);
    }
    if (keyword) {
      where.push('(b.order_no LIKE ? OR u.real_name LIKE ? OR r.room_no LIKE ?)');
      const like = `%${keyword}%`;
      params.push(like, like, like);
    }

    const rows = await db.all(`
      SELECT b.*, r.room_no, t.name AS type_name, u.real_name AS user_name, u.phone AS user_phone,
             u.vip_level
        FROM bookings b
        JOIN rooms r      ON r.id = b.room_id
        JOIN room_types t ON t.id = b.type_id
        JOIN users u      ON u.id = b.user_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY b.created_at DESC
       LIMIT 200
    `, params);

    res.json({ list: rows });
  })
);

// 确认入住
router.post(
  '/bookings/:id/checkin',
  wrap(async (req, res) => {
    const row = await db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    if (!row) throw notFound('订单不存在');
    if (row.status !== 'pending') throw badRequest('仅"已预订"订单可以办理入住');

    await db.tx(async (t) => {
      await t.run(
        "UPDATE bookings SET status = 'checked_in', checked_in_at = ? WHERE id = ?",
        [now(), row.id]
      );
      await t.run("UPDATE rooms SET status = 'occupied' WHERE id = ?", [row.roomId]);
    });
    res.json({ ok: true });
  })
);

// 确认退房：按 12 点规则结算
router.post(
  '/bookings/:id/checkout',
  wrap(async (req, res) => {
    const row = await db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    if (!row) throw notFound('订单不存在');
    if (row.status !== 'checked_in') throw badRequest('仅"入住中"订单可以办理退房');

    const type = await db.get('SELECT * FROM room_types WHERE id = ?', [row.typeId]);
    const user = await db.get('SELECT vip_level FROM users WHERE id = ?', [row.userId]);

    const result = settle(type, row, new Date(), user.vipLevel);

    await db.tx(async (t) => {
      await t.run(
        "UPDATE bookings SET status = 'checked_out', final_amount = ?, checked_out_at = ? WHERE id = ?",
        [result.amount, now(), row.id]
      );
      await t.run("UPDATE rooms SET status = 'idle' WHERE id = ?", [row.roomId]);
    });

    res.json({ ok: true, settle: result });
  })
);

// ----------------------------- 会员管理 -----------------------------
router.get(
  '/users',
  wrap(async (req, res) => {
    const rows = await db.all(`
      SELECT u.id, u.username, u.real_name, u.phone, u.role, u.vip_level, u.created_at,
             (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id) AS order_count,
             (SELECT COALESCE(SUM(COALESCE(b.final_amount, b.amount)), 0)
                FROM bookings b WHERE b.user_id = u.id AND b.status = 'checked_out') AS total_spent
        FROM users u
       ORDER BY u.role DESC, u.id
    `);
    res.json({ list: rows });
  })
);

router.put(
  '/users/:id/vip',
  wrap(async (req, res) => {
    const vipLevel = Number(req.body.vipLevel);
    if (![0, 1, 2].includes(vipLevel)) throw badRequest('VIP 等级只能为 0 / 1 / 2');
    const row = await db.get('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (!row) throw notFound('用户不存在');
    await db.run('UPDATE users SET vip_level = ? WHERE id = ?', [vipLevel, row.id]);
    res.json({ ok: true });
  })
);

module.exports = router;
