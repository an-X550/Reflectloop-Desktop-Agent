export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'zhiji-theme';

/** jsdom 等环境没有 matchMedia，懒创建并兜底为浅色。 */
function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function getThemePreference(): ThemePreference {
  const value = localStorage.getItem(STORAGE_KEY);
  return value === 'light' || value === 'dark' ? value : 'system';
}

function resolvedTheme(pref: ThemePreference): 'light' | 'dark' {
  return pref === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : pref;
}

/** 应用主题偏好：写入 localStorage 并落到 <html data-theme>，CSS 只认这一个属性。 */
export function applyThemePreference(pref: ThemePreference): void {
  localStorage.setItem(STORAGE_KEY, pref);
  document.documentElement.dataset.theme = resolvedTheme(pref);
}

/** 启动时调用一次：恢复保存的偏好；跟随系统时监听系统切换。 */
export function initTheme(): void {
  applyThemePreference(getThemePreference());
  if (typeof window.matchMedia !== 'function') return;
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getThemePreference() === 'system') document.documentElement.dataset.theme = resolvedTheme('system');
  });
}
