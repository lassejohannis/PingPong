import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Projects</h1>
        <Link
          href="/dashboard/new"
          className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-sm font-medium transition-colors"
        >
          New Project
        </Link>
      </div>

      {projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => {
            const settings =
              project.settings && typeof project.settings === "object" && !Array.isArray(project.settings)
                ? (project.settings as Record<string, string>)
                : {};
            const logoUrl = settings.logo_url ?? null;
            const initial = project.company_name?.[0]?.toUpperCase() ?? "?";

            return (
              <Link
                key={project.id}
                href={`/dashboard/${project.slug}`}
                className="group bg-[#111] border border-[#1e1e1e] hover:border-violet-500/40 rounded-xl p-5 flex flex-col gap-4 transition-colors"
              >
                {/* Logo / avatar */}
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center shrink-0">
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt={project.company_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-bold text-violet-400">{initial}</span>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-[#333] group-hover:text-[#666] transition-colors mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                {/* Name + slug */}
                <div>
                  <h2 className="font-semibold text-white group-hover:text-violet-300 transition-colors leading-tight">
                    {project.company_name}
                  </h2>
                  {settings.product_name && (
                    <p className="text-xs text-[#555] mt-0.5">{settings.product_name}</p>
                  )}
                </div>

                {/* Footer */}
                <div className="mt-auto">
                  <p className="text-xs text-[#333]">/{project.slug}</p>
                </div>
              </Link>
            );
          })}

          {/* New project card */}
          <Link
            href="/dashboard/new"
            className="group bg-[#0d0d0d] border-2 border-dashed border-[#1e1e1e] hover:border-violet-500/30 rounded-xl p-5 flex flex-col items-center justify-center gap-2 min-h-[140px] transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] group-hover:bg-violet-600/10 border border-[#2a2a2a] group-hover:border-violet-500/30 flex items-center justify-center transition-colors">
              <svg className="w-5 h-5 text-[#444] group-hover:text-violet-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-sm text-[#444] group-hover:text-[#888] transition-colors">New project</span>
          </Link>
        </div>
      ) : (
        <div className="border-2 border-dashed border-[#1e1e1e] rounded-xl p-16 text-center">
          <p className="text-[#444]">No projects yet.</p>
          <p className="text-sm text-[#333] mt-1">Create your first one to get started.</p>
        </div>
      )}
    </div>
  );
}
