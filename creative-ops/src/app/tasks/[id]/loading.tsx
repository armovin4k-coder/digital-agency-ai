export default function TaskLoading() {
  return (
    <main className="task-detail-loading" aria-busy="true" aria-label="Загрузка задачи">
      <div className="skeleton skeleton-kicker" /><div className="skeleton skeleton-title task-title-skeleton" />
      <div className="task-loading-grid"><section><div className="skeleton-card large" /><div className="skeleton-card large" /><div className="skeleton-card large" /></section><aside><div className="skeleton-card large" /><div className="skeleton-card large" /></aside></div>
    </main>
  );
}
