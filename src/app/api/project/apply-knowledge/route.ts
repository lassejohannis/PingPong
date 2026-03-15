import { createClient } from "@/lib/supabase/server";
import { generateSystemPrompt } from "@/lib/ai/generate-system-prompt";
import { getEmptyKnowledge, type AgentKnowledge, type KnowledgeQuestion } from "@/lib/ai/knowledge-questions";
import type { Json } from "@/lib/supabase/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, changes } = await request.json() as {
    projectId: string;
    changes: { questionId: string; newAnswer: string }[];
  };

  if (!projectId || !changes?.length) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, settings")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const settings = (project.settings ?? {}) as Record<string, unknown>;
  const knowledge = (settings.agent_knowledge as AgentKnowledge) || getEmptyKnowledge();
  const customQuestions = (settings.custom_questions as KnowledgeQuestion[]) || [];

  // Apply changes — mark as briefing source
  for (const change of changes) {
    knowledge[change.questionId] = {
      answer: change.newAnswer,
      quality: change.newAnswer.length > 200 ? "good" : "basic",
      sourceType: "briefing",
      sources: knowledge[change.questionId]?.sources || [],
      updatedAt: new Date().toISOString(),
    };
  }

  const { data: userProfile } = await supabase
    .from("users")
    .select("company_name")
    .eq("id", user.id)
    .single();

  const systemPrompt = await generateSystemPrompt({
    knowledge,
    productName: (settings.product_name as string) || "the product",
    companyName: userProfile?.company_name || undefined,
    productDescription: (settings.product_description as string) || undefined,
    productWebsite: (settings.product_website as string) || undefined,
    tone: (settings.tone as string) || undefined,
    aggressiveness: (settings.aggressiveness as number) || undefined,
    pricingStrategy: (settings.pricing_strategy as string) || undefined,
    ctaType: (settings.cta_type as string) || undefined,
    responseLength: (settings.response_length as string) || undefined,
    customRules: (settings.custom_rules as string) || undefined,
    customQuestions,
  });

  await supabase
    .from("projects")
    .update({
      system_prompt: systemPrompt,
      settings: { ...settings, agent_knowledge: knowledge } as unknown as Json,
    })
    .eq("id", projectId);

  return Response.json({ knowledge, systemPrompt });
}
