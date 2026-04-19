export default function SectorsLoading() {
  return (
    <div className="max-w-[1320px] mx-auto px-6 lg:px-10 py-16">
      <div className="animate-pulse space-y-6">
        <div className="h-10 w-56 bg-sand-200 rounded" />
        <div className="h-5 w-80 bg-sand-100 rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-2 surface-card h-96" />
          <div className="surface-card h-96" />
        </div>
        <div className="surface-card h-64 mt-6" />
      </div>
    </div>
  );
}
