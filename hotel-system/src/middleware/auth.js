/**
 * 登录态中间件
 * 会话里只存 userId，每次请求重新查库，
 * 保证管理员改了 VIP 等级后用户端立刻生效（避免把权限信息固化在 session 里）。
 */
const db = require('../db');
const { unauthorized, forbidden } = require('../lib/http');

const PUBLIC_USER_FIELDS = 'id, username, real_name, phone, role, vip_level, created_at';

async function attachUser(req, res, next) {
  try {
    req.user = null;
    if (req.session && req.session.userId) {
      const user = await db.get(
        `SELECT ${PUBLIC_USER_FIELDS} FROM users WHERE id = ?`,
        [req.session.userId]
      );
      if (user) req.user = user;
      else delete req.session.userId;
    }
    next();
  } catch (err) {
    next(err);
  }
}

function requireLogin(req, res, next) {
  if (!req.user) return next(unauthorized('请先登录后再操作'));
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return next(unauthorized('请先登录后再操作'));
  if (req.user.role !== 'admin') return next(forbidden('该功能仅管理员可用'));
  next();
}

module.exports = { attachUser, requireLogin, requireAdmin, PUBLIC_USER_FIELDS };
