/* ============================================================
 * common.js —— 公共工具（所有页面都能用）
 * ------------------------------------------------------------
 * 依赖：marked.js（Markdown 转 HTML）、highlight.js（代码高亮）
 * 这两个库通过 CDN 在各页面的 <head> 里引入，本文件直接用全局的
 * marked 和 hljs 对象。
 * ============================================================ */

// 配置 marked：开启 GitHub 风格换行（单换行也会变成 <br>）和表格
marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * 把 Markdown 文本渲染成 HTML 字符串
 * @param {string} md - Markdown 原文
 * @returns {string} HTML
 */
function renderMarkdown(md) {
  if (!md) return '';
  return marked.parse(md);
}

/**
 * 对某个容器内的所有 <pre><code> 做代码高亮
 * 必须在把 HTML 插入 DOM 之后调用
 * @param {HTMLElement} container
 */
function highlightCodeIn(container) {
  if (!container || !window.hljs) return;
  container.querySelectorAll('pre code').forEach((block) => {
    hljs.highlightElement(block);
  });
}

/**
 * 从渲染好的 HTML 容器里抽取 h2/h3，生成目录（用于详情页右侧导航）
 * @param {HTMLElement} container - 已渲染 Markdown 的容器
 * @returns {Array<{id, text, level}>}
 */
function buildToc(container) {
  const toc = [];
  container.querySelectorAll('h2, h3').forEach((el, i) => {
    if (!el.id) el.id = 'heading-' + i; // 给标题加锚点 id
    toc.push({ id: el.id, text: el.textContent, level: el.tagName.toLowerCase() });
  });
  return toc;
}

/**
 * 把时间字符串格式化成友好显示
 */
function formatDate(s) {
  if (!s) return '';
  return s; // 阶段1已存为 YYYY-MM-DD，直接显示
}

/**
 * 取 URL 查询参数，如 note.html?id=xxx
 */
function getQuery(name) {
  const p = new URLSearchParams(location.search);
  return p.get(name);
}

/**
 * 把文本转成安全的 HTML（防止标题里有特殊字符破坏页面）
 * 所有页面共用，所以放在公共文件里
 */
function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s == null ? '' : String(s);
  return div.innerHTML;
}
