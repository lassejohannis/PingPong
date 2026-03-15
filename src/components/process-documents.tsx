"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { AgentKnowledge } from "@/lib/ai/knowledge-questions";

interface ProcessDocumentsProps {
  projectId: string;
  presentationDocId: string | null;
  presentationDocUrl: string | null;
  presentationDocType: string | null;
  lastProcessedPresentationId: string | null;
  onComplete: (knowledge: AgentKnowledge, systemPrompt: string) => void;
  isChatActive: boolean;
  isProcessing: boolean;
  onProcessingChange: (processing: boolean) => void;
}

async function renderPdfToImages(pdfUrl: string, projectId: string): Promise<string[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(`PDF download failed: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength < 100) {
    throw new Error(`PDF download returned empty or invalid data (${arrayBuffer.byteLength} bytes)`);
  }
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  const pageCount = Math.min(pdf.numPages, 30); // Max 30 slides
  const imageUrls: string[] = [];

  for (let i = 0; i < pageCount; i++) {
    const page = await pdf.getPage(i + 1);
    const viewport = page.getViewport({ scale: 1 });

    // Scale to 1280px width
    const scale = 1280 / viewport.width;
    const scaledViewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    const ctx = canvas.getContext("2d")!;

    await page.render({ canvasContext: ctx, viewport: scaledViewport, canvas } as never).promise;

    // Canvas → Blob → Upload
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/png", 0.9)
    );

    const formData = new FormData();
    formData.append("file", blob, `${i}.png`);
    formData.append("projectId", projectId);
    formData.append("slideIndex", String(i));

    const uploadRes = await fetch("/api/project/slides/upload", {
      method: "POST",
      body: formData,
    });

    if (uploadRes.ok) {
      const { imageUrl } = await uploadRes.json();
      imageUrls.push(imageUrl);
    }
  }

  return imageUrls;
}

/** Slowly creep progress forward, simulating activity */
function useCreepingProgress(
  isActive: boolean,
  targetProgress: number,
  setProgress: (p: number) => void,
) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentRef = useRef(0);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (!isActive) {
      currentRef.current = 0;
      return;
    }

    intervalRef.current = setInterval(() => {
      const current = currentRef.current;
      const target = targetProgress;
      // Creep towards target but never reach it (asymptotic)
      const diff = target - current;
      if (diff > 0.5) {
        currentRef.current = current + diff * 0.03; // 3% of remaining distance per tick
        setProgress(Math.round(currentRef.current));
      }
    }, 200);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, targetProgress, setProgress]);

  // Allow jumping to a specific value (for step completions)
  const jumpTo = useCallback((value: number) => {
    currentRef.current = value;
    setProgress(value);
  }, [setProgress]);

  return { jumpTo };
}

const ROTATING_TEXTS: Record<string, string[]> = {
  reading: [
    "Reading document...",
    "Extracting content...",
    "Scanning pages...",
  ],
  analyzing: [
    "Analyzing for answers...",
    "Checking knowledge gaps...",
    "Processing insights...",
  ],
  slides: [
    "Rendering slides...",
    "Converting pages to images...",
    "Building presentation...",
  ],
  generating: [
    "Generating system prompt...",
    "Building agent personality...",
    "Finalizing knowledge...",
  ],
  default: [
    "Processing...",
    "Working on it...",
    "Almost there...",
  ],
};

function getTextCategory(status: string): string {
  if (status.toLowerCase().includes("reading") || status.toLowerCase().includes("extracting")) return "reading";
  if (status.toLowerCase().includes("analyzing") || status.toLowerCase().includes("answer")) return "analyzing";
  if (status.toLowerCase().includes("generating") || status.toLowerCase().includes("prompt")) return "generating";
  if (status.toLowerCase().includes("slide") || status.toLowerCase().includes("rendering")) return "slides";
  return "default";
}

export function ProcessDocuments({
  projectId,
  presentationDocId,
  presentationDocUrl,
  presentationDocType,
  lastProcessedPresentationId,
  onComplete,
  isChatActive,
  isProcessing,
  onProcessingChange,
}: ProcessDocumentsProps) {
  const [progress, setProgress] = useState(0);
  const [targetProgress, setTargetProgress] = useState(0);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [displayText, setDisplayText] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { jumpTo } = useCreepingProgress(isProcessing && !isDone, targetProgress, setProgress);

  const rotationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rotationIndexRef = useRef(0);
  const lastCategoryRef = useRef("");

  // Rotate text every 3 seconds if status hasn't changed
  useEffect(() => {
    if (!isProcessing || !statusText) {
      if (rotationRef.current) clearInterval(rotationRef.current);
      return;
    }

    const category = getTextCategory(statusText);

    // Reset rotation if category changed
    if (category !== lastCategoryRef.current) {
      rotationIndexRef.current = 0;
      lastCategoryRef.current = category;
      setDisplayText(statusText);
    }

    if (rotationRef.current) clearInterval(rotationRef.current);

    rotationRef.current = setInterval(() => {
      const texts = ROTATING_TEXTS[category] || ROTATING_TEXTS.default;
      rotationIndexRef.current = (rotationIndexRef.current + 1) % texts.length;
      setDisplayText(texts[rotationIndexRef.current]);
    }, 3000);

    return () => {
      if (rotationRef.current) clearInterval(rotationRef.current);
    };
  }, [isProcessing, statusText]);

  const handleProcess = useCallback(async () => {
    onProcessingChange(true);
    jumpTo(3);
    setTargetProgress(15); // Start creeping towards 15%
    setStatusText("Starting...");
    setDisplayText("Starting...");
    setIsDone(false);
    setError(null);

    try {
      const res = await fetch("/api/project/process-docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Processing failed");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "status") {
              setStatusText(data.message);
              setDisplayText(data.message);
              rotationIndexRef.current = 0;

              if (data.message.toLowerCase().includes("generating")) {
                // Jump to 90% for prompt generation phase
                jumpTo(88);
                setTargetProgress(98);
              } else if (data.message.toLowerCase().includes("found") || data.message.toLowerCase().includes("no new")) {
                // Document finished — jump to its completed position
                if (data.step && data.total) {
                  const completedProgress = 10 + (data.step / data.total) * 78;
                  jumpTo(completedProgress);
                  // Set target for next doc to creep towards
                  const nextTarget = 10 + ((data.step + 1) / data.total) * 78;
                  setTargetProgress(Math.min(nextTarget, 88));
                }
              } else if (data.step && data.total) {
                // New doc starting — set target to creep towards
                const docTarget = 10 + ((data.step - 0.5) / data.total) * 78;
                setTargetProgress(Math.min(docTarget, 88));
              }
            }

            if (data.type === "done") {
              onComplete(data.knowledge, data.systemPrompt);

              // Check if slide generation is needed
              const needsSlides = presentationDocId &&
                presentationDocId !== lastProcessedPresentationId;

              if (needsSlides) {
                jumpTo(70);
                setTargetProgress(85);
                setStatusText("Rendering slides...");
                setDisplayText("Rendering slides...");

                try {
                  // Download PDF via authenticated proxy and render to images client-side
                  const imageUrls = await renderPdfToImages(
                    `/api/project/documents/download?id=${presentationDocId}`,
                    projectId
                  );

                  jumpTo(85);
                  setTargetProgress(98);
                  setStatusText("Analyzing slides...");
                  setDisplayText("Analyzing slides...");

                  // Generate metadata
                  await fetch("/api/project/slides/generate-metadata", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      projectId,
                      presentationDocId,
                      slideCount: imageUrls.length,
                      imageUrls,
                    }),
                  });

                  jumpTo(100);
                  setStatusText(`Done! ${data.documentsProcessed} doc(s) + ${imageUrls.length} slides processed.`);
                  setDisplayText(`Done! ${data.documentsProcessed} doc(s) + ${imageUrls.length} slides processed.`);
                } catch (err) {
                  console.error("Slide generation failed:", err);
                  jumpTo(100);
                  setStatusText(`Done! ${data.documentsProcessed} doc(s) processed. Slide generation failed.`);
                  setDisplayText(`Done! ${data.documentsProcessed} doc(s) processed. Slide generation failed.`);
                }
              } else {
                jumpTo(100);
                setStatusText(`Done! ${data.documentsProcessed} document(s) processed.`);
                setDisplayText(`Done! ${data.documentsProcessed} document(s) processed.`);
              }

              setIsDone(true);
            }

            if (data.type === "error") {
              setError(data.message);
              setStatusText(null);
              setDisplayText(null);
            }
          } catch { /* skip malformed SSE */ }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
      setStatusText(null);
      setDisplayText(null);
    } finally {
      onProcessingChange(false);
    }
  }, [projectId, onComplete, onProcessingChange]);

  return (
    <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Process Documents</h2>
          <p className="text-xs text-[#555] mt-0.5">
            Extract knowledge from your uploaded documents.
          </p>
        </div>
        <button
          onClick={handleProcess}
          disabled={isProcessing || isChatActive}
          title={isChatActive ? "End your briefing session first" : undefined}
          className="text-xs px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isProcessing ? "Processing..." : "Process Documents"}
        </button>
      </div>

      {/* Progress bar */}
      {(isProcessing || isDone) && (
        <div className="w-full bg-[#1a1a1a] rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-700 ease-out ${
              isDone ? "bg-emerald-500" : "bg-violet-500"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Status text with animated dots */}
      {displayText && (
        <div className="flex items-center gap-2">
          {isProcessing && (
            <div className="flex gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse [animation-delay:0.4s]" />
            </div>
          )}
          <p className={`text-xs transition-opacity duration-300 ${
            isDone ? "text-emerald-400" : "text-[#888]"
          }`}>
            {displayText}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
