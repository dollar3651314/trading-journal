// 考核：今日红线（估算）、规则模板、Telegram 战报预览（预览组件在 components/Alerts.tsx，其他推送的订阅在设置页）。战报里不出现任何品种和方向的建议（AC-R6）。
import { useState } from 'react';
import { PENDING_TEMPLATES, TEMPLATES } from '../../core/rules';
import { TgPreview } from '../components/Alerts';
import { LoadError, Loading, RedLineCard, money, useLoad } from '../components/ui';
import { Shell, useAccountId } from '../components/Shell';
import { useIsMobile, useT } from '../lib';
import { fetchAccount } from '../mock/api';
import { TODAY } from '../mock/data';

export function Prop() {
  const t = useT();
  const mobile = useIsMobile();
  const { accountId } = useAccountId();
  const { data: acc, error, loading, retry } = useLoad(() => fetchAccount(accountId), [accountId]);
  const [tplId, setTplId] = useState<string | null>(null);
  const [bound, setBound] = useState(true);
  const [code, setCode] = useState<string | null>(null);
  const [time, setTime] = useState('08:00');

  if (loading) return <Shell><Loading /></Shell>;
  if (error || !acc) return <Shell><LoadError onRetry={retry} /></Shell>;
  const current = tplId ?? acc.templateId ?? 'ftmo-2step';
  const tpl = TEMPLATES.find((x) => x.id === current)!;
  const view = { ...acc, templateId: current, initialCapital: acc.initialCapital || 10_000_000 };

  const setup = (
    <div className="card">
      <div className="h">{t('prop.setup')}</div>
      <label className="lbl" htmlFor="tpl">{t('prop.template')}</label>
      <select id="tpl" className="field" value={current} onChange={(e) => setTplId(e.target.value)}>
        {TEMPLATES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        {PENDING_TEMPLATES.map((x) => <option key={x.id} disabled>{t('prop.pending', { name: x.name })}</option>)}
        <option disabled>{t('prop.custom')}</option>
      </select>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label className="lbl">{t('prop.capital')}</label><div className="field">{money(view.initialCapital)}</div></div>
        <div><label className="lbl">{t('prop.start')}</label><div className="field">2026-10-01</div></div>
      </div>
      <div className="note">{t(`prop.formula.${tpl.id}`)}</div>
      <div className="note" style={{ marginTop: 6 }}>{t('prop.source', { source: tpl.source, date: tpl.checkedOn })}</div>
    </div>
  );
  const tg = (
    <div className="card">
      <div className="h">{t('prop.tg')}</div>
      {bound ? (
        <div className="row" style={{ marginBottom: 10 }}>
          <span>{t('prop.tgBound')}</span>
          <select className="pill" value={time} onChange={(e) => setTime(e.target.value)} aria-label="push time">{['07:00', '08:00', '09:00', '21:00'].map((x) => <option key={x} value={x}>{t('prop.pushAt', { time: x })}</option>)}</select>
        </div>
      ) : (
        <div style={{ marginBottom: 10 }}>
          <div className="mut" style={{ marginBottom: 8 }}>{t('prop.tgUnbound')}</div>
          {code ? <div className="field">{t('prop.tgCode', { bot: '@TradingJournalBot', code })}</div> : <button className="btn" onClick={() => setCode('TJ-482913')}>{t('prop.tgBind')}</button>}
        </div>
      )}
      <div className="mut" style={{ marginBottom: 6 }}>{t('prop.preview')}</div>
      <TgPreview kind="daily" acc={view} />
      <button className="btn2" style={{ marginTop: 10 }} onClick={() => { setBound(!bound); setCode(null); }}>{t('proto.toggleBind')}</button>
    </div>
  );
  return (
    <Shell>
      {mobile
        ? <div className="stack"><RedLineCard acc={view} today={TODAY} full />{tg}{setup}</div>
        : <div className="grid adapt" style={{ gridTemplateColumns: '1.1fr 1fr 1fr', alignItems: 'start' }}><RedLineCard acc={view} today={TODAY} full />{setup}{tg}</div>}
    </Shell>
  );
}
