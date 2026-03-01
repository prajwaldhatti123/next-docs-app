export default function NotFound() {
  return (
    <div className="not-found-root">
      <div>
        <div className="not-found-code">404</div>
        <h2>Page not found</h2>
        <p>This page doesn't exist or you don't have access.</p>
        <a href="/dashboard" className="btn-back">
          ← Back to Dashboard
        </a>
      </div>
    </div>
  );
}
