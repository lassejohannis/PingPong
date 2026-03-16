"use client";

import { useState } from "react";
import { GenerateReportButton } from "@/components/generate-report-button";
import type { ConversationReport } from "@/app/api/research/report/route";

type ConvRow = {
  id: string;
  messages: { role: string; content: string }[];
  qualification: string | null;
  feedback: string | null;
  created_at: string;
  updated_at: string;
};

type InterestColors = {
  HOT: string;
  WARM: string;
  NOT_A_FIT: string;
};

export default function ConversationCard({
  conv,
  userMsgs,
  report,
  interestColors,
}: {
  conv: ConvRow;
  userMsgs: number;
  report: ConversationReport | null;
  interestColors: InterestColors;
}) {
  const [showReport, setShowReport] = useState(false);

  const dateLabel = new Date(conv.updated_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="bg-[#0d0d0d] border border-[#222] rounded-xl p-4 space-y-3">
      {/* One-liner row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-[#555]">{dateLabel}</span>
          <span className="text-xs text-[#444]">
            {userMsgs} message{userMsgs !== 1 ? "s" : ""}
          </span>
          {report?.follow_up_action && (
            <span className="text-xs text-[#666] truncate max-w-xs">
              → {report.follow_up_action}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {conv.qualification ? (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${
                interestColors[conv.qualification as keyof InterestColors] ?? interestColors.NOT_A_FIT
              }`}
            >
              {conv.qualification === "NOT_A_FIT" ? "Not a fit" : conv.qualification}
            </span>
          ) : (
            <GenerateReportButton conversationId={conv.id} />
          )}

          {report && (
            <button
              onClick={() => setShowReport(!showReport)}
              className="text-xs text-[#555] hover:text-violet-400 transition-colors border border-[#333] hover:border-violet-500/40 rounded-lg px-2.5 py-1"
            >
              {showReport ? "Hide report" : "View report"}
            </button>
          )}
        </div>
      </div>

      {/* Expanded report */}
      {showReport && report && (
        <div className="space-y-3 pt-3 border-t border-[#1a1a1a]">
          {report.questions_asked.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-[#555] uppercase tracking-wide">Questions asked</p>
              <ul className="space-y-1">
                {report.questions_asked.map((q, i) => (
                  <li key={i} className="text-sm text-[#ccc] flex items-start gap-2">
                    <span className="text-violet-400 shrink-0 mt-0.5">?</span>{q}
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
                    <span className="text-yellow-400 shrink-0 mt-0.5">⚠</span>{obj}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-[#111] border border-[#262626] rounded-lg px-3 py-2.5">
            <p className="text-xs text-[#555] uppercase tracking-wide mb-1">Recommended follow-up</p>
            <p className="text-sm text-[#ccc]">{report.follow_up_action}</p>
          </div>

          {report.interest_reasoning && (
            <p className="text-xs text-[#555]">{report.interest_reasoning}</p>
          )}
        </div>
      )}
    </div>
  );
}
