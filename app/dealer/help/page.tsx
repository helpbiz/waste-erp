import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function DealerHelpPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  if (session.role !== 'DEALER') redirect('/dashboard');

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="mb-2 text-3xl font-bold">📖 이렇게 쓰세요</h1>
        <p className="text-lg text-ink-muted">딱 두 가지만 하면 됩니다. 순서대로 따라 하세요.</p>
      </div>

      <section className="rounded-2xl border-4 border-blue-300 bg-blue-50 p-6">
        <h2 className="mb-4 text-2xl font-bold text-blue-900">🅰️ 먼저 할 일: 보여주기</h2>
        <p className="mb-4 text-base">고객님께 우리 프로그램이 뭔지 <b>직접 보여주는 것</b>이에요.</p>
        <ol className="space-y-4 text-base">
          <li className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 font-bold text-white">1</span>
            <span><a href="/dealer/demo" className="font-bold text-blue-700 underline">여기(영업 데모)</a>를 눌러요.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 font-bold text-white">2</span>
            <span>버튼 두 개 중 하나를 눌러요. (몇 초만 기다리면 돼요)</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 font-bold text-white">3</span>
            <span>주소(링크)가 나와요. <b>&ldquo;복사&rdquo;</b>를 눌러요.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 font-bold text-white">4</span>
            <span>고객님께 문자나 카카오톡으로 그 주소를 <b>붙여넣기 해서 보내요.</b></span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 font-bold text-white">5</span>
            <span>고객님이 그 주소를 누르면 — 끝! 비밀번호 없이 바로 구경할 수 있어요.</span>
          </li>
        </ol>
        <div className="mt-4 rounded-xl bg-white p-4 text-sm space-y-2">
          <p><b>어떤 버튼을 눌러야 하나요?</b></p>
          <p>🏢 <b>&ldquo;데모 즉시 발급 (회사 1곳)&rdquo;</b> — 청소업체 사장님께 보여줄 때. 가짜 회사 1곳이 만들어져요.</p>
          <p>🏛 <b>&ldquo;지자체 모드 데모 (회사 3곳)&rdquo;</b> — 시청·군청·구청 담당자께 보여줄 때. 가짜 회사 3곳이 한 번에 만들어지고, 그 3곳을 <b>한눈에 모아 보는 화면</b>까지 같이 보여줄 수 있어요.</p>
        </div>
        <div className="mt-4 rounded-xl bg-white p-4 text-sm">
          💡 <b>안심하세요</b>: 이 주소는 <b>연습용 화면</b>이에요. 진짜 정보가 아니라서 아무렇게나 눌러봐도 괜찮아요.
          또 <b>14일 뒤에는 저절로 없어지니까</b> 따로 정리 안 하셔도 돼요.
        </div>
      </section>

      <section className="rounded-2xl border-4 border-green-300 bg-green-50 p-6">
        <h2 className="mb-4 text-2xl font-bold text-green-900">🅱️ 다음에 할 일: 이름 남기기</h2>
        <p className="mb-4 text-base">고객님이 <b>&ldquo;진짜 쓰고 싶어요&rdquo;</b>라고 하면, 그때 이름만 살짝 남겨두는 거예요.</p>
        <ol className="space-y-4 text-base">
          <li className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-600 font-bold text-white">1</span>
            <span><a href="/dealer/leads" className="font-bold text-green-700 underline">여기(리드 등록)</a>를 눌러요.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-600 font-bold text-white">2</span>
            <span>고객님 회사 이름만 적어요. <b>다른 건 몰라도 돼요.</b></span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-600 font-bold text-white">3</span>
            <span><b>&ldquo;리드 등록&rdquo;</b> 버튼을 눌러요.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-600 font-bold text-white">4</span>
            <span>나중에 정보를 더 알게 되면, 목록에서 <b>&ldquo;정보 입력&rdquo;</b>을 눌러서 채워 넣어요.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-600 font-bold text-white">5</span>
            <span>그 다음은 회사(관리자)가 알아서 확인하고 처리해줘요. <b>딜러님은 기다리기만 하면 돼요.</b></span>
          </li>
        </ol>
        <div className="mt-4 rounded-xl bg-white p-4 text-sm">
          💡 <b>안심하세요</b>: 비밀번호 같은 어려운 건 딜러님이 만들지 않아도 돼요. <b>회사가 알아서</b> 다 만들어줘요.
        </div>
      </section>

      <section className="rounded-2xl border-2 border-slate-300 bg-white p-6">
        <h2 className="mb-4 text-xl font-bold">❓ 궁금한 게 있어요</h2>
        <dl className="space-y-4 text-base">
          <div>
            <dt className="font-bold">Q. 뭐부터 해야 돼요?</dt>
            <dd className="text-ink-muted">🅰️ 보여주기부터 하세요. 그다음에 🅱️ 이름 남기기예요.</dd>
          </div>
          <div>
            <dt className="font-bold">Q. 안 된대요(반려). 왜 그래요?</dt>
            <dd className="text-ink-muted">회사(관리자)한테 전화해서 물어보세요. 다시 이름을 남기면 돼요.</dd>
          </div>
          <div>
            <dt className="font-bold">Q. 비밀번호를 까먹었어요.</dt>
            <dd className="text-ink-muted">회사(관리자)한테 전화하세요. 새로 만들어줘요.</dd>
          </div>
          <div>
            <dt className="font-bold">Q. 비밀번호를 바꾸고 싶어요.</dt>
            <dd className="text-ink-muted">위쪽 메뉴에서 <a href="/dealer/profile" className="font-bold text-blue-700 underline">🔑 내 계정</a>을 누르면 직접 바꿀 수 있어요.</dd>
          </div>
          <div>
            <dt className="font-bold">Q. 뭘 눌러야 할지 모르겠어요.</dt>
            <dd className="text-ink-muted">괜찮아요! 이 페이지 맨 위로 다시 올라가서, 파란색(🅰️)부터 하나씩 눌러보세요.</dd>
          </div>
          <div>
            <dt className="font-bold">Q. 지자체(시/군/구) 담당자를 만나요. 뭘 보여줘요?</dt>
            <dd className="text-ink-muted"><a href="/dealer/demo" className="font-bold text-blue-700 underline">영업 데모</a>에서 <b>&ldquo;지자체 모드 데모 (회사 3곳)&rdquo;</b>를 누르세요. 회사가 여러 곳이어도 한눈에 관리하는 화면을 바로 보여줄 수 있어요.</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
