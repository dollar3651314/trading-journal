// 前端的公共工具：多语言、主题、路由、手机/电脑判断、浏览器本地偏好。
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import zh from '../../messages/zh.json';
import en from '../../messages/en.json';

export type Lang = 'zh' | 'en';
export type ThemePref = 'system' | 'dark' | 'light';
const MESSAGES: Record<Lang, Record<string, string>> = { zh, en };

// 浏览器本地存储可能不可用（隐私模式等），读写都要兜底。
// 存储格式带版本号（prefs.v1），以后改格式时换键名，不会读到旧格式的值（C55，v0.10 补充）。
const PREFS_KEY = 'tj.prefs.v1';
interface Prefs { lang?: Lang; theme?: ThemePref }
function readPrefs(): Prefs {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Prefs; } catch { return {}; }
}
function writePrefs(p: Prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify({ ...readPrefs(), ...p })); } catch { /* 忽略 */ }
}

const query = () => new URLSearchParams(location.search);
const initialLang = (): Lang => {
  const q = query().get('lang');
  if (q === 'zh' || q === 'en') return q;
  return readPrefs().lang ?? (navigator.language.startsWith('zh') ? 'zh' : 'en');
};
const initialTheme = (): ThemePref => {
  const q = query().get('theme');
  if (q === 'dark' || q === 'light' || q === 'system') return q;
  return readPrefs().theme ?? 'system';
};

interface Ctx { lang: Lang; setLang: (l: Lang) => void; theme: ThemePref; setTheme: (t: ThemePref) => void }
const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [theme, setThemeState] = useState<ThemePref>(initialTheme);
  useEffect(() => {
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => { document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'; }, [lang]);
  const setLang = (l: Lang) => { setLangState(l); writePrefs({ lang: l }); };
  const setTheme = (t: ThemePref) => { setThemeState(t); writePrefs({ theme: t }); };
  return <AppCtx.Provider value={{ lang, setLang, theme, setTheme }}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error('AppProvider missing');
  return c;
}

/** t('key', { n: 3 })：找不到键时显示键名，方便发现漏写的文案。 */
export function useT() {
  const { lang } = useApp();
  return (key: string, vars: Record<string, string | number> = {}) =>
    (MESSAGES[lang][key] ?? key).replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

// —— 路由：用 history API，地址就是真实路径，方便给 Amos 完整链接 ——
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); addEventListener('popstate', fn); return () => { listeners.delete(fn); removeEventListener('popstate', fn); }; };
export function navigate(to: string) {
  const keep = new URLSearchParams(location.search);
  const url = new URL(to, location.origin);
  for (const k of ['lang', 'theme', 'state']) if (keep.has(k) && !url.searchParams.has(k)) url.searchParams.set(k, keep.get(k)!);
  history.pushState(null, '', url.pathname + url.search + url.hash);
  scrollTo(0, 0);
  listeners.forEach((fn) => fn());
}
export function useLocation() {
  return useSyncExternalStore(subscribe, () => location.pathname + location.search);
}
export function Link({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return <a href={to} className={className} onClick={(e) => { e.preventDefault(); navigate(to); }}>{children}</a>;
}

/** 手机和电脑按 768 分界，两套页面结构（C64）。 */
export function useIsMobile() {
  const get = () => matchMedia('(max-width: 767px)').matches;
  return useSyncExternalStore((fn) => { const mq = matchMedia('(max-width: 767px)'); mq.addEventListener('change', fn); return () => mq.removeEventListener('change', fn); }, get);
}

export const fmtDate = (iso: string, lang: Lang) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return lang === 'zh' ? `${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}` : d.toLocaleString('en-GB', { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};
