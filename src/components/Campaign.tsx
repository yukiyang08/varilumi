import { useEffect, useState } from 'react';
import { track } from '../track';

/**
 * 體驗好禮 (current campaign): a Google Form that gives a 滿千折百 code, 300 only. Always shown, no unlock.
 * Works everywhere (no WordPress plugin needed). When the 300 are gone, set `active: false` and push.
 * The plugin-based survey (Survey.tsx, coupon straight into the member's account) is kept for later.
 */
export const CAMPAIGN = {
  active: true,
  url: 'https://forms.gle/DkSztbpKyw4XiJGs8',
  deal: '滿 1,000 折 100',
  quota: 300,
};

/** Short entry at the top right, beside the lab's title (the card below the picture is easy to miss). */
export function CampaignPill() {
  if (!CAMPAIGN.active) return null;
  return (
    <a
      className="campaign-pill"
      href={CAMPAIGN.url}
      target="_blank"
      rel="noopener"
      title={`填問卷送「${CAMPAIGN.deal}」優惠碼，限量 ${CAMPAIGN.quota} 份`}
      onClick={() => track('survey_open', { from: 'title' })}
    >
      <span className="cp-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="8" width="18" height="4" rx="1" />
          <path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
          <path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" />
        </svg>
      </span>
      <span className="cp-text">
        <b>
          <span className="cp-long">填問卷</span>領優惠碼
        </b>
        <small>滿千折百・限量 {CAMPAIGN.quota} 份</small>
      </span>
      <span className="cp-go" aria-hidden="true">›</span>
    </a>
  );
}

export function Campaign() {
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (CAMPAIGN.active) track('survey_offer');
  }, []);
  if (!CAMPAIGN.active) return null;

  return (
    <section className="survey-card ready" aria-label="體驗好禮">
      <div>
        <b>🎁 體驗好禮</b>
        <p>
          {opened
            ? '問卷已在新分頁開啟，填完就能拿到優惠碼。'
            : `體驗完填問卷，送「${CAMPAIGN.deal}」優惠碼，限量 ${CAMPAIGN.quota} 份，送完為止`}
        </p>
      </div>
      <a
        className="survey-go"
        href={CAMPAIGN.url}
        target="_blank"
        rel="noopener"
        onClick={() => {
          track('survey_open');
          setOpened(true);
        }}
      >
        填問卷領優惠碼
      </a>
    </section>
  );
}
