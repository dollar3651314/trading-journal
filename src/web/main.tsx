import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { AppProvider, useLocation } from './lib';
import { AccountProvider } from './components/Shell';
import { Dashboard } from './pages/Dashboard';
import { Trades } from './pages/Trades';
import { Import } from './pages/Import';
import { Prop } from './pages/Prop';
import { Settings } from './pages/Settings';
import { Admin } from './pages/Admin';
import { AdminLogin, Calculator, Landing, Login, Unsubscribe } from './pages/Public';
import { Pay } from './pages/Pay';
import { useSession } from './mock/session';

// v1.3 草稿：客户端（/app、/pay）要先登录，后台（/admin）要用管理员邮箱登录（F11）。没登录时在原地址显示登录页，登录后直接显示原页面。
function Router() {
  const path = useLocation().split('?')[0]?.replace(/\/$/, '') || '/';
  const session = useSession();
  if (path === '/admin/login') return <AdminLogin />;
  if (path.startsWith('/admin')) return session.admin ? <Admin path={path} /> : <AdminLogin />;
  if ((path.startsWith('/app') || path.startsWith('/pay/')) && !session.user) return <Login />;
  if (path.startsWith('/pay/')) return <Pay code={path.split('/')[2]!} />;
  switch (path) {
    case '/': return <Landing />;
    case '/calculator': return <Calculator />;
    case '/login': return <Login />;
    case '/unsubscribe': return <Unsubscribe />;
    case '/app': return <Dashboard />;
    case '/app/stats': return <Dashboard stats />;
    case '/app/trades': return <Trades />;
    case '/app/import': return <Import />;
    case '/app/prop': return <Prop />;
    case '/app/settings': return <Settings />;
    default: return <Landing />;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <AccountProvider>
        <Router />
      </AccountProvider>
    </AppProvider>
  </StrictMode>,
);
