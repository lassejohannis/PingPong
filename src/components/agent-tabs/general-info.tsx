"use client";

import { useState, useEffect, useCallback } from "react";

interface GeneralInfoProps {
  projectId: string;
  settings: Record<string, unknown>;
  onDirtyChange: (dirty: boolean) => void;
  onPromptRegenerated: (systemPrompt: string) => void;
}

export function GeneralInfo({ projectId, settings, onDirtyChange, onPromptRegenerated }: GeneralInfoProps) {
  const [productName, setProductName] = useState((settings.product_name as string) ?? "");
  const [productWebsite, setProductWebsite] = useState((settings.product_website as string) ?? "");
  const [productDescription, setProductDescription] = useState((settings.product_description as string) ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Track dirty state
  useEffect(() => {
    const isDirty =
      productName !== ((settings.product_name as string) ?? "") ||
      productWebsite !== ((settings.product_website as string) ?? "") ||
      productDescription !== ((settings.product_description as string) ?? "");
    onDirtyChange(isDirty);
  }, [productName, productWebsite, productDescription, settings, onDirtyChange]);

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
            product_name: productName.trim(),
            product_website: productWebsite.trim() || null,
            product_description: productDescription.trim() || null,
          },
        }),
      });

      if (res.ok) {
        onDirtyChange(false);
        // Regenerate prompt with new settings
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
  }, [projectId, productName, productWebsite, productDescription, onDirtyChange, onPromptRegenerated]);

  return (
    <div className="bg-[#111] border border-[#262626] rounded-xl p-6 space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-white">General Information</h2>
        <p className="text-xs text-[#555] mt-0.5">Basic facts about your product.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="product_name" className="text-sm font-medium text-[#ccc]">
            Product name <span className="text-red-400">*</span>
          </label>
          <input
            id="product_name" type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="PingPong Pro"
            className="w-full rounded-lg bg-[#0d0d0d] border border-[#333] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="product_website" className="text-sm font-medium text-[#ccc]">
            Product website <span className="text-[#444] font-normal">(optional)</span>
          </label>
          <input
            id="product_website" type="url"
            value={productWebsite}
            onChange={(e) => setProductWebsite(e.target.value)}
            placeholder="https://yourproduct.com"
            className="w-full rounded-lg bg-[#0d0d0d] border border-[#333] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="product_description" className="text-sm font-medium text-[#ccc]">
            Short description <span className="text-[#444] font-normal">(optional)</span>
          </label>
          <textarea
            id="product_description"
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
            placeholder="Describe your product in 2-3 sentences. What does it do and who is it for?"
            rows={3}
            className="w-full rounded-lg bg-[#0d0d0d] border border-[#333] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors resize-none"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-xs text-emerald-400">Saved!</span>}
        <button
          onClick={handleSave}
          disabled={isSaving || !productName.trim()}
          className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-40 transition-colors"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
