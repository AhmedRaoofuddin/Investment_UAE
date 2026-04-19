export default function CompaniesLoading() {
  return (
    <div className="max-w-[1320px] mx-auto px-6 lg:px-10 py-16">
      <div className="animate-pulse space-y-6">
        <div className="h-10 w-64 bg-sand-200 rounded" />
        <div className="h-5 w-96 bg-sand-100 rounded" />
        <div className="surface-card p-5 mt-6 h-28" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="surface-card h-56" />
          ))}
        </div>
      </div>
    </div>
  );
}
