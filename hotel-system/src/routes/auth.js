/** 注册 / 登录 / 退出 / 当前用户 */
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { wrap, badRequest, conflict, unauthorized } = require('../lib/http');
const { now } = require('../lib/time');
const { PUBLIC_USER_FIELDS } = require('../middleware/auth');

const router = express.Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

function safeUser(row) {
  return {
    id: row.id,
    username: row.username,
    realName: row.realName,
    phone: row.phone,
    role: row.role,
    vipLevel: row.vipLevel,
    createdAt: row.createdAt,
  };
}

// 注册
router.post(
  '/register',
  wrap(async (req, res) => {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const realName = String(req.body.realName || '').trim();
    const phone = String(req.body.phone || '').trim();

    if (!USERNAME_RE.test(username)) {
      throw badRequest('账号需为 3-20 位字母、数字或下划线');
    }
    if (password.length < 6 || password.length > 32) {
      throw badRequest('密码长度需为 6-32 位');
    }
    if (!realName || realName.length > 20) {
      throw badRequest('请填写真实姓名（20 字以内）');
    }
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
      throw badRequest('手机号格式不正确');
    }

    const exists = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (exists) throw conflict('该账号已被注册');

    const hash = await bcrypt.hash(password, 10);
    const { insertId } = await db.run(
      `INSERT INTO users (username, password, real_name, phone, role, vip_level, created_at)
       VALUES (?, ?, ?, ?, 'guest', 0, ?)`,
      [username, hash, realName, phone || null, now()]
    );

    req.session.userId = insertId;
    res.status(201).json({ user: { id: insertId, username, realName, phone: phone || null, role: 'guest', vipLevel: 0 } });
  })
);

// 登录
router.post(
  '/login',
  wrap(async (req, res) => {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    if (!username || !password) throw badRequest('请输入账号和密码');

    const row = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    // 账号不存在与密码错误返回同一提示，避免账号枚举
    if (!row) throw unauthorized('账号或密码错误');

    const ok = await bcrypt.compare(password, row.password);
    if (!ok) throw unauthorized('账号或密码错误');

    req.session.userId = row.id;
    res.json({ user: safeUser(row) });
  })
);

// 退出
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// 当前登录用户
router.get('/me', (req, res) => {
  res.json({ user: req.user ? safeUser(req.user) : null });
});

// 修改密码（个人中心用）
router.post(
  '/password',
  wrap(async (req, res) => {
    if (!req.user) throw unauthorized();
    const { oldPassword, newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 6) throw badRequest('新密码至少 6 位');

    const row = await db.get('SELECT password FROM users WHERE id = ?', [req.user.id]);
    const ok = await bcrypt.compare(String(oldPassword || ''), row.password);
    if (!ok) throw badRequest('原密码不正确');

    await db.run('UPDATE users SET password = ? WHERE id = ?', [
      await bcrypt.hash(String(newPassword), 10),
      req.user.id,
    ]);
    res.json({ ok: true });
  })
);

module.exports = router;
module.exports.PUBLIC_USER_FIELDS = PUBLIC_USER_FIELDS;
