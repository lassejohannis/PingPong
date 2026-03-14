import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function PitchPage({
  params,
}: {
  params: Promise<{ pitchLinkSlug: string }>;
}) {
  const { pitchLinkSlug } = await params;
  const supabase = await createClient();

  const { data: pitchLink } = await supabase
    .from("pitch_links")
    .select("*, projects(*)")
    .eq("slug", pitchLinkSlug)
    .eq("status", "active")
    .single();

  if (!pitchLink) {
    notFound();
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-6 py-3 flex items-center gap-3">
        {pitchLink.prospect_logo && (
          <img
            src={pitchLink.prospect_logo}
            alt={pitchLink.prospect_name}
            className="h-8 w-8 rounded"
          />
        )}
        <h1 className="font-semibold">{pitchLink.headline}</h1>
      </header>
      <main className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">Pitch presentation will be implemented here.</p>
      </main>
    </div>
  );
}
