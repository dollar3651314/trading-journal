// 看板：电脑"一屏看全"，手机"一屏一件事"（C64，效果图见 00-架构方案 第 5 节）。行为习惯卡片电脑在权益曲线下面，手机在"更多统计"里。
import { computeMetrics } from '../../core/metrics';
import { BehaviorCard } from '../components/Behavior';
import { Bars, Empty, EquityCurve, Kpi, LoadError, Loading, RedLineCard, SymbolTable, money, pct, ratio, sign, useLoad } from '../components/ui';
import { Shell, useAccountId } from '../components/Shell';
import { Link, fmtDate, useApp, useIsMobile, useT } from '../lib';
import { fetchAccount } from '../mock/api';
import { TODAY } from '../mock/data';

export function Dashboard({ stats = false }: { stats?: boolean }) {
  const t = useT();
  const { lang } = useApp();
  const mobile = useIsMobile();
  const { accountId } = useAccountId();
  const { data: acc, error, loading, retry } = useLoad(() => fetchAccount(accountId), [accountId]);

  let body;
  if (loading) body = <Loading />;
  else if (error || !acc) body = <LoadError onRetry={retry} />;
  else if (acc.trades.length === 0) body = <div className="stack"><Empty /><div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}><Kpi label={t('kpi.net')} value={money(0)} /><Kpi label={t('kpi.winRate')} value="—" /></div></div>;
  else {
    const m = computeMetrics(acc.trades);
    const kpis = [
      [t('kpi.net'), money(m.net, true), sign(m.net)],
      [t('kpi.winRate'), pct(m.winRate), ''],
      [t('kpi.payoff'), ratio(m.payoffRatio), ''],
      [t('kpi.maxDd'), money(m.maxDrawdown), m.maxDrawdown < 0 ? 'dn' : ''],
    ] as const;
    const sessions = <Bars groups={m.bySession} label={(k) => t(`session.${k}`)} />;
    const weekdays = <Bars groups={m.byWeekday} label={(k) => t(`weekday.${k}`)} />;
    const costs = <div className="mut">{t('dash.costs', { commission: money(m.commission), swap: money(m.swap), taxes: money(m.taxes) })} · {t('kpi.cost')} {pct(m.costRatio)} · {t('kpi.pf')} {ratio(m.profitFactor)}</div>;
    const lastImport = acc.lastImport && <span className="mut">{t('dash.lastImport', { time: fmtDate(acc.lastImport, lang) })}</span>;

    if (mobile && stats) {
      body = <div className="stack">
        <div className="row"><Link to="/app">‹ {t('nav.dashboard')}</Link><span className="h" style={{ margin: 0 }}>{t('dash.moreStats')}</span><span /></div>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}><Kpi label={t('kpi.payoff')} value={ratio(m.payoffRatio)} /><Kpi label={t('kpi.pf')} value={ratio(m.profitFactor)} /></div>
        <BehaviorCard trades={acc.trades} today={TODAY} />
        <div className="card"><div className="h">{t('dash.bySymbol')}</div><SymbolTable groups={m.bySymbol} /></div>
        <div className="card"><div className="h">{t('dash.bySession')}</div>{sessions}</div>
        <div className="card"><div className="h">{t('dash.byWeekday')}</div>{weekdays}</div>
        <div className="card">{costs}</div>
      </div>;
    } else if (mobile) {
      body = <div className="stack">
        <RedLineCard acc={acc} today={TODAY} full={false} />
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}><Kpi label={kpis[0][0]} value={kpis[0][1]} cls={kpis[0][2]} /><Kpi label={kpis[1][0]} value={kpis[1][1]} /></div>
        <div className="card"><div className="row"><div className="h">{t('dash.curve')}</div><span className="mut">{t('kpi.trades', { n: m.count })}</span></div><EquityCurve points={m.curve} height={110} /></div>
        <Link to="/app/stats" className="card row" ><span style={{ color: 'var(--fg)' }}>{t('dash.moreStats')} <span className="mut">　{t('dash.moreStatsHint')}</span></span><span className="mut">›</span></Link>
        <div className="note" style={{ textAlign: 'center' }}>{t('common.disclaimer')}</div>
      </div>;
    } else {
      body = <div className="stack">
        <div className="grid adapt" style={{ gridTemplateColumns: '1fr 2fr' }}>
          <RedLineCard acc={acc} today={TODAY} full footer={<div className="row" style={{ marginTop: 14 }}><Link to="/app/import" className="btn">{t('dash.importNew')}</Link>{lastImport}</div>} />
          <div className="stack">
            <div className="grid adapt2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>{kpis.map(([l, v, c]) => <Kpi key={l} label={l} value={v} cls={c} />)}</div>
            <div className="card"><div className="row"><div className="h">{t('dash.curve')}</div><span className="mut">{t('dash.curveHint')} · {t('kpi.trades', { n: m.count })}</span></div><EquityCurve points={m.curve} height={190} /></div>
            <BehaviorCard trades={acc.trades} today={TODAY} wide />
          </div>
        </div>
        <div className="grid adapt" style={{ gridTemplateColumns: '1.2fr 1fr 1fr' }}>
          <div className="card"><div className="h">{t('dash.bySymbol')}</div><SymbolTable groups={m.bySymbol} /></div>
          <div className="card"><div className="h">{t('dash.bySession')}</div>{sessions}</div>
          <div className="card"><div className="h">{t('dash.byWeekday')}</div>{weekdays}</div>
        </div>
        {costs}
      </div>;
    }
  }
  return <Shell>{body}</Shell>;
}
