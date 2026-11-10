export default function Loading() {
  return (
    <main className="app-loading" aria-busy="true" aria-label="Загрузка Creative Ops">
      <div className="loading-heading"><span className="skeleton skeleton-kicker" /><span className="skeleton skeleton-title" /></div>
      <div className="loading-kpis">{Array.from({ length: 4 }, (_, index) => <div className="skeleton-card" key={index}><span className="skeleton skeleton-kicker" /><span className="skeleton skeleton-metric" /></div>)}</div>
      <div className="loading-columns">{Array.from({ length: 5 }, (_, index) => <div className="skeleton-column" key={index}><span className="skeleton skeleton-heading" />{Array.from({ length: 2 }, (_, card) => <div className="skeleton-task" key={card}><span className="skeleton skeleton-line wide" /><span className="skeleton skeleton-line" /><span className="skeleton skeleton-line short" /></div>)}</div>)}</div>
    </main>
  );
}
