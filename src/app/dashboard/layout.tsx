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
      <nav className="border-b border-[#1a1a1a] px-6 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="font-bold text-lg text-white tracking-tight">
          PitchLink
        </Link>
        <Link
          href="/dashboard/account"
          className="flex items-center gap-2 text-[#888] hover:text-white transition-colors"
        >
          <span className="w-7 h-7 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center text-xs font-semibold text-violet-400">
            {(profile?.name ?? user.email ?? "?")[0].toUpperCase()}
          </span>
          <span className="hidden sm:inline text-sm">{profile?.name ?? user.email}</span>
        </Link>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
