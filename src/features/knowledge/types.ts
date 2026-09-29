export type KnowledgeArticle = {
  id: string;
  category: string;
  title: string;
  body: string;
  readingMinutes: number;
  excerpt: string;
};

export type KnowledgeProgressSource = "profile" | "device";

export type KnowledgeProgressState = {
  readIds: Set<string>;
  source: KnowledgeProgressSource;
  loading: boolean;
};
