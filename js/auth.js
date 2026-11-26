/* ============================================================
 * auth.js —— 登录状态与权限控制（所有页面共用）
 * ------------------------------------------------------------
 * 职责：
 *   1. renderNavAuth()：渲染导航
 *        #navMain  左侧：首页 / 分类 / 写笔记（紧跟在标题后面）
 *        #navAuth  右侧：登录 / 登出
 *   2. requireAuth()：编辑器、分类页的登录守卫
 *   3. 本地模式（未配置 Supabase）下免登录，方便阶段1体验
 * ============================================================ */

/** 渲染导航（左侧主链接 + 右侧登录态） */
async function renderNavAuth() {
  const mainEl = document.getElementById('navMain');
  const rightEl = document.getElementById('navAuth');
  if (!mainEl || !rightEl) return;

  const path = location.pathname;
  const onIndex = /\/$|index\.html$/i.test(path);
  const onCategories = /categories\.html$/i.test(path);
  const onEditor = /editor\.html$/i.test(path);

  const configured = isSupabaseConfigured();
  // 本地模式视为"已登录"，可以编辑
  const user = configured ? await getCurrentUser() : { id: 'local-mode' };
  const canEdit = !configured || !!user;

  // ---- 左侧主链接 ----
  let main = `<a href="./index.html"${onIndex ? ' class="active"' : ''}>首页</a>`;
  if (canEdit) {
    main += `<a href="./categories.html"${onCategories ? ' class="active"' : ''}>分类</a>`;
    main += `<a href="./editor.html"${onEditor ? ' class="active"' : ''}>写笔记</a>`;
  }
  mainEl.innerHTML = main;

  // ---- 右侧登录态 ----
  if (!configured) {
    rightEl.innerHTML = '';
    return;
  }
  if (user) {
    rightEl.innerHTML = `<a href="#" id="logoutBtn">登出</a>`;
    document.getElementById('logoutBtn').addEventListener('click', async (e) => {
      e.preventDefault();
      await getSupabase().auth.signOut();
      location.href = './index.html';
    });
  } else {
    rightEl.innerHTML = `<a href="./login.html">登录</a>`;
  }
}

/**
 * 登录守卫：受保护页面调用。
 * - 本地模式：直接放行
 * - 已登录：返回 user
 * - 未登录：跳转登录页
 */
async function requireAuth() {
  if (!isSupabaseConfigured()) return { id: 'local-mode' };
  const user = await getCurrentUser();
  if (!user) {
    location.href = './login.html';
    return null;
  }
  return user;
}
