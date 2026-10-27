/* 后台：客房维护（增删改查） */

(async function () {
  const me = await initAdmin('rooms');
  if (!me) return;

  const tbody = document.getElementById('roomBody');
  const typeFilter = document.getElementById('typeFilter');
  const statusFilter = document.getElementById('statusFilter');
  const modal = document.getElementById('roomModal');
  let rows = [];
  let types = [];

  async function load() {
    try {
      const data = await API.get('/api/admin/rooms');
      rows = data.list;
      types = data.types;

      if (!typeFilter.options.length || typeFilter.options.length <= 1) {
        typeFilter.innerHTML =
          '<option value="">全部房型</option>' +
          types.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
        document.getElementById('fTypeId').innerHTML = types
          .map((t) => `<option value="${t.id}">${esc(t.name)}</option>`)
          .join('');
      }
      render();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="color:var(--danger)">${esc(err.message)}</td></tr>`;
    }
  }

  function render() {
    let list = rows;
    if (typeFilter.value) list = list.filter((r) => String(r.typeId) === typeFilter.value);
    if (statusFilter.value) list = list.filter((r) => r.status === statusFilter.value);

    document.getElementById('roomCount').textContent =
      `共 ${list.length} 间 / 全部 ${rows.length} 间`;

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:var(--muted)">没有符合条件的房间</td></tr>';
      return;
    }

    const badgeOf = {
      idle: 'badge badge-success',
      booked: 'badge',
      occupied: 'badge badge-danger',
      cleaning: 'badge badge-muted',
      maintenance: 'badge badge-muted',
    };

    tbody.innerHTML = list
      .map(
        (r) => `
        <tr>
          <td class="num">${esc(r.roomNo)}</td>
          <td>${esc(r.typeName)}</td>
          <td>${r.floor} 层</td>
          <td class="num">¥${money(r.price)}</td>
          <td><span class="${badgeOf[r.status]}">${ROOM_STATUS_TEXT[r.status]}</span></td>
          <td>
            <div class="actions" style="justify-content:flex-end">
              <button class="mini-btn" data-edit="${r.id}">编辑</button>
              <button class="mini-btn is-danger" data-del="${r.id}">删除</button>
            </div>
          </td>
        </tr>`
      )
      .join('');

    tbody.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => openEdit(btn.dataset.edit));
    });
    tbody.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', () => removeRoom(btn.dataset.del));
    });
  }

  function openAdd() {
    document.getElementById('modalTitle').textContent = '新增客房';
    document.getElementById('roomId').value = '';
    document.getElementById('fRoomNo').value = '';
    document.getElementById('fFloor').value = '';
    document.getElementById('fStatus').value = 'idle';
    document.getElementById('fTypeId').value = types[0] ? types[0].id : '';
    modal.classList.add('is-open');
  }

  function openEdit(id) {
    const r = rows.find((x) => String(x.id) === String(id));
    if (!r) return;
    document.getElementById('modalTitle').textContent = `编辑客房 ${r.roomNo}`;
    document.getElementById('roomId').value = r.id;
    document.getElementById('fRoomNo').value = r.roomNo;
    document.getElementById('fFloor').value = r.floor;
    document.getElementById('fTypeId').value = r.typeId;
    document.getElementById('fStatus').value = r.status;
    modal.classList.add('is-open');
  }

  async function removeRoom(id) {
    const r = rows.find((x) => String(x.id) === String(id));
    if (!confirm(`确认删除房间 ${r ? r.roomNo : ''}？此操作不可撤销。`)) return;
    try {
      await API.del(`/api/admin/rooms/${id}`);
      toast('已删除');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  document.getElementById('addRoomBtn').addEventListener('click', openAdd);
  modal.querySelectorAll('[data-close]').forEach((b) =>
    b.addEventListener('click', () => modal.classList.remove('is-open'))
  );
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('is-open');
  });

  document.getElementById('roomForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('roomId').value;
    const payload = {
      roomNo: document.getElementById('fRoomNo').value.trim(),
      floor: Number(document.getElementById('fFloor').value),
      typeId: Number(document.getElementById('fTypeId').value),
      status: document.getElementById('fStatus').value,
    };

    try {
      if (id) await API.put(`/api/admin/rooms/${id}`, payload);
      else await API.post('/api/admin/rooms', payload);
      modal.classList.remove('is-open');
      toast(id ? '已保存' : '已新增客房');
      await load();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  typeFilter.addEventListener('change', render);
  statusFilter.addEventListener('change', render);

  load();
})();
