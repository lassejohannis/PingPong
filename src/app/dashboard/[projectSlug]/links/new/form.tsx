"use client";

import { useTransition } from "react";

interface NewLeadFormProps {
  action: (formData: FormData) => Promise<void>;
}

export function NewLeadForm({ action }: NewLeadFormProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        startTransition(() => action(formData));
      }}
      className="space-y-5"
    >
      <div className="space-y-1.5">
        <label htmlFor="prospect_name" className="text-sm font-medium text-[#ccc]">
          Company name <span className="text-red-400">*</span>
        </label>
        <input
          id="prospect_name" name="prospect_name" type="text" required
          placeholder="Prospect Corp"
          className="w-full rounded-lg bg-[#111] border border-[#333] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="first_name" className="text-sm font-medium text-[#ccc]">
            First name
          </label>
          <input
            id="first_name" name="first_name" type="text"
            placeholder="Jane"
            className="w-full rounded-lg bg-[#111] border border-[#333] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="last_name" className="text-sm font-medium text-[#ccc]">
            Last name
          </label>
          <input
            id="last_name" name="last_name" type="text"
            placeholder="Smith"
            className="w-full rounded-lg bg-[#111] border border-[#333] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="contact_email" className="text-sm font-medium text-[#ccc]">
          Contact email
        </label>
        <input
          id="contact_email" name="contact_email" type="email"
          placeholder="jane@prospect.com"
          className="w-full rounded-lg bg-[#111] border border-[#333] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="prospect_url" className="text-sm font-medium text-[#ccc]">
          Company website
        </label>
        <input
          id="prospect_url" name="prospect_url" type="url"
          placeholder="https://prospect.com"
          className="w-full rounded-lg bg-[#111] border border-[#333] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
        />
        <p className="text-xs text-[#555]">The AI crawls this to personalise the pitch automatically.</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="notes" className="text-sm font-medium text-[#ccc]">Notes</label>
        <input
          id="notes" name="notes" type="text"
          placeholder="e.g. Met at SaaStr 2025, interested in enterprise plan"
          className="w-full rounded-lg bg-[#111] border border-[#333] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-40"
      >
        {isPending ? "Creating..." : "Create lead"}
      </button>
    </form>
  );
}
