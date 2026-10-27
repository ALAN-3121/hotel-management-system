/* 后台概览：KPI + ECharts 曲线 + 今日待办 */

(async function () {
  const me = await initAdmin('dashboard');
  if (!me) return;

  const today = new Date();
  document.getElementById('todayLine').textContent =
    `${today.getFullYear()} 年 ${today.getMonth() + 1} 月 ${today.getDate()} 日 · 数据实时统计`;

  let data;
  try {
    data = await API.get('/api/admin/overview');
  } catch (err) {
    toast(err.message, 'error');
    return;
  }

  document.getElementById('kpiRate').innerHTML = `${data.occupancyRate}<small>%</small>`;
  document.getElementById('kpiRateSub').textContent =
    `在住 ${data.occupied} 间 / 在售 ${data.totalRooms} 间`;
  document.getElementById('kpiIn').textContent = data.todayCheckIn;
  document.getElementById('kpiOut').textContent = data.todayCheckOut;
  document.getElementById('kpiRevenue').innerHTML = `¥${money(Math.round(data.revenue))}`;

  // ------------------------- 近 7 天入住率 -------------------------
  const trend = echarts.init(document.getElementById('trendChart'));
  trend.setOption({
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1b2521',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: (p) => `${p[0].axisValue}<br/>入住率 ${p[0].data}%（${data.trend[p[0].dataIndex].occupied} 间）`,
    },
    xAxis: {
      type: 'category',
      data: data.trend.map((d) => d.date),
      axisLine: { lineStyle: { color: '#e7e2d8' } },
      axisTick: { show: false },
      axisLabel: { color: '#7a827c', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      max: (v) => Math.max(40, Math.ceil(v.max / 10) * 10),
      splitLine: { lineStyle: { color: '#f0ece4' } },
      axisLabel: { color: '#a8aea9', fontSize: 11, formatter: '{value}%' },
    },
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: data.trend.map((d) => d.rate),
        lineStyle: { width: 2, color: '#a8824c' },
        itemStyle: { color: '#a8824c', borderColor: '#fff', borderWidth: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(168,130,76,0.22)' },
            { offset: 1, color: 'rgba(168,130,76,0.01)' },
          ]),
        },
      },
    ],
  });

  // ------------------------- 各房型占用 -------------------------
  const typeChart = echarts.init(document.getElementById('typeChart'));
  const stats = data.typeStats;
  typeChart.setOption({
    grid: { left: 8, right: 24, top: 16, bottom: 40, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#1b2521',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 },
    },
    legend: {
      show: true,
      bottom: 0,
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: '#7a827c', fontSize: 11 },
    },
    xAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#f0ece4' } },
      axisLabel: { color: '#a8aea9', fontSize: 11 },
    },
    yAxis: {
      type: 'category',
      data: stats.map((s) => s.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#222a26', fontSize: 12 },
    },
    series: [
      {
        name: '已占用',
        type: 'bar',
        stack: 'total',
        barWidth: 14,
        data: stats.map((s) => s.used),
        itemStyle: { color: '#1b2521' },
      },
      {
        name: '空闲',
        type: 'bar',
        stack: 'total',
        barWidth: 14,
        data: stats.map((s) => Math.max(0, s.total - s.used)),
        itemStyle: { color: '#e7e2d8' },
      },
    ],
  });

  window.addEventListener('resize', () => {
    trend.resize();
    typeChart.resize();
  });

  // ------------------------- 今日待办 -------------------------
  const tbody = document.getElementById('todoBody');
  try {
    const { list } = await API.get('/api/admin/bookings?status=pending');
    const todayStrVal = todayStr();
    const rows = list.filter((b) => b.checkIn <= todayStrVal).slice(0, 6);

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:var(--muted)">今天没有待入住的订单</td></tr>';
    } else {
      tbody.innerHTML = rows
        .map(
          (b) => `
          <tr>
            <td class="mono">${esc(b.orderNo)}</td>
            <td>${esc(b.userName)}</td>
            <td>${esc(b.typeName)} · ${esc(b.roomNo)}</td>
            <td>${dateCN(b.checkIn)} — ${dateCN(b.checkOut)}</td>
            <td class="num">¥${money(b.amount)}</td>
            <td><button class="mini-btn is-primary" data-checkin="${b.id}">办理入住</button></td>
          </tr>`
        )
        .join('');

      tbody.querySelectorAll('[data-checkin]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            await API.post(`/api/admin/bookings/${btn.dataset.checkin}/checkin`);
            toast('已办理入住');
            setTimeout(() => location.reload(), 700);
          } catch (err) {
            toast(err.message, 'error');
            btn.disabled = false;
          }
        });
      });
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:var(--danger)">${esc(err.message)}</td></tr>`;
  }
})();
