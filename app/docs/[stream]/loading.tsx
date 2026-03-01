export default function StreamLoading() {
  return (
    <>
      {/* Navbar skeleton */}
      <div className="skeleton-navbar" />

      <div className="docs-root">
        {/* Sidebar skeleton */}
        <div className="docs-sidebar-wrap">
          <div className="sidebar-inner">
            <div className="skeleton-sidebar-header" />
            <div
              style={{
                padding: "0.75rem 0.6rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="skeleton-line"
                  style={{
                    width: `${65 + (i % 3) * 15}%`,
                    marginLeft: i % 2 === 1 ? "1rem" : 0,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Main content spinner */}
        <main className="docs-main-wrap">
          <div
            className="page-loader"
            style={{ minHeight: "60vh", position: "relative" }}
          >
            <div className="page-loader-inner">
              <div
                className="spinner"
                style={{ width: 28, height: 28 }}
                role="status"
                aria-label="Loading"
              />
              <p className="page-loader-text">Loading docs…</p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
