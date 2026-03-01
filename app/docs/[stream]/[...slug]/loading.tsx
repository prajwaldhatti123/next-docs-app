export default function DocLoading() {
  return (
    <main className="docs-main-wrap" id="main-content">
      {/* Title skeleton */}
      <div style={{ marginBottom: "2rem" }}>
        <div
          className="skeleton-line"
          style={{ width: "55%", height: "2rem", marginBottom: "0.75rem" }}
        />
        <div
          className="skeleton-line"
          style={{ width: "35%", height: "0.85rem" }}
        />
      </div>

      {/* Body skeletons */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            className="skeleton-line"
            style={{
              width: i % 5 === 4 ? "45%" : i % 3 === 2 ? "80%" : "95%",
              height: i === 5 || i === 10 ? "1.5rem" : "0.78rem",
              marginTop: i === 5 || i === 10 ? "1.5rem" : 0,
            }}
          />
        ))}
      </div>
    </main>
  );
}
