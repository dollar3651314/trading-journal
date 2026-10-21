// 设置：交易账户（平台、服务器时区、币种）、通知订阅（AC-N1）、行为规则参数（AC-B5）、专属收件地址、语言和主题、删除全部数据（AC-A3 二次确认）。
import { Fragment, useState } from 'react';
import { DEFAULT_PARAMS, type BehaviorParams } from '../../core/behavior';
import { KINDS, MailPreview, TgPreview, type Kind } from '../components/Alerts';
import { RULES } from '../components/Behavior';
import { Toast } from '../components/ui';
import { Prefs, Shell } from '../components/Shell';
import { Link, useIsMobile, useT } from '../lib';
import { accountList } from '../mock/api';
import { INBOUND_ADDRESS, LOGIN_EMAIL, SUBSCRIPTIONS, TG_HANDLE } from '../mock/data';

type Subs = Record<Kind, { tg: boolean; mail: boolean }>;
const initialSubs = () => Object.fromEntries(SUBSCRIPTIONS.map((x) => [x.kind, { tg: x.tg, mail: x.mail }])) as Subs;

/** 通知订阅：5 种内容 × Telegram / 邮件，每行可以预览（AC-N1）。电脑是表格，手机每种内容一张小卡片（C64）。 */
function Notify({ onSaved }: { onSaved: () => void }) {
  const t = useT();
  const mobile = useIsMobile();
  const [subs, setSubs] = useState<Subs>(initialSubs);
  const [daily, setDaily] = useState('08:00');
  const [weekly, setWeekly] = useState('08:00');
  const [levels, setLevels] = useState({ a: 70, b: 90 });
  const [preview, setPreview] = useState<{ kind: Kind; ch: 'tg' | 'mail' } | null>(null);
  const acc = accountList()[0]!;
  const toggle = (k: Kind, ch: 'tg' | 'mail') => setSubs({ ...subs, [k]: { ...subs[k], [ch]: !subs[k][ch] } });
  const times = ['07:00', '08:00', '09:00', '21:00'];
  const when = (k: Kind) => {
    if (k === 'daily') return <select className="pill" value={daily} onChange={(e) => setDaily(e.target.value)} aria-label={t('notify.kind.daily')}>{times.map((x) => <option key={x} value={x}>{t('notify.when.daily', { time: x })}</option>)}</select>;
    if (k === 'weekly') return <select className="pill" value={weekly} onChange={(e) => setWeekly(e.target.value)} aria-label={t('notify.kind.weekly')}>{times.map((x) => <option key={x} value={x}>{t('notify.when.weekly', { time: x })}</option>)}</select>;
    if (k === 'redline') return <span className="mut">{t('notify.when.redline', { a: levels.a, b: levels.b })} <select className="pill" value={`${levels.a}/${levels.b}`} onChange={(e) => { const [a, b] = e.target.value.split('/').map(Number); setLevels({ a: a!, b: b! }); }} aria-label={t('notify.levels')}>{['60/80', '70/90', '80/95'].map((x) => <option key={x}>{x}</option>)}</select></span>;
    return <span className="mut">{t(`notify.when.${k}`)}</span>;
  };
  const box = (k: Kind, ch: 'tg' | 'mail') => (
    <label className="check"><input type="checkbox" checked={subs[k][ch]} onChange={() => toggle(k, ch)} aria-label={`${t(`notify.kind.${k}`)} · ${t(`notify.${ch}`)}`} />{mobile && t(`notify.${ch}`)}</label>
  );
  const previewBtn = (k: Kind) => <button className="btn2" onClick={() => setPreview(preview?.kind === k ? null : { kind: k, ch: subs[k].mail && !subs[k].tg ? 'mail' : 'tg' })}>{t('notify.preview')}</button>;
  const previewBox = preview && (
    <div className="previewbox">
      <div className="row" style={{ marginBottom: 8 }}>
        <span className="seg">{(['tg', 'mail'] as const).map((ch) => <button key={ch} className={preview.ch === ch ? 'on' : ''} onClick={() => setPreview({ ...preview, ch })}>{t(`notify.${ch}`)}</button>)}</span>
        <button className="btn2" onClick={() => setPreview(null)}>{t('common.close')}</button>
      </div>
      {preview.ch === 'tg' ? <TgPreview kind={preview.kind} acc={acc} /> : <MailPreview kind={preview.kind} acc={acc} to={LOGIN_EMAIL} />}
      <div className="note" style={{ marginTop: 6 }}>{t('notify.previewNote')}</div>
    </div>
  );
  return (
    <div className="card">
      <div className="h">{t('notify.title')}</div>
      <div className="grid" style={{ gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div className="field" style={{ margin: 0 }}>Telegram · <b>{t('notify.tgBound', { handle: TG_HANDLE })}</b> <Link to="/app/prop">{t('notify.tgManage')}</Link></div>
        <div className="field" style={{ margin: 0 }}>{t('notify.mail')} · <b>{LOGIN_EMAIL}</b> <span className="mut">{t('notify.mailHint')}</span></div>
      </div>
      {mobile ? (
        <div className="stack">{KINDS.map((k) => (
          <div key={k} style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <div className="row"><b>{t(`notify.kind.${k}`)}</b>{previewBtn(k)}</div>
            <div style={{ margin: '6px 0' }}>{when(k)}</div>
            <div className="row" style={{ justifyContent: 'flex-start', gap: 18 }}>{box(k, 'tg')}{box(k, 'mail')}</div>
            {preview?.kind === k && previewBox}
          </div>
        ))}</div>
      ) : (
        <table>
          <thead><tr><th>{t('notify.colKind')}</th><th>{t('notify.colWhen')}</th><th style={{ textAlign: 'center' }}>{t('notify.tg')}</th><th style={{ textAlign: 'center' }}>{t('notify.mail')}</th><th /></tr></thead>
          <tbody>{KINDS.map((k) => (
            <Fragment key={k}>
              <tr><td><b>{t(`notify.kind.${k}`)}</b></td><td>{when(k)}</td><td style={{ textAlign: 'center' }}>{box(k, 'tg')}</td><td style={{ textAlign: 'center' }}>{box(k, 'mail')}</td><td className="r">{previewBtn(k)}</td></tr>
              {preview?.kind === k && <tr><td colSpan={5}>{previewBox}</td></tr>}
            </Fragment>
          ))}</tbody>
        </table>
      )}
      <div className="note" style={{ margin: '10px 0' }}>{t('notify.defaults')}</div>
      <button className="btn" onClick={onSaved}>{t('common.save')}</button>
    </div>
  );
}

const FIELDS: { [R in keyof BehaviorParams]: (keyof BehaviorParams[R] & string)[] } = {
  revenge: ['windowMin', 'lotsRatio'],
  overtrading: ['lookbackDays', 'ratio', 'minTrades'],
  holding: ['tradeRatio', 'summaryRatio', 'lookbackDays'],
};

/** 行为规则参数：调整阈值或关闭某条规则；只影响之后的新交易，已有标记保留（AC-B5）。 */
function RuleParams({ onSaved }: { onSaved: (msg: string) => void }) {
  const t = useT();
  const [p, setP] = useState<BehaviorParams>(DEFAULT_PARAMS);
  const set = <R extends keyof BehaviorParams>(r: R, k: keyof BehaviorParams[R], v: number | boolean) => setP({ ...p, [r]: { ...p[r], [k]: v } });
  return (
    <div className="card">
      <div className="row"><div className="h" style={{ margin: 0 }}>{t('rules.title')}</div><button className="btn2" onClick={() => setP(DEFAULT_PARAMS)}>{t('rules.reset')}</button></div>
      <div className="mut" style={{ margin: '4px 0 8px' }}>{t('rules.hint')}</div>
      {RULES.map((r) => (
        <div key={r} style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
          <label className="check" style={{ fontWeight: 700 }}><input type="checkbox" checked={p[r].enabled} onChange={() => set(r, 'enabled', !p[r].enabled)} />{t(`behavior.${r}`)}</label>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 8, opacity: p[r].enabled ? 1 : 0.5 }}>
            {(FIELDS[r] as string[]).map((k) => (
              <div key={k}><label className="lbl" htmlFor={`${r}-${k}`}>{t(`rules.${r}.${k}`)}</label>
                <input id={`${r}-${k}`} className="field" type="number" min={1} step={/Ratio|ratio/.test(k) ? 0.1 : 1} disabled={!p[r].enabled} value={(p[r] as unknown as Record<string, number>)[k]} onChange={(e) => set(r, k as never, Number(e.target.value))} style={{ margin: 0 }} /></div>
            ))}
          </div>
        </div>
      ))}
      <button className="btn" onClick={() => onSaved(t('rules.saved'))}>{t('common.save')}</button>
    </div>
  );
}

export function Settings() {
  const t = useT();
  const [toast, setToast] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState('');
  return (
    <Shell wide={false}>
      <div className="stack">
        <div className="card">
          <div className="row"><div className="h" style={{ margin: 0 }}>{t('settings.accounts')}</div><button className="btn2" onClick={() => setToast(t('common.saved'))}>{t('settings.addAccount')}</button></div>
          {accountList().map((a) => (
            <div key={a.id} className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
              <div><label className="lbl">{a.name}</label>{a.accountNo !== '—' && <div className="mut">#{a.accountNo}</div>}</div>
              <div><label className="lbl">{t('settings.platform')}</label><select className="field" defaultValue={a.platform}><option>MT4</option><option>MT5</option></select></div>
              <div><label className="lbl">{t('settings.serverTz')}</label><select className="field" defaultValue={a.serverTz}>{['GMT+2/+3', 'GMT+0', 'GMT+3', 'GMT+8'].map((z) => <option key={z}>{z}</option>)}</select></div>
              <div><label className="lbl">{t('settings.currency')}</label><select className="field" defaultValue={a.currency}><option>USD</option><option>EUR</option><option>GBP</option></select></div>
            </div>
          ))}
          <div className="note" style={{ marginTop: 8 }}>{t('settings.serverTzHint')}</div>
        </div>
        <Notify onSaved={() => setToast(t('common.saved'))} />
        <RuleParams onSaved={setToast} />
        <div className="card">
          <div className="h">{t('settings.inbound')}</div>
          <div className="field" style={{ wordBreak: 'break-all' }}>{INBOUND_ADDRESS}</div>
          <button className="btn2" onClick={() => setToast(t('common.saved'))}>{t('settings.regenerate')}</button>
        </div>
        <div className="card">
          <div className="h">{t('settings.language')} · {t('common.theme')}</div>
          <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}><Prefs /></div>
        </div>
        <div className="card">
          <div className="h dn">{t('settings.delete')}</div>
          <div className="mut" style={{ marginBottom: 12 }}>{t('settings.deleteHint')}</div>
          {!confirm ? <button className="btn btn-danger" onClick={() => setConfirm(true)}>{t('settings.delete')}</button> : (
            <div>
              <label className="lbl" htmlFor="del">{t('settings.deleteConfirm')}</label>
              <input id="del" className="field" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
              <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
                <button className="btn btn-danger" disabled={typed !== 'DELETE'} onClick={() => { setToast(t('settings.deleted')); setConfirm(false); setTyped(''); }}>{t('common.confirm')}</button>
                <button className="btn2" onClick={() => { setConfirm(false); setTyped(''); }}>{t('common.cancel')}</button>
              </div>
            </div>
          )}
        </div>
      </div>
      <Toast text={toast} onDone={() => setToast(null)} />
    </Shell>
  );
}
