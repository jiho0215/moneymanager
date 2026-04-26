import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="page">
      <div style={{ textAlign: 'center', padding: 'var(--sp-7) 0' }}>
        <div style={{ fontSize: '4rem', marginBottom: 'var(--sp-3)' }}>🌱</div>
        <h1 className="h1" style={{ marginBottom: 'var(--sp-3)' }}>
          Compound Learning System
        </h1>
        <p className="lead" style={{ marginBottom: 'var(--sp-6)' }}>
          가족이 함께 경험하는 <strong>시간의 가치</strong>
        </p>

        <div className="row gap-3" style={{ justifyContent: 'center', marginBottom: 'var(--sp-7)' }}>
          <Link href="/signup" className="btn btn-primary btn-lg">
            가족 만들기
          </Link>
          <Link href="/login" className="btn btn-subtle btn-lg">
            로그인
          </Link>
        </div>
      </div>

      <section className="card stack-4" style={{ marginBottom: 'var(--sp-5)' }}>
        <h2 className="h2">⏱ 이런 경험을 하게 됩니다</h2>
        <div className="grid-3">
          <div>
            <div style={{ fontSize: '2rem', marginBottom: 6 }}>🌱</div>
            <strong>1주차</strong>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.92rem' }}>
              실험영역 10,000원으로 시작
            </p>
          </div>
          <div>
            <div style={{ fontSize: '2rem', marginBottom: 6 }}>🌿</div>
            <strong>4주차</strong>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.92rem' }}>
              ~14,641원 (매주 청구 시)
            </p>
          </div>
          <div>
            <div style={{ fontSize: '2rem', marginBottom: 6 }}>🌳</div>
            <strong>8주차</strong>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.92rem' }}>
              <strong style={{ color: 'var(--experiment-deep)' }}>21,434원</strong> — 2배 넘게
            </p>
          </div>
        </div>
      </section>

      <section className="card stack-4">
        <h2 className="h2">💡 어떻게 작동하나요?</h2>
        <div className="stack-3" style={{ fontSize: '0.95rem', lineHeight: 1.7 }}>
          <div>
            <strong>1. 부모가 가족을 만들어요</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              자녀 닉네임 + 시작 자금 + PIPA 동의 (만 14세 미만 법정대리인 동의).
            </p>
          </div>
          <div>
            <strong>2. 자녀는 6자리 코드로 들어와요</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              부모가 발급한 코드만 있으면 자녀는 가입할 필요 없어요.
            </p>
          </div>
          <div>
            <strong>3. 매주 산수 풀고 이자를 받아요</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              실험영역에 매주 10% 복리. 8주 = 1년치 경험.
            </p>
          </div>
          <div>
            <strong>4. 자유영역은 마음대로</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              자녀가 통제받지 않고 자유롭게 쓸 수 있는 영역.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
