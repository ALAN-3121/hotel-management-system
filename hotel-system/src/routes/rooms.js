/** 房型浏览接口（游客即可访问） */
const express = require('express');
const db = require('../db');
const { wrap, notFound, badRequest } = require('../lib/http');
const { availableCountByType, findAvailableRooms } = require('../services/availability');
const { quote } = require('../lib/pricing');
const { isDateString, today, addDays } = require('../lib/time');

const router = express.Router();

function parseRange(query) {
  const checkIn = query.checkIn || '';
  const checkOut = query.checkOut || '';
  if (!checkIn && !checkOut) return { checkIn: '', checkOut: '' };
  if (!isDateString(checkIn) || !isDateString(checkOut)) {
    throw badRequest('日期格式应为 YYYY-MM-DD');
  }
  if (checkOut <= checkIn) throw badRequest('离店日期必须晚于入住日期');
  return { checkIn, checkOut };
}

function normalizeType(t) {
  return {
    ...t,
    features: t.features ? t.features.split(',').filter(Boolean) : [],
    price: Number(t.price),
    discountVip1: Number(t.discountVip1),
    discountVip2: Number(t.discountVip2),
  };
}

// 房型列表：可带日期查"该时段剩余房量"
router.get(
  '/',
  wrap(async (req, res) => {
    const { checkIn, checkOut } = parseRange(req.query);
    const guests = Number(req.query.guests || 0);

    let types = await db.all('SELECT * FROM room_types ORDER BY sort, id');
    types = types.map(normalizeType);

    if (guests > 0) types = types.filter((t) => t.capacity >= guests);

    const counts = await availableCountByType(checkIn, checkOut);
    const totalRooms = await db.all(
      "SELECT type_id, COUNT(*) AS total FROM rooms WHERE status <> 'maintenance' GROUP BY type_id"
    );
    const totalMap = new Map(totalRooms.map((r) => [r.typeId, r.total]));

    const data = types.map((t) => ({
      ...t,
      totalRooms: totalMap.get(t.id) || 0,
      availableRooms: counts.get(t.id) || 0,
      quote: checkIn && checkOut ? quote(t, checkIn, checkOut, req.user?.vipLevel || 0) : null,
    }));

    res.json({ checkIn, checkOut, guests, list: data });
  })
);

// 房型详情：含多角度实拍图与 360° 全景
router.get(
  '/:id',
  wrap(async (req, res) => {
    const type = await db.get('SELECT * FROM room_types WHERE id = ?', [req.params.id]);
    if (!type) throw notFound('房型不存在');

    const images = await db.all(
      'SELECT id, url, caption, kind FROM room_images WHERE type_id = ? ORDER BY sort, id',
      [type.id]
    );
    const rooms = await db.all(
      'SELECT id, room_no, floor, status FROM rooms WHERE type_id = ? ORDER BY room_no',
      [type.id]
    );

    res.json({
      type: normalizeType(type),
      photos: images.filter((i) => i.kind === 'photo'),
      panoramas: images.filter((i) => i.kind === 'panorama'),
      rooms,
    });
  })
);

// 某房型在指定日期区间的可用情况
router.get(
  '/:id/availability',
  wrap(async (req, res) => {
    const { checkIn, checkOut } = parseRange(req.query);
    if (!checkIn || !checkOut) throw badRequest('请选择入住与离店日期');

    const type = await db.get('SELECT * FROM room_types WHERE id = ?', [req.params.id]);
    if (!type) throw notFound('房型不存在');

    const rooms = await findAvailableRooms(type.id, checkIn, checkOut);
    res.json({
      checkIn,
      checkOut,
      available: rooms.length,
      rooms: rooms.map((r) => ({ id: r.id, roomNo: r.roomNo, floor: r.floor })),
      quote: quote(normalizeType(type), checkIn, checkOut, req.user?.vipLevel || 0),
    });
  })
);

// 首页默认日期（今天 / 明天），供前端初始化
router.get('/meta/defaults', (req, res) => {
  res.json({ checkIn: today(), checkOut: addDays(today(), 1) });
});

module.exports = router;
