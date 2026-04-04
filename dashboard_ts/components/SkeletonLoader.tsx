export default function SkeletonLoader() {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-gray-800 animate-pulse">
      {/* Header */}
      <div className="grid grid-cols-[160px_1fr_110px_100px_110px] gap-4 px-5 py-3 bg-[#0d0d0f] border-b border-gray-800">
        {["w-16", "w-24", "w-14", "w-12", "w-16"].map((w, i) => (
          <div key={i} className={`h-3 bg-gray-800 rounded ${w}`} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[160px_1fr_110px_100px_110px] gap-4 px-5 py-4 border-b border-gray-900/60 bg-[#0a0a0c]"
        >
          <div className="h-3 bg-gray-800 rounded w-28" />
          <div className="space-y-1.5">
            <div className="h-3 bg-gray-800 rounded w-full" />
            <div className="h-3 bg-gray-800/60 rounded w-3/4" />
          </div>
          <div className="h-5 bg-gray-800 rounded-full w-16" />
          <div className="h-3 bg-gray-800 rounded w-12" />
          <div className="h-3 bg-gray-800 rounded w-20" />
        </div>
      ))}
    </div>
  );
}
