// 公开页面：落地页、免费计算器（不用注册）、登录、退订（邮件里的链接，不用登录，AC-N6）。计算器用的是 src/core 的真实规则，结果和考核页一致（AC-G4）。
import { useEffect, useState } from 'react';
import { parseMoney } from '../../core/money';
import { PENDING_TEMPLATES, TEMPLATES, computeRedLines } from '../../core/rules';
import { KINDS } from '../components/Alerts';
import { money } from '../components/ui';
import { Banner, Prefs } from '../components/Shell';
import { Link, navigate, useIsMobile, useT } from '../lib';
import { accountList } from '../mock/api';
import { ADMIN_EMAIL, loginAdmin, loginUser } from '../mock/session';
import { LOGIN_EMAIL } from '../mock/data';

const CHANNELS = ['reddit', 'calculator', 'cn-group', 'forexfactory', 'other'];

function PublicTop() {
  const t = useT();
  return (
    <div className="top">
      <Link to="/" className="logo">{t('app.name')}</Link>
      <span className="row" style={{ gap: 8 }}><Prefs /><Link to="/login" className="pill">{t('login.title')}</Link></span>
    </div>
  );
}

function Apply({ channel }: { channel: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  const [email, setEmail] = useState('');
  const ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  return (
    <div className="card" id="apply">
      <div className="h">{t('landing.applyTitle')}</div>
      <div className="mut" style={{ marginBottom: 12 }}>{t('landing.applyBody')}</div>
      <label className="lbl" htmlFor="ap-email">{t('login.email')}</label>
      <input id="ap-email" className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label className="lbl" htmlFor="ap-ch">{t('landing.channel')}</label>
      <select id="ap-ch" className="field" defaultValue={channel}>{CHANNELS.map((c) => <option key={c} value={c}>{t(`channel.${c}`)}</option>)}</select>
      <button className="btn block" disabled={!ok} onClick={() => setDone(true)}>{t('landing.submit')}</button>
      {done && <div className="mut" role="status" style={{ marginTop: 8 }}>{t('landing.submitted')}</div>}
    </div>
  );
}

export function Landing() {
  const t = useT();
  const mobile = useIsMobile();
  // 从计算器、登录页点"申请内测"进来时（/#apply），滚动到申请表
  useEffect(() => { if (location.hash === '#apply') document.getElementById('apply')?.scrollIntoView(); }, []);
  return (
    <div className={mobile ? 'm' : ''}>
      <Banner />
      <div className="page" style={{ maxWidth: 1080 }}>
        <PublicTop />
        <div className="hero">
          <div className="title">{t('landing.headline')}</div>
          <div className="mut" style={{ fontSize: 15, margin: '12px auto 20px', maxWidth: 640 }}>{t('landing.sub')}</div>
          <div className="row" style={{ justifyContent: 'center', gap: 10 }}><a href="#apply" className="btn">{t('landing.apply')}</a><Link to="/calculator" className="btn2">{t('landing.tryCalc')}</Link></div>
        </div>
        <div className="grid" style={{ gridTemplateColumns: mobile ? '1fr' : 'repeat(3, 1fr)' }}>
          {[1, 2, 3].map((i) => <div key={i} className="card"><div className="h">{['①', '②', '③'][i - 1]} {t(`landing.point${i}`)}</div><div className="mut">{t(`landing.point${i}b`)}</div></div>)}
        </div>
        <div className="grid" style={{ gridTemplateColumns: mobile ? '1fr' : '1.2fr 1fr', marginTop: 20, alignItems: 'start' }}>
          <div className="card">
            <div className="h">{t('landing.how')}</div>
            <ol style={{ paddingLeft: 20, lineHeight: 2 }}>{[1, 2, 3].map((i) => <li key={i}>{t(`landing.how${i}`)}</li>)}</ol>
            <div className="mut" style={{ marginTop: 8 }}>{t('landing.noPassword')}</div>
          </div>
          <Apply channel="other" />
        </div>
        <div className="note" style={{ textAlign: 'center', margin: '24px 0' }}>{t('landing.risk')}</div>
        <div className="note" style={{ textAlign: 'center', marginBottom: 24 }}><Link to="/admin/login">{t('landing.protoAdmin')}</Link></div>
      </div>
    </div>
  );
}

export function Calculator() {
  const t = useT();
  const mobile = useIsMobile();
  const [tplId, setTplId] = useState('ftmo-2step');
  const [v, setV] = useState({ capital: '100000', dayStart: '98500', highest: '98500', equity: '97100' });
  const [shown, setShown] = useState(v);
  const [open, setOpen] = useState(false);
  const tpl = TEMPLATES.find((x) => x.id === tplId)!;
  const parse = (s: string) => { try { const n = parseMoney(s); return n > 0 ? n : null; } catch { return null; } };
  const p = { capital: parse(shown.capital), dayStart: parse(shown.dayStart), highest: parse(shown.highest), equity: parse(shown.equity) };
  const valid = p.capital !== null && p.dayStart !== null && p.equity !== null && (tpl.maxLossMode === 'fixed' || p.highest !== null);
  const r = valid ? computeRedLines(tpl, { initialCapital: p.capital!, dayStartBalance: p.dayStart!, equity: p.equity!, balance: p.dayStart!, highestDayStartBalance: p.highest ?? undefined }) : null;
  const input = (k: keyof typeof v, label: string) => {
    const bad = parse(v[k]) === null;
    return <div><label className="lbl" htmlFor={`c-${k}`}>{label}</label><input id={`c-${k}`} className="field" inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} aria-invalid={bad} />{bad && <div className="err">{t('calc.invalid')}</div>}</div>;
  };
  const form = (
    <div className="card">
      <label className="lbl" htmlFor="c-tpl">{t('calc.template')}</label>
      <select id="c-tpl" className="field" value={tplId} onChange={(e) => setTplId(e.target.value)}>
        {TEMPLATES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        {PENDING_TEMPLATES.map((x) => <option key={x.id} disabled>{t('prop.pending', { name: x.name })}</option>)}
      </select>
      {input('capital', t('calc.capital'))}
      {input('dayStart', t('calc.dayStart', { tz: tpl.resetTimezone }))}
      {tpl.maxLossMode === 'trailing' && input('highest', t('calc.highest'))}
      {input('equity', t('calc.equity'))}
      <button className="btn block" onClick={() => setShown(v)}>{t('calc.compute')}</button>
    </div>
  );
  const result = (
    <div className="card" aria-live="polite">
      <div className="mut">{t('calc.remaining')}</div>
      <div className={`big ${r?.breached ? 'dn' : ''}`}>{r ? money(r.remaining) : '—'}</div>
      {r?.breached && <div className="dn">{t(r.breached === 'daily' ? 'red.breachedDaily' : 'red.breachedMax')}</div>}
      <div className="row" style={{ marginTop: 10 }}><span>{t('calc.dailyLine')}</span><b className="num">{r ? money(r.dailyLine) : '—'}</b></div>
      <div className="row"><span>{t('calc.maxLine')}</span><b className="num">{r ? money(r.maxLine) : '—'}</b></div>
      <button className="btn2" style={{ marginTop: 10 }} onClick={() => setOpen(!open)} aria-expanded={open}>{t('calc.formula')} {open ? '▴' : '▾'}</button>
      {open && <div className="note" style={{ marginTop: 8 }}>{t(`prop.formula.${tpl.id}`)}<br />{t('prop.source', { source: tpl.source, date: tpl.checkedOn })}</div>}
      <div className="note" style={{ marginTop: 8 }}>{t('common.estimate')} · {t('common.disclaimer')}</div>
    </div>
  );
  const cta = <div className="card"><div className="h">{t('calc.ctaTitle')}</div><div className="mut" style={{ marginBottom: 10 }}>{t('calc.ctaBody')}</div><button className="btn" onClick={() => navigate('/#apply')}>{t('landing.apply')}</button></div>;
  return (
    <div className={mobile ? 'm' : ''}>
      <Banner />
      <div className="page" style={{ maxWidth: 960 }}>
        <PublicTop />
        <div className={mobile ? '' : 'hero'} style={mobile ? { marginBottom: 14 } : { paddingTop: 10 }}>
          <div className="title">{t('calc.title')}</div>
          <div className="mut" style={{ marginTop: 6 }}>{t('calc.sub')}</div>
        </div>
        {mobile ? <div className="stack">{form}{result}{cta}</div> : <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>{form}<div className="stack">{result}{cta}</div></div>}
      </div>
    </div>
  );
}

export function Login() {
  const t = useT();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(LOGIN_EMAIL);
  const [code, setCode] = useState('');
  // 登录后：在 /login 打开的去看板；从别的页面被拦下来的，留在原页面（F11）
  const submit = () => { loginUser(email.trim()); if (location.pathname === '/login') navigate('/app'); };
  return (
    <div>
      <Banner />
      <div className="page" style={{ maxWidth: 420 }}>
        <PublicTop />
        <div className="card">
          <div className="h">{t('login.title')}</div>
          <label className="lbl" htmlFor="l-email">{t('login.email')}</label>
          <input id="l-email" className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={step === 'code'} />
          {step === 'email' ? <>
            <label className="lbl" htmlFor="l-inv">{t('login.invite')}</label>
            <input id="l-inv" className="field" placeholder="RDT-01" />
            <button className="btn block" disabled={!email.includes('@')} onClick={() => setStep('code')}>{t('login.send')}</button>
          </> : <>
            <div className="mut" style={{ marginBottom: 10 }}>{t('login.sent')}</div>
            <label className="lbl" htmlFor="l-code">{t('login.code')}</label>
            <input id="l-code" className="field" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            <button className="btn block" disabled={code.length !== 6} onClick={submit}>{t('login.submit')}</button>
          </>}
          <div className="mut" style={{ marginTop: 14 }}>{t('login.noInvite')} <Link to="/#apply">{t('login.apply')}</Link></div>
        </div>
      </div>
    </div>
  );
}

/**
 * 退订：从推送邮件的链接打开，不用登录。链接里带签名（正式版由 Worker 校验）。
 * 打开页面不会直接退订，要点一下确认：邮箱的安全扫描会预先打开链接，直接退订会误退（邮件同时带 List-Unsubscribe 一键退订头）。
 */
export function Unsubscribe() {
  const t = useT();
  const q = new URLSearchParams(location.search);
  const kind = KINDS.find((k) => k === q.get('kind'));
  const account = accountList().find((a) => a.id === q.get('account'));
  const [done, setDone] = useState(false);
  if (!kind) return <div><Banner /><div className="page" style={{ maxWidth: 480 }}><PublicTop /><div className="card"><div className="h">{t('unsub.title')}</div><div className="mut">{t('unsub.invalid')}</div></div></div></div>;
  const what = t('unsub.what', { kind: t(`notify.kind.${kind}`), account: account?.name ?? t('unsub.allAccounts') });
  return (
    <div>
      <Banner />
      <div className="page" style={{ maxWidth: 480 }}>
        <PublicTop />
        <div className="card">
          <div className="h">{t(done ? 'unsub.doneTitle' : 'unsub.title')}</div>
          <div style={{ marginBottom: 14 }}>{done ? t('unsub.done', { what }) : t('unsub.confirm', { what })}</div>
          {done
            ? <button className="btn2" onClick={() => setDone(false)}>{t('unsub.undo')}</button>
            : <button className="btn block" onClick={() => setDone(true)}>{t('unsub.button')}</button>}
          <div className="mut" style={{ marginTop: 14 }}>{t('unsub.other')} <Link to="/app/settings">{t('unsub.manage')}</Link></div>
        </div>
      </div>
    </div>
  );
}

/** 后台登录（F11、AC-G6）：和客户一样用邮箱验证码，但只认管理员邮箱。原型里管理员邮箱是 admin@tradingjournal.example，验证码输入任意 6 位数字。 */
export function AdminLogin() {
  const t = useT();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const submit = () => {
    if (!loginAdmin(email)) { setErr(t('adminLogin.denied')); setStep('email'); setCode(''); return; }
    if (location.pathname === '/admin/login') navigate('/admin');
  };
  return (
    <div>
      <Banner />
      <div className="page" style={{ maxWidth: 420 }}>
        <div className="top"><span className="logo">{t('app.name')} · {t('admin.title')}</span><span className="row" style={{ gap: 8 }}><Prefs /></span></div>
        <div className="card">
          <div className="h">{t('adminLogin.title')}</div>
          <label className="lbl" htmlFor="a-email">{t('login.email')}</label>
          <input id="a-email" className="field" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(null); }} disabled={step === 'code'} />
          {err && <div className="err">{err}</div>}
          {step === 'email' ? <button className="btn block" disabled={!email.includes('@')} onClick={() => setStep('code')}>{t('login.send')}</button> : <>
            <div className="mut" style={{ marginBottom: 10 }}>{t('login.sent')}</div>
            <label className="lbl" htmlFor="a-code">{t('login.code')}</label>
            <input id="a-code" className="field" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            <button className="btn block" disabled={code.length !== 6} onClick={submit}>{t('login.submit')}</button>
          </>}
          <div className="note" style={{ marginTop: 14 }}>{t('adminLogin.hint')}</div>
        </div>
      </div>
    </div>
  );
}
