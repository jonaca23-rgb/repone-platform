import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-repone-black text-repone-white">
      <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold uppercase tracking-wide">
        RepOne <span className="text-repone-red">Platform</span>
      </h1>
      <p className="max-w-md text-center text-white/60">
        Sports data, scoring, and broadcast graphics for RepOneLive competitions.
      </p>
      <div className="flex gap-4">
        <Link href="/login" className="control-btn control-btn-red px-8">
          Sign In
        </Link>
      </div>
    </div>
  );
}
