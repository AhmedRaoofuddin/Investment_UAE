export default function PlatformLoading() {
  return (
    <div className="max-w-[1320px] mx-auto px-6 lg:px-10 py-16">
      <div className="animate-pulse space-y-6">
        <div className="h-10 w-80 bg-sand-200 rounded" />
        <div className="h-5 w-96 bg-sand-100 rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line mt-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white p-6 h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="surface-card h-52" />
          ))}
        </div>
      </div>
    </div>
  );
}
