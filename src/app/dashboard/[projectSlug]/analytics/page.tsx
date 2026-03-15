import { createClient } from "@/lib/supabase/server";
import { GenerateReportButton } from "@/components/generate-report-button";
import type { ConversationReport } from "@/app/api/research/report/route";

const INTEREST_COLORS = {
  HOT: "bg-red-950/60 text-red-400 border-red-800/40",
  WARM: "bg-yellow-950/60 text-yellow-400 border-yellow-800/40",
  NOT_A_FIT: "bg-[#1a1a1a] text-[#888] border-[#333]",
};

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ projectSlug: string }>;
}) {
  const { projectSlug } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("slug", projectSlug)
    .single();

  if (!project) return null;

  type ConvRow = {
    id: string;
    messages: { role: string }[];
    slides_viewed: number[];
    qualification: string | null;
    summary: string | null;
    feedback: string | null;
    created_at: string;
    updated_at: string;
    pitch_links: { prospect_name: string; slug: string } | null;
  };

  // Get pitch link ids for this project first
  const { data: pitchLinkIds } = await supabase
    .from("pitch_links")
    .select("id")
    .eq("project_id", project.id);

  const ids = pitchLinkIds?.map((r) => r.id) ?? [];

  const { data: conversations } = ids.length
    ? await supabase
        .from("conversations")
        .select(
          "id, messages, slides_viewed, qualification, summary, feedback, created_at, updated_at, pitch_links(prospect_name, slug)"
        )
        .in("pitch_link_id", ids)
        .order("updated_at", { ascending: false })
        .returns<ConvRow[]>()
    : { data: [] as ConvRow[] };

  const total = conversations?.length ?? 0;
  const hot = conversations?.filter((c) => c.qualification === "HOT").length ?? 0;
  const notAFit = conversations?.filter((c) => c.qualification === "NOT_A_FIT").length ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-sm text-[#888] mt-1">Track how prospects engage with your pitch links.</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total conversations", value: total, color: "text-white" },
          { label: "HOT leads", value: hot, color: "text-red-400" },
          { label: "Not a fit", value: notAFit, color: "text-[#555]" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#111] border border-[#262626] rounded-xl p-4">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-[#555] mt-1">{label}</p>
          </div>
        ))}
      </div>

      {!conversations || conversations.length === 0 ? (
        <div className="border-2 border-dashed border-[#262626] rounded-xl p-16 text-center">
          <p className="text-sm text-[#444]">No conversations yet.</p>
          <p className="text-xs text-[#333] mt-1">
            When prospects open their pitch links, conversations will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {conversations.map((conv) => {
            const userMsgs =
              (conv.messages as { role: string }[])?.filter((m) => m.role === "user").length ?? 0;
            const slidesViewed = (conv.slides_viewed as number[])?.length ?? 0;

            let report: ConversationReport | null = null;
            if (conv.feedback) {
              try {
                report = JSON.parse(conv.feedback);
              } catch { /* ignore */ }
            }

            return (
              <div key={conv.id} className="bg-[#111] border border-[#262626] rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <h3 className="font-semibold text-white">
                      {(conv.pitch_links as { prospect_name: string } | null)?.prospect_name ??
                        "Unknown prospect"}
                    </h3>
                    <p className="text-xs text-[#555]">
                      {new Date(conv.updated_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {conv.qualification ? (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${
                          INTEREST_COLORS[conv.qualification as keyof typeof INTEREST_COLORS] ??
                          INTEREST_COLORS.NOT_A_FIT
                        }`}
                      >
                        {conv.qualification === "NOT_A_FIT" ? "Not a fit" : conv.qualification}
                      </span>
                    ) : (
                      <GenerateReportButton conversationId={conv.id} />
                    )}
                  </div>
                </div>

                {/* Quick stats */}
                <div className="flex gap-5 text-xs text-[#555]">
                  <span>
                    {userMsgs} message{userMsgs !== 1 ? "s" : ""} from prospect
                  </span>
                  {slidesViewed > 0 && (
                    <span>
                      {slidesViewed} slide{slidesViewed !== 1 ? "s" : ""} viewed
                    </span>
                  )}
                  {userMsgs === 0 && <span className="text-[#333]">Opened but no messages sent</span>}
                </div>

                {/* Report */}
                {report && (
                  <div className="space-y-3 pt-3 border-t border-[#222]">
                    {report.questions_asked.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs text-[#555] uppercase tracking-wide">Questions asked</p>
                        <ul className="space-y-1">
                          {report.questions_asked.map((q, i) => (
                            <li key={i} className="text-sm text-[#ccc] flex items-start gap-2">
                              <span className="text-violet-400 shrink-0 mt-0.5">?</span>
                              {q}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {report.objections_raised.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs text-[#555] uppercase tracking-wide">Objections raised</p>
                        <ul className="space-y-1">
                          {report.objections_raised.map((obj, i) => (
                            <li key={i} className="text-sm text-[#ccc] flex items-start gap-2">
                              <span className="text-yellow-400 shrink-0 mt-0.5">⚠</span>
                              {obj}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="bg-[#0d0d0d] border border-[#262626] rounded-lg px-3 py-2.5">
                      <p className="text-xs text-[#555] uppercase tracking-wide mb-1">
                        Recommended follow-up
                      </p>
                      <p className="text-sm text-[#ccc]">{report.follow_up_action}</p>
                    </div>

                    {report.interest_reasoning && (
                      <p className="text-xs text-[#555]">{report.interest_reasoning}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
