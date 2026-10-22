// 付费页（需求说明书 v1.3 草稿 CH7，AC-P4、P5、P7）：要登录，只有订单的客户本人能打开。
// 显示金额、USDT-TRC20 收款地址和二维码、剩余有效时间；客户转账后填交易哈希。到没到账由 Amos 在后台核对，这里不查链上（CH8）。
import { useState } from 'react';
import qrcode from 'qrcode-generator';
import { canSubmit, effectiveStatus, formatUsdt } from '../../core/billing';
import { Toast } from '../components/ui';
import { Shell } from '../components/Shell';
import { Link, fmtDate, useApp, useT } from '../lib';
import { actions, customerById, NOW, RECEIVE_DEMO, useAdmin } from '../mock/admin';
import { LOGIN_EMAIL } from '../mock/data';

function Qr({ text }: { text: string }) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  return <div className="qr" aria-label="QR" dangerouslySetInnerHTML={{ __html: q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }) }} />;
}

export function Pay({ code }: { code: string }) {
  const t = useT();
  const { lang } = useApp();
  const s = useAdmin();
  const [hash, setHash] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const o = s.orders.find((x) => x.code === code);
  const owner = o && customerById(s, o.customer);
  // 原型里登录的客户是 trader@example.com；正式版按服务器会话判断
  if (!o || owner?.email !== LOGIN_EMAIL) {
    return <Shell wide={false}><div className="card state"><div className="h">{t('pay.notFound')}</div><div className="mut">{t('pay.notFoundHint')}</div><Link to="/app/settings" className="btn2" >{t('pay.toSettings')}</Link></div></Shell>;
  }
  const st = effectiveStatus(o, NOW);
  const left = Math.max(0, Math.floor((Date.parse(o.expiresAt) - Date.parse(NOW)) / 3600000));
  const used = s.orders.filter((x) => x.id !== o.id && x.txHash).map((x) => x.txHash!);
  const submit = () => {
    const res = canSubmit(o, hash, NOW, used);
    if (res !== 'ok') return setErr(t(`pay.err.${res}`));
    setErr(null);
    actions.submitHash(o.id, hash);
    setToast(t('pay.submitted'));
  };
  const address = s.settings.address;
  return (
    <Shell wide={false}>
      <div className="stack">
        <div className="card">
          <div className="row wrap"><div className="h" style={{ margin: 0 }}>{t('pay.title')}</div><span className="mut">{t('pay.order', { id: o.id })}</span></div>
          <div className="row wrap" style={{ margin: '12px 0', alignItems: 'baseline' }}>
            <span>Pro · {t(`plan.${o.period}`)}</span>
            <span className="big">{formatUsdt(o.amount)}</span>
          </div>
          <div className={`paystate ${st}`}>
            <b>{t(`order.status.${st}`)}</b>
            <div>{st === 'pending' && t('pay.state.pending', { h: left, at: fmtDate(o.expiresAt, lang) })}
              {st === 'submitted' && t('pay.state.submitted')}
              {st === 'confirmed' && t('pay.state.confirmed', { until: owner.proUntil ?? '—' })}
              {st === 'problem' && t('pay.state.problem', { reason: o.reason ?? '' })}
              {st === 'expired' && t('pay.state.expired')}
              {st === 'cancelled' && t('pay.state.cancelled')}</div>
          </div>
        </div>
        {(st === 'pending' || st === 'problem') && <>
          <div className="card">
            <div className="h">{t('pay.step1')}</div>
            {address === RECEIVE_DEMO && <div className="err" style={{ margin: '0 0 10px' }}>⚠ {t('pay.demoAddress')}</div>}
            <div className="grid adapt" style={{ gridTemplateColumns: '160px 1fr', gap: 16, alignItems: 'start' }}>
              <Qr text={address} />
              <div>
                <label className="lbl">{t('pay.network')}</label>
                <div className="field"><b>USDT · TRC20（TRON）</b></div>
                <label className="lbl">{t('pay.address')}</label>
                <div className="field row"><span style={{ wordBreak: 'break-all', fontFamily: 'ui-monospace, monospace' }}>{address}</span><button className="btn2" onClick={() => { navigator.clipboard?.writeText(address).catch(() => {}); setToast(t('common.copied')); }}>{t('common.copy')}</button></div>
                <label className="lbl">{t('pay.amount')}</label>
                <div className="field row"><b>{(o.amount / 100).toFixed(2)}</b><button className="btn2" onClick={() => { navigator.clipboard?.writeText((o.amount / 100).toFixed(2)).catch(() => {}); setToast(t('common.copied')); }}>{t('common.copy')}</button></div>
              </div>
            </div>
            <div style={{ color: 'var(--warn)', fontSize: 12.5 }}>⚠ {t('pay.warnNetwork')}</div>
            <div className="note" style={{ marginTop: 6 }}>{t('pay.noKey')}</div>
          </div>
          <div className="card">
            <div className="h">{t('pay.step2')}</div>
            <label className="lbl" htmlFor="tx">{t('pay.hash')}</label>
            <input id="tx" className="field" value={hash} onChange={(e) => setHash(e.target.value)} placeholder={t('pay.hashPlaceholder')} spellCheck={false} autoComplete="off" style={{ fontFamily: 'ui-monospace, monospace' }} />
            {err && <div className="err">{err}</div>}
            <button className="btn block" disabled={!hash.trim()} onClick={submit}>{t('pay.paid')}</button>
            <div className="note" style={{ marginTop: 8 }}>{t('pay.manual')}</div>
          </div>
        </>}
        {st === 'submitted' && o.txHash && <div className="card"><div className="mut">{t('pay.hash')}</div><div style={{ wordBreak: 'break-all', fontFamily: 'ui-monospace, monospace' }}>{o.txHash}</div><div className="note" style={{ marginTop: 6 }}>{t('pay.manual')}</div></div>}
        {(st === 'expired' || st === 'cancelled') && <div className="card"><Link to="/app/settings" className="btn">{t('pay.again')}</Link></div>}
        <div className="note" style={{ textAlign: 'center' }}><Link to="/app/settings">{t('pay.toSettings')}</Link></div>
      </div>
      <Toast text={toast} onDone={() => setToast(null)} />
    </Shell>
  );
}
