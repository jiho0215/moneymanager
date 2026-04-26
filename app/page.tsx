import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="page">
      <div style={{ textAlign: 'center', padding: 'var(--sp-7) 0' }}>
        <div style={{ fontSize: '4rem', marginBottom: 'var(--sp-3)' }}>🌱</div>
        <h1 className="h1" style={{ marginBottom: 'var(--sp-2)' }}>
          Money Bean
        </h1>
        <p className="soft" style={{ margin: '0 0 var(--sp-3)', fontSize: '0.95rem' }}>
          작은 콩 한 알이 큰 통장으로
        </p>
        <p className="lead" style={{ marginBottom: 'var(--sp-6)' }}>
          가족이 함께 경험하는 <strong>시간의 가치</strong>
        </p>

        <div className="row gap-3" style={{ justifyContent: 'center', marginBottom: 'var(--sp-3)', flexWrap: 'wrap' }}>
          <Link href="/signup" className="btn btn-primary btn-lg">
            가족 만들기
          </Link>
          <Link href="/login" className="btn btn-subtle btn-lg">
            로그인
          </Link>
        </div>
        <div style={{ marginBottom: 'var(--sp-7)' }}>
          <Link href="/learn" className="btn btn-ghost">
            💸 단리 vs 복리 직접 보기 (가입 없이도) →
          </Link>
        </div>
      </div>

      <section className="card stack-4" style={{ marginBottom: 'var(--sp-5)' }}>
        <h2 className="h2">⏱ 이런 경험을 하게 됩니다</h2>
        <div className="grid-3">
          <div>
            <div style={{ fontSize: '2rem', marginBottom: 6 }}>🌱</div>
            <strong>0주차</strong>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.92rem' }}>
              통장 10,000원으로 시작
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
        <p className="soft" style={{ margin: 0, fontSize: '0.85rem' }}>
          매주 일요일에 산수 한 문제 풀고 이번 주 이자(통장 전체의 10%)를 받는 단순한 약속.
          한 주 놓치면 그 주 이자는 사라져요 — 의식이 가치예요.
        </p>
      </section>

      <section className="card stack-4">
        <h2 className="h2">💡 어떻게 작동하나요?</h2>
        <div className="stack-3" style={{ fontSize: '0.95rem', lineHeight: 1.7 }}>
          <div>
            <strong>1. 보호자가 가족 가입</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              자녀 닉네임 + 4자리 PIN + PIPA 동의 (만 14세 미만 법정대리인 동의).
            </p>
          </div>
          <div>
            <strong>2. 보호자가 통장을 설계</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              시작 원금, 저금 방식 (한 번 / 꾸준히), 주간 이자율, 기간을 정하고 미리보기로 확인.
            </p>
          </div>
          <div>
            <strong>3. 자녀가 닉네임 + PIN 으로 로그인</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              자녀는 별도 가입 없이 보호자가 만든 계정으로 들어와요.
            </p>
          </div>
          <div>
            <strong>4. 자녀가 본인 통장으로 시작</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              보호자 추천을 기본으로 보고, 본인 선택으로 시작 원금/방식/기간을 확정해요.
            </p>
          </div>
          <div>
            <strong>5. 매주 일요일에 산수 풀고 이자 받기</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              통장 전체에 매주 10% 복리. 8주 ≈ 1년치 시간 압축 경험.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
