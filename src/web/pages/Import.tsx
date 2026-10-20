// 导入：上传 HTML 报表、专属收件地址、导入记录。原型里上传只显示模拟结果，不解析文件。
// 失败、不是对账单都写明具体原因（AC-I6、AC-I7、C48）。
import { useState } from 'react';
import { Toast } from '../components/ui';
import { AccountPicker, Shell } from '../components/Shell';
import { fmtDate, useApp, useIsMobile, useT } from '../lib';
import { IMPORTS, INBOUND_ADDRESS } from '../mock/data';

const MAX = 10 * 1024 * 1024;

export function Import() {
  const t = useT();
  const { lang } = useApp();
  const mobile = useIsMobile();
  const [toast, setToast] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const take = (file: File | undefined) => {
    if (!file) return;
    if (!/\.html?$/i.test(file.name)) return setErr(`${file.name}：.htm / .html`);
    if (file.size > MAX) return setErr(`${file.name}：> 10MB`);
    setErr(null);
    setToast(t('import.protoResult', { file: file.name }));
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(INBOUND_ADDRESS); } catch { /* 原型里复制失败也不影响 */ }
    setToast(t('common.copied'));
  };

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
      <div className="field row" style={{ marginBottom: 8 }}><span style={{ wordBreak: 'break-all' }}>{INBOUND_ADDRESS}</span><button className="btn2" onClick={copy}>{t('common.copy')}</button></div>
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
  return (
    <Shell>
      {mobile ? <div className="stack">{upload}{email}{history}</div> : <div className="stack"><div className="grid adapt" style={{ gridTemplateColumns: '1fr 1fr' }}>{upload}{email}</div>{history}</div>}
      <Toast text={toast} onDone={() => setToast(null)} />
    </Shell>
  );
}
