"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewProjectPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const data = new FormData(e.currentTarget);
    const campaignName = data.get("campaign_name") as string;
    const productName = data.get("product_name") as string;

    const slug = campaignName
      .toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({ company_name: campaignName, slug, user_id: user.id, settings: { product_name: productName } })
      .select("id, slug")
      .single();

    if (projectError) { setError(projectError.message); setLoading(false); return; }

    router.push(`/dashboard/${project.slug}/product`);
  }

  return (
    <div className="max-w-lg mx-auto space-y-8 pt-8">
      <a href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-[#555] hover:text-white transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Projects
      </a>
      <div>
        <h1 className="text-2xl font-bold text-white">New Campaign</h1>
        <p className="text-sm text-[#888] mt-1">A campaign represents one product you are pitching.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="campaign_name" className="text-sm font-medium text-[#ccc]">
            Campaign name <span className="text-red-400">*</span>
          </label>
          <input
            id="campaign_name" name="campaign_name" type="text" required
            placeholder="Q2 Enterprise Push"
            className="w-full rounded-lg bg-[#111] border border-[#333] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="product_name" className="text-sm font-medium text-[#ccc]">
            Product name <span className="text-red-400">*</span>
          </label>
          <input
            id="product_name" name="product_name" type="text" required
            placeholder="PitchLink Pro"
            className="w-full rounded-lg bg-[#111] border border-[#333] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit" disabled={loading}
          className="w-full rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {loading ? "Creating..." : "Create campaign"}
        </button>
      </form>
    </div>
  );
}
