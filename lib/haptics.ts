// Design Ref: docs/02-design/mobile-ux-overhaul.md §4 Haptic Feedback
// pm-research 권고: 햅틱 피드백 ★★★★★ (안드로이드 비율 높음, 야외 진동 즉시 인지)
//
// Web Vibration API 사용. iOS Safari는 미지원 (사용자가 원하면 향후 native bridge).

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 35,
  success: [15, 50, 15],   // 짧-짧
  warning: [30, 80, 30],   // 살짝 강조
  error: [40, 60, 40, 60, 40], // 빠른 3연타
};

function vibrationSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return typeof navigator.vibrate === 'function';
}

export function haptic(pattern: HapticPattern = 'light'): void {
  if (!vibrationSupported()) return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    /* 일부 브라우저에서 정책상 차단되면 silent fail */
  }
}

export const hapticLight = () => haptic('light');
export const hapticMedium = () => haptic('medium');
export const hapticHeavy = () => haptic('heavy');
export const hapticSuccess = () => haptic('success');
export const hapticWarning = () => haptic('warning');
export const hapticError = () => haptic('error');
