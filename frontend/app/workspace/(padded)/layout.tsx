// Padded inner layout for non-Pulse workspace pages.
// The root /workspace layout owns the sub-nav; this one only handles the
// container + spacing applied to Overview, Connections, Watchlist,
// Notifications.

export default function PaddedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 py-6 md:py-10">
      {children}
    </div>
  );
}
