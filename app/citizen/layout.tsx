import './citizen.css';

export const metadata = {
  title: '폐기물 민원 신고 — CleanERP',
  description: '특허 10-2024-0084638 시민 민원앱',
};

export default function CitizenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex justify-center bg-page">
      <div className="w-full max-w-[480px] min-h-screen bg-surface flex flex-col shadow-card relative">
        <header className="px-5 py-3 bg-sidebar text-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-horizontal-dark.svg"
              alt="공비랩 Clean ERP"
              width={140}
              height={59}
              className="block h-[44px] w-auto"
            />
            <div className="flex-1 border-l border-white/15 pl-3">
              <div className="text-[0.8125rem] font-extrabold leading-tight">폐기물 민원 신고</div>
              <div className="text-[0.5625rem] font-mono font-bold text-ink-faint mt-0.5">시민용 · 특허 10-2024-0084638</div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto pb-6">{children}</main>
      </div>
    </div>
  );
}
