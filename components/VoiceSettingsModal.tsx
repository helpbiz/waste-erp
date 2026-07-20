'use client';

/**
 * 공지 음성 알림 설정 모달.
 *
 * 사용자가 직접:
 *  - 음성 ON/OFF
 *  - 남성 / 여성 기본 톤 선택
 *  - 시스템 한국어 voice 목록에서 명시 선택 (선택사항)
 *  - [▶ 미리듣기] 로 즉시 테스트
 */
import { useEffect, useState } from 'react';
import {
  type VoiceSettings,
  loadVoiceSettings,
  saveVoiceSettings,
  listKoreanVoices,
  guessVoiceGender,
  speakAnnouncement,
  speakComplaintArrival,
  onVoicesReady,
} from '@/lib/voice-settings';

export default function VoiceSettingsModal({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<VoiceSettings>(() => loadVoiceSettings());
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setSupported(false);
      return;
    }
    const off = onVoicesReady(() => {
      setVoices(listKoreanVoices());
    });
    return off;
  }, []);

  function update<K extends keyof VoiceSettings>(k: K, v: VoiceSettings[K]) {
    const next = { ...settings, [k]: v };
    setSettings(next);
    saveVoiceSettings(next);
  }

  function previewAnnouncement(role: 'MUNI_ADMIN' | 'CONTRACTOR_ADMIN') {
    speakAnnouncement(role, { ...settings, enabled: true });
  }
  function previewComplaint(role: 'MUNI_ADMIN' | 'CONTRACTOR_ADMIN') {
    speakComplaintArrival(role, { ...settings, enabled: true });
  }

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/55 flex items-center justify-center p-3"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-[520px] w-full max-h-[90vh] flex flex-col">
        <div className="px-5 py-3 border-b border-line bg-purple-50 flex items-center gap-2">
          <span className="text-xl">🔊</span>
          <h2 className="text-base font-black text-ink flex-1">공지 음성 알림 설정</h2>
          <button onClick={onClose} aria-label="닫기" className="text-ink-faint hover:text-ink-muted text-xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!supported && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3 text-sm font-bold text-amber-900">
              ⚠ 이 기기/브라우저는 음성 합성(SpeechSynthesis)을 지원하지 않습니다.
              진동·사운드 알림만 동작합니다.
            </div>
          )}

          {/* 1. ON/OFF */}
          <label className="flex items-center justify-between gap-3 p-3 rounded-lg border-2 border-line cursor-pointer">
            <div>
              <div className="text-sm font-extrabold text-ink">음성 알림</div>
              <div className="text-[0.6875rem] text-ink-faint mt-0.5">신규 공지가 오면 자동으로 음성을 재생합니다.</div>
            </div>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => update('enabled', e.target.checked)}
              className="w-5 h-5 accent-purple-600"
              disabled={!supported}
            />
          </label>

          {/* 2. 남성 / 여성 */}
          <div>
            <div className="text-sm font-extrabold text-ink mb-2">기본 음성 톤</div>
            <div className="grid grid-cols-2 gap-2">
              {(['female', 'male'] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => update('gender', g)}
                  disabled={!supported || !settings.enabled}
                  className={`px-3 py-3 rounded-lg border-2 text-sm font-extrabold transition active:scale-95 ${
                    settings.gender === g
                      ? 'border-purple-600 bg-purple-50 text-purple-900'
                      : 'border-line bg-white text-ink-muted hover:border-purple-300'
                  } ${!supported || !settings.enabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {g === 'female' ? '👩 여성' : '👨 남성'}
                </button>
              ))}
            </div>
            <div className="text-[0.6875rem] text-ink-faint mt-1">
              ※ 시스템에 해당 성별 voice 가 없으면 자동으로 가장 가까운 한국어 voice 를 사용합니다.
            </div>
          </div>

          {/* 3. 명시 voice 선택 (옵션) */}
          {voices.length > 0 && (
            <div>
              <div className="text-sm font-extrabold text-ink mb-1">정확한 음성 선택 (선택)</div>
              <select
                value={settings.voiceURI ?? ''}
                onChange={(e) => update('voiceURI', e.target.value || null)}
                disabled={!supported || !settings.enabled}
                className="w-full px-3 py-2 rounded border-2 border-line text-sm font-semibold disabled:opacity-40"
              >
                <option value="">자동 (성별 기본값에 맞춰 선택)</option>
                {voices.map((v) => {
                  const g = guessVoiceGender(v);
                  const tag = g === 'female' ? '👩' : g === 'male' ? '👨' : '🔊';
                  return (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {tag} {v.name} ({v.lang})
                    </option>
                  );
                })}
              </select>
              <div className="text-[0.6875rem] text-ink-faint mt-1">
                감지된 한국어 음성: {voices.length}개
              </div>
            </div>
          )}

          {/* 4. 미리듣기 — 공지 */}
          <div>
            <div className="text-sm font-extrabold text-ink mb-2">▶ 공지사항 미리듣기</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => previewAnnouncement('CONTRACTOR_ADMIN')}
                disabled={!supported}
                className="px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-extrabold active:scale-95 disabled:opacity-40"
              >
                🏢 회사 공지
              </button>
              <button
                onClick={() => previewAnnouncement('MUNI_ADMIN')}
                disabled={!supported}
                className="px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-extrabold active:scale-95 disabled:opacity-40"
              >
                🏛 지자체 공지
              </button>
            </div>
            <div className="text-[0.6875rem] text-ink-faint mt-1.5 leading-relaxed">
              ▸ 회사: <span className="font-mono">"회사에서 공지사항이 도착했습니다."</span><br />
              ▸ 지자체: <span className="font-mono">"지자체에서 공지사항이 도착했습니다."</span>
            </div>
          </div>

          {/* 5. 미리듣기 — 민원 접수 */}
          <div>
            <div className="text-sm font-extrabold text-ink mb-2">▶ 민원 접수 미리듣기</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => previewComplaint('CONTRACTOR_ADMIN')}
                disabled={!supported}
                className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-extrabold active:scale-95 disabled:opacity-40"
              >
                🏢 회사 접수
              </button>
              <button
                onClick={() => previewComplaint('MUNI_ADMIN')}
                disabled={!supported}
                className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-extrabold active:scale-95 disabled:opacity-40"
              >
                🏛 지자체 접수
              </button>
            </div>
            <div className="text-[0.6875rem] text-ink-faint mt-1.5 leading-relaxed">
              ▸ 회사: <span className="font-mono">"회사에서 새로운 민원이 접수되었습니다."</span><br />
              ▸ 지자체: <span className="font-mono">"지자체에서 새로운 민원이 접수되었습니다."</span>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-line bg-slate-50 flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 rounded bg-accent text-white text-sm font-extrabold hover:bg-cyan-800">
            ✓ 닫기
          </button>
        </div>
      </div>
    </div>
  );
}
