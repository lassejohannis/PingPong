"use client";

interface PitchPreviewProps {
  headline: string;
  openingMessage: string;
  suggestedQuestions: string[];
  logoUrl: string | null;
  companyName: string;
}

export function PitchPreview({
  headline,
  openingMessage,
  suggestedQuestions,
  logoUrl,
  companyName,
}: PitchPreviewProps) {
  const displayMessage = openingMessage || `Hey! I can walk you through how ${companyName} can specifically help. What would you like to know?`;

  return (
    <div className="bg-black rounded-xl overflow-hidden border border-[#2a2a2a] shadow-2xl" style={{ height: "580px" }}>
      {/* Header */}
      <div className="border-b border-white/10 px-4 py-2.5 flex items-center gap-2 bg-black/80">
        {logoUrl ? (
          <img src={logoUrl} alt={companyName} className="h-5 w-5 rounded object-contain" />
        ) : (
          <div className="h-5 w-5 rounded bg-white/10" />
        )}
        <p className="font-semibold text-[10px] text-white truncate">{headline}</p>
        <div className="ml-auto">
          <span className="text-[8px] px-2 py-0.5 rounded-full border border-white/20 text-white/50">
            Voice Mode
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex h-[calc(100%-37px)]">
        {/* Slide area */}
        <div className="flex-1 flex items-center justify-center p-3">
          <div className="w-full aspect-video bg-white/5 rounded-lg flex items-center justify-center">
            <div className="text-center px-4">
              <p className="text-[10px] font-bold text-white/60">Your Pitch Deck</p>
              <p className="text-[8px] text-white/30 mt-1">Slides will appear here</p>
            </div>
          </div>
        </div>

        {/* Chat sidebar */}
        <div className="w-[140px] flex flex-col bg-black/80 border-l border-white/10">
          {/* Messages */}
          <div className="flex-1 p-2.5 space-y-2 overflow-hidden">
            {/* Opening message */}
            <div className="text-left">
              <span className="inline-block px-2 py-1.5 rounded-lg bg-white/10 text-white/80 text-[8px] leading-relaxed max-w-full">
                {displayMessage.length > 120 ? displayMessage.slice(0, 120) + "..." : displayMessage}
              </span>
            </div>
          </div>

          {/* Suggested questions */}
          {suggestedQuestions.length > 0 && (
            <div className="px-2 py-1.5 flex flex-wrap gap-1">
              {suggestedQuestions.slice(0, 3).map((q, i) => (
                <span
                  key={i}
                  className="text-[7px] px-1.5 py-0.5 rounded-full border border-white/20 text-white/50 truncate max-w-full"
                >
                  {q}
                </span>
              ))}
              {suggestedQuestions.length > 3 && (
                <span className="text-[7px] text-white/30">
                  +{suggestedQuestions.length - 3} more
                </span>
              )}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-white/10 p-2">
            <div className="flex gap-1 items-center">
              <div className="flex-1 bg-white/5 border border-white/10 rounded-full px-2 py-1">
                <span className="text-[7px] text-white/20">Ask anything...</span>
              </div>
              <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center shrink-0">
                <span className="text-[7px] text-black font-bold">→</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
