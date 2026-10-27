/* 客房列表：日期筛选 + 实时房量 + 排序 */

(async function () {
  await initHeader();

  const elIn = document.getElementById('fCheckIn');
  const elOut = document.getElementById('fCheckOut');
  const elGuests = document.getElementById('fGuests');
  const elSort = document.getElementById('fSort');
  const grid = document.getElementById('roomGrid');
  const counter = document.getElementById('filterCount');

  const today = todayStr();
  elIn.min = today;
  elOut.min = addDaysStr(today, 1);
  elIn.value = qs('checkIn') || today;
  elOut.value = qs('checkOut') || addDaysStr(elIn.value, 1);
  elGuests.value = qs('guests') || '2';

  let cache = [];

  function syncUrl() {
    const params = new URLSearchParams({
      checkIn: elIn.value,
      checkOut: elOut.value,
      guests: elGuests.value,
    });
    history.replaceState(null, '', `?${params.toString()}`);
  }

  async function load() {
    if (!elIn.value || !elOut.value) return;
    if (elOut.value <= elIn.value) {
      toast('离店日期必须晚于入住日期', 'error');
      return;
    }
    syncUrl();
    grid.innerHTML = '<div class="loading" style="grid-column:1/-1">正在查询空房…</div>';

    try {
      const params = new URLSearchParams({
        checkIn: elIn.value,
        checkOut: elOut.value,
        guests: elGuests.value,
      });
      const data = await API.get(`/api/room-types?${params.toString()}`);
      cache = data.list;
      render();
    } catch (err) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1">${esc(err.message)}</div>`;
    }
  }

  function unitPrice(t) {
    const vip = App.user ? App.user.vipLevel : 0;
    if (vip >= 2) return Number(t.price) * Number(t.discountVip2);
    if (vip === 1) return Number(t.price) * Number(t.discountVip1);
    return Number(t.price);
  }

  function render() {
    let list = [...cache];
    if (elSort.value === 'asc') list.sort((a, b) => a.price - b.price);
    if (elSort.value === 'desc') list.sort((a, b) => b.price - a.price);

    const nights = nightsBetween(elIn.value, elOut.value);
    const totalAvail = list.reduce((s, t) => s + t.availableRooms, 0);
    counter.textContent = `${elIn.value} 至 ${elOut.value} · 共 ${nights} 晚 · 可订 ${totalAvail} 间`;

    if (!list.length) {
      grid.innerHTML = '<div class="empty" style="grid-column:1/-1">没有符合条件的房型</div>';
      return;
    }

    grid.innerHTML = list
      .map((t, i) => {
        const soldOut = t.availableRooms <= 0;
        const price = unitPrice(t);
        const origin = Number(t.price);
        const link = `room.html?id=${t.id}&checkIn=${elIn.value}&checkOut=${elOut.value}&guests=${elGuests.value}`;

        return `
        <article class="room-card reveal" style="transition-delay:${i * 80}ms">
          <a class="room-card-media" href="${link}">
            <img src="${t.coverImg}" alt="${esc(t.name)}" loading="lazy">
            <span class="room-card-flag ${t.availableRooms <= 2 ? 'is-low' : ''}">
              ${soldOut ? '该日期已订满' : `可订 ${t.availableRooms} 间`}
            </span>
          </a>
          <div class="room-card-body">
            <h3 class="room-card-title">${esc(t.name)}</h3>
            <p class="room-card-meta">
              <span>${t.area}㎡</span><span>${esc(t.bedType)}</span><span>可住 ${t.capacity} 人</span>
            </p>
            <p class="room-card-intro">${esc(t.intro)}</p>
            <div class="room-card-foot">
              <div>
                <div class="price">
                  <small>¥</small>${money(price.toFixed(0))}
                  ${price < origin ? `<span class="price-old">¥${money(origin)}</span>` : ''}
                  <span>/ 晚</span>
                </div>
                ${soldOut ? '' : `<div style="font-size:12px;color:var(--muted);margin-top:8px">${nights} 晚合计 ¥${money(t.quote ? t.quote.amount : price * nights)}</div>`}
              </div>
              <a class="btn ${soldOut ? 'btn-light' : 'btn-outline'} btn-sm" href="${link}">
                ${soldOut ? '查看房型' : '预订'}
              </a>
            </div>
          </div>
        </article>`;
      })
      .join('');

    initReveal();
  }

  elIn.addEventListener('change', () => {
    elOut.min = addDaysStr(elIn.value, 1);
    if (elOut.value <= elIn.value) elOut.value = addDaysStr(elIn.value, 1);
    load();
  });
  elOut.addEventListener('change', load);
  elGuests.addEventListener('change', load);
  elSort.addEventListener('change', render);

  load();
})();
