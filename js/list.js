/* ============================================================
 * list.js —— 首页（笔记列表）逻辑
 * ------------------------------------------------------------
 * 职责：
 *   1. 拉取分类和笔记数据（通过 storage.js）
 *   2. 渲染分类筛选标签 + 笔记卡片
 *   3. 处理搜索和分类筛选
 * ============================================================ */

let allNotes = [];      // 全部笔记（内存缓存）
let allCategories = []; // 全部分类
let activeCategory = 'all'; // 当前选中的分类 id
let searchKeyword = '';     // 当前搜索词

// 页面加载完成后运行
document.addEventListener('DOMContentLoaded', init);

async function init() {
  renderNavAuth(); // 渲染右上角登录/登出/写笔记

  await loadAndRender();

  // 搜索框：输入时实时筛选
  document.getElementById('searchInput').addEventListener('input', (e) => {
    searchKeyword = e.target.value.trim().toLowerCase();
    renderCards();
  });

  subscribeRealtime(); // 数据库有变化时自动刷新列表
}

// 拉取数据并渲染（抽成函数，方便实时订阅回调里重复调用）
async function loadAndRender() {
  // 登录用户能看全部（含未发布草稿）；访客只看已发布；本地模式看全部
  const user = await getCurrentUser();
  const publishedOnly = isSupabaseConfigured() && !user;
  [allCategories, allNotes] = await Promise.all([
    getCategories(),
    getNotes({ publishedOnly }),
  ]);
  renderCategoryChips();
  renderCards();
}

// 订阅 notes 表的实时变化：任何人在别处改了笔记，本页自动刷新
function subscribeRealtime() {
  const sb = getSupabase();
  if (!sb) return; // 本地模式没有实时
  sb.channel('notes-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => {
      loadAndRender();
    })
    .subscribe();
}

// 渲染分类筛选标签
function renderCategoryChips() {
  const wrap = document.getElementById('categoryChips');
  // 先放一个"全部"
  const all = ['all', ...allCategories.map((c) => c.id)];
  wrap.innerHTML = all.map((id) => {
    const cat = allCategories.find((c) => c.id === id);
    const label = id === 'all' ? '全部' : `${cat.icon} ${cat.name}`;
    const activeCls = id === activeCategory ? 'active' : '';
    return `<button class="chip ${activeCls}" data-cat="${id}">${label}</button>`;
  }).join('');
  // 给每个标签绑定点击事件
  wrap.querySelectorAll('.chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      renderCategoryChips(); // 重新渲染以更新选中态
      renderCards();
    });
  });
}

// 根据当前筛选条件渲染卡片
function renderCards() {
  const grid = document.getElementById('cardGrid');
  const emptyTip = document.getElementById('emptyTip');

  // 过滤：分类 + 搜索词
  const filtered = allNotes.filter((n) => {
    const catMatch = activeCategory === 'all' || n.categoryId === activeCategory;
    const kw = searchKeyword;
    const kwMatch = !kw ||
      n.title.toLowerCase().includes(kw) ||
      (n.excerpt || '').toLowerCase().includes(kw) ||
      (n.content || '').toLowerCase().includes(kw);
    return catMatch && kwMatch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '';
    emptyTip.style.display = 'block';
    return;
  }
  emptyTip.style.display = 'none';

  grid.innerHTML = filtered.map((n) => {
    const cat = allCategories.find((c) => c.id === n.categoryId);
    const catLabel = cat ? `${cat.icon} ${cat.name}` : '未分类';
    return `
      <div class="card" onclick="location.href='./note.html?id=${n.id}'">
        <div class="card-cat">${catLabel}</div>
        <div class="card-title">${escapeHtml(n.title)}</div>
        <div class="card-excerpt">${escapeHtml(n.excerpt || '')}</div>
        <div class="card-date">${formatDate(n.updatedAt)}</div>
      </div>
    `;
  }).join('');
}
