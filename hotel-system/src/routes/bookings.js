/** 订单：下单、我的订单、取消 */
const express = require('express');
const db = require('../db');
const { wrap, badRequest, notFound, conflict, forbidden, unauthorized } = require('../lib/http');
const { findAvailableRooms } = require('../services/availability');
const { quote, billableNights } = require('../lib/pricing');
const { isDateString, today, now } = require('../lib/time');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

/** 生成订单号：H + 年月日 + 6 位随机数 */
function makeOrderNo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  const rand = String(Math.floor(Math.random() * 900000) + 100000);
  return `H${stamp}${rand}`;
}

const DETAIL_SQL = `
  SELECT b.*, r.room_no, r.floor, t.name AS type_name, t.cover_img, t.price AS type_price,
         u.real_name AS user_name, u.phone AS user_phone
    FROM bookings b
    JOIN rooms r      ON r.id = b.room_id
    JOIN room_types t ON t.id = b.type_id
    JOIN users u      ON u.id = b.user_id
`;

function shape(row) {
  return {
    ...row,
    amount: Number(row.amount),
    finalAmount: row.finalAmount === null ? null : Number(row.finalAmount),
  };
}

// 下单
router.post(
  '/',
  requireLogin,
  wrap(async (req, res) => {
    const typeId = Number(req.body.typeId);
    const checkIn = String(req.body.checkIn || '');
    const checkOut = String(req.body.checkOut || '');
    const guests = Number(req.body.guests || 1);
    const remark = String(req.body.remark || '').slice(0, 200);

    if (!typeId) throw badRequest('请选择房型');
    if (!isDateString(checkIn) || !isDateString(checkOut)) throw badRequest('日期格式不正确');
    if (checkOut <= checkIn) throw badRequest('离店日期必须晚于入住日期');
    if (checkIn < today()) throw badRequest('入住日期不能早于今天');
    if (billableNights(checkIn, checkOut) > 30) throw badRequest('单次预订不超过 30 天');

    const booking = await db.tx(async (t) => {
      const type = await t.get('SELECT * FROM room_types WHERE id = ?', [typeId]);
      if (!type) throw notFound('房型不存在');
      if (guests < 1 || guests > type.capacity) {
        throw badRequest(`该房型最多入住 ${type.capacity} 人`);
      }

      // 关键：分配房间与冲突检测在同一个事务里完成
      const rooms = await findAvailableRooms(typeId, checkIn, checkOut, t);
      if (!rooms.length) throw conflict('该房型在所选日期已订满，请更换日期或房型');

      const room = rooms[0];
      const q = quote(type, checkIn, checkOut, req.user.vipLevel);

      const { insertId } = await t.run(
        `INSERT INTO bookings
           (order_no, user_id, room_id, type_id, check_in, check_out, guests,
            status, amount, remark, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
        [makeOrderNo(), req.user.id, room.id, typeId, checkIn, checkOut, guests, q.amount, remark || null, now()]
      );

      // 房间状态：若今天已进入入住区间，标记为 booked
      if (checkIn <= today()) {
        await t.run("UPDATE rooms SET status = 'booked' WHERE id = ? AND status = 'idle'", [room.id]);
      }

      const created = await t.get(`${DETAIL_SQL} WHERE b.id = ?`, [insertId]);
      return shape(created);
    });

    res.status(201).json({ booking });
  })
);

// 我的订单
router.get(
  '/mine',
  requireLogin,
  wrap(async (req, res) => {
    const rows = await db.all(
      `${DETAIL_SQL} WHERE b.user_id = ? ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    res.json({ list: rows.map(shape) });
  })
);

// 订单详情（本人或管理员）
router.get(
  '/:id',
  requireLogin,
  wrap(async (req, res) => {
    const row = await db.get(`${DETAIL_SQL} WHERE b.id = ?`, [req.params.id]);
    if (!row) throw notFound('订单不存在');
    if (req.user.role !== 'admin' && row.userId !== req.user.id) throw forbidden();
    res.json({ booking: shape(row) });
  })
);

// 取消订单：仅本人、仅"已预订"状态
router.post(
  '/:id/cancel',
  requireLogin,
  wrap(async (req, res) => {
    const row = await db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    if (!row) throw notFound('订单不存在');
    if (row.userId !== req.user.id) throw forbidden();
    if (row.status !== 'pending') throw badRequest('当前状态不可取消');

    await db.tx(async (t) => {
      await t.run("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [row.id]);
      // 若该房间没有其他有效订单，恢复空闲
      const other = await t.get(
        `SELECT id FROM bookings
          WHERE room_id = ? AND id <> ? AND status IN ('pending','checked_in')`,
        [row.roomId, row.id]
      );
      if (!other) await t.run("UPDATE rooms SET status = 'idle' WHERE id = ?", [row.roomId]);
    });

    res.json({ ok: true });
  })
);

module.exports = router;
