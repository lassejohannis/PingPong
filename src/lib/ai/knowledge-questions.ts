export type KnowledgeCategory = "Product" | "Audience" | "Sales" | "Company" | "Custom";

export interface KnowledgeQuestion {
  id: string;
  category: KnowledgeCategory;
  question: string;
  isCustom?: boolean;
}

export type KnowledgeQuality = "empty" | "basic" | "good" | "excellent";

export type KnowledgeSourceType = "document" | "briefing" | "manual";

export interface KnowledgeEntry {
  answer: string;
  quality: KnowledgeQuality;
  sourceType: KnowledgeSourceType;
  sources: string[];
  updatedAt: string;
  needsReview?: boolean;
}

export type AgentKnowledge = Record<string, KnowledgeEntry>;

export const AGENT_KNOWLEDGE_QUESTIONS: KnowledgeQuestion[] = [
  { id: "product_what", category: "Product", question: "What is the product and what does it do?" },
  { id: "product_features", category: "Product", question: "What are the key features and capabilities?" },
  { id: "product_usps", category: "Product", question: "What makes this product unique vs competitors?" },
  { id: "pricing", category: "Product", question: "What is the pricing model and price range?" },
  { id: "target_audience", category: "Audience", question: "Who is the ideal customer / target audience?" },
  { id: "pain_points", category: "Audience", question: "What problems does the product solve for customers?" },
  { id: "use_cases", category: "Audience", question: "What are typical use cases or success stories?" },
  { id: "objections", category: "Sales", question: "What are common objections and how to handle them?" },
  { id: "competitors", category: "Sales", question: "Who are the main competitors and how do we differ?" },
  { id: "no_go", category: "Sales", question: "Are there topics or claims the agent should avoid?" },
  { id: "cta", category: "Sales", question: "What is the desired call-to-action (demo, trial, call)?" },
  { id: "company_background", category: "Company", question: "What is the company background and credibility?" },
];

export function getEmptyKnowledge(): AgentKnowledge {
  const knowledge: AgentKnowledge = {};
  for (const q of AGENT_KNOWLEDGE_QUESTIONS) {
    knowledge[q.id] = { answer: "", quality: "empty", sourceType: "document", sources: [], updatedAt: "" };
  }
  return knowledge;
}

/** Merge standard questions with custom questions from project settings */
export function getAllQuestions(customQuestions?: KnowledgeQuestion[]): KnowledgeQuestion[] {
  if (!customQuestions?.length) return AGENT_KNOWLEDGE_QUESTIONS;
  return [...AGENT_KNOWLEDGE_QUESTIONS, ...customQuestions.map((q) => ({ ...q, isCustom: true }))];
}

export function getUnansweredQuestions(knowledge: AgentKnowledge, allQuestions?: KnowledgeQuestion[]): KnowledgeQuestion[] {
  const questions = allQuestions || AGENT_KNOWLEDGE_QUESTIONS;
  return questions.filter((q) => !knowledge[q.id]?.answer);
}

export function getAnsweredQuestions(knowledge: AgentKnowledge, allQuestions?: KnowledgeQuestion[]): KnowledgeQuestion[] {
  const questions = allQuestions || AGENT_KNOWLEDGE_QUESTIONS;
  return questions.filter((q) => !!knowledge[q.id]?.answer);
}

const QUALITY_WEIGHTS: Record<KnowledgeQuality, number> = {
  empty: 0,
  basic: 0.33,
  good: 0.66,
  excellent: 1,
};

/** Returns a 0-100 weighted score across all questions (standard + custom) */
export function getKnowledgeScore(knowledge: AgentKnowledge, allQuestions?: KnowledgeQuestion[]): number {
  const questions = allQuestions || AGENT_KNOWLEDGE_QUESTIONS;
  const total = questions.length;
  if (total === 0) return 0;
  const sum = questions.reduce((acc, q) => {
    const quality = knowledge[q.id]?.quality || "empty";
    return acc + QUALITY_WEIGHTS[quality];
  }, 0);
  return Math.round((sum / total) * 100);
}

export const QUALITY_COLORS: Record<KnowledgeQuality, string> = {
  empty: "bg-[#333]",
  basic: "bg-yellow-500",
  good: "bg-green-500",
  excellent: "bg-emerald-400",
};
