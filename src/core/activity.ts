// 客户活跃和渠道质量（需求说明书 v1.3 第 7.5 节，AC-G7、AC-G10）。后台的客户列表、渠道质量表和测试共用这一份口径。
// 日期一律用 'YYYY-MM-DD' 字符串（按客户时区算好的日期），这里不做时区换算。

export type Status = 'new' | 'active' | 'dormant' | 'churned';

export interface CustomerActivity {
  id: string;
  channel: string;
  registered: string; // 注册日期
  activated: string | null; // 第一次 EA 连接或导入成功的日期
  activeDays: string[]; // 主动活跃日：打开页面或点推送链接
  dataDays: string[]; // 数据活跃日：EA 推送或导入成功
  paid: number[]; // 已确认到账的订单金额（USDT 按 0.01 的整数）；退款记成负数
}

const DAY = 86400000;
const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
export const addDays = (d: string, n: number) => new Date(toMs(d) + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((toMs(to) - toMs(from)) / DAY);
const within = (days: string[], from: string, to: string) => days.some((d) => d >= from && d <= to);
const countWithin = (days: string[], from: string, to: string) => days.filter((d) => d >= from && d <= to).length;

/** 客户状态：新用户（注册不满 7 天）→ 活跃（近 7 天有主动活跃）→ 流失（30 天以上没有任何活跃）→ 其余是沉默。 */
export function statusOf(c: CustomerActivity, today: string): Status {
  if (daysBetween(c.registered, today) < 7) return 'new';
  if (within(c.activeDays, addDays(today, -6), today)) return 'active';
  const last = [...c.activeDays, ...c.dataDays].sort().at(-1);
  if (!last || daysBetween(last, today) >= 30) return 'churned';
  return 'dormant';
}

/** 第 n 周（注册后第 7n 天到 7n+6 天）有没有活跃；这一周还没过完时返回 null，不计入留存。 */
export function activeInWeek(c: CustomerActivity, n: number, today: string, kind: 'active' | 'data'): boolean | null {
  const from = addDays(c.registered, 7 * n);
  const to = addDays(from, 6);
  if (to > today) return null;
  return within(kind === 'active' ? c.activeDays : c.dataDays, from, to);
}

export interface Rate { hit: number; base: number } // 比例的分子、分母；分母为 0 时页面显示"—"
const rate = (cs: CustomerActivity[], f: (c: CustomerActivity) => boolean | null): Rate => {
  const vals = cs.map(f).filter((v): v is boolean => v !== null);
  return { hit: vals.filter(Boolean).length, base: vals.length };
};
const median = (xs: number[]) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export interface ChannelQuality {
  channel: string;
  registered: number;
  activated: number;
  activation: Rate;
  activationDaysMedian: number | null;
  retention: Record<'w1' | 'w2' | 'w4', { active: Rate; data: Rate }>;
  active7: number;
  activeDaysPerWeek: number | null; // 近 28 天主动活跃日 ÷ 4 ÷ 激活人数
  paidUsers: number;
  paidAmount: number;
}

/** 按渠道统计质量（AC-G10）。留存的分母只算"那一周已经过完"的人。 */
export function channelQuality(customers: CustomerActivity[], today: string): ChannelQuality[] {
  const channels = [...new Set(customers.map((c) => c.channel))];
  return channels.map((channel) => {
    const cs = customers.filter((c) => c.channel === channel);
    const act = cs.filter((c) => c.activated);
    const ret = (n: number) => ({ active: rate(cs, (c) => activeInWeek(c, n, today, 'active')), data: rate(cs, (c) => activeInWeek(c, n, today, 'data')) });
    const days28 = act.reduce((a, c) => a + countWithin(c.activeDays, addDays(today, -27), today), 0);
    return {
      channel,
      registered: cs.length,
      activated: act.length,
      activation: { hit: act.length, base: cs.length },
      activationDaysMedian: median(act.map((c) => daysBetween(c.registered, c.activated!))),
      retention: { w1: ret(1), w2: ret(2), w4: ret(4) },
      active7: cs.filter((c) => within(c.activeDays, addDays(today, -6), today)).length,
      activeDaysPerWeek: act.length ? Math.round((days28 / 4 / act.length) * 10) / 10 : null,
      paidUsers: cs.filter((c) => c.paid.reduce((x, y) => x + y, 0) > 0).length, // 全额退款的不算付费用户
      paidAmount: cs.reduce((a, c) => a + c.paid.reduce((x, y) => x + y, 0), 0),
    };
  });
}

/** 按注册周（周一开始）分组的留存表：每行一个注册周，列是第 0–4 周的主动活跃留存。 */
export function cohorts(customers: CustomerActivity[], today: string, weeks = 4) {
  const monday = (d: string) => addDays(d, -((new Date(toMs(d)).getUTCDay() + 6) % 7));
  const groups = new Map<string, CustomerActivity[]>();
  for (const c of customers) groups.set(monday(c.registered), [...(groups.get(monday(c.registered)) ?? []), c]);
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, cs]) => ({
    week,
    size: cs.length,
    weeks: Array.from({ length: weeks + 1 }, (_, n) => rate(cs, (c) => activeInWeek(c, n, today, 'active'))),
  }));
}
