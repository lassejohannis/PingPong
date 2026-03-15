"use client";

import { useState, useEffect, useCallback } from "react";

interface AgentBehaviourProps {
  projectId: string;
  settings: Record<string, unknown>;
  onDirtyChange: (dirty: boolean) => void;
  onPromptRegenerated: (systemPrompt: string) => void;
}

export function AgentBehaviour({ projectId, settings, onDirtyChange, onPromptRegenerated }: AgentBehaviourProps) {
  const [tone, setTone] = useState((settings.tone as string) ?? "professional");
  const [aggressiveness, setAggressiveness] = useState((settings.aggressiveness as number) ?? 2);
  const [pricingStrategy, setPricingStrategy] = useState((settings.pricing_strategy as string) ?? "range");
  const [ctaType, setCtaType] = useState((settings.cta_type as string) ?? "demo");
  const [responseLength, setResponseLength] = useState((settings.response_length as string) ?? "medium");
  const [customRules, setCustomRules] = useState((settings.custom_rules as string) ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const isDirty =
      tone !== ((settings.tone as string) ?? "professional") ||
      aggressiveness !== ((settings.aggressiveness as number) ?? 2) ||
      pricingStrategy !== ((settings.pricing_strategy as string) ?? "range") ||
      ctaType !== ((settings.cta_type as string) ?? "demo") ||
      responseLength !== ((settings.response_length as string) ?? "medium") ||
      customRules !== ((settings.custom_rules as string) ?? "");
    onDirtyChange(isDirty);
  }, [tone, aggressiveness, pricingStrategy, ctaType, responseLength, customRules, settings, onDirtyChange]);

  const aggressivenessLabels = ["", "Consultative", "Friendly", "Balanced", "Assertive", "Hard Closer"];

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/project/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          updates: {
            tone,
            aggressiveness,
            pricing_strategy: pricingStrategy,
            cta_type: ctaType,
            response_length: responseLength,
            custom_rules: customRules.trim() || null,
          },
        }),
      });
      if (res.ok) {
        onDirtyChange(false);
        // Regenerate prompt with new behaviour settings
        const regenRes = await fetch("/api/project/regenerate-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId }),
        });
        if (regenRes.ok) {
          const { systemPrompt } = await regenRes.json();
          onPromptRegenerated(systemPrompt);
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setIsSaving(false);
    }
  }, [projectId, tone, aggressiveness, pricingStrategy, ctaType, responseLength, customRules, onDirtyChange, onPromptRegenerated]);

  const selectClass = "w-full rounded-lg bg-[#0d0d0d] border border-[#333] text-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors";

  return (
    <div className="bg-[#111] border border-[#262626] rounded-xl p-6 space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-white">Agent Behaviour</h2>
        <p className="text-xs text-[#555] mt-0.5">Define how the AI agent communicates and sells.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#ccc]">Tone</label>
          <select value={tone} onChange={(e) => setTone(e.target.value)} className={selectClass}>
            <option value="professional">Professional</option>
            <option value="casual">Casual</option>
            <option value="direct">Direct</option>
            <option value="friendly">Friendly</option>
          </select>
        </div>

      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[#ccc]">
          Aggressiveness: <span className="text-violet-400">{aggressivenessLabels[aggressiveness]}</span>
        </label>
        <input
          type="range" min={1} max={5} step={1}
          value={aggressiveness}
          onChange={(e) => setAggressiveness(Number(e.target.value))}
          className="w-full accent-violet-500"
        />
        <div className="flex justify-between text-[10px] text-[#444]">
          <span>Consultative</span>
          <span>Hard Closer</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#ccc]">Pricing Strategy</label>
          <select value={pricingStrategy} onChange={(e) => setPricingStrategy(e.target.value)} className={selectClass}>
            <option value="share">Share openly</option>
            <option value="range">Give range only</option>
            <option value="redirect">Redirect to call</option>
            <option value="never">Never mention</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#ccc]">Call-to-Action</label>
          <select value={ctaType} onChange={(e) => setCtaType(e.target.value)} className={selectClass}>
            <option value="demo">Book a demo</option>
            <option value="trial">Start free trial</option>
            <option value="call">Schedule a call</option>
            <option value="website">Visit website</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[#ccc]">Response Length</label>
        <select value={responseLength} onChange={(e) => setResponseLength(e.target.value)} className={selectClass}>
          <option value="short">Short (1-2 sentences)</option>
          <option value="medium">Medium (2-4 sentences)</option>
          <option value="detailed">Detailed (4+ sentences)</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[#ccc]">
          Custom Rules <span className="text-[#444] font-normal">(optional)</span>
        </label>
        <textarea
          value={customRules}
          onChange={(e) => setCustomRules(e.target.value)}
          placeholder={"Example rules:\n- Never mention competitor X by name\n- Always ask for company size early\n- Don't promise features on the roadmap"}
          rows={4}
          className="w-full rounded-lg bg-[#0d0d0d] border border-[#333] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors resize-none"
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-xs text-emerald-400">Saved!</span>}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-40 transition-colors"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
