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

  if (!project) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <Link href="/dashboard" className="hover:text-black">
          Projects
        </Link>
        <span>/</span>
        <span className="text-black font-medium">{project.company_name}</span>
      </div>
      <nav className="flex gap-4 text-sm border-b pb-2">
        <Link href={`/dashboard/${projectSlug}`} className="hover:text-black">
          Leads
        </Link>
        <Link href={`/dashboard/${projectSlug}/product`} className="hover:text-black">
          Product
        </Link>
        <Link href={`/dashboard/${projectSlug}/analytics`} className="hover:text-black">
          Analytics
        </Link>
        <Link href={`/dashboard/${projectSlug}/campaign`} className="hover:text-black">
          Campaign
        </Link>
      </nav>
      {children}
    </div>
  );
}
