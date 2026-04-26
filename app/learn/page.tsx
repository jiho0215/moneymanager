import Link from 'next/link';
import { ScrubChart } from '@/lib/ui/scrub-chart';

export const metadata = {
  title: '단리 vs 복리 — Compound Learning System',
};

export default function LearnPage() {
  return (
    <main className="page" style={{ paddingTop: 24 }}>
      <Link href="/" className="btn btn-ghost" style={{ marginBottom: 'var(--sp-3)' }}>
        ← 홈으로
      </Link>

      <header style={{ marginBottom: 'var(--sp-5)' }}>
        <div className="soft" style={{ marginBottom: 4 }}>학습 도구</div>
        <h1 className="h1">💸 단리 vs 복리</h1>
        <p className="lead" style={{ marginTop: 'var(--sp-2)' }}>
          시간을 끌어보면서 두 곡선이 어떻게 갈라지는지 직접 봐.
        </p>
      </header>

      <ScrubChart />

      <section className="card stack-3" style={{ marginTop: 'var(--sp-6)' }}>
        <h2 className="h2">💡 정리</h2>
        <div className="stack-3" style={{ fontSize: '0.95rem', lineHeight: 1.7 }}>
          <div>
            <strong>단리 (Simple)</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              매년 <strong>원금</strong>의 10% 이자만 더해짐. 매년 똑같은 양 → 직선.
            </p>
          </div>
          <div>
            <strong>복리 (Compound)</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              매년 <strong>지금까지 모인 잔액</strong>의 10%. 이자에도 이자가 붙어 → 곡선이 점점 가팔라짐.
            </p>
          </div>
          <div>
            <strong>왜 시간이 중요해?</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              짧은 기간엔 차이가 작아 보여. 하지만 시간이 길어질수록 복리가 폭발해.
              <strong style={{ color: 'var(--experiment-deep)' }}> 일찍 시작하는 게 가장 큰 무기.</strong>
            </p>
          </div>
        </div>
      </section>

      <section
        className="card stack-3"
        style={{ marginTop: 'var(--sp-4)', background: 'var(--bonus-bg)', borderColor: 'var(--bonus)' }}
      >
        <h2 className="h3" style={{ color: 'var(--bonus-deep)' }}>📚 우리 시스템에서는</h2>
        <div className="muted" style={{ fontSize: '0.92rem', lineHeight: 1.7 }}>
          이 학습 도구는 <strong>1년에 10%</strong> 기준이지만, 실제 우리 가족 시스템은{' '}
          <strong>1주에 10%</strong>로 시간을 압축한 거예요.
          <br />
          → 8주 = 8년의 복리 경험. 너의 실험 영역도 이렇게 자라고 있어.
        </div>
      </section>
    </main>
  );
}
