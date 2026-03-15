import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name, company_name")
    .eq("id", user.id)
    .single();

  async function saveProfile(formData: FormData) {
    "use server";
    const supabase2 = await createClient();
    const { data: { user: u } } = await supabase2.auth.getUser();
    if (!u) redirect("/login");
    await supabase2
      .from("users")
      .update({
        name: (formData.get("name") as string).trim(),
        company_name: (formData.get("company_name") as string).trim(),
      })
      .eq("id", u.id);
    revalidatePath("/dashboard/account");
  }

  const initials = (profile?.name ?? user.email ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-[80vh] flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-md space-y-8">
        <a href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-[#555] hover:text-white transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Projects
        </a>

        {/* Avatar + heading */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-lg font-bold text-violet-400">
            {initials}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{profile?.name ?? "Your account"}</h1>
            <p className="text-sm text-[#555] mt-0.5">{user.email}</p>
          </div>
        </div>

        {/* Profile form */}
        <div className="bg-[#111] border border-[#262626] rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-white">Profile</h2>
          <form action={saveProfile} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-sm font-medium text-[#ccc]">
                Your name <span className="text-red-400">*</span>
              </label>
              <input
                id="name" name="name" type="text" required
                defaultValue={profile?.name ?? ""}
                placeholder="Jane Smith"
                className="w-full rounded-lg bg-[#0d0d0d] border border-[#333] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="company_name" className="text-sm font-medium text-[#ccc]">
                Company name <span className="text-red-400">*</span>
              </label>
              <input
                id="company_name" name="company_name" type="text" required
                defaultValue={profile?.company_name ?? ""}
                placeholder="Acme Inc."
                className="w-full rounded-lg bg-[#0d0d0d] border border-[#333] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#ccc]">Email</label>
              <input
                type="text" value={user.email} disabled
                className="w-full rounded-lg bg-[#0a0a0a] border border-[#222] text-[#3a3a3a] px-3 py-2.5 text-sm cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-violet-600 hover:bg-violet-700 text-white py-2.5 text-sm font-medium transition-colors"
            >
              Save changes
            </button>
          </form>
        </div>

        {/* Sign out */}
        <div className="bg-[#111] border border-[#262626] rounded-xl p-6 space-y-3">
          <h2 className="text-sm font-semibold text-white">Session</h2>
          <p className="text-xs text-[#555]">You are signed in as {user.email}.</p>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-lg border border-red-900/50 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-950/30 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
