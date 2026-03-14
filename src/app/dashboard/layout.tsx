import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <nav className="border-b px-6 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="font-bold text-lg">
          PitchLink
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500">{user.email}</span>
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-gray-500 hover:text-black">
              Sign Out
            </button>
          </form>
        </div>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
