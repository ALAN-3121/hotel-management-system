/**
 * 房费计算规则
 * ---------------------------------------------------------------
 * 题目要求："房费的计算以中午 12 点为界计算天数"。
 *
 * 规则实现：
 *   1) 基础天数 = 离店日期 - 入住日期，最少按 1 天计
 *      （模拟场景下入住与退房可能只隔几分钟，仍算 1 天）
 *   2) 实际退房时刻超过 12:00，加收 1 天房费
 *   3) VIP 金卡（vip_level = 2）退房宽限至 14:00，这是进阶版要求
 *   4) 折扣：银卡 95 折、金卡 9 折，系数存在房型表里，可按房型单独配置
 */
const { parseDate } = require('./time');

const STANDARD_CHECKOUT_HOUR = 12;
const VIP_LATE_CHECKOUT_HOUR = 14;

const round2 = (n) => Math.round(n * 100) / 100;

/** 两个日期之间相差的自然日数 */
function daysBetween(start, end) {
  const ms = parseDate(end).getTime() - parseDate(start).getTime();
  return Math.round(ms / 86400000);
}

/** 计费天数：至少 1 天 */
function billableNights(checkIn, checkOut) {
  return Math.max(1, daysBetween(checkIn, checkOut));
}

/** 按 VIP 等级取折扣系数 */
function discountFor(type, vipLevel = 0) {
  if (vipLevel >= 2) return Number(type.discountVip2 ?? type.discount_vip2 ?? 0.9);
  if (vipLevel === 1) return Number(type.discountVip1 ?? type.discount_vip1 ?? 0.95);
  return 1;
}

/**
 * 下单时的报价
 * @returns {{nights:number, unitPrice:number, discount:number, amount:number}}
 */
function quote(type, checkIn, checkOut, vipLevel = 0) {
  const nights = billableNights(checkIn, checkOut);
  const unitPrice = Number(type.price);
  const discount = discountFor(type, vipLevel);
  return { nights, unitPrice, discount, amount: round2(nights * unitPrice * discount) };
}

/** VIP 等级对应的最晚退房时刻（小时，含分钟按小数） */
function checkoutLimitHour(vipLevel = 0) {
  return vipLevel >= 2 ? VIP_LATE_CHECKOUT_HOUR : STANDARD_CHECKOUT_HOUR;
}

/**
 * 退房结算
 * 在预订时算出的金额基础上，判断实际退房是否超时并加收房费。
 * @param {object} type       房型（含 price / 折扣系数）
 * @param {object} booking    订单（含 checkIn / checkOut / amount）
 * @param {Date}   actualTime 实际退房时刻
 * @param {number} vipLevel   VIP 等级
 */
function settle(type, booking, actualTime, vipLevel = 0) {
  const baseNights = billableNights(booking.checkIn, booking.checkOut);
  const unitPrice = Number(type.price);
  const discount = discountFor(type, vipLevel);
  const limitHour = checkoutLimitHour(vipLevel);
  const hour = actualTime.getHours() + actualTime.getMinutes() / 60;
  const overtime = hour > limitHour;
  const extraNights = overtime ? 1 : 0;
  const nights = baseNights + extraNights;

  return {
    baseNights,
    extraNights,
    nights,
    unitPrice,
    discount,
    limitHour,
    overtime,
    amount: round2(nights * unitPrice * discount),
  };
}

module.exports = {
  STANDARD_CHECKOUT_HOUR,
  VIP_LATE_CHECKOUT_HOUR,
  daysBetween,
  billableNights,
  discountFor,
  quote,
  settle,
  checkoutLimitHour,
  round2,
};
