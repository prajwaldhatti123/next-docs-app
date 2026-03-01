export default function DashboardLoading() {
  return (
    <div className="page-loader">
      <div className="page-loader-inner">
        <div
          className="spinner"
          style={{ width: 32, height: 32 }}
          role="status"
          aria-label="Loading dashboard"
        />
        <p className="page-loader-text">Loading streams…</p>
      </div>
    </div>
  );
}
