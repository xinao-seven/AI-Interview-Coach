export interface ResumeProject {
    id: string;
    name: string;
    role: string;
    techStack: string[];
    description: string;
    highlights: string[];
    difficulties: string;
    result: string;
}

export interface ResumeExperience {
    id: string;
    company: string;
    role: string;
    duration: string;
    description: string;
}

export interface ResumeInfo {
    name: string;
    targetRole: string;
    education: string;
    skills: string[];
    projects: ResumeProject[];
    experiences: ResumeExperience[];
    rawText: string;
}
