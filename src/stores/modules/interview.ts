import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
    InterviewConfig,
    InterviewQuestion,
    ChatMessage,
    AnswerEvaluation,
    InterviewSession,
} from '@/types/interview';
import type { ResumeInfo } from '@/types/resume';

export const useInterviewStore = defineStore('interview', () => {
    const config = ref<InterviewConfig | null>(null);
    const resumeSnapshot = ref<ResumeInfo | null>(null);
    const questions = ref<InterviewQuestion[]>([]);
    const messages = ref<ChatMessage[]>([]);
    const evaluations = ref<AnswerEvaluation[]>([]);
    const currentQuestionIndex = ref(0);
    const sessionId = ref<string>('');
    const status = ref<'idle' | 'configuring' | 'in-progress' | 'finished'>('idle');
    const createdAt = ref<string>('');
    const finishedAt = ref<string>('');

    // 追问状态：questionId -> { 追问问题文本, 主问题答案文本 }
    const followUpStates = ref<Record<string, { question: string; mainAnswer: string }>>({});

    const currentQuestion = computed(() => {
        if (currentQuestionIndex.value < questions.value.length) {
            return questions.value[currentQuestionIndex.value];
        }
        return null;
    });

    const isLastQuestion = computed(() => {
        return currentQuestionIndex.value >= questions.value.length - 1;
    });

    const hasSession = computed(() => status.value !== 'idle');

    const answeredCount = computed(() => evaluations.value.length);

    // 检查当前题目是否有活跃的（未回答的）追问
    const hasActiveFollowUp = computed(() => {
        const q = currentQuestion.value;
        if (!q) return false;
        return q.id in followUpStates.value;
    });

    // 获取当前题目的活跃追问问题文本
    const activeFollowUpQuestion = computed(() => {
        const q = currentQuestion.value;
        if (!q) return '';
        return followUpStates.value[q.id]?.question || '';
    });

    function setFollowUp(questionId: string, followUpQuestion: string, mainAnswer: string) {
        followUpStates.value[questionId] = { question: followUpQuestion, mainAnswer };
        saveToStorage();
    }

    function clearFollowUp(questionId: string) {
        delete followUpStates.value[questionId];
        saveToStorage();
    }

    function setConfig(c: InterviewConfig) {
        config.value = c;
        status.value = 'configuring';
        saveToStorage();
    }

    function updateConfig(fields: Partial<InterviewConfig>) {
        if (config.value) {
            Object.assign(config.value, fields);
            saveToStorage();
        }
    }

    function setResumeSnapshot(info: ResumeInfo) {
        resumeSnapshot.value = info;
    }

    function setQuestions(qs: InterviewQuestion[]) {
        questions.value = qs;
        currentQuestionIndex.value = 0;
        evaluations.value = [];
        messages.value = [];
        sessionId.value = `session-${Date.now()}`;
        createdAt.value = new Date().toISOString();
        status.value = 'in-progress';
        saveToStorage();
    }

    function addMessage(msg: ChatMessage) {
        messages.value.push(msg);
        saveToStorage();
    }

    function updateMessage(id: string, content: string, msgStatus?: ChatMessage['status']) {
        const msg = messages.value.find((m) => m.id === id);
        if (msg) {
            msg.content = content;
            if (msgStatus) msg.status = msgStatus;
            saveToStorage();
        }
    }

    function addEvaluation(eval_: AnswerEvaluation) {
        evaluations.value.push(eval_);
        saveToStorage();
    }

    function updateEvaluation(questionId: string, fields: Partial<AnswerEvaluation>) {
        const evaluation = evaluations.value.find((e) => e.questionId === questionId);
        if (evaluation) {
            Object.assign(evaluation, fields);
            saveToStorage();
        }
    }

    function nextQuestion() {
        if (currentQuestionIndex.value < questions.value.length - 1) {
            currentQuestionIndex.value++;
            saveToStorage();
        }
    }

    function finishInterview() {
        status.value = 'finished';
        finishedAt.value = new Date().toISOString();
        flushToStorage();
    }

    function resetSession() {
        config.value = null;
        resumeSnapshot.value = null;
        questions.value = [];
        messages.value = [];
        evaluations.value = [];
        followUpStates.value = {};
        currentQuestionIndex.value = 0;
        sessionId.value = '';
        status.value = 'idle';
        createdAt.value = '';
        finishedAt.value = '';
        localStorage.removeItem('interview-session');
    }

    function saveToStorage() {
        const session: InterviewSession = {
            id: sessionId.value,
            config: config.value!,
            resumeSnapshot: resumeSnapshot.value || undefined,
            questions: questions.value,
            messages: messages.value,
            evaluations: evaluations.value,
            currentQuestionIndex: currentQuestionIndex.value,
            status: status.value,
            createdAt: createdAt.value,
            finishedAt: finishedAt.value,
            followUpStates: { ...followUpStates.value },
        };
        _schedulePersist(session);
    }

    // ── 防抖持久化：避免 SSE 流式期间频繁写 localStorage 阻塞主线程 ──
    let _persistTimer: ReturnType<typeof setTimeout> | null = null;
    const PERSIST_DEBOUNCE_MS = 500;

    function _schedulePersist(session: InterviewSession) {
        if (_persistTimer) return; // 已有待执行的写入，跳过
        _persistTimer = setTimeout(() => {
            _persistTimer = null;
            try {
                localStorage.setItem('interview-session', JSON.stringify(session));
            } catch {
                /* localStorage 满或不可用 */
            }
        }, PERSIST_DEBOUNCE_MS);
    }

    /** 立即持久化（用于关键状态变更，如面试结束） */
    function flushToStorage() {
        if (_persistTimer) {
            clearTimeout(_persistTimer);
            _persistTimer = null;
        }
        const session: InterviewSession = {
            id: sessionId.value,
            config: config.value!,
            resumeSnapshot: resumeSnapshot.value || undefined,
            questions: questions.value,
            messages: messages.value,
            evaluations: evaluations.value,
            currentQuestionIndex: currentQuestionIndex.value,
            status: status.value,
            createdAt: createdAt.value,
            finishedAt: finishedAt.value,
            followUpStates: { ...followUpStates.value },
        };
        try {
            localStorage.setItem('interview-session', JSON.stringify(session));
        } catch {
            /* ignore */
        }
    }

    function loadFromStorage() {
        const stored = localStorage.getItem('interview-session');
        if (stored) {
            try {
                const session: InterviewSession = JSON.parse(stored);
                config.value = session.config;
                resumeSnapshot.value = session.resumeSnapshot || null;
                questions.value = session.questions;
                messages.value = session.messages;
                evaluations.value = session.evaluations;
                currentQuestionIndex.value = session.currentQuestionIndex;
                sessionId.value = session.id;
                status.value = session.status;
                createdAt.value = session.createdAt;
                finishedAt.value = session.finishedAt;
                followUpStates.value = session.followUpStates || {};
            } catch {
                resetSession();
            }
        }
    }

    return {
        config,
        resumeSnapshot,
        questions,
        messages,
        evaluations,
        currentQuestionIndex,
        sessionId,
        status,
        createdAt,
        finishedAt,
        followUpStates,
        currentQuestion,
        isLastQuestion,
        hasSession,
        answeredCount,
        hasActiveFollowUp,
        activeFollowUpQuestion,
        setConfig,
        updateConfig,
        setResumeSnapshot,
        setQuestions,
        addMessage,
        updateMessage,
        addEvaluation,
        updateEvaluation,
        setFollowUp,
        clearFollowUp,
        nextQuestion,
        finishInterview,
        resetSession,
        loadFromStorage,
        saveToStorage,
        flushToStorage,
    };
});
