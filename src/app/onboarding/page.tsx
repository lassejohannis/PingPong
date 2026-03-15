import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function saveProfile(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("users")
    .update({
      name: formData.get("name") as string,
      company_name: formData.get("company_name") as string,
    })
    .eq("id", user.id);

  redirect("/dashboard");
}

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
      <div className="w-full max-w-lg space-y-8 px-6 py-12">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="h-10 overflow-hidden flex items-center mb-6"><img src="/logo.png" alt="PingPong" className="h-24 translate-y-1" /></div>
          <h1 className="text-2xl font-bold text-white">Set up your company profile</h1>
          <p className="text-sm text-[#888] mt-1">
            The AI agent uses this information when pitching to your prospects.
          </p>
        </div>

        <form action={saveProfile} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-sm font-medium text-[#ccc]">
              Your name <span className="text-red-400">*</span>
            </label>
            <input
              id="name" name="name" type="text" required
              placeholder="Jane Smith"
              className="w-full rounded-lg bg-[#111] border border-[#2a2a2a] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="company_name" className="text-sm font-medium text-[#ccc]">
              Company name <span className="text-red-400">*</span>
            </label>
            <input
              id="company_name" name="company_name" type="text" required
              placeholder="Acme Inc."
              className="w-full rounded-lg bg-[#111] border border-[#2a2a2a] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="company_url" className="text-sm font-medium text-[#ccc]">
              Company website
            </label>
            <input
              id="company_url" name="company_url" type="url"
              placeholder="https://acme.com"
              className="w-full rounded-lg bg-[#111] border border-[#2a2a2a] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
            />
            <p className="text-xs text-[#555]">The AI crawls this to learn about your company.</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="company_description" className="text-sm font-medium text-[#ccc]">
              What does your company do?
            </label>
            <textarea
              id="company_description" name="company_description" rows={3}
              placeholder="We help enterprise teams automate their sales workflows..."
              className="w-full rounded-lg bg-[#111] border border-[#2a2a2a] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors resize-none"
            />
            <p className="text-xs text-[#555]">Used as context for every pitch the AI delivers.</p>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 text-sm font-medium transition-colors"
          >
            Continue to dashboard
          </button>
        </form>
      </div>
    </div>
  );
}
