import { createClient } from "@/lib/supabase/server";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectSlug: string }>;
}) {
  const { projectSlug } = await params;
  const supabase = await createClient();

  const { data: pitchLinks } = await supabase
    .from("pitch_links")
    .select("*")
    .eq("project_id", (
      await supabase.from("projects").select("id").eq("slug", projectSlug).single()
    ).data?.id ?? "")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Pitch Links</h2>
      {pitchLinks && pitchLinks.length > 0 ? (
        <div className="grid gap-3">
          {pitchLinks.map((link) => (
            <div key={link.id} className="border rounded-lg p-4">
              <h3 className="font-semibold">{link.prospect_name}</h3>
              <p className="text-sm text-gray-500">{link.headline}</p>
              <p className="text-xs text-gray-400 mt-1">
                Status: {link.status}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500">No pitch links yet.</p>
      )}
    </div>
  );
}
