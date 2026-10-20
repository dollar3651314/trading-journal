// 设置：交易账户（平台、服务器时区、币种）、专属收件地址、语言和主题、删除全部数据（AC-A3 二次确认）。
import { useState } from 'react';
import { Toast } from '../components/ui';
import { Prefs, Shell } from '../components/Shell';
import { useT } from '../lib';
import { accountList } from '../mock/api';
import { INBOUND_ADDRESS } from '../mock/data';

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
