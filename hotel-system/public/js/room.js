/* 房型详情：多角度图集 + 360° 全景看房 + 实时报价下单 */

(async function () {
  const me = await initHeader();

  const typeId = Number(qs('id') || 1);
  const state = { type: null, photos: [], panoramas: [], nights: 1, available: 0, panoIndex: 0 };

  const elIn = document.getElementById('bCheckIn');
  const elOut = document.getElementById('bCheckOut');
  const elGuests = document.getElementById('bGuests');
  const elRemark = document.getElementById('bRemark');
  const form = document.getElementById('bookingForm');
  const submitBtn = document.getElementById('submitBtn');

  const today = todayStr();
  elIn.min = today;
  elOut.min = addDaysStr(today, 1);
  elIn.value = qs('checkIn') || today;
  elOut.value = qs('checkOut') || addDaysStr(elIn.value, 1);
  if (qs('guests')) elGuests.value = qs('guests');

  // ------------------------- 加载房型 -------------------------
  let data;
  try {
    data = await API.get(`/api/room-types/${typeId}`);
  } catch (err) {
    document.getElementById('roomName').textContent = '房型不存在';
    toast(err.message, 'error');
    return;
  }

  state.type = data.type;
  state.photos = data.photos;
  state.panoramas = data.panoramas;

  renderDetail(data);
  await refreshAvailability();
  updateQuote();

  // ------------------------- 渲染 -------------------------
  function renderDetail({ type, photos, panoramas, rooms }) {
    document.title = `${type.name} · 云栖酒店`;
    document.getElementById('crumbName').textContent = type.name;
    document.getElementById('roomName').textContent = type.name;
    document.getElementById('roomIntro').textContent = type.intro;

    document.getElementById('roomMeta').innerHTML = `
      <div>面积<strong>${type.area} ㎡</strong></div>
      <div>床型<strong>${esc(type.bedType)}</strong></div>
      <div>可住<strong>${type.capacity} 人</strong></div>
      <div>楼层<strong>${[...new Set(rooms.map((r) => r.floor))].sort().join(' / ')} 层</strong></div>
    `;

    document.getElementById('roomFeatures').innerHTML = type.features
      .map((f) => `<span class="tag">${esc(f)}</span>`)
      .join('');

    // 图集
    const mainImg = document.getElementById('mainImage');
    mainImg.src = photos[0] ? photos[0].url : type.coverImg;

    const thumbs = document.getElementById('thumbs');
    thumbs.innerHTML = photos
      .map(
        (p, i) => `
        <button class="gallery-thumb ${i === 0 ? 'is-active' : ''}" type="button" data-index="${i}">
          <img src="${p.url}" alt="${esc(p.caption || type.name)}">
        </button>`
      )
      .join('');

    thumbs.addEventListener('click', (e) => {
      const btn = e.target.closest('.gallery-thumb');
      if (!btn) return;
      const i = Number(btn.dataset.index);
      thumbs.querySelectorAll('.gallery-thumb').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      mainImg.classList.add('is-fading');
      setTimeout(() => {
        mainImg.src = photos[i].url;
        mainImg.classList.remove('is-fading');
      }, 160);
    });

    // 房间状态
    const STATUS_LABEL = {
      idle: '空闲',
      booked: '已预订',
      occupied: '入住中',
      cleaning: '待清洁',
      maintenance: '维修停用',
    };
    const STATUS_COLOR = {
      idle: 'var(--success)',
      booked: 'var(--gold)',
      occupied: 'var(--danger)',
      cleaning: 'var(--muted)',
      maintenance: 'var(--muted-light)',
    };
    document.getElementById('roomList').innerHTML = rooms
      .map(
        (r) => `
        <span class="tag" style="border-color:${STATUS_COLOR[r.status]};color:${STATUS_COLOR[r.status]}">
          ${r.roomNo} · ${STATUS_LABEL[r.status]}
        </span>`
      )
      .join('');

    // 无全景图时隐藏按钮
    if (!panoramas.length) {
      document.getElementById('panoBtn').style.display = 'none';
    }
  }

  // ------------------------- 报价 -------------------------
  function vipDiscount() {
    const vip = me ? me.vipLevel : 0;
    if (vip >= 2) return Number(state.type.discountVip2);
    if (vip === 1) return Number(state.type.discountVip1);
    return 1;
  }

  function updateQuote() {
    const t = state.type;
    if (!t) return;
    const nights = nightsBetween(elIn.value, elOut.value);
    const discount = vipDiscount();
    const roomFee = nights * Number(t.price);
    const total = Math.round(roomFee * discount * 100) / 100;
    state.nights = nights;

    document.getElementById('panelPrice').innerHTML = `<small>¥</small>${money((Number(t.price) * discount).toFixed(0))}`;
    document.getElementById('sumRoom').textContent = `¥${money(roomFee)}（${nights} 晚）`;
    document.getElementById('sumDiscount').textContent =
      discount < 1 ? `-${Math.round((1 - discount) * 100)}%（${VIP_TEXT[me ? me.vipLevel : 0]}）` : '暂无折扣';
    document.getElementById('sumTotal').textContent = `¥${money(total)}`;
  }

  async function refreshAvailability() {
    if (elOut.value <= elIn.value) return;
    try {
      const res = await API.get(
        `/api/room-types/${typeId}/availability?checkIn=${elIn.value}&checkOut=${elOut.value}`
      );
      state.available = res.available;
      submitBtn.disabled = res.available <= 0;
      submitBtn.textContent = res.available > 0 ? `立即预订（可订 ${res.available} 间）` : '该日期已订满';
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  elIn.addEventListener('change', () => {
    elOut.min = addDaysStr(elIn.value, 1);
    if (elOut.value <= elIn.value) elOut.value = addDaysStr(elIn.value, 1);
    updateQuote();
    refreshAvailability();
  });

  elOut.addEventListener('change', () => {
    updateQuote();
    refreshAvailability();
  });

  // ------------------------- 提交订单 -------------------------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!me) {
      location.href = `login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
      return;
    }
    if (elOut.value <= elIn.value) return toast('离店日期必须晚于入住日期', 'error');

    submitBtn.disabled = true;
    submitBtn.textContent = '正在提交…';
    try {
      const { booking } = await API.post('/api/bookings', {
        typeId,
        checkIn: elIn.value,
        checkOut: elOut.value,
        guests: Number(elGuests.value),
        remark: elRemark.value.trim(),
      });
      toast(`预订成功，订单号 ${booking.orderNo}`);
      setTimeout(() => {
        location.href = 'orders.html';
      }, 900);
    } catch (err) {
      toast(err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = '立即预订';
    }
  });

  // ------------------------- 360° 全景 -------------------------
  let viewer = null;
  const panoModal = document.getElementById('panoModal');

  function openPano() {
    if (!state.panoramas.length) return;
    panoModal.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    const url = state.panoramas[state.panoIndex].url;
    if (!viewer) {
      viewer = window.pannellum.viewer('panoViewer', {
        type: 'equirectangular',
        panorama: url,
        autoLoad: true,
        showControls: true,
        showFullscreenCtrl: true,
        compass: false,
        hfov: 105,
        minHfov: 60,
        maxHfov: 120,
        pitch: 0,
        yaw: 0,
        backgroundColor: [11, 16, 14],
      });
    } else {
      viewer.resize();
    }
    setTimeout(() => viewer && viewer.resize(), 80);
  }

  function closePano() {
    panoModal.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  document.getElementById('panoBtn').addEventListener('click', openPano);
  document.getElementById('panoClose').addEventListener('click', closePano);
  panoModal.addEventListener('click', (e) => {
    if (e.target === panoModal) closePano();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panoModal.classList.contains('is-open')) closePano();
  });
  window.addEventListener('resize', () => viewer && viewer.resize());
})();
