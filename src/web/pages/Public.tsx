// 公开页面：落地页、免费计算器（不用注册）、登录。计算器用的是 src/core 的真实规则，结果和考核页一致（AC-G4）。
import { useEffect, useState } from 'react';
import { parseMoney } from '../../core/money';
import { PENDING_TEMPLATES, TEMPLATES, computeRedLines } from '../../core/rules';
import { money } from '../components/ui';
import { Banner, Prefs } from '../components/Shell';
import { Link, navigate, useIsMobile, useT } from '../lib';

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
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
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
            <button className="btn block" disabled={code.length !== 6} onClick={() => navigate('/app')}>{t('login.submit')}</button>
          </>}
          <div className="mut" style={{ marginTop: 14 }}>{t('login.noInvite')} <Link to="/#apply">{t('login.apply')}</Link></div>
        </div>
      </div>
    </div>
  );
}
