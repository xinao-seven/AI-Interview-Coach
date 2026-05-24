export interface AbilityScores {
    technicalFoundation: number;
    projectExperience: number;
    expressiveness: number;
    depthOfThinking: number;
    comprehensiveness: number;
}

export interface QuestionReview {
    questionId: string;
    question: string;
    userAnswer: string;
    score: number;
    suggestion: string;
    referenceAnswer: string;
}

export interface InterviewReport {
    sessionId: string;
    totalScore: number;
    abilityScores: AbilityScores;
    strengths: string[];
    weaknesses: string[];
    suggestedTopics: string[];
    questionReviews: QuestionReview[];
}
