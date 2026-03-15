"use client";

interface PitchPreviewProps {
  headline: string;
  openingMessage: string;
  suggestedQuestions: string[];
  logoUrl: string | null;
  companyName: string;
}

export function PitchPreview({
  openingMessage,
  suggestedQuestions,
  logoUrl,
  companyName,
}: PitchPreviewProps) {
  const displayMessage = openingMessage || `Hey! I can walk you through how ${companyName} can specifically help. What would you like to know?`;

  return (
    <div className="bg-black rounded-xl overflow-hidden border border-[#333] shadow-2xl">
      {/* Browser bar mock */}
      <div className="bg-[#111] border-b border-[#262626] px-4 py-2 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#333]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#333]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#333]" />
        </div>
        <div className="flex-1 mx-3 bg-[#1a1a1a] rounded px-3 py-0.5 text-[10px] text-[#444] font-mono">
          pitchlink.io/p/prospect-name
        </div>
      </div>

      {/* Pitch page content — start screen */}
      <div className="relative flex flex-col items-center justify-center px-6 py-10 gap-4 bg-black min-h-[220px]">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt={companyName} className="w-12 h-12 rounded-lg object-contain" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-[#1a1a1a] border border-[#333] flex items-center justify-center">
              <span className="text-lg font-bold text-[#444]">{companyName.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <p className="text-white font-semibold text-base tracking-tight">{companyName}</p>
        </div>

        {/* Opening message preview */}
        <div className="max-w-sm text-center">
          <p className="text-[11px] text-[#888] leading-relaxed line-clamp-3">{displayMessage}</p>
        </div>

        {/* Suggested questions */}
        {suggestedQuestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center max-w-md">
            {suggestedQuestions.slice(0, 3).map((q, i) => (
              <span
                key={i}
                className="text-[10px] px-2.5 py-1 rounded-full border border-white/15 text-white/50 truncate max-w-[180px]"
              >
                {q}
              </span>
            ))}
            {suggestedQuestions.length > 3 && (
              <span className="text-[10px] text-[#444]">+{suggestedQuestions.length - 3} more</span>
            )}
          </div>
        )}

        {/* Start button */}
        <button
          disabled
          className="mt-1 px-6 py-2.5 rounded-full bg-white text-black text-xs font-semibold opacity-80 cursor-default"
        >
          Start
        </button>
      </div>
    </div>
  );
}
