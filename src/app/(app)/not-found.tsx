import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold">Not found</h1>
      <p className="max-w-md text-black/60">
        That page, event or athlete doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <Link href="/" className="control-btn control-btn-red px-6">
        Home
      </Link>
    </main>
  );
}
