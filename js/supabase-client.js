/* ============================================================
 * supabase-client.js —— Supabase 客户端的唯一初始化入口
 * ------------------------------------------------------------
 * 全项目只有这里调用 supabase.createClient，其它文件要用就调 getSupabase()。
 * 这样 URL/Key 只在 config.js 读一次，不会出现"某个页面连不上"的问题。
 *
 * 降级策略：如果用户还没填 config.js（还是占位符），getSupabase() 返回 null，
 *          storage.js 会自动降级用 localStorage，保证阶段1的功能不崩。
 * ============================================================ */

let _client = null; // 单例：只创建一次

/**
 * 获取 Supabase 客户端实例（单例）
 * @returns {SupabaseClient|null} 未配置时返回 null
 */
function getSupabase() {
  if (_client) return _client;

  const cfg = window.SUPABASE_CONFIG;
  // 没填配置，或是占位符 → 视为未配置
  const notConfigured =
    !cfg ||
    !cfg.url || cfg.url.indexOf('你的') >= 0 ||
    !cfg.anonKey || cfg.anonKey.indexOf('你的') >= 0;

  if (notConfigured) return null;

  // 创建客户端：开启会话持久化（关浏览器再打开仍保持登录）和自动续期
  _client = supabase.createClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return _client;
}

/** 是否已配置 Supabase */
function isSupabaseConfigured() {
  return getSupabase() !== null;
}

/**
 * 获取当前登录用户（未登录返回 null）
 * 注意：这是异步的，因为要从本地存储恢复会话
 */
async function getCurrentUser() {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: { user } } = await sb.auth.getUser();
  return user;
}
