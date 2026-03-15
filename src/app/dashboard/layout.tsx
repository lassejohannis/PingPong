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

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name, company_name")
    .eq("id", user.id)
    .single();

  if (!profile?.name?.trim() || !profile?.company_name?.trim()) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <nav className="border-b border-[#222] px-6 py-3 flex items-center justify-between bg-[#0d0d0d]">
        <Link href="/dashboard" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="h-8 overflow-hidden flex items-center"><img src="/logo.png" alt="PingPong" className="h-24 translate-y-1" /></div>
        </Link>
        <Link
          href="/dashboard/account"
          className="flex items-center gap-2 text-[#999] hover:text-white transition-colors"
        >
          <span className="w-7 h-7 rounded-full bg-violet-950/60 border border-violet-500/30 flex items-center justify-center text-xs font-semibold text-violet-300">
            {(profile?.name ?? user.email ?? "?")[0].toUpperCase()}
          </span>
          <span className="hidden sm:inline text-sm">{profile?.name ?? user.email}</span>
        </Link>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
