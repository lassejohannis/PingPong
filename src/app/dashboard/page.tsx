import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Link
          href="/dashboard/new"
          className="rounded-md bg-black text-white px-4 py-2 text-sm font-medium hover:bg-gray-800"
        >
          New Project
        </Link>
      </div>

      {projects && projects.length > 0 ? (
        <div className="grid gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/${project.slug}`}
              className="block border rounded-lg p-4 hover:border-black transition-colors"
            >
              <h2 className="font-semibold">{project.company_name}</h2>
              <p className="text-sm text-gray-500">/{project.slug}</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-gray-500">No projects yet. Create your first one!</p>
      )}
    </div>
  );
}
