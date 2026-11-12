import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { FunctionId } from '../engine/functions';
import { wp, type Claimed, type WpConfig } from '../root';
import { store } from '../store';
import { QUESTIONS, UNLOCK, isAnswered, toPayload, type Answers } from '../survey';
import { track } from '../track';

const PROGRESS_KEY = 'varilumi-survey-progress';
const DRAFT_KEY = 'varilumi-survey-draft'; // answers survive the trip to the login page

export interface Progress {
  presses: number;
  tried: string[];
}

function load<T>(key: string, fallback: T): T {
  try {
    const v = JSON.parse(store.get(key) ?? '');
    return v && typeof v === 'object' ? v : fallback;
  } catch {
    return fallback;
  }
}

/** How much the visitor has tried on this device: switch actions and the functions they were on. */
export function useSurveyProgress() {
  const [p, setP] = useState<Progress>(() => {
    const v = load<Progress>(PROGRESS_KEY, { presses: 0, tried: [] });
    return { presses: Number(v.presses) || 0, tried: Array.isArray(v.tried) ? v.tried : [] };
  });
  const note = useCallback((fn: FunctionId) => {
    setP((s) => {
      const n = { presses: s.presses + 1, tried: s.tried.includes(fn) ? s.tried : [...s.tried, fn] };
      store.set(PROGRESS_KEY, JSON.stringify(n));
      return n;
    });
  }, []);
  return [p, note] as const;
}

/**
 * 體驗好禮: after enough trying, a short survey that puts a 滿千折百 coupon into the visitor's WooCommerce
 * account. Only on varilumi.com (the plugin provides the endpoint); hidden on GitHub Pages.
 */
export function Survey({ progress }: { progress: Progress }) {
  const cfg = wp;
  const [claimed, setClaimed] = useState<Claimed | null>(cfg?.claimed ?? null);
  // back from the login page (?vl_survey=1): reopen the survey with the saved answers
  const [open, setOpen] = useState(() => !!cfg?.nonce && !cfg.claimed && new URLSearchParams(location.search).get('vl_survey') === '1');
  useEffect(() => {
    const u = new URL(location.href);
    if (!u.searchParams.has('vl_survey')) return;
    u.searchParams.delete('vl_survey'); // a reload shouldn't reopen it
    history.replaceState(history.state, '', u);
  }, []);
  const left = { presses: Math.max(0, UNLOCK.presses - progress.presses), fns: Math.max(0, UNLOCK.functions - progress.tried.length) };
  const unlocked = !left.presses && !left.fns;
  useEffect(() => {
    if (cfg?.shop && unlocked && !claimed) track('survey_offer');
  }, [cfg, unlocked, claimed]);

  if (!cfg?.shop) return null;
  const deal = `滿 ${cfg.offer.min.toLocaleString()} 折 ${cfg.offer.amount}`;

  return (
    <section className={`survey-card ${claimed ? 'claimed' : unlocked ? 'ready' : ''}`} aria-label="體驗好禮">
      {claimed ? (
        <ClaimedView c={claimed} deal={deal} />
      ) : unlocked ? (
        <>
          <div>
            <b>🎉 解鎖體驗好禮</b>
            <p>填 1 分鐘問卷，領「{deal}」優惠券，直接存進你的會員帳戶</p>
          </div>
          <button
            type="button"
            className="survey-go"
            onClick={() => {
              track('survey_open');
              setOpen(true);
            }}
          >
            填問卷領券
          </button>
        </>
      ) : (
        <div>
          <b>🎁 體驗好禮：{deal} 優惠券</b>
          <p>
            再{left.presses ? `按 ${left.presses} 次開關` : ''}
            {left.presses && left.fns ? '、' : ''}
            {left.fns ? `試 ${left.fns} 種功能` : ''}，就能填 1 分鐘問卷領取
          </p>
          <div className="survey-meter" aria-hidden="true">
            <i style={{ width: `${Math.min(1, progress.presses / UNLOCK.presses) * 50 + Math.min(1, progress.tried.length / UNLOCK.functions) * 50}%` }} />
          </div>
        </div>
      )}
      {open && !claimed && (
        <SurveyDialog
          cfg={cfg}
          deal={deal}
          progress={progress}
          onClose={() => setOpen(false)}
          onClaimed={(c) => {
            setClaimed(c);
            setOpen(false);
          }}
        />
      )}
    </section>
  );
}

function ClaimedView({ c, deal }: { c: Claimed; deal: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <b>🎟 你的專屬優惠碼</b>
      <div className="survey-code">
        <code>{c.code}</code>
        {!c.used && (
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(c.code).then(() => setCopied(true));
              track('coupon_copy');
            }}
          >
            {copied ? '已複製' : '複製'}
          </button>
        )}
      </div>
      <p>
        {c.used
          ? '這張優惠券已經使用過了，謝謝你的支持！'
          : `${deal}，${c.expires ? `${c.expires} 前` : ''}結帳時輸入即可（限本會員使用一次）。也可以在「我的帳戶」找到它。`}
      </p>
    </div>
  );
}

function SurveyDialog(p: { cfg: WpConfig; deal: string; progress: Progress; onClose: () => void; onClaimed: (c: Claimed) => void }) {
  const { cfg } = p;
  const ref = useRef<HTMLDialogElement>(null);
  const [a, setA] = useState<Answers>(() => load<Answers>(DRAFT_KEY, {}));
  const [agree, setAgree] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal?.();
  }, []);
  const ready = agree && QUESTIONS.every((q) => isAnswered(q, a));
  const set = (id: string, v: string | string[]) =>
    setA((s) => {
      const n = { ...s, [id]: v };
      store.set(DRAFT_KEY, JSON.stringify(n));
      return n;
    });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || sending) return;
    if (!cfg.nonce) {
      // the coupon goes into an account: log in / register first, then come back here (answers are saved)
      track('survey_login_click');
      location.href = cfg.login;
      return;
    }
    setSending(true);
    setError('');
    try {
      const r = await fetch(cfg.api, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': cfg.nonce },
        body: JSON.stringify({ answers: toPayload(a), tried: p.progress.tried, presses: p.progress.presses }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.code) throw new Error(d.message || '領取失敗，請稍後再試');
      store.del(DRAFT_KEY);
      track('survey_submit');
      p.onClaimed(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : '領取失敗，請稍後再試');
      track('survey_error');
      setSending(false);
    }
  };

  return (
    <dialog
      ref={ref}
      className="survey"
      aria-labelledby="survey-title"
      onCancel={(e) => {
        e.preventDefault();
        p.onClose();
      }}
    >
      <form onSubmit={submit}>
        <h2 id="survey-title">體驗館問卷</h2>
        <p className="survey-sub">填完即可領取「{p.deal}」優惠券</p>
        {QUESTIONS.map((q) => {
          const v = a[q.id];
          return (
            <fieldset key={q.id}>
              <legend>{q.text}</legend>
              {q.kind === 'text' ? (
                <textarea rows={3} maxLength={300} value={typeof v === 'string' ? v : ''} onChange={(e) => set(q.id, e.target.value)} />
              ) : (
                <div className="survey-opts">
                  {q.options!.map((o) => {
                    const list = Array.isArray(v) ? v : [];
                    const on = q.kind === 'many' ? list.includes(o) : v === o;
                    return (
                      <label key={o} className={on ? 'on' : ''}>
                        <input
                          type={q.kind === 'many' ? 'checkbox' : 'radio'}
                          name={q.id}
                          checked={on}
                          onChange={() => set(q.id, q.kind === 'many' ? (on ? list.filter((x) => x !== o) : [...list, o]) : o)}
                        />
                        {o}
                      </label>
                    );
                  })}
                </div>
              )}
            </fieldset>
          );
        })}
        <label className="survey-agree">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>
            我同意飛利明 VariLumi 依
            {cfg.privacy ? (
              <a href={cfg.privacy} target="_blank" rel="noopener">
                隱私權政策
              </a>
            ) : (
              '隱私權政策'
            )}
            蒐集與使用這份問卷的資料
          </span>
        </label>
        {error && <p className="survey-err">{error}</p>}
        {!cfg.nonce && <p className="survey-hint">優惠券會存進會員帳戶，所以要先登入或註冊；完成後會回到這裡，答案已幫你保留。</p>}
        <div className="survey-actions">
          <button type="button" className="survey-later" onClick={p.onClose}>
            稍後再填
          </button>
          <button type="submit" className="survey-send" disabled={!ready || sending}>
            {sending ? '領取中…' : cfg.nonce ? '送出並領券' : '登入／註冊後領券'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
