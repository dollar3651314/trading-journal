// 登录后的页面框架：电脑是顶部导航，手机是底部标签栏（C64）。顶部始终显示原型标识。
import { createContext, useContext, useState, type ReactNode } from 'react';
import { Link, useApp, useIsMobile, useLocation, useT, type ThemePref } from '../lib';
import { accountList } from '../mock/api';

const TABS = [
  ['/app', 'nav.dashboard'], ['/app/trades', 'nav.trades'], ['/app/import', 'nav.import'], ['/app/prop', 'nav.prop'], ['/app/settings', 'nav.settings'],
] as const;

const AccountCtx = createContext<{ accountId: string; setAccountId: (id: string) => void }>({ accountId: 'ftmo-100k', setAccountId: () => {} });
export const useAccountId = () => useContext(AccountCtx);

export function Banner() {
  const t = useT();
  return <div className="banner">{t('proto.banner')}</div>;
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const q = new URLSearchParams(location.search).get('account');
  const [accountId, setAccountId] = useState(accountList().some((a) => a.id === q) ? q! : 'ftmo-100k');
  return <AccountCtx.Provider value={{ accountId, setAccountId }}>{children}</AccountCtx.Provider>;
}

export function AccountPicker() {
  const { accountId, setAccountId } = useAccountId();
  return (
    <select className="pill" value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label="account">
      {accountList().map((a) => <option key={a.id} value={a.id}>{a.name} · {a.platform}</option>)}
    </select>
  );
}

export function Prefs() {
  const { lang, setLang, theme, setTheme } = useApp();
  const t = useT();
  const next: Record<ThemePref, ThemePref> = { system: 'dark', dark: 'light', light: 'system' };
  return <>
    <button className="pill" onClick={() => setTheme(next[theme])} aria-label={t('common.theme')}>{theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐'} {t(`common.theme.${theme}`)}</button>
    <button className="pill" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>{t('common.lang')}</button>
  </>;
}

export function Shell({ children, wide = true }: { children: ReactNode; wide?: boolean }) {
  const t = useT();
  const path = useLocation().split('?')[0];
  const mobile = useIsMobile();
  const isOn = (to: string) => (to === '/app' ? path === '/app' || path === '/app/stats' : path?.startsWith(to));
  if (mobile) {
    return (
      <div className="m">
        <Banner />
        <div className="page">
          <div className="row" style={{ marginBottom: 14 }}><AccountPicker /><span className="row" style={{ gap: 6 }}><Prefs /></span></div>
          {children}
        </div>
        <nav className="tabbar">{TABS.map(([to, k]) => <Link key={to} to={to} className={isOn(to) ? 'on' : ''}>{t(k)}</Link>)}</nav>
      </div>
    );
  }
  return (
    <div>
      <Banner />
      <div className="page" style={wide ? undefined : { maxWidth: 1000 }}>
        <div className="top">
          <div className="row" style={{ justifyContent: 'flex-start' }}>
            <Link to="/app" className="logo">{t('app.name')}</Link>
            <nav className="nav">{TABS.map(([to, k]) => <Link key={to} to={to} className={isOn(to) ? 'on' : ''}>{t(k)}</Link>)}</nav>
          </div>
          <div className="row" style={{ gap: 8 }}><AccountPicker /><Prefs /><Link to="/admin" className="pill">{t('nav.admin')}</Link></div>
        </div>
        {children}
        <div className="note" style={{ textAlign: 'center', marginTop: 20 }}>{t('common.disclaimer')}</div>
      </div>
    </div>
  );
}
