/* 后台：订单管理（入住 / 退房结算） */

(async function () {
  const me = await initAdmin('bookings');
  if (!me) return;

  const tbody = document.getElementById('bookingBody');
  const chips = document.getElementById('statusChips');
  const keyword = document.getElementById('keyword');
  let status = qs('status') || 'all';

  chips.querySelectorAll('.chip').forEach((c) => {
    if (c.dataset.status === status) {
      chips.querySelectorAll('.chip').forEach((x) => x.classList.remove('is-active'));
      c.classList.add('is-active');
    }
    c.addEventListener('click', () => {
      chips.querySelectorAll('.chip').forEach((x) => x.classList.remove('is-active'));
      c.classList.add('is-active');
      status = c.dataset.status;
      load();
    });
  });

  let timer = null;
  keyword.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(load, 300);
  });

  async function load() {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (keyword.value.trim()) params.set('keyword', keyword.value.trim());

    try {
      const { list } = await API.get(`/api/admin/bookings?${params.toString()}`);
      render(list);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" style="color:var(--danger)">${esc(err.message)}</td></tr>`;
    }
  }

  function render(list) {
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="color:var(--muted)">没有符合条件的订单</td></tr>';
      return;
    }

    tbody.innerHTML = list
      .map((b) => {
        const nights = nightsBetween(b.checkIn, b.checkOut);
        const amount = b.finalAmount !== null ? b.finalAmount : b.amount;
        let actions = '';

        if (b.status === 'pending') {
          actions = `<button class="mini-btn is-primary" data-checkin="${b.id}">确认入住</button>`;
        } else if (b.status === 'checked_in') {
          actions = `<button class="mini-btn is-primary" data-checkout="${b.id}">确认退房</button>`;
        } else {
          actions = '<span style="color:var(--muted-light);font-size:12px">—</span>';
        }

        return `
        <tr>
          <td class="mono">${esc(b.orderNo)}</td>
          <td>
            ${esc(b.userName)}
            ${b.vipLevel > 0 ? `<span class="badge" style="margin-left:6px;height:18px;font-size:10px">${VIP_TEXT[b.vipLevel]}</span>` : ''}
          </td>
          <td>${esc(b.typeName)} · ${esc(b.roomNo)}</td>
          <td>${dateCN(b.checkIn)} — ${dateCN(b.checkOut)}
            <span style="color:var(--muted-light);font-size:11.5px">（${nights} 晚）</span></td>
          <td class="num">¥${money(amount)}
            ${b.finalAmount !== null && b.finalAmount !== b.amount ? '<span style="font-size:11px;color:var(--gold)">已结算</span>' : ''}</td>
          <td><span class="${ADMIN_STATUS_CLASS[b.status]}">${ADMIN_STATUS_TEXT[b.status]}</span></td>
          <td><div class="actions" style="justify-content:flex-end">${actions}</div></td>
        </tr>`;
      })
      .join('');

    tbody.querySelectorAll('[data-checkin]').forEach((btn) => {
      btn.addEventListener('click', () => doAction(btn, `/api/admin/bookings/${btn.dataset.checkin}/checkin`, '已办理入住'));
    });

    tbody.querySelectorAll('[data-checkout]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          const res = await API.post(`/api/admin/bookings/${btn.dataset.checkout}/checkout`);
          const s = res.settle;
          const msg = s.overtime
            ? `已退房。退房时刻超过 ${s.limitHour}:00，加收 ${s.extraNights} 天房费，实收 ¥${money(s.amount)}`
            : `已退房，实收 ¥${money(s.amount)}`;
          toast(msg);
          await load();
        } catch (err) {
          toast(err.message, 'error');
          btn.disabled = false;
        }
      });
    });
  }

  async function doAction(btn, url, okMsg) {
    btn.disabled = true;
    try {
      await API.post(url);
      toast(okMsg);
      await load();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  }

  load();
})();
