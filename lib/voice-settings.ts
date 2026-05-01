/**
 * 공지 도착 음성 알림 설정 — Web Speech API (SpeechSynthesis) 기반.
 *
 * 사용자 선호:
 *   enabled  : 음성 알림 ON/OFF
 *   gender   : 'male' | 'female'  (자동 후보 선택용)
 *   voiceURI : 사용자가 명시 선택한 voice (있으면 gender 우선보다 강제 사용)
 *
 * 메시지 텍스트:
 *   author.role === 'MUNI_ADMIN'    → "지자체에서 공지사항이 도착했습니다."
 *   그 외 (CONTRACTOR/INTERNAL/SUPER) → "회사에서 공지사항이 도착했습니다."
 */

export type VoiceGender = 'male' | 'female';

export type VoiceSettings = {
  enabled: boolean;
  gender: VoiceGender;
  voiceURI: string | null;
};

const KEY = 'cleanerp:voice-settings:v1';

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  enabled: true,
  gender: 'female',
  voiceURI: null,
};

export function loadVoiceSettings(): VoiceSettings {
  if (typeof window === 'undefined') return DEFAULT_VOICE_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_VOICE_SETTINGS;
    const p = JSON.parse(raw) as Partial<VoiceSettings>;
    return {
      enabled: p.enabled ?? DEFAULT_VOICE_SETTINGS.enabled,
      gender: p.gender ?? DEFAULT_VOICE_SETTINGS.gender,
      voiceURI: p.voiceURI ?? null,
    };
  } catch {
    return DEFAULT_VOICE_SETTINGS;
  }
}

export function saveVoiceSettings(s: VoiceSettings) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* */ }
}

/* 한국어 voice 만 필터 */
export function listKoreanVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  const all = window.speechSynthesis.getVoices();
  return all.filter((v) => v.lang.toLowerCase().startsWith('ko'));
}

/* 이름 패턴으로 성별 추정 — 100% 정확하지 않음(브라우저별 다름) */
const FEMALE_HINTS = ['female', 'woman', '여', 'yuna', 'sora', 'sun-hi', 'heami', 'jimin'];
const MALE_HINTS = ['male', 'man', '남', 'inho', 'jihye', 'siyeon', 'minjun'];
/* 주: jihye/siyeon 은 보통 여성이지만 일부 OS에서 male 라벨이 있어 보수적으로 male 후보로 둠. */

export function guessVoiceGender(v: SpeechSynthesisVoice): VoiceGender | null {
  const n = `${v.name} ${v.voiceURI}`.toLowerCase();
  if (FEMALE_HINTS.some((h) => n.includes(h))) return 'female';
  if (MALE_HINTS.some((h) => n.includes(h))) return 'male';
  return null;
}

/* 사용자 선호에 맞는 voice 선택 */
export function pickVoice(settings: VoiceSettings): SpeechSynthesisVoice | null {
  const voices = listKoreanVoices();
  if (voices.length === 0) return null;

  /* 1) 명시 선택 voiceURI 우선 */
  if (settings.voiceURI) {
    const v = voices.find((x) => x.voiceURI === settings.voiceURI);
    if (v) return v;
  }

  /* 2) gender 추정 후보 */
  const matched = voices.find((v) => guessVoiceGender(v) === settings.gender);
  if (matched) return matched;

  /* 3) fallback — 첫 한국어 voice */
  return voices[0] ?? null;
}

/* 공지 author role → 메시지 */
export function announcementSpeechText(authorRole: string | null | undefined): string {
  if (authorRole === 'MUNI_ADMIN') return '지자체에서 공지사항이 도착했습니다.';
  return '회사에서 공지사항이 도착했습니다.';
}

/* 민원 reporter role → 메시지 */
export function complaintSpeechText(reporterRole: string | null | undefined): string {
  if (reporterRole === 'MUNI_ADMIN') return '지자체에서 새로운 민원이 접수되었습니다.';
  return '회사에서 새로운 민원이 접수되었습니다.';
}

/* 내부 공통 발화 helper */
function speakText(text: string, settings: VoiceSettings) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  if (!settings.enabled) return;

  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR';
  u.rate = 1.0;
  u.pitch = settings.gender === 'male' ? 0.85 : 1.15; /* voice 미지원 시 pitch 로 흉내 */
  const v = pickVoice(settings);
  if (v) u.voice = v;

  /* 진행중 발화 정리 후 새로 시작 */
  try { window.speechSynthesis.cancel(); } catch { /* */ }
  try { window.speechSynthesis.speak(u); } catch { /* */ }
}

/* 발화 — settings.enabled 면 즉시 speak */
export function speakAnnouncement(authorRole: string | null | undefined, settings: VoiceSettings) {
  speakText(announcementSpeechText(authorRole), settings);
}

export function speakComplaintArrival(reporterRole: string | null | undefined, settings: VoiceSettings) {
  speakText(complaintSpeechText(reporterRole), settings);
}

/* voiceschanged 이벤트 — 비동기 로드 보정 */
export function onVoicesReady(cb: () => void): () => void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return () => {};
  const handler = () => cb();
  window.speechSynthesis.addEventListener('voiceschanged', handler);
  /* 즉시 한 번 시도 — 일부 브라우저는 이벤트 안 쏨 */
  setTimeout(cb, 100);
  return () => window.speechSynthesis.removeEventListener('voiceschanged', handler);
}
