import Anthropic from "@anthropic-ai/sdk";
import {
  getAllQuestions,
  type AgentKnowledge,
  type KnowledgeQuestion,
} from "./knowledge-questions";

const client = new Anthropic();

export interface SystemPromptContext {
  knowledge: AgentKnowledge;
  productName: string;
  companyName?: string;
  productDescription?: string;
  productWebsite?: string;
  // Behaviour settings
  tone?: string;
  aggressiveness?: number;
  pricingStrategy?: string;
  ctaType?: string;
  responseLength?: string;
  customRules?: string;
  // Custom questions
  customQuestions?: KnowledgeQuestion[];
}

const AGGRESSIVENESS_LABELS: Record<number, string> = {
  1: "Very consultative — listen more than talk, ask questions, never push",
  2: "Friendly advisor — suggest solutions naturally, low pressure",
  3: "Balanced — share value confidently, ask for next steps when appropriate",
  4: "Assertive — proactively drive toward conversion, handle objections firmly",
  5: "Hard closer — always push for commitment, create urgency, overcome every objection",
};

const PRICING_LABELS: Record<string, string> = {
  share: "Share pricing openly and transparently when asked",
  range: "Give a general price range but encourage a call for exact quotes",
  redirect: "Don't share specific numbers — redirect to booking a call for pricing",
  never: "Never discuss pricing — say it depends on requirements and redirect to sales team",
};

const RESPONSE_LABELS: Record<string, string> = {
  short: "Keep responses to 1-2 sentences. Be punchy and direct.",
  medium: "Respond in 2-4 sentences. Balance detail with brevity.",
  detailed: "Give thorough 4+ sentence responses with examples and specifics.",
};

/**
 * Generate a natural system prompt from the agent's knowledge base + behaviour settings.
 */
export async function generateSystemPrompt(ctx: SystemPromptContext): Promise<string> {
  const {
    knowledge, productName, companyName, productDescription, productWebsite,
    tone, aggressiveness, pricingStrategy, ctaType, responseLength, customRules,
    customQuestions,
  } = ctx;

  const allQuestions = getAllQuestions(customQuestions);

  const knowledgeText = allQuestions
    .filter((q) => knowledge[q.id]?.answer)
    .map((q) => `**${q.question}**\n${knowledge[q.id].answer}`)
    .join("\n\n");

  if (!knowledgeText && !productDescription) {
    return `You are a helpful sales assistant for ${productName}${companyName ? ` by ${companyName}` : ""}. Be ${tone || "professional"} in your communication style.`;
  }

  const sections: string[] = [];

  // Product info
  sections.push(`## Product: ${productName}`);
  if (companyName) sections.push(`## Company: ${companyName}`);
  if (productWebsite) sections.push(`## Website: ${productWebsite}`);
  if (productDescription) sections.push(`## Product Description:\n${productDescription}`);

  // Behaviour settings
  const behaviourLines: string[] = [];
  if (tone) behaviourLines.push(`- Tone: ${tone}`);
  if (aggressiveness) behaviourLines.push(`- Sales approach: ${AGGRESSIVENESS_LABELS[aggressiveness] || "Balanced"}`);
  if (pricingStrategy) behaviourLines.push(`- Pricing strategy: ${PRICING_LABELS[pricingStrategy] || "Give range only"}`);
  if (ctaType) behaviourLines.push(`- Primary call-to-action: ${ctaType === "custom" ? "Custom (see rules)" : ctaType.replace(/_/g, " ")}`);
  if (responseLength) behaviourLines.push(`- Response style: ${RESPONSE_LABELS[responseLength] || "Medium length"}`);

  if (behaviourLines.length > 0) {
    sections.push(`## Agent Behaviour:\n${behaviourLines.join("\n")}`);
  }

  if (customRules) {
    sections.push(`## Custom Rules (MUST follow):\n${customRules}`);
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `You are a prompt engineer. Write a system prompt for an AI sales agent based on the following product knowledge and behaviour settings. The agent will have real-time conversations with prospects on a pitch page.

${sections.join("\n\n")}

## Knowledge Base:
${knowledgeText || "No detailed knowledge yet — use the product description and company info above."}

## Requirements for the system prompt:
- Write in second person ("You are...", "Your goal is...")
- Be concise but comprehensive — the agent should know everything listed
- Include specific details, numbers, and examples from the knowledge
- Include the company name and background naturally
- Incorporate ALL behaviour settings (tone, aggressiveness, pricing strategy, response length, CTA)
- Include custom rules as strict constraints the agent must follow
- Structure it with clear sections
- Include guidance on handling objections if that info exists
- Include any no-go topics or constraints
- End with the desired call-to-action
- Do NOT include any instructions about speech/TTS formatting — that gets added separately
- Do NOT wrap in markdown code blocks — just output the raw prompt text`,
      },
    ],
  });

  const text = response.content[0];
  return text.type === "text" ? text.text : "";
}
