import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <main className="max-w-xl space-y-6 text-center px-6">
        <h1 className="text-4xl font-bold">PitchLink</h1>
        <p className="text-lg text-gray-600">
          AI-powered personalized pitch pages for your prospects.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="rounded-md bg-black text-white px-6 py-2 text-sm font-medium hover:bg-gray-800"
          >
            Get Started
          </Link>
        </div>
      </main>
    </div>
  );
}
