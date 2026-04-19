export default function GeoLoading() {
  return (
    <div className="max-w-[1320px] mx-auto px-6 lg:px-10 py-16">
      <div className="animate-pulse space-y-6">
        <div className="h-10 w-72 bg-sand-200 rounded" />
        <div className="h-5 w-96 bg-sand-100 rounded" />
        <div className="grid grid-cols-3 gap-px bg-line border border-line mt-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-6 h-24" />
          ))}
        </div>
        <div className="w-full h-[560px] bg-navy-900 rounded-md mt-4" />
      </div>
    </div>
  );
}
