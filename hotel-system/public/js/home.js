/* 首页逻辑：日期查询 + 房型卡片渲染 */

(async function () {
  await initHeader({ transparent: true });

  const checkInEl = document.getElementById('checkIn');
  const checkOutEl = document.getElementById('checkOut');
  const guestsEl = document.getElementById('guests');
  const form = document.getElementById('searchForm');
  const grid = document.getElementById('roomGrid');

  // 默认日期：今天 / 明天
  const today = todayStr();
  checkInEl.value = today;
  checkOutEl.value = addDaysStr(today, 1);
  checkInEl.min = today;
  checkOutEl.min = addDaysStr(today, 1);

  checkInEl.addEventListener('change', () => {
    if (!checkInEl.value) return;
    checkOutEl.min = addDaysStr(checkInEl.value, 1);
    if (checkOutEl.value <= checkInEl.value) {
      checkOutEl.value = addDaysStr(checkInEl.value, 1);
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!checkInEl.value || !checkOutEl.value) return toast('请选择入住与离店日期', 'error');
    if (checkOutEl.value <= checkInEl.value) return toast('离店日期必须晚于入住日期', 'error');
    const params = new URLSearchParams({
      checkIn: checkInEl.value,
      checkOut: checkOutEl.value,
      guests: guestsEl.value,
    });
    location.href = `rooms.html?${params.toString()}`;
  });

  // 加载房型
  try {
    const { list } = await API.get(`/api/room-types?checkIn=${today}&checkOut=${addDaysStr(today, 1)}`);
    render(list);
    const total = list.reduce((sum, t) => sum + t.totalRooms, 0);
    const statRooms = document.getElementById('statRooms');
    if (statRooms) statRooms.innerHTML = `${total}<small>间</small>`;
  } catch (err) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1">房型加载失败：${esc(err.message)}</div>`;
  }

  function unitPrice(type) {
    const vip = App.user ? App.user.vipLevel : 0;
    if (vip >= 2) return Number(type.price) * Number(type.discountVip2);
    if (vip === 1) return Number(type.price) * Number(type.discountVip1);
    return Number(type.price);
  }

  function render(list) {
    if (!list.length) {
      grid.innerHTML = '<div class="empty" style="grid-column:1/-1">暂无可预订房型</div>';
      return;
    }

    grid.innerHTML = list
      .map((t, i) => {
        const soldOut = t.availableRooms <= 0;
        const price = unitPrice(t);
        const origin = Number(t.price);
        const hasDiscount = price < origin;
        const link = `room.html?id=${t.id}&checkIn=${checkInEl.value}&checkOut=${checkOutEl.value}&guests=${guestsEl.value}`;

        return `
        <article class="room-card reveal" style="transition-delay:${i * 90}ms">
          <a class="room-card-media" href="${link}">
            <img src="${t.coverImg}" alt="${esc(t.name)}" loading="lazy">
            <span class="room-card-flag ${t.availableRooms <= 2 ? 'is-low' : ''}">
              ${soldOut ? '今日已订满' : `剩余 ${t.availableRooms} 间`}
            </span>
          </a>
          <div class="room-card-body">
            <h3 class="room-card-title">${esc(t.name)}</h3>
            <p class="room-card-meta">
              <span>${t.area}㎡</span><span>${esc(t.bedType)}</span><span>可住 ${t.capacity} 人</span>
            </p>
            <p class="room-card-intro">${esc(t.intro)}</p>
            <div class="room-card-foot">
              <div class="price">
                <small>¥</small>${money(price.toFixed(0))}
                ${hasDiscount ? `<span class="price-old">¥${money(origin)}</span>` : ''}
                <span>/ 晚起</span>
              </div>
              <a class="btn ${soldOut ? 'btn-light' : 'btn-outline'} btn-sm" href="${link}">
                ${soldOut ? '查看房型' : '查看详情'}
              </a>
            </div>
          </div>
        </article>`;
      })
      .join('');

    initReveal();
  }
})();
