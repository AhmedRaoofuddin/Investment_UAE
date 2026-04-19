import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-lg text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-gold-600 font-medium">
          404 · Not Found
        </div>
        <h1 className="headline-serif text-navy-800 text-5xl mt-4">
          The page you were looking for isn't here.
        </h1>
        <p className="mt-4 text-ink-500">
          It may have moved, or the link might be stale. Head back to the home
          page and pick up from there.
        </p>
        <Link href="/" className="mt-8 inline-flex btn-primary text-sm">
          Return Home
        </Link>
      </div>
    </div>
  );
}
