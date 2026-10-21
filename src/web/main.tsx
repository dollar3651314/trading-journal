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
import { Calculator, Landing, Login, Unsubscribe } from './pages/Public';

function Router() {
  const path = useLocation().split('?')[0]?.replace(/\/$/, '') || '/';
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
    case '/admin': return <Admin />;
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
