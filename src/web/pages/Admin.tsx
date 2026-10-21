// 运营后台（只给 Amos）：内测申请、邀请码、按渠道统计（AC-G2、AC-G5、AC-G6）。原型里全部是模拟数据。
import { Shell } from '../components/Shell';
import { useIsMobile, useT } from '../lib';
import { APPLICATIONS, CHANNEL_STATS, INVITES } from '../mock/data';

export function Admin() {
  const t = useT();
  const mobile = useIsMobile();
  const sum = (k: 'visits' | 'applied' | 'registered' | 'activated' | 'weekly') => CHANNEL_STATS.reduce((a, x) => a + x[k], 0);
  return (
    <Shell>
      <div className="title" style={{ marginBottom: 16 }}>{t('admin.title')}</div>
      <div className="grid" style={{ gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', alignItems: 'start' }}>
        <div className="card" style={{ overflowX: 'auto' }}>
          <div className="h">{t('admin.applications')}</div>
          <table><thead><tr><th>{t('admin.email')}</th><th>{t('admin.channel')}</th><th>{t('admin.at')}</th><th /></tr></thead>
            <tbody>{APPLICATIONS.map((a) => <tr key={a.email}><td>{a.email}</td><td>{t(`channel.${a.channel}`)}</td><td>{a.at}</td><td className="r"><button className="btn2">{t('admin.send')}</button></td></tr>)}</tbody></table>
        </div>
        <div className="card" style={{ overflowX: 'auto' }}>
          <div className="row"><div className="h">{t('admin.invites')}</div><button className="btn2">{t('admin.newInvite')}</button></div>
          <table><thead><tr><th>{t('admin.code')}</th><th>{t('admin.channel')}</th><th className="r">{t('admin.used')}</th></tr></thead>
            <tbody>{INVITES.map((i) => <tr key={i.code}><td>{i.code}</td><td>{t(`channel.${i.channel}`)}</td><td className="r">{i.used} / {i.limit}</td></tr>)}</tbody></table>
        </div>
      </div>
      <div className="card" style={{ marginTop: 20, overflowX: 'auto' }}>
        <div className="row"><div className="h">{t('admin.stats')}</div><span className="mut">{t('admin.sample')}</span></div>
        <table>
          <thead><tr><th>{t('admin.channel')}</th><th className="r">{t('admin.visits')}</th><th className="r">{t('admin.applied')}</th><th className="r">{t('admin.registered')}</th><th className="r">{t('admin.activated')}</th><th className="r">{t('admin.weekly')}</th></tr></thead>
          <tbody>
            {CHANNEL_STATS.map((c) => <tr key={c.channel}><td>{t(`channel.${c.channel}`)}</td><td className="r">{c.visits}</td><td className="r">{c.applied}</td><td className="r">{c.registered}</td><td className="r">{c.activated}</td><td className="r">{c.weekly}</td></tr>)}
            <tr><td><b>{t('admin.total')}</b></td><td className="r"><b>{sum('visits')}</b></td><td className="r"><b>{sum('applied')}</b></td><td className="r"><b>{sum('registered')}</b></td><td className="r"><b>{sum('activated')}</b></td><td className="r"><b>{sum('weekly')}</b></td></tr>
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
