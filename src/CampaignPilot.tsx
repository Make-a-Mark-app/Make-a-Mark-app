import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Gift, LockKeyhole, Share2, TreePine } from "lucide-react";
import type { CampaignPilotState } from "./pilotState";

const recallChoices = [
  "AMF1 reports travel and logistics emissions were 14% lower",
  "My game choices measured real emissions savings",
  "A tree was planted when I finished",
];
const interestChoices = ["Much less interested", "A little less interested", "No change", "A little more interested", "Much more interested"];

export function CampaignPilot({ pilot, onStart, onShare, onOfferUse, onSurvey, embedded = false }: {
  pilot: CampaignPilotState;
  onStart: () => void;
  onShare: () => void;
  onOfferUse: () => void;
  onSurvey: (recall: string, interest: string) => void;
  embedded?: boolean;
}) {
  const [copyStatus, setCopyStatus] = useState("");
  const [recall, setRecall] = useState(pilot.recallAnswer ?? "");
  const [interest, setInterest] = useState(pilot.interestAnswer ?? "");
  const shareUrl = `${window.location.origin}/mission/freight?ref=${pilot.referralCode}`;

  async function shareLink() {
    if (!pilot.completed) return;
    onShare();
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyStatus("Invite link copied. Share it with a friend.");
    } catch {
      setCopyStatus("Invite link ready below. Select it to copy and share.");
    }
  }

  function submitSurvey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (recall && interest) onSurvey(recall, interest);
  }

  function jumpTo(sectionId: string) {
    const target = document.getElementById(sectionId);
    target?.scrollIntoView({ behavior: "instant", block: "start" });
    target?.focus({ preventScroll: true });
  }

  return <div className={`pilot-page${embedded ? " pilot-embedded" : ""}`}>
    <div className="pilot-wrap">
      {!embedded && <header className="pilot-hero">
        <p className="pilot-eyebrow">MAKE A MARK</p>
        <h1>Finish the mission.<br /><em>Pass it on.</em></h1>
        <p>Complete the freight mission, unlock your rewards, and invite someone else to take part.</p>
        {pilot.referredBy && <p className="pilot-invite">You arrived with an invite link.</p>}
      </header>}

      <ol className="pilot-steps" aria-label="Impact rewards journey">
        <li className={pilot.completed ? "is-done" : ""}><button className="pilot-step-button" type="button" onClick={onStart} aria-label={`Go to freight mission — ${pilot.completed ? "completed" : "not completed"}`}><span>01</span><strong>Complete the freight mission</strong><small>Make three decisions and explore the linked sources</small></button></li>
        <li className={pilot.completed ? "is-done" : ""}><button className="pilot-step-button" type="button" onClick={() => jumpTo("pilot-rewards-title")} aria-label={`Go to rewards — ${pilot.completed ? "completed" : "not completed"}`}><span>02</span><strong>Unlock your rewards</strong><small>Tree planting and a 20% merchandise offer</small></button></li>
        <li className={pilot.shareActions > 0 ? "is-done" : ""}><button className="pilot-step-button" type="button" onClick={() => jumpTo("pilot-share-title")} aria-label={`Go to share link — ${pilot.shareActions > 0 ? "completed" : "not completed"}`}><span>03</span><strong>Share one link</strong><small>Invite someone else to try the mission</small></button></li>
      </ol>

      {!pilot.completed && <section className="pilot-start" aria-labelledby="pilot-start-title">
        <img className="pilot-start-image" src="/assets/freight-mission-garage.png" alt="A team member in the Aston Martin garage" />
        <div className="pilot-start-copy"><p className="pilot-eyebrow">YOUR NEXT STEP</p><h2 id="pilot-start-title">Take the freight mission</h2><p>Complete the mission to reveal your Impact rewards.</p>
          <button type="button" className="pilot-primary" onClick={onStart}>{pilot.started ? "Continue mission" : "Start mission"}<ArrowRight size={18} aria-hidden="true" /></button>
        </div>
      </section>}

      <section className="pilot-rewards" aria-labelledby="pilot-rewards-title">
        <div className="pilot-section-heading"><div><p className="pilot-eyebrow">IMPACT REWARDS</p><h2 id="pilot-rewards-title" tabIndex={-1}>Your rewards</h2></div><span>{pilot.completed ? "Rewards unlocked" : "Preview after completion"}</span></div>
        {pilot.completed ? <>
          <div className="pilot-reward-grid">
            <article className="pilot-reward pilot-reward-tree"><TreePine size={30} aria-hidden="true" /><p className="pilot-reward-type">IMPACT REWARD</p><h3>Tree planting</h3><p>Complete the mission to unlock a tree planting reward.</p><a className="pilot-reward-link" href="#top">Explore Impact rewards<ArrowRight size={16} aria-hidden="true" /></a></article>
            <article className="pilot-reward pilot-reward-merch"><Gift size={30} aria-hidden="true" /><p className="pilot-reward-type">MERCHANDISE OFFER</p><h3>20% off AMF1 merchandise</h3><p>Visit the Aston Martin Aramco F1 Team shop to explore eligible merchandise.</p><a className="pilot-reward-link" href="https://shop.astonmartinf1.com/en/home/" target="_blank" rel="noreferrer" onClick={onOfferUse}>Shop AMF1 merchandise<ArrowRight size={16} aria-hidden="true" /></a></article>
          </div>
          <div className="pilot-rules">
            <div><span>ELIGIBLE PRODUCTS</span><strong>Reusable bottle selection</strong></div>
            <div><span>MINIMUM SPEND</span><strong>None</strong></div>
            <div><span>EXPIRY</span><strong>14 days after completion</strong></div>
            <div><span>COMBINING OFFERS</span><strong>Cannot combine with other promotions</strong></div>
          </div>
        </> : <p className="pilot-rewards-locked" role="status">Complete the freight mission to unlock your rewards.</p>}
      </section>

      <section className={`pilot-share${pilot.completed ? " is-unlocked" : " is-locked"}`} aria-labelledby="pilot-share-title">
        <div className="pilot-share-inner">
          <div className="pilot-share-copy"><p className="pilot-eyebrow">SHARE</p><h2 id="pilot-share-title" tabIndex={-1}>Invite someone to try the mission</h2><p>Share your personal mission link with a friend.</p>
            <p className="pilot-share-locked">{pilot.completed ? <Share2 size={18} aria-hidden="true" /> : <LockKeyhole size={18} aria-hidden="true" />}{pilot.completed ? "Every successful click through your affiliate link earns +3 Carbon Coins." : "Complete steps 1 and 2 to reveal your invite link."}</p>
            <button type="button" className="pilot-share-button" onClick={() => void shareLink()} disabled={!pilot.completed}><Share2 size={17} aria-hidden="true" />Share</button>
          </div>
          {pilot.completed && <div className="pilot-share-action"><label htmlFor="pilot-link">Your invite link</label><input id="pilot-link" value={shareUrl} readOnly onFocus={(event) => event.currentTarget.select()} /><small>Your code: {pilot.referralCode}</small>{copyStatus && <p role="status">{copyStatus}</p>}</div>}
        </div>
      </section>

      {pilot.completed && <section className="pilot-survey" aria-labelledby="pilot-survey-title"><p className="pilot-eyebrow">OPTIONAL</p><h2 id="pilot-survey-title">What stayed with you?</h2><p>The recall question refers to the <a href="https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2025.pdf" target="_blank" rel="noreferrer">2025 Make A Mark report</a>; it does not suggest the mission measured emissions.</p><form onSubmit={submitSurvey}><fieldset><legend>Which message do you remember?</legend>{recallChoices.map((choice) => <label key={choice}><input type="radio" name="recall" value={choice} checked={recall === choice} onChange={() => setRecall(choice)} />{choice}</label>)}</fieldset><fieldset><legend>Compared with before the mission, how has your interest in AMF1’s sustainability work changed?</legend>{interestChoices.map((choice) => <label key={choice}><input type="radio" name="interest" value={choice} checked={interest === choice} onChange={() => setInterest(choice)} />{choice}</label>)}</fieldset><button type="submit" className="pilot-primary" disabled={!recall || !interest}>{pilot.recallAnswer ? "Update answers" : "Save answers"}<ArrowRight size={17} aria-hidden="true" /></button>{pilot.recallAnswer && <p className="pilot-saved" role="status"><Check size={16} aria-hidden="true" /> Answers saved.</p>}</form></section>}
    </div>
  </div>;
}
