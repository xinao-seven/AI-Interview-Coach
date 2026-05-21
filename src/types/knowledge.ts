export interface KnowledgeQuestion {
  id: string
  category: string
  question: string
  tags: string[]
  difficulty: string
  referenceAnswer: string
}

export interface KnowledgeCategory {
  id: string
  name: string
  icon: string
  questions: KnowledgeQuestion[]
}
