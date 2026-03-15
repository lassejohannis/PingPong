import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
      <main className="max-w-xl space-y-8 text-center px-6">
        <div className="space-y-6 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="h-16 overflow-hidden flex items-center"><img src="/logo.png" alt="PingPong" className="h-40 translate-y-1" /></div>
          <p className="text-lg text-[#888]">
            AI-powered personalised pitch pages for your prospects.
          </p>
        </div>
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-6 py-2.5 text-sm font-medium transition-colors"
          >
            Get Started
          </Link>
        </div>
      </main>
    </div>
  );
}
