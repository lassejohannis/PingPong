import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectSlug: string }>;
}) {
  const { projectSlug } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", projectSlug)
    .single();

  if (!project) notFound();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#555]">
        <Link href="/dashboard" className="hover:text-white transition-colors flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Projects
        </Link>
        <span>/</span>
        <span className="text-white font-medium">{project.company_name}</span>
      </div>

      {/* Tab nav — order: Leads → Product → Campaign → Analytics */}
      <nav className="flex gap-1 border-b border-[#1a1a1a] pb-0">
        {[
          { label: "Leads", href: `/dashboard/${projectSlug}` },
          { label: "Product", href: `/dashboard/${projectSlug}/product` },
          { label: "Campaign", href: `/dashboard/${projectSlug}/campaign` },
          { label: "Analytics", href: `/dashboard/${projectSlug}/analytics` },
        ].map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className="px-4 py-2 text-sm text-[#666] hover:text-white transition-colors border-b-2 border-transparent hover:border-[#444] -mb-px"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
