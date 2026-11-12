import { FUNCTIONS, FUNCTION_ORDER } from './engine/functions';

/**
 * The questionnaire behind the coupon. Edit the questions here: answers are stored with the question text,
 * so the CSV export in WordPress (WooCommerce → 體驗館問卷) picks up new questions by itself.
 */
export interface Question {
  id: string;
  text: string;
  kind: 'one' | 'many' | 'text';
  options?: string[];
  optional?: boolean;
}

export const QUESTIONS: Question[] = [
  { id: 'fav', text: '你最喜歡哪一種功能？', kind: 'one', options: [...FUNCTION_ORDER.map((f) => FUNCTIONS[f].name), '還沒決定'] },
  { id: 'room', text: '打算在哪些空間換燈？（可複選）', kind: 'many', options: ['客廳', '臥室', '餐廳', '書房', '其他'] },
  { id: 'when', text: '預計什麼時候換燈或裝修？', kind: 'one', options: ['一個月內', '三個月內', '半年內', '還沒有計畫'] },
  { id: 'help', text: '體驗館有幫你了解開關調光嗎？', kind: 'one', options: ['很有幫助', '有一點', '沒什麼幫助'] },
  { id: 'note', text: '其他想法或建議（選填）', kind: 'text', optional: true },
];

/** The survey opens once the visitor has really tried the lab. The plugin checks the same numbers. */
export const UNLOCK = { presses: 5, functions: 2 };

export type Answers = Record<string, string | string[]>;

export const isAnswered = (q: Question, a: Answers) => {
  const v = a[q.id];
  return q.optional || (Array.isArray(v) ? v.length > 0 : !!v?.trim());
};

/** What the plugin stores: question text → answer text, in question order. */
export const toPayload = (a: Answers) =>
  QUESTIONS.map((q) => {
    const v = a[q.id];
    return [q.text, Array.isArray(v) ? v.join('、') : (v ?? '').trim()];
  });
