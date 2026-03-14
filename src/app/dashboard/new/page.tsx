"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export default function NewProjectPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const data = new FormData(e.currentTarget);
    const campaignName = data.get("campaign_name") as string;
    const productName = data.get("product_name") as string;
    const file = fileRef.current?.files?.[0];

    const slug = campaignName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        company_name: campaignName,
        slug,
        user_id: user.id,
        settings: { product_name: productName },
      })
      .select("id, slug")
      .single();

    if (projectError) {
      setError(projectError.message);
      setLoading(false);
      return;
    }

    if (file) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const path = `${project.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(path, file);

      if (!uploadError) {
        await supabase.from("documents").insert({
          project_id: project.id,
          file_name: file.name,
          file_type: file.type,
          file_url: path,
        });
      }
    }

    router.push(`/dashboard/${project.slug}/product`);
  }

  return (
    <div className="max-w-lg mx-auto space-y-8 pt-8">
      <div>
        <h1 className="text-2xl font-bold">New Campaign</h1>
        <p className="text-sm text-gray-500 mt-1">
          A campaign represents one product you are pitching.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="campaign_name" className="text-sm font-medium">
            Campaign name <span className="text-red-500">*</span>
          </label>
          <input
            id="campaign_name"
            name="campaign_name"
            type="text"
            required
            placeholder="Q2 Enterprise Push"
            className="w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="product_name" className="text-sm font-medium">
            Product name <span className="text-red-500">*</span>
          </label>
          <input
            id="product_name"
            name="product_name"
            type="text"
            required
            placeholder="PitchLink Pro"
            className="w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Slide deck</label>
          <div
            className="border-2 border-dashed rounded-md px-4 py-8 text-center cursor-pointer hover:border-black transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            {fileName ? (
              <p className="text-sm font-medium">{fileName}</p>
            ) : (
              <>
                <p className="text-sm text-gray-500">
                  Click to upload PDF or PPTX
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Optional — you can add slides later
                </p>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.pptx"
            className="hidden"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {loading ? "Creating..." : "Create campaign"}
        </button>
      </form>
    </div>
  );
}
