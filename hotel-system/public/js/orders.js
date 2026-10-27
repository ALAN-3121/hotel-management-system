/* 我的订单：列表 + 取消 */

(async function () {
  const me = await initHeader();
  const box = document.getElementById('orderList');

  if (!me) {
    location.href = `login.html?next=${encodeURIComponent('orders.html')}`;
    return;
  }

  let list = [];

  async function load() {
    try {
      const data = await API.get('/api/bookings/mine');
      list = data.list;
      render();
    } catch (err) {
      box.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
    }
  }

  function render() {
    const active = list.filter((b) => b.status === 'pending' || b.status === 'checked_in').length;
    document.getElementById('orderSummary').textContent =
      `共 ${list.length} 条记录，其中 ${active} 条正在进行中。`;

    if (!list.length) {
      box.innerHTML = `
        <div class="empty">
          <p style="margin-bottom:20px">还没有订单，去挑一间房吧</p>
          <a class="btn btn-outline" href="rooms.html">浏览客房</a>
        </div>`;
      return;
    }

    box.innerHTML = list
      .map((b) => {
        const nights = nightsBetween(b.checkIn, b.checkOut);
        const amount = b.finalAmount !== null ? b.finalAmount : b.amount;
        const canCancel = b.status === 'pending';
        const checkedOut = b.status === 'checked_out';

        return `
        <article class="order-card">
          <div class="order-media">
            <img src="${b.coverImg}" alt="${esc(b.typeName)}">
          </div>
          <div>
            <div class="order-head">
              <h3>${esc(b.typeName)}</h3>
              <span class="${STATUS_CLASS[b.status]}">${STATUS_TEXT[b.status]}</span>
            </div>
            <div class="order-info">
              <div>房间号：<span>${esc(b.roomNo)}</span></div>
              <div>订单号：<span>${esc(b.orderNo)}</span></div>
              <div>入住：<span>${dateCN(b.checkIn)}</span></div>
              <div>离店：<span>${dateCN(b.checkOut)}（共 ${nights} 晚）</span></div>
              <div>入住人数：<span>${b.guests} 位</span></div>
              <div>下单时间：<span>${String(b.createdAt).slice(0, 16)}</span></div>
              ${b.remark ? `<div style="grid-column:1/-1">备注：<span>${esc(b.remark)}</span></div>` : ''}
              ${checkedOut && b.checkedOutAt ? `<div style="grid-column:1/-1">退房时间：<span>${String(b.checkedOutAt).slice(0, 16)}</span></div>` : ''}
            </div>
          </div>
          <div class="order-side">
            <div>
              <div class="order-amount"><small>¥</small>${money(amount)}</div>
              <div style="font-size:11.5px;color:var(--muted-light);margin-top:4px">
                ${checkedOut ? '已结算' : b.finalAmount !== null ? '已结算' : '预估金额'}
              </div>
            </div>
            <div style="display:flex;gap:8px">
              <a class="mini-btn" href="room.html?id=${b.typeId}">再订一次</a>
              ${canCancel ? `<button class="mini-btn is-danger" data-cancel="${b.id}">取消订单</button>` : ''}
            </div>
          </div>
        </article>`;
      })
      .join('');

    box.querySelectorAll('[data-cancel]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('确认取消该订单？')) return;
        btn.disabled = true;
        try {
          await API.post(`/api/bookings/${btn.dataset.cancel}/cancel`);
          toast('订单已取消');
          await load();
        } catch (err) {
          toast(err.message, 'error');
          btn.disabled = false;
        }
      });
    });
  }

  load();
})();
