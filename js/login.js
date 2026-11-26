/* ============================================================
 * login.js —— 登录页逻辑
 * ------------------------------------------------------------
 * 用邮箱 + 密码登录 Supabase Auth。
 * 登录成功后跳回首页，会话会被持久化（关浏览器再开仍登录）。
 * ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  // 已登录就直接回首页
  if (await getCurrentUser()) {
    location.href = './index.html';
    return;
  }

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('loginErr');
    errEl.textContent = '';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    const sb = getSupabase();
    if (!sb) {
      errEl.textContent = '尚未配置 Supabase，请先在 js/config.js 填写 URL 和 Key。';
      return;
    }

    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      errEl.textContent = '登录失败：' + error.message;
      return;
    }
    // 成功，回首页
    location.href = './index.html';
  });
});
