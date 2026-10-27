/**
 * 数据访问层（适配器模式）
 * ---------------------------------------------------------------
 * 对外统一暴露 all / get / run / tx 四个方法，屏蔽 MySQL 与 SQLite 的差异。
 * 这样上层路由代码只写一套 SQL，两种数据库都能跑：
 *   - 课程演示：配置 .env 走 MySQL（报告里的建表 SQL、ER 图与之对应）
 *   - 免安装运行：未配置时自动降级到 Node 内置 SQLite
 */
const fs = require('fs');
const path = require('path');

const DRIVER = (process.env.DB_DRIVER || 'sqlite').trim().toLowerCase();

/** 下划线转驼峰：room_no -> roomNo，前端可直接用 */
function camelKey(key) {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function camelRow(row) {
  if (!row) return row;
  const out = {};
  for (const key of Object.keys(row)) out[camelKey(key)] = row[key];
  return out;
}

/** SQLite 不接受 undefined，统一转成 null */
function normalize(params = []) {
  return params.map((v) => (v === undefined ? null : v));
}

// ------------------------------ SQLite ------------------------------
function createSqlite() {
  const { DatabaseSync } = require('node:sqlite');
  const file = process.env.SQLITE_FILE || path.join(__dirname, '..', 'data', 'hotel.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const conn = new DatabaseSync(file);
  conn.exec('PRAGMA foreign_keys = ON');

  const api = {
    driver: 'sqlite',
    file,
    async all(sql, params = []) {
      return conn.prepare(sql).all(...normalize(params)).map(camelRow);
    },
    async get(sql, params = []) {
      const row = conn.prepare(sql).get(...normalize(params));
      return row ? camelRow(row) : undefined;
    },
    async run(sql, params = []) {
      const r = conn.prepare(sql).run(...normalize(params));
      return { insertId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    async tx(fn) {
      conn.exec('BEGIN');
      try {
        const result = await fn(api);
        conn.exec('COMMIT');
        return result;
      } catch (err) {
        conn.exec('ROLLBACK');
        throw err;
      }
    },
    async close() {
      conn.close();
    },
  };
  return api;
}

// ------------------------------ MySQL ------------------------------
function createMysql() {
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hotel_system',
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
    // 关键配置：日期返回字符串（与 SQLite 行为一致），DECIMAL 返回数字
    dateStrings: true,
    decimalNumbers: true,
  });

  const wrap = (conn) => ({
    async all(sql, params = []) {
      const [rows] = await conn.query(sql, params);
      return rows.map(camelRow);
    },
    async get(sql, params = []) {
      const [rows] = await conn.query(sql, params);
      return rows.length ? camelRow(rows[0]) : undefined;
    },
    async run(sql, params = []) {
      const [r] = await conn.query(sql, params);
      return { insertId: r.insertId, changes: r.affectedRows };
    },
  });

  const api = {
    driver: 'mysql',
    ...wrap(pool),
    async tx(fn) {
      const conn = await pool.getConnection();
      await conn.beginTransaction();
      try {
        const result = await fn(wrap(conn));
        await conn.commit();
        return result;
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
  return api;
}

const db = DRIVER === 'mysql' ? createMysql() : createSqlite();

module.exports = db;
