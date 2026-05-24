import request from '@/api';
import type { ResumeInfo, ResumeProject } from '@/types/resume';
import type { InterviewConfig, InterviewQuestion, AnswerEvaluation, InterviewSession } from '@/types/interview';
import type { InterviewReport } from '@/types/report';
import {
    mockParseResume,
    mockGenerateQuestions,
    mockEvaluateAnswer,
    mockGenerateReport,
    mockPolishProject,
    mockGenerateProjectQuestions,
} from '@/api/mock';

const isMock = import.meta.env.VITE_AI_MODE !== 'real';

// 1. 解析简历
export async function parseResumeApi(rawText: string): Promise<ResumeInfo> {
    if (isMock) return mockParseResume(rawText);
    const res: any = await request.post('/resume/parse', { rawText });
    return (res.resumeInfo || res) as ResumeInfo;
}

// 2. 生成面试题目
export async function generateQuestionsApi(
    resumeInfo: ResumeInfo | null,
    config: InterviewConfig
): Promise<InterviewQuestion[]> {
    if (isMock) return mockGenerateQuestions(resumeInfo, config);
    const res: any = await request.post('/interview/questions', { resumeInfo, config });
    return (res.questions || res) as InterviewQuestion[];
}

// 3. 评估回答
export async function evaluateAnswerApi(
    question: InterviewQuestion,
    userAnswer: string,
    resumeInfo: ResumeInfo | null,
    followUpContext?: {
        isFollowUp: boolean;
        followUpQuestion: string;
        mainAnswer: string;
    }
): Promise<AnswerEvaluation> {
    if (isMock) return mockEvaluateAnswer(question, userAnswer, resumeInfo);
    const res: any = await request.post('/interview/evaluate', {
        question,
        userAnswer,
        resumeInfo,
        followUpContext: followUpContext || null,
    });
    const evaluation = (res.evaluation || res) as AnswerEvaluation;
    // 附加后端返回的思考过程
    if (res.thinking) {
        evaluation.thinking = res.thinking;
    }
    return evaluation;
}

// 4. 生成面试报告
export async function generateReportApi(session: InterviewSession): Promise<InterviewReport> {
    if (isMock) return mockGenerateReport(session);
    const res: any = await request.post('/interview/report', { session });
    return (res.report || res) as InterviewReport;
}

// 5. 润色项目描述
export async function polishResumeProjectApi(project: ResumeProject): Promise<{
    optimized: ResumeProject;
    suggestions: string[];
}> {
    if (isMock) return mockPolishProject(project);
    const res: any = await request.post('/project/polish', { project });
    return {
        optimized: res.optimizedProject || res.optimized || res,
        suggestions: res.suggestions || [],
    };
}

// 6. 生成项目深挖问题
export async function generateProjectQuestionsApi(project: ResumeProject): Promise<InterviewQuestion[]> {
    if (isMock) return mockGenerateProjectQuestions(project);
    const res: any = await request.post('/project/questions', { project });
    return (res.questions || res) as InterviewQuestion[];
}
