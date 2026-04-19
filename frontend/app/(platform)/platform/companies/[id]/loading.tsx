export default function CompanyLoading() {
  return (
    <div className="max-w-[1320px] mx-auto px-6 lg:px-10 py-16">
      <div className="animate-pulse space-y-6">
        <div className="h-4 w-32 bg-sand-200 rounded" />
        <div className="h-10 w-72 bg-sand-200 rounded" />
        <div className="h-5 w-96 bg-sand-100 rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-8">
          <div className="lg:col-span-4 space-y-6">
            <div className="surface-card h-52" />
            <div className="surface-card h-40" />
            <div className="surface-card h-24" />
          </div>
          <div className="lg:col-span-8 space-y-6">
            <div className="surface-card h-64" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="surface-card h-48" />
              <div className="surface-card h-48" />
            </div>
            <div className="surface-card h-72" />
          </div>
        </div>
      </div>
    </div>
  );
}
