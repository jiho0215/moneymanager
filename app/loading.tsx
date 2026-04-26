export default function Loading() {
  return (
    <main style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 24px', textAlign: 'center' }}>
      <div
        role="status"
        aria-label="페이지 불러오는 중"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '12px',
          padding: '20px 28px',
          backgroundColor: '#f3f4f6',
          borderRadius: '12px',
          color: '#374151',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
          <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <style>{'@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
        </svg>
        <span>잠시만요...</span>
      </div>
    </main>
  );
}
