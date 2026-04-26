export default function HomePage() {
  return (
    <main
      style={{
        maxWidth: '720px',
        margin: '0 auto',
        padding: '64px 24px',
        lineHeight: 1.6,
      }}
    >
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
        🌱 Compound Learning System
      </h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        가족이 함께 경험하는 시간의 가치
      </p>
      <p>
        이 시스템은 초/중/고 자녀가 <strong>복리</strong>의 본질과{' '}
        <strong>정기적 청구</strong>의 가치를 직접 체험하도록 설계됐습니다.
      </p>
      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#fff3cd', borderRadius: '8px' }}>
        <strong>현재 상태</strong>: T1-foundation implementation 진행 중. 회원가입은
        다음 ticket (T2-auth-family) 머지 후 활성화됩니다.
      </div>
    </main>
  );
}
