/* =============================================================
   公共脚本：接口封装 / 登录态 / 头部导航 / 通用工具
   ============================================================= */

const API = {
  async request(path, { method = 'GET', body } = {}) {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      credentials: 'same-origin',
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try {
      data = await res.json();
    } catch (_) {
      /* 空响应 */
    }
    if (!res.ok) {
      const err = new Error(data.error || `请求失败（${res.status}）`);
      err.status = res.status;
      throw err;
    }
    return data;
  },
  get: (p) => API.request(p),
  post: (p, b) => API.request(p, { method: 'POST', body: b }),
  put: (p, b) => API.request(p, { method: 'PUT', body: b }),
  del: (p) => API.request(p, { method: 'DELETE' }),
};

const App = {
  user: null,
  ready: null,
};

/* ---------------------------- 工具函数 ---------------------------- */
const pad2 = (n) => String(n).padStart(2, '0');

function fmtDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function todayStr() {
  return fmtDate(new Date());
}

function addDaysStr(base, n) {
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}

function money(n) {
  const num = Number(n || 0);
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function dateCN(str) {
  if (!str) return '—';
  const [y, m, d] = String(str).slice(0, 10).split('-');
  return `${Number(m)}月${Number(d)}日`;
}

function nightsBetween(a, b) {
  const ms = new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`);
  return Math.max(1, Math.round(ms / 86400000));
}

function qs(name) {
  return new URLSearchParams(location.search).get(name) || '';
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

/* ---------------------------- 轻提示 ---------------------------- */
let toastTimer = null;
function toast(message, type = 'info') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = type === 'error' ? 'is-show is-error' : 'is-show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.className = '';
  }, 2600);
}

/* ---------------------------- 弹窗 ---------------------------- */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('is-open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('is-open');
}

/* ---------------------------- 头部导航 ---------------------------- */
const STATUS_TEXT = {
  pending: '已预订',
  checked_in: '入住中',
  checked_out: '已退房',
  cancelled: '已取消',
};

const STATUS_CLASS = {
  pending: 'badge',
  checked_in: 'badge badge-success',
  checked_out: 'badge badge-muted',
  cancelled: 'badge badge-danger',
};

const VIP_TEXT = { 0: '普通会员', 1: '银卡会员', 2: '金卡会员' };

async function initHeader({ transparent = false } = {}) {
  const header = document.querySelector('.site-header');

  if (transparent && header) {
    header.classList.add('is-transparent');
    const onScroll = () => {
      if (window.scrollY > 70) {
        header.classList.remove('is-transparent');
        header.classList.add('is-solid');
      } else {
        header.classList.add('is-transparent');
        header.classList.remove('is-solid');
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // 当前页高亮
  const path = location.pathname.replace(/\/$/, '') || '/index.html';
  document.querySelectorAll('.nav a').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href) return;
    if (path.endsWith(href.replace('../', '')) || (path.endsWith('/') && href === 'index.html')) {
      a.classList.add('is-active');
    }
  });

  let me = null;
  try {
    const data = await API.get('/api/auth/me');
    me = data.user;
  } catch (_) {
    me = null;
  }
  App.user = me;

  const box = document.getElementById('headerActions');
  if (box) {
    if (me) {
      const adminLink =
        me.role === 'admin'
          ? '<a class="btn btn-outline btn-sm" href="' +
            (location.pathname.includes('/admin/') ? '' : 'admin/') +
            'dashboard.html">管理后台</a>'
          : '';
      box.innerHTML = `
        ${adminLink}
        <span class="header-user">${esc(me.realName)}</span>
        <button class="btn btn-outline btn-sm" id="logoutBtn">退出</button>
      `;
      document.getElementById('logoutBtn').addEventListener('click', async () => {
        await API.post('/api/auth/logout');
        location.href = location.pathname.includes('/admin/') ? '../index.html' : 'index.html';
      });
    } else {
      box.innerHTML = `<a class="btn btn-outline btn-sm" href="${location.pathname.includes('/admin/') ? '../' : ''}login.html">登录 / 注册</a>`;
    }
  }

  // 管理后台入口（仅管理员可见）
  const adminNav = document.querySelector('[data-admin-nav]');
  if (adminNav) adminNav.style.display = me && me.role === 'admin' ? '' : 'none';

  return me;
}

/* ---------------------------- 滚动出现动画 ---------------------------- */
function initReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;
  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
  );
  items.forEach((el) => io.observe(el));
}

/* ---------------------------- 未登录拦截 ---------------------------- */
function guardLogin(nextUrl) {
  if (App.user) return true;
  location.href = `login.html?next=${encodeURIComponent(nextUrl || location.pathname + location.search)}`;
  return false;
}

/* 初始化：所有页面自动执行 */
document.addEventListener('DOMContentLoaded', () => {
  initReveal();
});
