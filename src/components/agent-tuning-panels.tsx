"use client";

import { useState, useCallback, useEffect } from "react";
import type { AgentKnowledge, KnowledgeQuestion } from "@/lib/ai/knowledge-questions";
import { GeneralInfo } from "./agent-tabs/general-info";
import { AgentBehaviour } from "./agent-tabs/agent-behaviour";
import { DocumentManager } from "./document-manager";
import { ProcessDocuments } from "./process-documents";
import { KnowledgeOverview } from "./knowledge-overview";
import { BriefingChat } from "./briefing-chat";

interface Document {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  created_at: string;
}

interface AgentTuningPanelsProps {
  projectId: string;
  initialSettings: Record<string, unknown>;
  initialKnowledge: AgentKnowledge | null;
  initialSystemPrompt: string | null;
  initialDocuments: Document[];
  productName: string;
  companyName: string;
}

type TabId = "general" | "behaviour" | "documents" | "knowledge" | "briefing";

const TABS: { id: TabId; label: string }[] = [
  { id: "general", label: "General Info" },
  { id: "behaviour", label: "Agent Behaviour" },
  { id: "documents", label: "Documents" },
  { id: "knowledge", label: "Knowledge" },
  { id: "briefing", label: "Briefing" },
];

export function AgentTuningPanels({
  projectId,
  initialSettings,
  initialKnowledge,
  initialSystemPrompt,
  initialDocuments,
  productName,
  companyName,
}: AgentTuningPanelsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [knowledge, setKnowledge] = useState<AgentKnowledge | null>(initialKnowledge);
  const [systemPrompt, setSystemPrompt] = useState<string | null>(initialSystemPrompt);
  const [isChatActive, setIsChatActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnprocessedDocs, setHasUnprocessedDocs] = useState(false);
  const [presentationDocId, setPresentationDocId] = useState<string | null>(
    (initialSettings.presentation_doc_id as string) ?? null
  );
  const [customQuestions, setCustomQuestions] = useState<KnowledgeQuestion[]>(
    (initialSettings.custom_questions as KnowledgeQuestion[]) || []
  );

  // Guard state
  const [showGuard, setShowGuard] = useState(false);
  const [guardMessage, setGuardMessage] = useState("");
  const [pendingTab, setPendingTab] = useState<TabId | null>(null);
  const [guardActions, setGuardActions] = useState<{
    onSave?: () => Promise<void>;
    onDiscard: () => void;
  } | null>(null);

  // Dirty tracking refs (set by child components)
  const [isGeneralDirty, setIsGeneralDirty] = useState(false);
  const [isBehaviourDirty, setIsBehaviourDirty] = useState(false);
  const [briefingPendingCount, setBriefingPendingCount] = useState(0);

  useEffect(() => {
    if (!isProcessing) return;
    const handle = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handle);
    return () => window.removeEventListener("beforeunload", handle);
  }, [isProcessing]);

  const handleTabSwitch = useCallback((newTab: TabId) => {
    if (newTab === activeTab) return;
    if (isProcessing || isSaving) return; // Block all switches during processing or saving

    // Check guards for current tab
    if (activeTab === "general" && isGeneralDirty) {
      setGuardMessage("You have unsaved changes in General Info.");
      setGuardActions({
        onDiscard: () => setIsGeneralDirty(false),
      });
      setPendingTab(newTab);
      setShowGuard(true);
      return;
    }

    if (activeTab === "behaviour" && isBehaviourDirty) {
      setGuardMessage("You have unsaved changes in Agent Behaviour.");
      setGuardActions({
        onDiscard: () => setIsBehaviourDirty(false),
      });
      setPendingTab(newTab);
      setShowGuard(true);
      return;
    }

    if (activeTab === "documents" && hasUnprocessedDocs) {
      setGuardMessage("Your documents are saved. Hit 'Process Documents' so the AI can learn from them — or leave and do it later.");
      setGuardActions({
        onDiscard: () => setHasUnprocessedDocs(false),
      });
      setPendingTab(newTab);
      setShowGuard(true);
      return;
    }

    if (activeTab === "briefing" && briefingPendingCount > 0) {
      setGuardMessage(`You have ${briefingPendingCount} unsaved change(s) from your briefing session.`);
      setGuardActions({
        onDiscard: () => setBriefingPendingCount(0),
      });
      setPendingTab(newTab);
      setShowGuard(true);
      return;
    }

    setActiveTab(newTab);
  }, [activeTab, isGeneralDirty, isBehaviourDirty, hasUnprocessedDocs, briefingPendingCount, isSaving]);

  const handleGuardSave = useCallback(async () => {
    if (guardActions?.onSave) {
      await guardActions.onSave();
    }
    setShowGuard(false);
    if (pendingTab) setActiveTab(pendingTab);
    setPendingTab(null);
    setGuardActions(null);
  }, [guardActions, pendingTab]);

  const handleGuardDiscard = useCallback(() => {
    guardActions?.onDiscard();
    setShowGuard(false);
    if (pendingTab) setActiveTab(pendingTab);
    setPendingTab(null);
    setGuardActions(null);
  }, [guardActions, pendingTab]);

  const handleKnowledgeUpdate = useCallback((newKnowledge: AgentKnowledge, newPrompt: string) => {
    setKnowledge(newKnowledge);
    setSystemPrompt(newPrompt);
  }, []);

  return (
    <div className="space-y-6">
      {/* Sub-tab navigation */}
      <div className="flex gap-1 border-b border-[#222] pb-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabSwitch(tab.id)}
            disabled={(isProcessing || isSaving) && tab.id !== activeTab}
            className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "text-violet-300 border-violet-500"
                : isProcessing || isSaving
                ? "text-[#444] border-transparent cursor-not-allowed"
                : "text-[#999] border-transparent hover:text-violet-300 hover:border-violet-500/40"
            }`}
          >
            {tab.label}
            {tab.id === "documents" && hasUnprocessedDocs && (
              <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block" />
            )}
            {tab.id === "briefing" && briefingPendingCount > 0 && (
              <span className="ml-1.5 text-[10px] bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded-full">
                {briefingPendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Guard overlay */}
      {showGuard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowGuard(false); setPendingTab(null); }} />
          <div className="relative bg-[#111] border border-[#333] rounded-xl p-6 space-y-4 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <p className="text-sm font-semibold text-white">Unsaved Changes</p>
            </div>
            <p className="text-sm text-[#888]">{guardMessage}</p>
            <div className="flex flex-col gap-2 pt-1">
              {guardActions?.onSave && (
                <button
                  onClick={handleGuardSave}
                  className="w-full rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 text-sm font-medium transition-colors"
                >
                  Save & Continue
                </button>
              )}
              <button
                onClick={handleGuardDiscard}
                className="w-full rounded-lg border border-[#333] text-[#888] hover:text-white hover:border-[#555] px-4 py-2.5 text-sm transition-colors"
              >
                {guardActions?.onSave ? "Discard & Continue" : "Continue Anyway"}
              </button>
              <button
                onClick={() => { setShowGuard(false); setPendingTab(null); }}
                className="w-full text-sm text-[#555] hover:text-white py-1.5 transition-colors"
              >
                Stay Here
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab content */}
      {activeTab === "general" && (
        <GeneralInfo
          projectId={projectId}
          settings={initialSettings}
          onDirtyChange={setIsGeneralDirty}
          onPromptRegenerated={(prompt) => setSystemPrompt(prompt)}
          onSavingChange={setIsSaving}
        />
      )}

      {activeTab === "behaviour" && (
        <AgentBehaviour
          projectId={projectId}
          settings={initialSettings}
          onDirtyChange={setIsBehaviourDirty}
          onPromptRegenerated={(prompt) => setSystemPrompt(prompt)}
          onSavingChange={setIsSaving}
        />
      )}

      {activeTab === "documents" && (
        <div className="space-y-6">
          <DocumentManager
            projectId={projectId}
            initialDocuments={initialDocuments}
            presentationDocId={presentationDocId}
            onDocsChanged={() => setHasUnprocessedDocs(true)}
            onPresentationChange={setPresentationDocId}
          />
          <ProcessDocuments
            projectId={projectId}
            presentationDocId={presentationDocId}
            presentationDocUrl={(() => {
              if (!presentationDocId) return null;
              const doc = initialDocuments.find((d) => d.id === presentationDocId);
              return doc?.file_url ?? null;
            })()}
            presentationDocType={(() => {
              if (!presentationDocId) return null;
              const doc = initialDocuments.find((d) => d.id === presentationDocId);
              return doc?.file_type ?? null;
            })()}
            lastProcessedPresentationId={(initialSettings.last_processed_presentation_id as string) ?? null}
            onComplete={handleKnowledgeUpdate}
            isChatActive={isChatActive}
            isProcessing={isProcessing}
            onProcessingChange={setIsProcessing}
          />
        </div>
      )}

      {activeTab === "knowledge" && (
        <KnowledgeOverview
          projectId={projectId}
          knowledge={knowledge}
          systemPrompt={systemPrompt}
          customQuestions={customQuestions}
          onCustomQuestionsChange={setCustomQuestions}
        />
      )}

      {activeTab === "briefing" && (
        <BriefingChat
          projectId={projectId}
          knowledge={knowledge}
          productName={productName}
          onKnowledgeUpdate={handleKnowledgeUpdate}
          onActiveChange={setIsChatActive}
          onPendingCountChange={setBriefingPendingCount}
          isProcessing={isProcessing}
        />
      )}
    </div>
  );
}
