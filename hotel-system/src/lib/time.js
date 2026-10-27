/**
 * 时间工具
 * 统一使用 'YYYY-MM-DD'（日期）与 'YYYY-MM-DD HH:mm:ss'（时刻）字符串，
 * 避免 MySQL 与 SQLite 的时区/类型差异。
 */
const pad = (n) => String(n).padStart(2, '0');

function fmtDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtDateTime(d) {
  return `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function now() {
  return fmtDateTime(new Date());
}

function today() {
  return fmtDate(new Date());
}

function parseDate(str) {
  return new Date(`${str}T00:00:00`);
}

function addDays(dateStr, n) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}

/** 判断是否为合法的 YYYY-MM-DD */
function isDateString(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = parseDate(str);
  return !Number.isNaN(d.getTime()) && fmtDate(d) === str;
}

module.exports = { fmtDate, fmtDateTime, now, today, parseDate, addDays, isDateString, pad };
