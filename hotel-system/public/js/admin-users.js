/* 后台：会员管理（调整 VIP 等级） */

(async function () {
  const me = await initAdmin('users');
  if (!me) return;

  const tbody = document.getElementById('userBody');

  async function load() {
    try {
      const { list } = await API.get('/api/admin/users');
      render(list);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" style="color:var(--danger)">${esc(err.message)}</td></tr>`;
    }
  }

  function render(list) {
    document.getElementById('userCount').textContent = `共 ${list.length} 位用户`;

    tbody.innerHTML = list
      .map(
        (u) => `
        <tr>
          <td>${esc(u.realName)}</td>
          <td class="mono">${esc(u.username)}</td>
          <td class="mono">${esc(u.phone || '—')}</td>
          <td>${u.role === 'admin' ? '<span class="badge badge-dark">管理员</span>' : '普通用户'}</td>
          <td>
            <select class="select" style="height:32px;font-size:12.5px;width:130px" data-vip="${u.id}">
              <option value="0" ${u.vipLevel === 0 ? 'selected' : ''}>普通会员</option>
              <option value="1" ${u.vipLevel === 1 ? 'selected' : ''}>银卡会员</option>
              <option value="2" ${u.vipLevel === 2 ? 'selected' : ''}>金卡会员</option>
            </select>
          </td>
          <td class="num">${u.orderCount}</td>
          <td class="num">¥${money(u.totalSpent)}</td>
        </tr>`
      )
      .join('');

    tbody.querySelectorAll('[data-vip]').forEach((sel) => {
      sel.addEventListener('change', async () => {
        const id = sel.dataset.vip;
        const level = Number(sel.value);
        sel.disabled = true;
        try {
          await API.put(`/api/admin/users/${id}/vip`, { vipLevel: level });
          toast(`会员等级已调整为${VIP_TEXT[level]}`);
        } catch (err) {
          toast(err.message, 'error');
        } finally {
          sel.disabled = false;
        }
      });
    });
  }

  load();
})();
