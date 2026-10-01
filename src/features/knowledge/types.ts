export type KnowledgeArticle = {
  id: string;
  category: string;
  title: string;
  body: string;
  readingMinutes: number;
  excerpt: string;
  source?: 'legacy' | 'supabase';
  revision?: number;
  searchText?: string;
  firstImage?: string | null;
};

export type KnowledgeProgressSource = "profile" | "device";

export type KnowledgeProgressState = {
  readIds: Set<string>;
  source: KnowledgeProgressSource;
  loading: boolean;
};
