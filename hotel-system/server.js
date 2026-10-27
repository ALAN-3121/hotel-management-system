/**
 * 云栖酒店客房管理系统 —— 服务入口
 * 启动：npm start   （默认 http://localhost:3000）
 */
require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');

const db = require('./src/db');
const { attachUser } = require('./src/middleware/auth');
const { HttpError } = require('./src/lib/http');

const app = express();
const PORT = Number(process.env.PORT || 3000);

// ----------------------------- 基础中间件 -----------------------------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: 'hotel.sid',
    secret: process.env.SESSION_SECRET || 'yunqi-hotel-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8, // 8 小时
    },
  })
);

// 静态资源
app.use(
  express.static(path.join(__dirname, 'public'), {
    extensions: ['html'],
    maxAge: 0,
  })
);

// 每个请求解析登录态
app.use(attachUser);

// ----------------------------- 业务路由 -----------------------------
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/room-types', require('./src/routes/rooms'));
app.use('/api/bookings', require('./src/routes/bookings'));
app.use('/api/admin', require('./src/routes/admin'));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, driver: db.driver, time: new Date().toISOString() });
});

// ----------------------------- 兜底处理 -----------------------------
app.use('/api', (req, res) => {
  res.status(404).json({ error: `接口不存在：${req.method} ${req.originalUrl}` });
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// 全局错误处理
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err instanceof HttpError ? err.status : err.status || 500;
  if (status >= 500) console.error('[server error]', err);
  res.status(status).json({ error: err.message || '服务器内部错误' });
});

// ----------------------------- 启动 -----------------------------
const server = app.listen(PORT, () => {
  console.log('');
  console.log('  云栖酒店客房管理系统');
  console.log('  ------------------------------------');
  console.log(`  服务地址 : http://localhost:${PORT}`);
  console.log(`  数据驱动 : ${db.driver}${db.driver === 'sqlite' ? ` (${db.file})` : ''}`);
  console.log('  停止服务 : 在本窗口按 Ctrl + C');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error(`  [启动失败] 端口 ${PORT} 已被占用。`);
    console.error('  通常是因为已经有一个服务在运行，先关闭之前的窗口再试。');
    console.error(`  也可以换一个端口启动：set PORT=3001 && npm start`);
    console.error('');
  } else {
    console.error('[启动失败]', err.message);
  }
  process.exit(1);
});

process.on('SIGINT', async () => {
  await db.close();
  process.exit(0);
});
