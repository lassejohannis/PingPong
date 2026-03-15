import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ProspectProfile = {
  company_summary: string;
  industry: string;
  pain_points: string[];
  relevance_mapping: string;
  potential_objections: string[];
  personalized_opener: string;
  fit_score: "high" | "medium" | "low";
  fit_reasoning: string;
};

export async function generateProspectProfile(
  prospectName: string,
  prospectWebContent: string,
  productContext: {
    productName: string;
    companyName: string;
    systemPrompt?: string | null;
  }
): Promise<ProspectProfile> {
  const { productName, companyName, systemPrompt } = productContext;

  const userMessage = `You are an expert B2B sales researcher. Analyze this prospect and generate a research profile to help a salesperson personalize their pitch.

SELLER INFORMATION:
Company: ${companyName}
Product: ${productName}
${systemPrompt ? `Product context:\n${systemPrompt.slice(0, 800)}` : ""}

PROSPECT:
Company name: ${prospectName}
${prospectWebContent ? `Website content:\n${prospectWebContent}` : "No website content available — base your analysis on the company name and any general knowledge."}

Generate a comprehensive prospect profile using the write_prospect_profile tool.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    tools: [
      {
        name: "write_prospect_profile",
        description: "Generate a structured prospect research profile",
        input_schema: {
          type: "object" as const,
          properties: {
            company_summary: {
              type: "string",
              description: "One sentence: what this company does",
            },
            industry: {
              type: "string",
              description: "Industry/vertical (e.g. 'HR Technology', 'FinTech')",
            },
            pain_points: {
              type: "array",
              items: { type: "string" },
              description: "3-5 specific pain points relevant to what the seller solves",
            },
            relevance_mapping: {
              type: "string",
              description:
                "Why this seller's product is relevant to this specific prospect — which features matter most and why",
            },
            potential_objections: {
              type: "array",
              items: { type: "string" },
              description: "2-4 likely objections this prospect might raise",
            },
            personalized_opener: {
              type: "string",
              description:
                "A personalized conversation opener that references something specific from their website or situation (1-2 sentences)",
            },
            fit_score: {
              type: "string",
              enum: ["high", "medium", "low"],
              description: "How good a fit is this prospect for the seller's product",
            },
            fit_reasoning: {
              type: "string",
              description: "Brief reasoning for the fit score (1-2 sentences)",
            },
          },
          required: [
            "company_summary",
            "industry",
            "pain_points",
            "relevance_mapping",
            "potential_objections",
            "personalized_opener",
            "fit_score",
            "fit_reasoning",
          ],
        },
      },
    ],
    tool_choice: { type: "tool", name: "write_prospect_profile" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Failed to generate prospect profile");
  }

  return toolUse.input as ProspectProfile;
}
