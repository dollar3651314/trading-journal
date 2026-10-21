// 导入：v1.2 起分成三页——安装 EA（推荐）、上传和转发、导入记录。原型里上传只显示模拟结果，不解析文件；EA 令牌和连接状态是模拟的。
// 失败、不是对账单都写明具体原因（AC-I6、AC-I7、C48）。
import { useState } from 'react';
import { Toast } from '../components/ui';
import { AccountPicker, Shell } from '../components/Shell';
import { fmtDate, useApp, useIsMobile, useT } from '../lib';
import { accountList } from '../mock/api';
import { IMPORTS, INBOUND_ADDRESS } from '../mock/data';

const EA_HOST = 'https://tradingjournal.example';

const MAX = 10 * 1024 * 1024;
// 去掉容易看错的字符（0/O、1/l/I、i）
const TOKEN_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function Import() {
  const t = useT();
  const { lang } = useApp();
  const mobile = useIsMobile();
  const [toast, setToast] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'ea' | 'files' | 'history'>('ea');
  const [token, setToken] = useState<string | null>(null);

  const take = (file: File | undefined) => {
    if (!file) return;
    if (!/\.html?$/i.test(file.name)) return setErr(`${file.name}：.htm / .html`);
    if (file.size > MAX) return setErr(`${file.name}：> 10MB`);
    setErr(null);
    setToast(t('import.protoResult', { file: file.name }));
  };
  const copy = async (text = INBOUND_ADDRESS) => {
    try { await navigator.clipboard.writeText(text); } catch { /* 原型里复制失败也不影响 */ }
    setToast(t('common.copied'));
  };
  // 令牌只在生成时显示一次；数据库只存哈希（架构方案 v1.1 2.6）。原型里随机生成一个看起来像的值。
  const regen = () => setToken(`tj_ea_${Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => TOKEN_CHARS[b % TOKEN_CHARS.length]).join('')}`);

  const steps = (
    <div className="card">
      <div className="row" style={{ justifyContent: 'flex-start', gap: 8, marginBottom: 10 }}><div className="h" style={{ margin: 0 }}>{t('ea.title')}</div><span className="tag on" style={{ cursor: 'default' }}>{t('ea.recommended')}</span></div>
      <div style={{ marginBottom: 14 }}><b>① {t('ea.step1')}</b>
        <div className="row" style={{ justifyContent: 'flex-start', gap: 8, marginTop: 6 }}><button className="btn" onClick={() => setToast(t('ea.protoDownload'))}>{t('ea.mt5')}</button><button className="btn2" onClick={() => setToast(t('ea.protoDownload'))}>{t('ea.mt4')}</button></div>
        <div className="mut" style={{ marginTop: 6 }}>🔒 {t('ea.readOnly')} · <a href="#source">{t('ea.source')}</a></div></div>
      <div style={{ marginBottom: 14 }}><b>② {t('ea.step2')}</b><div className="mut">{t('ea.step2b')}</div></div>
      <div style={{ marginBottom: 14 }}><b>③ {t('ea.step3')}</b><div className="mut">{t('ea.step3b')}</div>
        <div className="field row" style={{ margin: '6px 0 0' }}><span>{EA_HOST}</span><button className="btn2" onClick={() => copy(EA_HOST)}>{t('common.copy')}</button></div></div>
      <div><b>④ {t('ea.step4')}</b><div className="mut">{t('ea.step4b')}</div>
        <div className="field row" style={{ margin: '6px 0 0' }}>
          <span style={{ wordBreak: 'break-all' }}>{token ?? t('ea.tokenHidden')}</span>
          <span className="row" style={{ gap: 6 }}>{token && <button className="btn2" onClick={() => copy(token)}>{t('common.copy')}</button>}<button className="btn2" onClick={regen}>{t('ea.regenerate')}</button></span>
        </div>
        {token && <div style={{ color: "var(--warn)", fontSize: 12.5, marginTop: 6 }}>{t('ea.tokenOnce')}</div>}</div>
      <div className="note" style={{ marginTop: 12 }}>{t('ea.vpsHint')}</div>
    </div>
  );
  const stDot = { connected: 'var(--up)', disconnected: 'var(--warn)', never: 'var(--mut)' } as const;
  const status = (
    <div className="card">
      <div className="h">{t('ea.status')}</div>
      {accountList().map((a, i, all) => (
        <div key={a.id} className="row" style={{ padding: '10px 0', borderBottom: i < all.length - 1 ? '1px solid var(--line)' : 0, alignItems: 'flex-start' }}>
          <span><i className="dot" style={{ background: stDot[a.ea.status] }} /><b>{a.name}</b> · {a.platform}{a.accountNo !== '—' ? ` #${a.accountNo}` : ''}
            <div className="mut" style={{ marginLeft: 14 }}>
              {a.ea.status === 'connected' && t('ea.connected', { time: fmtDate(a.ea.lastPush!, lang), version: a.ea.version! })}
              {a.ea.status === 'disconnected' && t('ea.disconnected', { time: fmtDate(a.ea.lastPush!, lang) })}
              {a.ea.status === 'never' && t('ea.never')}
            </div>
          </span>
          {a.ea.status === 'connected' ? <span className="mut">{t('ea.pushesToday', { n: a.ea.pushesToday })}</span>
            : a.ea.status === 'disconnected' ? <button className="btn2" onClick={() => setToast(t('ea.troubleshoot'))}>{t('ea.howToFix')}</button>
            : <button className="btn2" onClick={regen}>{t('ea.genToken')}</button>}
        </div>
      ))}
    </div>
  );

  const upload = (
    <div className="card">
      <div className="h">{t('import.uploadTitle')}</div>
      <label className={`drop ${over ? 'over' : ''}`} style={{ display: 'block', cursor: 'pointer' }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]); }}>
        <div style={{ fontSize: 28 }} aria-hidden>⇪</div>
        <div>{t('import.drop')} <b style={{ color: 'var(--acc)' }}>{t('import.choose')}</b></div>
        <div className="mut">{t('import.limits')}</div>
        <input type="file" accept=".htm,.html" hidden onChange={(e) => take(e.target.files?.[0])} />
      </label>
      {err && <div className="err" style={{ margin: '0 0 10px' }}>{err}</div>}
      <label className="lbl">{t('import.toAccount')}</label>
      <AccountPicker />
    </div>
  );
  const email = (
    <div className="card">
      <div className="h">{t('import.emailTitle')}</div>
      <div className="mut" style={{ marginBottom: 8 }}>{t('import.emailYours')}</div>
      <div className="field row" style={{ marginBottom: 8 }}><span style={{ wordBreak: 'break-all' }}>{INBOUND_ADDRESS}</span><button className="btn2" onClick={() => copy()}>{t('common.copy')}</button></div>
      <div className="mut">{t('import.emailHint')}</div>
    </div>
  );
  const dot = (s: string) => ({ ok: 'var(--up)', parsing: 'var(--warn)', failed: 'var(--dn)', notStatement: 'var(--mut)' })[s];
  const history = (
    <div className="card">
      <div className="h">{t('import.history')}</div>
      {IMPORTS.map((x, i) => (
        <div key={x.id} className="row" style={{ padding: '10px 0', borderBottom: i < IMPORTS.length - 1 ? '1px solid var(--line)' : 0, alignItems: 'flex-start' }}>
          <span><i className="dot" style={{ background: dot(x.status) }} />{x.file}
            <div className="mut" style={{ marginLeft: 14 }}>
              {x.status === 'ok' && t('import.ok', { added: x.added, skipped: x.skipped })}
              {x.status === 'parsing' && t('import.parsing')}
              {x.status === 'failed' && t(`import.failed.${'reason' in x ? x.reason : 'noTable'}`)}
              {x.status === 'notStatement' && t('import.notStatement')}
            </div>
            {x.status === 'failed' && <div className="row" style={{ margin: '6px 0 0 14px', justifyContent: 'flex-start', gap: 8 }}><button className="btn2" onClick={() => setToast(t('import.protoResult', { file: x.file }))}>{t('common.retry')}</button><button className="btn2">{t('import.sendSample')}</button></div>}
          </span>
          <span className="mut">{fmtDate(x.at, lang)}</span>
        </div>
      ))}
    </div>
  );
  const tabs = (
    <div className="seg" role="tablist" style={{ marginBottom: mobile ? 14 : 20 }}>
      {(['ea', 'files', 'history'] as const).map((k) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t(`import.tab.${k}`)}</button>)}
    </div>
  );
  let body;
  if (tab === 'ea') body = mobile ? <div className="stack">{status}{steps}</div> : <div className="grid adapt" style={{ gridTemplateColumns: '1.4fr 1fr', alignItems: 'start' }}>{steps}{status}</div>;
  else if (tab === 'files') body = mobile ? <div className="stack">{upload}{email}</div> : <div className="grid adapt" style={{ gridTemplateColumns: '1fr 1fr' }}>{upload}{email}</div>;
  else body = history;
  return (
    <Shell>
      {tabs}
      {body}
      <Toast text={toast} onDone={() => setToast(null)} />
    </Shell>
  );
}
