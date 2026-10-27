/**
 * 可用房判定（核心业务逻辑）
 * ---------------------------------------------------------------
 * 两段日期是否冲突，用标准区间重叠公式：
 *     已有区间.start < 新区间.end  且  已有区间.end > 新区间.start
 * 只要有一条"有效订单"满足该条件，这间房在该时段就不可再售。
 *
 * 有效订单 = pending（已预订）或 checked_in（入住中）；
 * cancelled / checked_out 不占用房间，自然被排除。
 */
const db = require('../db');

/** 某日期区间内已被占用的房间 id 集合 */
async function busyRoomIds(checkIn, checkOut, exec = db) {
  const rows = await exec.all(
    `SELECT room_id FROM bookings
      WHERE status IN ('pending','checked_in')
        AND check_in < ? AND check_out > ?`,
    [checkOut, checkIn]
  );
  return new Set(rows.map((r) => r.roomId));
}

/**
 * 某房型在指定区间内可用的房间列表
 * 排除维修停用的房间，再排除已被占用的房间
 */
async function findAvailableRooms(typeId, checkIn, checkOut, exec = db) {
  const rooms = await exec.all(
    `SELECT id, room_no, floor, status FROM rooms
      WHERE type_id = ? AND status <> 'maintenance'
      ORDER BY room_no`,
    [typeId]
  );
  if (!checkIn || !checkOut) return rooms;
  const busy = await busyRoomIds(checkIn, checkOut, exec);
  return rooms.filter((r) => !busy.has(r.id));
}

/** 各房型的可用房数量，返回 Map<typeId, number> */
async function availableCountByType(checkIn, checkOut, exec = db) {
  const rooms = await exec.all(
    `SELECT id, type_id FROM rooms WHERE status <> 'maintenance'`
  );
  const busy = checkIn && checkOut ? await busyRoomIds(checkIn, checkOut, exec) : new Set();
  const map = new Map();
  for (const r of rooms) {
    if (busy.has(r.id)) continue;
    map.set(r.typeId, (map.get(r.typeId) || 0) + 1);
  }
  return map;
}

module.exports = { busyRoomIds, findAvailableRooms, availableCountByType };
