// 客户活跃、渠道质量（AC-G7、G10、G11 的口径）和套餐、订单规则（AC-P1、P5–P7）。
import { describe, expect, it } from 'vitest';
import { activeInWeek, addDays, channelQuality, cohorts, statusOf, type CustomerActivity } from '../src/core/activity';
import { canSubmit, effectiveStatus, extendUntil, formatUsdt, isAddress, isTxHash, parseUsdt, planOf, revokedUntil, validRefund, type Order } from '../src/core/billing';

const TODAY = '2026-10-22';
const C = (over: Partial<CustomerActivity>): CustomerActivity => ({ id: 'c', channel: 'reddit', registered: '2026-09-01', activated: null, activeDays: [], dataDays: [], paid: [], ...over });

describe('客户状态（第 7.5 节）', () => {
  it('注册不满 7 天是新用户，即使没有活跃', () => expect(statusOf(C({ registered: '2026-10-16' }), TODAY)).toBe('new'));
  it('注册满 7 天且近 7 天有主动活跃：活跃', () => expect(statusOf(C({ activeDays: ['2026-10-16'] }), TODAY)).toBe('active'));
  it('近 7 天没有主动活跃、但昨天有 EA 数据：沉默（不是流失）', () => expect(statusOf(C({ activeDays: ['2026-09-10'], dataDays: ['2026-10-21'] }), TODAY)).toBe('dormant'));
  it('最近一次任何活跃是 30 天前：流失', () => expect(statusOf(C({ dataDays: [addDays(TODAY, -30)] }), TODAY)).toBe('churned'));
  it('29 天前还有数据：沉默', () => expect(statusOf(C({ dataDays: [addDays(TODAY, -29)] }), TODAY)).toBe('dormant'));
  it('注册后从来没有活跃：流失', () => expect(statusOf(C({}), TODAY)).toBe('churned'));
});

describe('留存（按注册后第 n 周）', () => {
  const c = C({ registered: '2026-10-01', activeDays: ['2026-10-09'], dataDays: ['2026-10-15'] });
  it('第 1 周（第 7–13 天）有主动活跃', () => expect(activeInWeek(c, 1, TODAY, 'active')).toBe(true));
  it('第 2 周只有数据活跃：主动算没有、数据算有', () => {
    expect(activeInWeek(c, 2, TODAY, 'active')).toBe(false);
    expect(activeInWeek(c, 2, TODAY, 'data')).toBe(true);
  });
  it('第 4 周还没过完（10-29 到 11-04）：不计入', () => expect(activeInWeek(c, 4, TODAY, 'active')).toBeNull());
});

describe('渠道质量（AC-G10）', () => {
  const cs: CustomerActivity[] = [
    C({ id: 'a', channel: 'cn-group', registered: '2026-09-01', activated: '2026-09-02', activeDays: ['2026-09-09', '2026-09-15', '2026-10-20', '2026-10-21'], paid: [1500] }),
    C({ id: 'b', channel: 'cn-group', registered: '2026-09-01', activated: '2026-09-05', activeDays: ['2026-09-10'] }),
    C({ id: 'c', channel: 'cn-group', registered: '2026-10-20' }),
    C({ id: 'd', channel: 'reddit', registered: '2026-09-01' }),
  ];
  const [cn, rd] = channelQuality(cs, TODAY);
  it('注册、激活、激活率', () => {
    expect(cn).toMatchObject({ channel: 'cn-group', registered: 3, activated: 2, activation: { hit: 2, base: 3 } });
    expect(rd).toMatchObject({ registered: 1, activated: 0 });
  });
  it('激活用时中位数：1 天和 4 天 → 2.5 天', () => expect(cn!.activationDaysMedian).toBe(2.5));
  it('第 1 周留存：第 3 个客户还没满一周，不计入分母', () => expect(cn!.retention.w1.active).toEqual({ hit: 2, base: 2 }));
  it('第 2 周留存：只有 a 在第 14–20 天来过', () => expect(cn!.retention.w2.active).toEqual({ hit: 1, base: 2 }));
  it('近 7 天活跃人数、人均每周活跃天数（近 28 天 2 天 ÷ 4 ÷ 2 个激活）', () => {
    expect(cn!.active7).toBe(1);
    expect(cn!.activeDaysPerWeek).toBe(0.3);
  });
  it('付费人数和金额', () => expect([cn!.paidUsers, cn!.paidAmount]).toEqual([1, 1500]));
  it('全额退款后不算付费用户，金额扣掉退款', () => {
    const [x] = channelQuality([C({ paid: [1500, -1500] }), C({ id: 'z', paid: [14400, -4400] })], TODAY);
    expect([x!.paidUsers, x!.paidAmount]).toEqual([1, 10000]);
  });
  it('没有激活用户时人均活跃天数是 null（页面显示"—"）', () => expect(rd!.activeDaysPerWeek).toBeNull());
  it('按注册周分组：09-01 是周二，归到 08-31 那一周', () => {
    const rows = cohorts(cs, TODAY);
    expect(rows.map((r) => [r.week, r.size])).toEqual([['2026-08-31', 3], ['2026-10-19', 1]]);
    expect(rows[1]!.weeks[0]).toEqual({ hit: 0, base: 0 });
  });
});

describe('套餐和开通（第 7.6、7.7 节）', () => {
  it('到期日当天仍是 Pro，第二天变回 Free', () => {
    expect(planOf('2026-10-22', TODAY)).toBe('pro');
    expect(planOf('2026-10-21', TODAY)).toBe('free');
    expect(planOf(null, TODAY)).toBe('free');
  });
  it('没有 Pro：从今天起 30 天', () => expect(extendUntil(null, TODAY, 'month')).toBe('2026-11-21'));
  it('Pro 还没到期：从原到期日往后延', () => expect(extendUntil('2026-11-01', TODAY, 'month')).toBe('2026-12-01'));
  it('Pro 已过期：从今天起算', () => expect(extendUntil('2026-10-01', TODAY, 'year')).toBe('2027-10-22'));
});

describe('网络、付款地址和交易哈希（AC-P4、P5、P7）', () => {
  const tron = 'TPrototypeDemoAddressNotReaLPay111';
  const eth = `0x${'ab'.repeat(20)}`;
  const h = 'a'.repeat(64);
  const o = (over: Partial<Order>): Order => ({ id: 'o', status: 'pending', expiresAt: '2026-10-25T10:00:00Z', txHash: null, network: 'TRC20', ...over });
  it('TRC20：地址 T 开头 34 位；哈希 64 位十六进制、不带 0x', () => {
    expect(isAddress('TRC20', tron)).toBe(true);
    expect(isAddress('TRC20', eth)).toBe(false);
    expect(isTxHash('TRC20', h)).toBe(true);
    expect(isTxHash('TRC20', `0x${h}`)).toBe(false);
    expect(isTxHash('TRC20', 'a'.repeat(63))).toBe(false);
  });
  it('ERC20、BEP20：地址 0x 加 40 位；哈希 0x 加 64 位，钱包没带 0x 的自动补上', () => {
    expect(isAddress('ERC20', eth)).toBe(true);
    expect(isAddress('BEP20', 'ab'.repeat(20))).toBe(true);
    expect(isAddress('BEP20', tron)).toBe(false);
    expect(isTxHash('ERC20', `0x${h}`)).toBe(true);
    expect(isTxHash('BEP20', h)).toBe(true);
    expect(isTxHash('ERC20', `0x${'g'.repeat(64)}`)).toBe(false);
  });
  it('待付款的订单过了 72 小时是已过期；已提交的不会过期', () => {
    expect(effectiveStatus(o({}), '2026-10-25T10:00:01Z')).toBe('expired');
    expect(effectiveStatus(o({ status: 'submitted' }), '2026-11-30T00:00:00Z')).toBe('submitted');
  });
  it('点"我已付款"：付款地址、哈希格式、哈希重复（不分大小写、补 0x 后比较）、订单已关闭', () => {
    const now = '2026-10-23T00:00:00Z';
    expect(canSubmit(o({}), tron, h, now, [])).toBe('ok');
    expect(canSubmit(o({}), eth, h, now, [])).toBe('payer');
    expect(canSubmit(o({}), tron, 'xyz', now, [])).toBe('format');
    expect(canSubmit(o({}), tron, h, now, [h.toUpperCase()])).toBe('used');
    expect(canSubmit(o({ network: 'BEP20' }), eth, h, now, [`0x${h}`])).toBe('used');
    expect(canSubmit(o({ status: 'confirmed' }), tron, h, now, [])).toBe('closed');
    expect(canSubmit(o({ status: 'refunded' }), tron, h, now, [])).toBe('closed');
    expect(canSubmit(o({}), tron, h, '2026-10-26T00:00:00Z', [])).toBe('closed');
    expect(canSubmit(o({ status: 'problem' }), tron, h, now, [])).toBe('ok');
  });
});

describe('退款（P10）', () => {
  it('退款金额大于 0、不超过订单金额', () => {
    expect(validRefund(1500, 1500)).toBe(true);
    expect(validRefund(1000, 1500)).toBe(true);
    expect(validRefund(1501, 1500)).toBe(false);
    expect(validRefund(0, 1500)).toBe(false);
    expect(validRefund(null, 1500)).toBe(false);
  });
  it('审批通过后今天就回到 Free', () => {
    expect(planOf(revokedUntil(TODAY), TODAY)).toBe('free');
  });
});

describe('价格', () => {
  it('价格的输入和显示', () => {
    expect(parseUsdt('15')).toBe(1500);
    expect(parseUsdt('15.5')).toBe(1550);
    expect(parseUsdt('144.00')).toBe(14400);
    expect(parseUsdt('15.555')).toBeNull();
    expect(parseUsdt('-1')).toBeNull();
    expect(parseUsdt('abc')).toBeNull();
    expect(formatUsdt(1550)).toBe('15.50 USDT');
  });
});
