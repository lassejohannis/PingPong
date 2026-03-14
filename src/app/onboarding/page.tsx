import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function saveProfile(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // TODO: company_url and company_description need a DB migration to add columns to the users table
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-lg space-y-8 px-6 py-12">
        <div>
          <h1 className="text-2xl font-bold">Set up your company profile</h1>
          <p className="text-sm text-gray-500 mt-1">
            The AI agent uses this information when pitching to your prospects.
          </p>
        </div>

        <form action={saveProfile} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-sm font-medium">
              Your name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="Jane Smith"
              className="w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="company_name" className="text-sm font-medium">
              Company name <span className="text-red-500">*</span>
            </label>
            <input
              id="company_name"
              name="company_name"
              type="text"
              required
              placeholder="Acme Inc."
              className="w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="company_url" className="text-sm font-medium">
              Company website
            </label>
            <input
              id="company_url"
              name="company_url"
              type="url"
              placeholder="https://acme.com"
              className="w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
            />
            <p className="text-xs text-gray-400">
              The AI crawls this to learn about your company.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="company_description" className="text-sm font-medium">
              What does your company do?
            </label>
            <textarea
              id="company_description"
              name="company_description"
              rows={3}
              placeholder="We help enterprise teams automate their sales workflows..."
              className="w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black resize-none"
            />
            <p className="text-xs text-gray-400">
              Used as context for every pitch the AI delivers.
            </p>
          </div>

          <button
            type="submit"
            className="w-full bg-black text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Continue to dashboard
          </button>
        </form>
      </div>
    </div>
  );
}
