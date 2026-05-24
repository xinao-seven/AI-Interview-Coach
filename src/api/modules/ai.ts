import request from '@/api';
import { createStreamRequest } from '@/utils/sse';
import type { ResumeInfo, ResumeProject } from '@/types/resume';
import type { InterviewConfig, InterviewQuestion, AnswerEvaluation, InterviewSession } from '@/types/interview';
import type { InterviewReport } from '@/types/report';

// 1. 解析简历
export async function parseResumeApi(rawText: string): Promise<ResumeInfo> {
    const res: any = await request.post('/resume/parse', { rawText });
    return (res.resumeInfo || res) as ResumeInfo;
}

// 2. 生成面试题目
export async function generateQuestionsApi(
    resumeInfo: ResumeInfo | null,
    config: InterviewConfig
): Promise<InterviewQuestion[]> {
    const res: any = await request.post('/interview/questions', { resumeInfo, config });
    return (res.questions || res) as InterviewQuestion[];
}

// 3. 评估回答（非流式，供知识点训练等场景使用）
export async function evaluateAnswerApi(
    question: InterviewQuestion,
    userAnswer: string,
    resumeInfo: ResumeInfo | null,
    followUpContext?: { isFollowUp: boolean; followUpQuestion: string; mainAnswer: string }
): Promise<AnswerEvaluation> {
    const res: any = await request.post('/interview/evaluate', {
        question,
        userAnswer,
        resumeInfo,
        followUpContext: followUpContext || null,
    });
    const evaluation = (res.evaluation || res) as AnswerEvaluation;
    if (res.thinking) evaluation.thinking = res.thinking;
    return evaluation;
}

/**
 * 评估回答（SSE 流式版本，供模拟面试使用）
 * - 实时接收 AI 输出的每个文本块，边收边回调
 * - 流结束后提取 thinking 和追问
 */
export function evaluateAnswerStreamApi(
    question: InterviewQuestion,
    userAnswer: string,
    resumeInfo: ResumeInfo | null,
    callbacks: {
        onChunk: (text: string) => void;
        onReasoning?: (text: string) => void;
        onDone: (evaluation: AnswerEvaluation) => void;
        onError: (err: Error) => void;
    },
    followUpContext?: { isFollowUp: boolean; followUpQuestion: string; mainAnswer: string }
): AbortController {
    let fullText = '';

    return createStreamRequest({
        url: '/api/interview/evaluate/stream',
        method: 'POST',
        body: { question, userAnswer, resumeInfo, followUpContext: followUpContext || null },
        callbacks: {
            onMessage: (chunk) => {
                fullText += chunk;
                callbacks.onChunk(chunk);
            },
            onReasoning: (reasoning) => {
                callbacks.onReasoning?.(reasoning);
            },
            onDone: () => {
                const fuMatch = fullText.match(/\*\*💬 追问：\*\*\s*\n\s*(.+?)(?:\n\n|\n*$)/);
                const followUp = fuMatch?.[1]?.trim() || '';
                const evaluation: AnswerEvaluation = {
                    questionId: question.id,
                    totalScore: 0,
                    accuracy: 0,
                    completeness: 0,
                    expression: 0,
                    projectRelevance: 0,
                    depth: 0,
                    strengths: [],
                    weaknesses: [],
                    improvedAnswer: '',
                    followUpQuestion: followUp,
                    thinking: _extractThinking(fullText),
                };
                callbacks.onDone(evaluation);
            },
            onError: (err) => callbacks.onError(err),
        },
    });
}

function _extractThinking(text: string): string {
    const match = text.match(/<thinking>\s*([\s\S]*?)\s*<\/thinking>/i);
    return match?.[1]?.trim() || '';
}

// 4. 生成面试报告
export async function generateReportApi(session: InterviewSession): Promise<InterviewReport> {
    const res: any = await request.post('/interview/report', { session });
    return (res.report || res) as InterviewReport;
}

// 5. 润色项目描述
export async function polishResumeProjectApi(project: ResumeProject): Promise<{
    optimized: ResumeProject;
    suggestions: string[];
}> {
    const res: any = await request.post('/project/polish', { project });
    return {
        optimized: res.optimizedProject || res.optimized || res,
        suggestions: res.suggestions || [],
    };
}

// 6. 生成项目深挖问题
export async function generateProjectQuestionsApi(project: ResumeProject): Promise<InterviewQuestion[]> {
    const res: any = await request.post('/project/questions', { project });
    return (res.questions || res) as InterviewQuestion[];
}
