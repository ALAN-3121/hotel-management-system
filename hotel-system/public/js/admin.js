/* 后台公共：权限校验 + 侧边栏 + 顶栏 */

const ADMIN_NAV = [
  { key: 'dashboard', label: '经营概览', href: 'dashboard.html', icon: 'M3 12h4l3 7 4-14 3 7h4' },
  { key: 'rooms', label: '客房管理', href: 'rooms.html', icon: 'M3 19V7h11v5h7v7M3 19h18M7 11h.01' },
  { key: 'bookings', label: '订单管理', href: 'bookings.html', icon: 'M5 4h14v16H5zM8 9h8M8 13h8M8 17h5' },
  { key: 'users', label: '会员管理', href: 'users.html', icon: 'M12 11a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6' },
];

async function initAdmin(activeKey) {
  let me = null;
  try {
    const data = await API.get('/api/auth/me');
    me = data.user;
  } catch (_) {}

  const page = location.pathname.split('/').pop();
  if (!me) {
    location.href = `../login.html?next=${encodeURIComponent(`admin/${page}`)}`;
    return null;
  }
  if (me.role !== 'admin') {
    document.body.innerHTML =
      '<div style="padding:120px 40px;text-align:center;color:#7a827c">' +
      '<p style="font-size:18px;margin-bottom:16px">当前账号不是管理员，无法访问后台</p>' +
      '<a href="../index.html" style="color:#a8824c">返回首页</a></div>';
    return null;
  }

  const side = document.getElementById('adminSide');
  if (side) {
    side.innerHTML = `
      <div class="admin-brand">
        <span class="brand-cn">云栖酒店</span>
        <span class="brand-en">Yunqi Hotel</span>
        <p>管理控制台</p>
      </div>
      <nav class="admin-nav">
        ${ADMIN_NAV.map(
          (item) => `
          <a href="${item.href}" class="${item.key === activeKey ? 'is-active' : ''}" style="position:relative">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="${item.icon}"></path>
            </svg>
            ${item.label}
          </a>`
        ).join('')}
      </nav>
      <div class="admin-side-foot">
        <div>当前登录：${esc(me.realName)}</div>
        <a href="../index.html">← 返回前台</a>
      </div>`;
  }

  const userBox = document.getElementById('adminUser');
  if (userBox) {
    userBox.innerHTML = `
      <div class="avatar">${esc(me.realName.slice(0, 1))}</div>
      <span>${esc(me.realName)}</span>
      <button class="mini-btn" id="adminLogout">退出</button>`;
    document.getElementById('adminLogout').addEventListener('click', async () => {
      await API.post('/api/auth/logout');
      location.href = '../login.html';
    });
  }

  return me;
}

/* 后台常用：状态标签 */
const ADMIN_STATUS_TEXT = {
  pending: '已预订',
  checked_in: '入住中',
  checked_out: '已退房',
  cancelled: '已取消',
};

const ADMIN_STATUS_CLASS = {
  pending: 'badge',
  checked_in: 'badge badge-success',
  checked_out: 'badge badge-muted',
  cancelled: 'badge badge-danger',
};

const ROOM_STATUS_TEXT = {
  idle: '空闲',
  booked: '已预订',
  occupied: '入住中',
  cleaning: '待清洁',
  maintenance: '维修停用',
};
