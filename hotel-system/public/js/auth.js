/* 登录 / 注册 */

(function () {
  const tabs = document.querySelectorAll('.auth-tab');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const next = qs('next') || 'index.html';

  // 已登录直接跳转
  API.get('/api/auth/me')
    .then(({ user }) => {
      if (user) location.href = next;
    })
    .catch(() => {});

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      const isLogin = tab.dataset.tab === 'login';
      loginForm.style.display = isLogin ? 'grid' : 'none';
      registerForm.style.display = isLogin ? 'none' : 'grid';
    });
  });

  function done(user) {
    toast(`欢迎，${user.realName}`);
    setTimeout(() => {
      location.href = user.role === 'admin' && next === 'index.html' ? 'admin/dashboard.html' : next;
    }, 500);
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = loginForm.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = '登录中…';
    try {
      const { user } = await API.post('/api/auth/login', {
        username: document.getElementById('loginUser').value.trim(),
        password: document.getElementById('loginPass').value,
      });
      done(user);
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = '登 录';
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = registerForm.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = '提交中…';
    try {
      const { user } = await API.post('/api/auth/register', {
        username: document.getElementById('regUser').value.trim(),
        realName: document.getElementById('regName').value.trim(),
        phone: document.getElementById('regPhone').value.trim(),
        password: document.getElementById('regPass').value,
      });
      done(user);
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = '注 册 并 登 录';
    }
  });
})();
