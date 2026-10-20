// 原型的模拟接口：模拟网络延迟。地址里加 ?state=loading / ?state=error / ?state=empty 可以看到加载中、出错、空状态（C42、C52）。
import { ACCOUNTS, type Account } from './data';

const state = () => new URLSearchParams(location.search).get('state');

export async function fetchAccount(id: string): Promise<Account> {
  const s = state();
  if (s === 'loading') return new Promise(() => {});
  await new Promise((r) => setTimeout(r, 350));
  if (s === 'error') throw new Error('mock error');
  const acc = ACCOUNTS.find((a) => a.id === id) ?? ACCOUNTS[0]!;
  return s === 'empty' ? { ...acc, trades: [], lastImport: null } : acc;
}

export const accountList = () => ACCOUNTS;
