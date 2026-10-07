import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight, ArrowUpRight, Check, Minus, Sparkles,
  ChevronDown, Info, Menu, Search, ShieldCheck, X,
} from "lucide-react";
import { evidenceRecords, illustrativeSamples, routeOptions, telemetrySnapshots, type EvidenceRecord, type IllustrativeSample, type RouteId } from "./data";
import { EMPTY_DISCOVERY, hasDiscovery, parseDiscoveryRecap, type DiscoveryRecap } from "../shared/contracts/discovery";
import { MissionGame } from "./MissionGame";
import { Home } from "./Home";
import { GarageHeader } from "./GarageHeader";
import { VideoExperience } from "./VideoExperience";
import { CampaignPilot } from "./CampaignPilot";
import { ImpactRewards } from "./ImpactRewards";
import { PilotMetrics } from "./PilotMetrics";
import { readCampaignPilot, saveCampaignPilot } from "./pilotState";
import type { PilotEvent } from "../shared/contracts/pilot";
import { awardContentView, awardMissionCompletion, EMPTY_IMPACT_REWARDS, MAX_IMPACT_REWARDS_COUNT, parseImpactRewardsState, redeemImpactContribution, redeemWaterContribution, rolloverImpactRewardsYear, type ImpactRewardsState } from "../shared/contracts/impact-rewards";
import { parseImpactTotals, type ImpactExchangeKind, type ImpactTotals } from "../shared/contracts/impact-totals";
import { evidenceTopicTags, lookupEvidence, normalizeLiteralSearchText } from "../shared/contracts/evidence";
import { missionScenario } from "../shared/mission";

type Screen = "home" | "mission" | "video" | "library" | "telemetry" | "summary" | "about" | "rewards" | "metrics";
type EngineerReply = {
  answer: string;
  whatSourceStates: string;
  whatItMeans: string;
  limitations: string[];
  citations: Array<{ recordId: string; title: string; sourceTitle: string; sourceUrl: string; reportingPeriod: string | null; sourceLocation: string | null }>;
  relatedRecordIds: string[];
  mode: "grounded_ai" | "general_explanation" | "prepared_fallback" | "no_answer";
};
type LibraryRecord = EvidenceRecord | IllustrativeSample;
type EvidenceView = "reported" | "illustrative";

function findLibraryRecord(id: string): LibraryRecord | null {
  return evidenceRecords.find((record) => record.id === id)
    ?? illustrativeSamples.find((record) => record.id === id)
    ?? null;
}

function isIllustrativeSample(record: LibraryRecord): record is IllustrativeSample {
  return "review" in record;
}

function evidenceCardCopy(record: LibraryRecord) {
  if (isIllustrativeSample(record)) return {
    metric: "EXAMPLE",
    metricLabel: "Not a reported result",
    plain: record.summary,
    caveat: record.limitations.join(" "),
  };

  const copyByTopic = {
    "aleto-network": {
      metricLabel: "% of participants, self-reported",
      plain: "About 9 in 10 participants said the programme helped them build professional connections.",
      caveat: "This is what participants reported feeling. The report does not say how many people answered or how the survey was run.",
    },
    "aleto-skills-confidence": {
      metricLabel: "% of participants, self-reported",
      plain: "9 in 10 participants said they developed leadership skills, public speaking and confidence.",
      caveat: "The report groups these three areas together. It does not give a separate percentage for each one.",
    },
    "education-community-organisations": {
      metricLabel: "schools and community groups combined",
      plain: "Make A Mark Week engaged 14 organisations in total across schools and community groups.",
      caveat: "This is one combined total. It does not mean 14 schools plus additional community groups.",
    },
    "student-reach": {
      metricLabel: "students",
      plain: "257 students took part in STEM and career development workshops.",
      caveat: "The report does not say whether each student is counted once or whether this is an attendance count. It does not measure what students learned.",
    },
    "travel-logistics-avoided": {
      metricLabel: "tonnes of emissions estimated avoided",
      plain: "The report estimates that air freight changes avoided emissions equal to 1,188 tonnes of CO₂e. CO₂e combines different greenhouse gases into one figure.",
      caveat: "This is an estimate of emissions avoided, not a measured drop in the team's total emissions.",
    },
    "travel-logistics-reduction": {
      metricLabel: "% reported reduction",
      plain: "The team reports travel and logistics emissions were 14% lower, attributing this to more efficient logistics and Sustainable Aviation Fuel.",
      caveat: "The report does not state the comparison period or full calculation boundary. This is not a 14% reduction in all team emissions.",
    },
  } satisfies Record<EvidenceRecord["topicTag"], { metricLabel: string; plain: string; caveat: string }>;
  const copy = copyByTopic[record.topicTag];
  return {
    metric: record.valueDisplay ?? "Claim",
    ...copy,
  };
}

const readingLinks: Array<{ type: "ESG REPORT" | "TEAM STORY"; year: string; title: string; summary: string; url: string }> = [
  { type: "ESG REPORT", year: "2025", title: "2025 Make A Mark Report", summary: "The team's latest Environment, Belong and Community report.", url: "https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2025.pdf" },
  { type: "ESG REPORT", year: "2024", title: "2024 Make A Mark Report", summary: "Explore the previous year's goals and reported progress.", url: "https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2024.pdf" },
  { type: "TEAM STORY", year: "2025", title: "Setting sail: the sea freight operation", summary: "How the team's logistics crew plans freight movement between races.", url: "https://www.astonmartinf1.com/en-GB/news/feature/setting-sail-the-sea-freight-operation-supporting-our-2025-season" },
  { type: "TEAM STORY", year: "2025", title: "Celebrating Pride and allyship", summary: "A look at inclusion activities across the team and paddock.", url: "https://www.astonmartinf1.com/en-GB/news/feature/celebrating-pride-a-month-of-inclusion-and-allyship" },
  { type: "TEAM STORY", year: "2025", title: "Make A Mark hospital tour", summary: "A community visit bringing the team and a replica car to young patients.", url: "https://www.astonmartinf1.com/en-GB/news/feature/aston-martin-aramco-completes-second-make-a-mark-hospital-tour" },
];

const navItems: Array<{ id: Screen; label: string }> = [
  { id: "mission", label: "Game" },
  { id: "video", label: "Video" },
  { id: "library", label: "Reports & articles" },
  { id: "rewards", label: "Impact rewards" },
  { id: "metrics", label: "Demo metrics" },
];

const screenPaths: Record<Screen, string> = {
  home: "/", mission: "/mission/freight", video: "/video", library: "/library",
  telemetry: "/telemetry", summary: "/summary", about: "/about", rewards: "/rewards", metrics: "/pilot/metrics",
};

function readSavedDiscovery(): DiscoveryRecap {
  try {
    const raw = localStorage.getItem("impact-drive-discovery");
    if (raw) return parseDiscoveryRecap(JSON.parse(raw)) ?? EMPTY_DISCOVERY;
  } catch { /* Start with a clean local session if storage is unavailable. */ }
  return EMPTY_DISCOVERY;
}

function readSavedRewards(): ImpactRewardsState {
  try {
    const raw = localStorage.getItem("impact-drive-rewards");
    const parsed = raw ? parseImpactRewardsState(JSON.parse(raw)) : null;
    return parsed ? rolloverImpactRewardsYear(parsed) : { ...EMPTY_IMPACT_REWARDS };
  } catch { return { ...EMPTY_IMPACT_REWARDS }; }
}

function screenFromPath(path: string): Screen {
  const route = path.replace(/\/$/, "") || "/";
  if (route === "/world") return "mission";
  if (route === "/mission/freight") return "mission";
  if (route === "/video") return "video";
  if (route === "/library" || route.startsWith("/library/")) return "library";
  if (route === "/telemetry") return "telemetry";
  if (route === "/engineer") return "home";
  if (route === "/summary") return "summary";
  if (route === "/about") return "about";
  if (route === "/rewards") return "rewards";
  if (route === "/pilot/metrics") return "metrics";
  return "home";
}

function Logo() {
  return (
    <a className="brand" href="/" aria-label="Make A Mark Impact Drive home">
      <svg className="brand-mark" viewBox="0 0 36 28" aria-hidden="true">
        <path d="M0 3h8l10 11L8 25H0l10-11L0 3Zm15 0h8l10 11-10 11h-8l10-11L15 3Z" fill="currentColor" />
      </svg>
      <span className="brand-copy"><strong>MAKE A MARK</strong><span>IMPACT DRIVE</span></span>
    </a>
  );
}

function App() {
  const [screen, setScreen] = useState<Screen>(() => screenFromPath(window.location.pathname));
  const [menuOpen, setMenuOpen] = useState(false);
  const [discovery, setDiscovery] = useState<DiscoveryRecap>(readSavedDiscovery);
  const [pilot, setPilot] = useState(readCampaignPilot);
  const [rewards, setRewards] = useState(readSavedRewards);
  const [rewardsNotice, setRewardsNotice] = useState("");
  const [rewardsFeedback, setRewardsFeedback] = useState("");
  const [coinToast, setCoinToast] = useState<{ id: number; text: string } | null>(null);
  const pendingContentAwards = useRef(new Set<string>());
  const missionCompletionId = useRef(window.crypto.randomUUID());
  const awardedCompletionId = useRef<string | null>(null);
  const [, setPilotSyncError] = useState(false);
  const pilotEventQueue = useRef<Promise<void>>(Promise.resolve());
  const [motionOn, setMotionOn] = useState(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState("All pillars");
  const [topicTag, setTopicTag] = useState("All topics");
  const [period, setPeriod] = useState("All periods");
  const [evidenceView, setEvidenceView] = useState<EvidenceView>("reported");
  const [selectedRecord, setSelectedRecord] = useState<LibraryRecord | null>(() => {
    const id = window.location.pathname.startsWith("/library/") ? window.location.pathname.split("/")[2] : "";
    return findLibraryRecord(id);
  });
  const [question, setQuestion] = useState("");
  const [lastAskedQuestion, setLastAskedQuestion] = useState("");
  const [chatOpen, setChatOpen] = useState(() => window.location.pathname.replace(/\/$/, "") === "/engineer");
  const [chatMinimized, setChatMinimized] = useState(false);
  const [reply, setReply] = useState<EngineerReply | null>(null);
  const [asking, setAsking] = useState(false);
  const [greetingPulse, setGreetingPulse] = useState(false);
  const [greetingVisible, setGreetingVisible] = useState(false);
  const greetingPulseTimer = useRef<number | undefined>(undefined);
  const greetingBubbleTimer = useRef<number | undefined>(undefined);
  const [detailLevel, setDetailLevel] = useState<"concise" | "detailed">("concise");
  const [includeMissionContext, setIncludeMissionContext] = useState(false);
  const [includeTelemetryContext, setIncludeTelemetryContext] = useState(false);
  const [status, setStatus] = useState("");
  const [telemetryIndex, setTelemetryIndex] = useState(0);

  useEffect(() => {
    try {
      if (hasDiscovery(discovery)) localStorage.setItem("impact-drive-discovery", JSON.stringify(discovery));
      else localStorage.removeItem("impact-drive-discovery");
    } catch { /* Local state still works for this visit. */ }
  }, [discovery]);

  useEffect(() => saveCampaignPilot(pilot), [pilot]);
  useEffect(() => {
    try { localStorage.setItem("impact-drive-rewards", JSON.stringify(rewards)); }
    catch { setRewardsNotice("Your Carbon Coins could not be saved on this device."); }
  }, [rewards]);
  useEffect(() => {
    if (!coinToast) return;
    const timer = window.setTimeout(() => setCoinToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [coinToast]);

  function awardViewedContent(contentId: string, label: string) {
    if (pendingContentAwards.current.has(contentId)) return;
    const result = awardContentView(rewards, contentId);
    if (result.kind !== "awarded") return;
    pendingContentAwards.current.add(contentId);
    setRewards(result.state);
    setCoinToast({ id: Date.now(), text: `+1 Carbon Coin earned for ${label}` });
  }
  useEffect(() => {
    if (window.location.pathname.replace(/\/$/, "") === "/world") {
      window.history.replaceState({}, "", "/");
    }
    const onPop = () => {
      const path = window.location.pathname;
      if (path.replace(/\/$/, "") === "/world") window.history.replaceState({}, "", "/");
      setScreen(screenFromPath(path));
      setChatOpen(path.replace(/\/$/, "") === "/engineer");
      setChatMinimized(false);
      const id = path.startsWith("/library/") ? path.split("/")[2] : "";
      setSelectedRecord(findLibraryRecord(id));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!chatOpen || chatMinimized) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setChatOpen(false);
        window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".race-engineer-launcher")?.focus());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chatOpen, chatMinimized]);

  function navigate(next: Screen, instant = false) {
    if (next === "mission" && screen !== "mission") missionCompletionId.current = window.crypto.randomUUID();
    window.history.pushState({}, "", screenPaths[next]);
    setScreen(next);
    if (next === "rewards" || next === "metrics") setChatOpen(false);
    setSelectedRecord(null);
    setMenuOpen(false);
    setStatus("");
    window.scrollTo({ top: 0, behavior: instant ? "instant" : motionOn ? "smooth" : "auto" });
  }


  const visibleRecords = useMemo(() => {
    if (evidenceView === "reported") return lookupEvidence(evidenceRecords, {
      query: search,
      ...(topic !== "All pillars" && { pillar: topic as "Environment" | "Belong" | "Community" }),
      ...(topicTag !== "All topics" && { topicTag: topicTag as typeof evidenceTopicTags[number] }),
      ...(period !== "All periods" && { period }),
      limit: 10,
    });
    const records: LibraryRecord[] = illustrativeSamples;
    const query = normalizeLiteralSearchText(search);
    return records.filter((record) => {
      const searchableText = isIllustrativeSample(record)
        ? `${record.title} ${record.summary} ${record.topic} ${record.claimType} ${record.source}`
        : `${record.title} ${record.claim} ${record.topic} ${record.claimType} ${record.source.title}`;
      const words = normalizeLiteralSearchText(searchableText).split(" ");
      const matchesSearch = !query || query.split(" ").every((word) => words.includes(word));
      return matchesSearch && (topic === "All pillars" || record.topic === topic);
    }).sort((a, b) => a.id.localeCompare(b.id, "en")).slice(0, 10);
  }, [evidenceView, search, topic, topicTag, period]);

  function openRecord(record: LibraryRecord) {
    window.history.pushState({}, "", `/library/${record.id}`);
    setSelectedRecord(record);
    setDiscovery((d) => ({
      ...d,
      openedRecords: d.openedRecords.includes(record.id) ? d.openedRecords : [...d.openedRecords, record.id],
      topics: d.topics.includes(record.topic) ? d.topics : [...d.topics, record.topic],
    }));
  }

  const closeRecord = useCallback(() => {
    window.history.replaceState({}, "", "/library");
    setSelectedRecord(null);
  }, []);

  function chooseRoute(routeId: RouteId) {
    setDiscovery((d) => ({ ...d, missionComplete: false, routeChoice: routeId, topics: d.topics.includes("Environment") ? d.topics : [...d.topics, "Environment"] }));
    setStatus("");
  }

  function clearDiscoveries() {
    setDiscovery(EMPTY_DISCOVERY);
    setStatus("Your local recap was cleared.");
  }

  async function askEngineer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedQuestion = question.trim();
    if (!submittedQuestion) return;
    setLastAskedQuestion(submittedQuestion);
    setQuestion("");
    setAsking(true);
    setReply(null);
    try {
      const response = await fetch("/api/engineer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: submittedQuestion,
          detailLevel,
          ...((includeMissionContext && discovery.routeChoice) || includeTelemetryContext ? {
            context: {
              ...(includeMissionContext && discovery.routeChoice && { mission: { missionId: missionScenario.missionId, configId: missionScenario.configId, choiceId: discovery.routeChoice } }),
              ...(includeTelemetryContext && { telemetry: { stepId: telemetrySnapshots[telemetryIndex].stepId } }),
            },
          } : {}),
        }),
      });
      if (!response.ok) throw new Error("Engineer unavailable");
      setReply(await response.json() as EngineerReply);
    } catch {
      setReply({
        answer: "The Race Engineer API is unavailable, so I could not retrieve an approved record or selected-context explanation.",
        whatSourceStates: "No source record was retrieved for this request.",
        whatItMeans: "Try again when the local API is available. Unsupported questions are not answered from general model knowledge.",
        limitations: ["API unavailable; no evidence or context was retrieved."], citations: [], relatedRecordIds: [], mode: "prepared_fallback",
      });
    } finally { setAsking(false); }
  }

  function greetEngineer() {
    if (chatOpen) return;
    setGreetingPulse(true);
    setGreetingVisible(true);
    window.clearTimeout(greetingPulseTimer.current);
    window.clearTimeout(greetingBubbleTimer.current);
    greetingPulseTimer.current = window.setTimeout(() => setGreetingPulse(false), 820);
    greetingBubbleTimer.current = window.setTimeout(() => setGreetingVisible(false), 3100);
  }

  function finishMission(earnedCoins: number) {
    if (!discovery.routeChoice) return;
    if (awardedCompletionId.current !== missionCompletionId.current) {
      awardedCompletionId.current = missionCompletionId.current;
      const award = awardMissionCompletion(rewards, missionCompletionId.current, earnedCoins);
      if (award.kind === "awarded") {
        setRewards(award.state);
        setRewardsNotice(`Mission complete. Your score earned ${earnedCoins} Carbon Coin${earnedCoins === 1 ? "" : "s"}.`);
      } else if (award.kind === "limit") setRewardsNotice("Your Carbon Coin balance has reached its limit.");
    }
    setDiscovery((d) => ({ ...d, missionComplete: true }));
    setPilot((current) => ({ ...current, started: true, completed: true, completedAt: current.completedAt ?? Date.now() }));
    queuePilotEvent({ type: "joined", participantId: pilot.participantId, referralCode: pilot.referralCode, referredBy: pilot.referredBy });
    queuePilotEvent({ type: "completed", participantId: pilot.participantId });
    navigate("rewards");
  }

  function grantPrototypeCredits(amount: number) {
    if (!Number.isSafeInteger(amount) || amount < 1) return;
    setRewards((current) => amount <= MAX_IMPACT_REWARDS_COUNT - current.credits
      ? { ...current, credits: current.credits + amount }
      : current);
  }

  async function resetPrototype() {
    const response = await fetch("/api/prototype/reset-impact", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!response.ok) throw new Error("Prototype totals could not be reset");
    const totals = parseImpactTotals(await response.json());
    if (!totals || totals.trees !== 0 || totals.waterDollars !== 0) throw new Error("Invalid reset totals");
    localStorage.removeItem("impact-drive-rewards");
    localStorage.removeItem("impact-drive-discovery");
    localStorage.removeItem("impact-drive-campaign-pilot-v1");
    window.location.replace("/");
  }

  async function redeemContribution(kind: ImpactExchangeKind): Promise<ImpactTotals | null> {
    const redemption = kind === "tree" ? redeemImpactContribution(rewards) : redeemWaterContribution(rewards);
    if (redemption.kind !== "redeemed") {
      setRewardsFeedback(redemption.kind === "insufficient" ? "You need 10 Carbon Coins to make this exchange." : "The exchange limit has been reached.");
      return null;
    }
    try {
      const response = await fetch("/api/impact-exchanges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, eventId: window.crypto.randomUUID() }) });
      if (!response.ok) throw new Error("Exchange unavailable");
      const totals = parseImpactTotals(await response.json());
      if (!totals) throw new Error("Invalid exchange totals");
      setRewards(redemption.state);
      setRewardsFeedback(kind === "tree" ? "Tree planting exchange complete." : "Water conservation exchange complete.");
      return totals;
    } catch {
      setRewardsFeedback("The exchange could not be completed. Your Carbon Coins were not used.");
      return null;
    }
  }

  function queuePilotEvent(event: PilotEvent) {
    pilotEventQueue.current = pilotEventQueue.current.then(async () => {
      try {
        const response = await fetch("/api/pilot/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(event) });
        if (!response.ok) throw new Error("Demo event unavailable");
        setPilotSyncError(false);
      } catch { setPilotSyncError(true); }
    });
  }

  function ensurePilotCompletionRecorded() {
    queuePilotEvent({ type: "joined", participantId: pilot.participantId, referralCode: pilot.referralCode, referredBy: pilot.referredBy });
    queuePilotEvent({ type: "completed", participantId: pilot.participantId });
  }

  const activeNav = screen === "home" ? "" : screen;

  return (
    <div className={`app-shell ${motionOn ? "motion-on" : "motion-reduced"}${screen === "rewards" ? " rewards-screen" : ""}`}>
      <a className="skip-link" href="#main">Skip to content</a>
      {(screen === "video" || screen === "library" || screen === "rewards") && <GarageHeader onNavigate={navigate} />}
      {screen !== "home" && screen !== "mission" && screen !== "video" && screen !== "library" && screen !== "rewards" && <header className="topbar">
        <Logo />
        <button className="menu-toggle icon-button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={19} /> : <Menu size={20} />}
        </button>
        <nav className={`primary-nav ${menuOpen ? "open" : ""}`} aria-label="Main navigation">
          {navItems.map((item) => <a key={item.id} className={activeNav === item.id ? "active" : ""} href={screenPaths[item.id]} onClick={(e) => { e.preventDefault(); navigate(item.id); }}>{item.label}</a>)}
        </nav>
        <div className="topbar-meta"><span className="session-dot" /> Local prototype <span className="meta-divider">·</span> No account</div>
      </header>}

      <main id="main" key={screen}>
        {screen === "home" && <Home onNavigate={navigate} />}
        {screen === "mission" && <MissionGame onTransport={chooseRoute} onStart={() => { setPilot((current) => ({ ...current, started: true })); queuePilotEvent({ type: "joined", participantId: pilot.participantId, referralCode: pilot.referralCode, referredBy: pilot.referredBy }); }} onComplete={finishMission} onHome={() => navigate("home")} />}
        {screen === "video" && <VideoExperience onNavigate={navigate} onWatch={(id) => awardViewedContent(`video:${id}`, "this video")} />}
        {screen === "library" && <Library search={search} setSearch={setSearch} topic={topic} setTopic={setTopic} topicTag={topicTag} setTopicTag={setTopicTag} period={period} setPeriod={setPeriod} view={evidenceView} setView={setEvidenceView} records={visibleRecords} onOpen={openRecord} onResourceOpen={(url, type) => awardViewedContent(type === "ESG REPORT" ? `report:${url}` : `article:${url}`, type === "ESG REPORT" ? "opening this report" : "opening this article")} />}
        {screen === "telemetry" && <Telemetry index={telemetryIndex} onSelect={setTelemetryIndex} onAdvance={() => setTelemetryIndex((index) => Math.min(index + 1, telemetrySnapshots.length - 1))} />}
        {screen === "summary" && <Summary discovery={discovery} onNavigate={navigate} onClear={clearDiscoveries} status={status} />}
        {screen === "about" && <About onNavigate={navigate} />}
        {screen === "rewards" && <ImpactRewards credits={rewards.credits} treesThisYear={rewards.treesThisYear} treesAllTime={rewards.treesAllTime} notice={rewardsNotice} feedback={rewardsFeedback} onRedeem={redeemContribution} onGrantCredits={grantPrototypeCredits} onReset={resetPrototype}><section className="impact-pilot-section" aria-labelledby="impact-pilot-title"><div className="impact-pilot-intro"><p>IMPACT REWARDS</p><h2 id="impact-pilot-title">Finish the mission. Pass it on.</h2></div><CampaignPilot embedded pilot={pilot} onStart={() => navigate("mission", true)} onShare={() => { setPilot((current) => ({ ...current, shareActions: current.shareActions + 1 })); ensurePilotCompletionRecorded(); queuePilotEvent({ type: "shared", participantId: pilot.participantId }); }} onOfferUse={() => { if (pilot.offerUsed) return; setPilot((current) => ({ ...current, offerUsed: true })); ensurePilotCompletionRecorded(); queuePilotEvent({ type: "offer_used", participantId: pilot.participantId }); }} onSurvey={(recallAnswer, interestAnswer) => { setPilot((current) => ({ ...current, recallAnswer, interestAnswer })); ensurePilotCompletionRecorded(); queuePilotEvent({ type: "survey_submitted", participantId: pilot.participantId, recallAnswer, interestAnswer }); }} /></section></ImpactRewards>}
        {screen === "metrics" && <PilotMetrics onReturn={() => navigate("rewards")} />}
      </main>

      {screen !== "home" && screen !== "mission" && <footer className={`site-footer${screen === "rewards" ? " rewards-footer" : ""}`}>
        <span>MAKE A MARK <i>·</i> IMPACT DRIVE</span>
        <div><button onClick={() => setMotionOn(!motionOn)} aria-pressed={!motionOn}>{motionOn ? "Reduce motion" : "Motion reduced"}</button>{screen !== "rewards" && <button onClick={() => navigate("about")}>How this prototype works</button>}<button onClick={() => navigate("summary")}>My discoveries</button></div>
      </footer>}

      {selectedRecord && <EvidenceDialog record={selectedRecord} onClose={closeRecord} />}
      {coinToast && createPortal(<div className="coin-toast" key={coinToast.id} role="status" aria-live="polite"><Sparkles size={17} aria-hidden="true" /><span>{coinToast.text}</span></div>, document.body)}
      {screen !== "rewards" && createPortal(<>
        {chatOpen && <RaceEngineerChat
          minimized={chatMinimized}
          onMinimize={() => setChatMinimized(true)}
          onExpand={() => setChatMinimized(false)}
          onClose={() => {
            setQuestion("");
            setLastAskedQuestion("");
            setReply(null);
            setChatOpen(false);
            window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".race-engineer-launcher")?.focus());
          }}
          question={question}
          setQuestion={setQuestion}
          lastAskedQuestion={lastAskedQuestion}
          reply={reply}
          asking={asking}
          onSubmit={askEngineer}
          currentChoice={discovery.routeChoice}
          detailLevel={detailLevel}
          setDetailLevel={setDetailLevel}
          includeMissionContext={includeMissionContext}
          setIncludeMissionContext={setIncludeMissionContext}
          includeTelemetryContext={includeTelemetryContext}
          setIncludeTelemetryContext={setIncludeTelemetryContext}
          telemetrySnapshot={telemetrySnapshots[telemetryIndex]}
        />}
        <div className="race-engineer-companion" data-motion={motionOn ? "on" : "reduced"} data-state={asking ? "thinking" : chatOpen && !lastAskedQuestion ? "listening" : greetingPulse && !chatOpen ? "greeting" : "idle"}>
          {greetingVisible && !chatOpen && <div className="race-engineer-greeting" role="status"><span>Hi, I’m your AI Race Engineer.<br />Got a question? Click me.</span></div>}
          <button
          className="race-engineer-launcher"
          type="button"
          aria-label={chatOpen ? "Close Race Engineer chat" : "Open Race Engineer chat"}
          aria-haspopup="dialog"
          onMouseEnter={greetEngineer}
          onFocus={greetEngineer}
          onClick={() => {
            if (chatOpen) {
              setChatOpen(false);
              setChatMinimized(false);
              return;
            }
            setQuestion("");
            setLastAskedQuestion("");
            setReply(null);
            setChatOpen(true);
            setChatMinimized(false);
            window.requestAnimationFrame(() => document.getElementById("race-engineer-chat-input")?.focus());
          }}
        >
            <span className="race-engineer-poses" aria-hidden="true">
              <img className="engineer-pose engineer-idle" src="/assets/race-engineer/idle.png" alt="" />
              <span className="engineer-pose engineer-greeting-frames">
                {[1, 2, 3, 4].map((frame) => <img key={frame} src={`/assets/race-engineer/greeting-${frame}.png`} alt="" />)}
              </span>
              <img className="engineer-pose engineer-listening" src="/assets/race-engineer/listening.png" alt="" />
              <span className="engineer-pose engineer-thinking-frames">
                {[1, 2].map((frame) => <img key={frame} src={`/assets/race-engineer/thinking-${frame}.png`} alt="" />)}
              </span>
            </span>
          </button>
          <img className="race-engineer-pedestal" src="/assets/race-engineer/pedestal.png" alt="" aria-hidden="true" />
        </div>
      </>, document.body)}
    </div>
  );
}

function Telemetry({ index, onSelect, onAdvance }: { index: number; onSelect: (index: number) => void; onAdvance: () => void }) {
  const snapshot = telemetrySnapshots[index];
  const statusLabel = snapshot.status[0].toUpperCase() + snapshot.status.slice(1);
  return (
    <section className="telemetry-page" aria-labelledby="telemetry-title">
      <div className="telemetry-heading">
        <div>
          <p className="overline"><span /> Simulated telemetry</p>
          <h1 id="telemetry-title">Simulated live view</h1>
          <p>A fixed sequence of sample snapshots for exploring feed states. These values are not live AMF1 telemetry.</p>
        </div>
        <div className={`telemetry-state telemetry-state-${snapshot.status}`} role="status" aria-live="polite">
          <span className="telemetry-state-dot" />{statusLabel}
        </div>
      </div>
      <div className="telemetry-meta">
        <span>SIMULATED TELEMETRY</span>
        <time dateTime={snapshot.timestamp}>{snapshot.timestamp}</time>
        <span>SNAPSHOT {index + 1} / {telemetrySnapshots.length}</span>
      </div>
      <div className="telemetry-signals" aria-label="Snapshot signals">
        {snapshot.signals.map((signal) => (
          <article className="telemetry-signal" key={signal.id}>
            <h2>{signal.name}</h2>
            <p className={signal.value === null ? "telemetry-value telemetry-value-missing" : "telemetry-value"}>
              {signal.value === null ? <>Unavailable<span className="telemetry-unit"> · {signal.unit}</span></> : <>{signal.value} <span className="telemetry-unit">{signal.unit}</span></>}
            </p>
            <p className="telemetry-signal-meta">{signal.valueType === "integer" ? "Integer" : "Number"} · {signal.unit}</p>
            <p className="telemetry-interpretation">{signal.interpretation}</p>
          </article>
        ))}
      </div>
      <div className="telemetry-controls">
        <div className="telemetry-state-controls" role="group" aria-label="Select simulated feed state">
          {telemetrySnapshots.map((item, itemIndex) => <button key={item.stepId} type="button" aria-pressed={itemIndex === index} onClick={() => onSelect(itemIndex)}>{item.status[0].toUpperCase() + item.status.slice(1)}</button>)}
        </div>
        <p>Choose any prepared state directly. No timestamps or values are generated from your device clock.</p>
        <button className="button button-primary" onClick={onAdvance} disabled={index === telemetrySnapshots.length - 1}>Next snapshot <ArrowRight size={17} /></button>
      </div>
    </section>
  );
}

function Library({ search, setSearch, topic, setTopic, topicTag, setTopicTag, period, setPeriod, view, setView, records, onOpen, onResourceOpen }: {
  search: string;
  setSearch: (value: string) => void;
  topic: string;
  setTopic: (value: string) => void;
  topicTag: string;
  setTopicTag: (value: string) => void;
  period: string;
  setPeriod: (value: string) => void;
  view: EvidenceView;
  setView: (value: EvidenceView) => void;
  records: LibraryRecord[];
  onOpen: (record: LibraryRecord) => void;
  onResourceOpen: (url: string, type: string) => void;
}) {
  const isReportedView = view === "reported";
  const [resourceSearch, setResourceSearch] = useState("");
  const [resourceType, setResourceType] = useState<"all" | "reports" | "articles">("all");
  const visibleResources = readingLinks.filter((item) => {
    const matchesType = resourceType === "all"
      || (resourceType === "reports" ? item.type === "ESG REPORT" : item.type === "TEAM STORY");
    const query = resourceSearch.trim().toLocaleLowerCase();
    return matchesType && (!query || `${item.title} ${item.summary} ${item.type} ${item.year}`.toLocaleLowerCase().includes(query));
  });
  const visibleReports = visibleResources.filter((item) => item.type === "ESG REPORT");
  const visibleArticles = visibleResources.filter((item) => item.type === "TEAM STORY");

  function resourceCard(item: (typeof readingLinks)[number]) {
    const coverIndex = readingLinks.indexOf(item);
    const reportCover = item.type === "ESG REPORT" ? `/assets/reports/make-a-mark-${item.year}.webp` : null;
    return (
      <a className="resource-card" key={item.url} href={item.url} target="_blank" rel="noopener noreferrer" onClick={() => onResourceOpen(item.url, item.type)}>
        <span className={`resource-cover resource-cover-${coverIndex}${reportCover ? " resource-cover-image" : ""}`} aria-hidden="true">
          {reportCover ? <img src={reportCover} width="1600" height="899" alt="" /> : <>
            <span className="resource-cover-mark">MAKE A MARK</span>
            <span className="resource-cover-title">{String(coverIndex + 1).padStart(2, "0")}<small>{item.title}</small></span>
            <ArrowUpRight size={24} />
          </>}
        </span>
        <span className="resource-meta">{item.type === "ESG REPORT" ? "ESG report" : "Article"}<span aria-hidden="true">·</span>{item.year}</span>
        <strong>{item.title}</strong>
        <span className="resource-summary">{item.summary}</span>
        <span className="resource-action">Open resource <ArrowUpRight size={16} aria-hidden="true" /></span>
      </a>
    );
  }
  return (
    <div className="content-page library-page">
      <header className="resource-hero"><p className="overline"><span /> MAKE A MARK / RESOURCE HUB</p><h1>Reports &amp; articles</h1><p>Explore Make A Mark reports and stories from Aston Martin Aramco F1. Search the collection or browse by resource type.</p></header>
      <section className="resource-hub" aria-labelledby="resource-hub-title">
        <h2 id="resource-hub-title" className="sr-only">Reports and articles collection</h2>
        <label className="resource-search"><Search size={21} aria-hidden="true" /><span className="sr-only">Search reports and articles</span><input type="search" value={resourceSearch} onChange={(event) => setResourceSearch(event.target.value)} placeholder="Search resources" /></label>
        <div className="resource-layout">
          <fieldset className="resource-types"><legend>Resource type</legend>{([
            ["all", "All"], ["reports", "ESG reports"], ["articles", "Articles"],
          ] as const).map(([value, label]) => <label key={value}><input type="radio" name="resource-type" value={value} checked={resourceType === value} onChange={() => setResourceType(value)} /><span>{label}</span></label>)}</fieldset>
          <div className="resource-results">
            <p className="resource-count" aria-live="polite">{visibleResources.length} {visibleResources.length === 1 ? "resource" : "resources"}</p>
            {visibleReports.length > 0 && <section className="resource-group" aria-labelledby="esg-reports-title">
              <h3 id="esg-reports-title">ESG reports</h3>
              <div className="resource-grid resource-grid-reports">{visibleReports.map(resourceCard)}</div>
            </section>}
            {visibleArticles.length > 0 && <section className="resource-group" aria-labelledby="articles-title">
              <h3 id="articles-title">Articles</h3>
              <div className="resource-grid">{visibleArticles.map(resourceCard)}</div>
            </section>}
            {visibleResources.length === 0 && <div className="resource-empty"><Search size={22} aria-hidden="true" /><h3>No matching resources</h3><p>Try another search or resource type.</p></div>}
          </div>
        </div>
      </section>
      <section className="resource-evidence" aria-labelledby="resource-evidence-title"><header className="resource-evidence-heading"><div><span>EXPLORE THE CLAIMS BEHIND THE STORIES</span><h2 id="resource-evidence-title">Source-reviewed evidence</h2></div><p>Selected statements from the 2025 report, explained in plain language with context on what each number can and cannot tell you.</p></header>
      <div className="library-trust"><ShieldCheck size={18} /><span>Each card explains the report statement and what it cannot confirm. Open a card for the original source and review notes.</span></div>
      <div className="evidence-views" aria-label="Evidence views">
        <button aria-pressed={isReportedView} onClick={() => setView("reported")}>Reported impact</button>
        <button aria-pressed={!isReportedView} onClick={() => setView("illustrative")}>Illustrative samples</button>
      </div>
      {!isReportedView && <p className="sample-explainer">Illustrative demo data — not live AMF1 data or a measured impact result.</p>}
      <div className="library-toolbar"><label className="search-field"><Search size={17} /><span className="sr-only">Search evidence library</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Literal search across reviewed claims" /></label><label className="filter-select"><span className="sr-only">Filter by pillar</span><select value={topic} onChange={(e) => setTopic(e.target.value)}><option>All pillars</option><option>Environment</option><option>Belong</option><option>Community</option></select><ChevronDown size={15} /></label>{isReportedView && <><label className="filter-select"><span className="sr-only">Filter by controlled topic</span><select value={topicTag} onChange={(e) => setTopicTag(e.target.value)}><option>All topics</option>{evidenceTopicTags.map((tag) => <option key={tag} value={tag}>{tag.replaceAll("-", " ")}</option>)}</select><ChevronDown size={15} /></label><label className="filter-select"><span className="sr-only">Filter by reporting period</span><select value={period} onChange={(e) => setPeriod(e.target.value)}><option>All periods</option><option value="2025">2025</option></select><ChevronDown size={15} /></label></>}</div>
      <div className="library-count"><span>{records.length} {isReportedView ? `TAKEAWAY${records.length === 1 ? "" : "S"} FROM THE 2025 REPORT` : `EXAMPLE${records.length === 1 ? "" : "S"}`}</span><span>{isReportedView ? "SOURCE-REVIEWED" : "NOT OFFICIAL RESULTS"}</span></div>
      <div className="evidence-grid">{records.length ? records.map((record, index) => {
        const illustrative = isIllustrativeSample(record);
        const copy = evidenceCardCopy(record);
        const claimType = illustrative ? record.claimType : record.claimType === "report_result" ? "Reported result" : record.claimType === "target" ? "Target" : "Method";
        return <article className={`evidence-card${illustrative ? " evidence-card-illustrative" : ""}`} key={record.id}>
          <div className={`evidence-card-cover evidence-card-cover-${index % 3}`} aria-hidden="true">
            <span>{illustrative ? "EXAMPLE ONLY" : "SOURCE-REVIEWED"} <i>·</i> {record.topic.toUpperCase()}</span>
            <strong>{copy.metric}</strong>
            <small>{copy.metricLabel}</small>
          </div>
          <div className="evidence-card-body">
            <div className="evidence-card-meta">{record.topic}<span aria-hidden="true">·</span>{claimType}</div>
            <h3>{record.title}</h3>
            <div className="evidence-card-explanation"><strong>In plain language</strong><p>{copy.plain}</p></div>
            <div className="evidence-card-caveat"><strong>What to keep in mind</strong><p>{copy.caveat}</p></div>
            <button className="evidence-card-link" aria-label={`See source and review details for ${record.title}`} onClick={() => onOpen(record)}>See source &amp; review details <ArrowRight size={16} /></button>
          </div>
        </article>;
      }) : <div className="empty-results"><Search size={20} /><h2>{search.trim() ? "No matching claims" : "No claims to show"}</h2><p>{search.trim() ? "Try different words or remove a filter." : "Choose another filter to browse the claims."}</p></div>}</div>
      <div className="library-method"><span>HOW TO USE THIS SECTION</span><p>Each card summarizes one statement from the 2025 report. Open “See source &amp; review details” to find the page it came from and how it was checked. Read the report for the full context.</p><span className="method-mark">MM</span></div></section>
    </div>
  );
}

function RaceEngineerChat({ minimized, onMinimize, onExpand, onClose, question, setQuestion, lastAskedQuestion, reply, asking, onSubmit, currentChoice, detailLevel, setDetailLevel, includeMissionContext, setIncludeMissionContext, includeTelemetryContext, setIncludeTelemetryContext, telemetrySnapshot }: {
  minimized: boolean;
  onMinimize: () => void;
  onExpand: () => void;
  onClose: () => void;
  question: string;
  setQuestion: (value: string) => void;
  lastAskedQuestion: string;
  reply: EngineerReply | null;
  asking: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  currentChoice: RouteId | null;
  detailLevel: "concise" | "detailed";
  setDetailLevel: (value: "concise" | "detailed") => void;
  includeMissionContext: boolean;
  setIncludeMissionContext: (value: boolean) => void;
  includeTelemetryContext: boolean;
  setIncludeTelemetryContext: (value: boolean) => void;
  telemetrySnapshot: typeof telemetrySnapshots[number];
}) {
  const input = useRef<HTMLInputElement>(null);
  const messages = useRef<HTMLDivElement>(null);
  const answerStart = useRef<HTMLDivElement>(null);
  const sampleQuestions = [
    "What has AMF1 reported about travel and logistics emissions?",
    "How does the report describe Sustainable Aviation Fuel?",
    "What does Make A Mark Week do for students?",
    "What did participants report about the Aleto programme?",
    "Which sustainability figures are estimates or need context?",
  ];
  const followUpQuestions = [
    "Which result is an estimate rather than a measured reduction?",
    "What does the report say about Sustainable Aviation Fuel?",
    "What sustainability work supports students and communities?",
    "What limits should I keep in mind when comparing these figures?",
  ];
  const serviceUnavailable = reply?.limitations.some((limitation) => limitation.toLowerCase().includes("api unavailable")) ?? false;
  const connectionLabel = asking ? "Thinking…" : serviceUnavailable ? "Service unavailable" : reply?.mode === "general_explanation" ? "General explanation" : reply?.mode === "no_answer" ? "No matching source" : reply ? "Source-based response" : "Ask a question";

  useEffect(() => {
    if (!minimized) input.current?.focus();
  }, [minimized]);

  useEffect(() => {
    const container = messages.current;
    const answer = answerStart.current;
    if (minimized || !reply || !container || !answer) return;
    const containerTop = container.getBoundingClientRect().top;
    const answerTop = answer.getBoundingClientRect().top;
    container.scrollTop += answerTop - containerTop;
  }, [minimized, reply]);

  return (
    <section id="race-engineer-chat" className={`race-engineer-chat-window${minimized ? " is-minimized" : ""}`} role="dialog" aria-modal="false" aria-labelledby="race-engineer-chat-title">
      <header className="race-engineer-chat-header">
        <img src="/assets/race-engineer/idle.png" alt="" />
        <button className="race-engineer-chat-title" onClick={onExpand} aria-label="Expand Race Engineer chat"><strong id="race-engineer-chat-title">Ask the Race Engineer</strong><span className={serviceUnavailable ? "is-unavailable" : ""}><i /> {connectionLabel}</span></button>
        <div className="race-engineer-chat-controls">
          <button type="button" onClick={minimized ? onExpand : onMinimize} aria-label={minimized ? "Expand chat" : "Minimize chat"}>{minimized ? <ArrowUpRight size={19} /> : <Minus size={21} />}</button>
          <button type="button" onClick={onClose} aria-label="Close Race Engineer chat"><X size={23} /></button>
        </div>
      </header>
      {!minimized && <>
        <div ref={messages} className="race-engineer-chat-messages" aria-live="polite" aria-relevant="additions text">
          <div className="race-engineer-chat-bubble engineer">
            <span className="chat-bubble-label">RACE ENGINEER</span>
            <p>Hi, I can help explain the source-reviewed reports and the choices you make in the experience. What would you like to know?</p>
            <small>Answers are based on reviewed records or context you choose to share.</small>
          </div>
          {!lastAskedQuestion && <div className="race-engineer-chat-suggestions">
            <span>TRY ASKING</span>
            {sampleQuestions.map((sample) => <button key={sample} type="button" onClick={() => { setQuestion(sample); input.current?.focus(); }}>{sample}<ArrowUpRight size={14} /></button>)}
          </div>}
          {lastAskedQuestion && <>
            <div className="race-engineer-chat-bubble user"><p>{lastAskedQuestion}</p></div>
            {reply ? <div ref={answerStart} className="race-engineer-chat-bubble engineer" aria-live="polite">
              <span className="chat-bubble-label">RACE ENGINEER · {reply.mode === "grounded_ai" ? "SOURCE-REVIEWED" : reply.mode === "general_explanation" ? "GENERAL EXPLANATION" : reply.mode === "no_answer" ? "LIMITED RESPONSE" : "PREPARED RESPONSE"}</span>
              <p>{reply.answer}</p>
              <div className="chat-answer-details">{!reply.citations.length && <><strong>About this answer</strong><p>{reply.whatSourceStates}</p></>}{reply.whatItMeans && <><strong>What it means</strong><p>{reply.whatItMeans}</p></>}
                {reply.citations.length > 0 && <><strong>Sources</strong><ul>{reply.citations.map((citation) => <li key={citation.recordId}><a href={citation.sourceUrl} target="_blank" rel="noreferrer">{citation.title} · {citation.sourceTitle}</a><small>{citation.reportingPeriod ?? "Reporting period not stated"}{citation.sourceLocation ? ` · ${citation.sourceLocation}` : ""}</small></li>)}</ul></>}
                {reply.limitations.length > 2 && <details className="chat-answer-limitations"><summary>Other source limitations</summary><ul>{reply.limitations.slice(2).map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></details>}
              </div>
              <div className="race-engineer-chat-suggestions">
                <span>TRY ASKING</span>
                {followUpQuestions.map((sample) => <button key={sample} type="button" onClick={() => { setQuestion(sample); input.current?.focus(); }}>{sample}<ArrowUpRight size={14} /></button>)}
              </div>
            </div> : asking && <div className="race-engineer-chat-bubble engineer chat-thinking" role="status"><span className="chat-bubble-label">RACE ENGINEER</span><p>Thinking…</p></div>}
          </>}
        </div>
        <form className="race-engineer-chat-composer" onSubmit={onSubmit}>
          <label className="sr-only" htmlFor="race-engineer-chat-input">Your message</label>
          <input ref={input} id="race-engineer-chat-input" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} placeholder="Type your message here" />
          <button type="submit" aria-label="Send message" disabled={asking || !question.trim()}>{asking ? <span className="spinner" /> : <ArrowRight size={21} />}</button>
          <div className="race-engineer-chat-composer-footer">
            <details className="race-engineer-chat-options"><summary>Answer settings</summary>
              <label>Answer detail<select value={detailLevel} onChange={(event) => setDetailLevel(event.target.value as "concise" | "detailed")}><option value="concise">Concise</option><option value="detailed">Detailed</option></select></label>
              <label className="chat-context-option"><input type="checkbox" checked={includeMissionContext} disabled={!currentChoice} onChange={(event) => setIncludeMissionContext(event.target.checked)} /> Include fictional Mission choice{currentChoice ? ` · ${routeOptions.find((route) => route.id === currentChoice)?.name}` : " · choose a route first"}</label>
              <label className="chat-context-option"><input type="checkbox" checked={includeTelemetryContext} onChange={(event) => setIncludeTelemetryContext(event.target.checked)} /> Include simulated snapshot · {telemetrySnapshot.stepId}</label>
            </details>
            <small>Questions are not saved on the server.</small>
          </div>
        </form>
      </>}
    </section>
  );
}

function Summary({ discovery, onNavigate, onClear, status }: { discovery: DiscoveryRecap; onNavigate: (screen: Screen) => void; onClear: () => void; status: string }) {
  return (
    <div className="content-page summary-page">
      <p className="overline"><span /> YOUR LOCAL SESSION</p>
      <h1>A few things discovered.</h1>
      <p className="summary-intro">This summary is stored on this device. It describes what you explored here, not real-world impact or learning outcomes.</p>
      <div className="summary-stats">
        <div><span>MISSION</span><strong>{discovery.missionComplete ? "Complete" : "Not complete yet"}</strong><small>{discovery.routeChoice ? `Route: ${routeOptions.find((r) => r.id === discovery.routeChoice)?.name}` : "Choose a route when you’re ready"}</small></div>
        <div><span>GAME</span><strong>Three decisions</strong><small>Transport, freight load, team travel</small></div>
        <div><span>EVIDENCE PREVIEWS</span><strong>{discovery.openedRecords.length}</strong><small>Illustrative records opened</small></div>
      </div>
      <div className="summary-topics"><span>TOPICS YOU VISITED</span>{discovery.topics.length ? discovery.topics.map((t) => <span className="topic-chip" key={t}>{t}</span>) : <p>No topics visited yet.</p>}</div>
      <div className="summary-actions">
        <button className="button button-primary" onClick={() => onNavigate("mission")}>Continue mission <ArrowRight size={16} /></button>
        <button className="button button-quiet" onClick={() => onNavigate("library")}>Browse evidence library</button>
        <button className="button button-quiet" onClick={onClear}>Clear my discoveries</button>
      </div>
      {status && <p className="success-line" role="status"><Check size={16} />{status}</p>}
      <p className="summary-note"><Info size={15} />This summary does not measure or claim a real-world environmental or social outcome.</p>
    </div>
  );
}

function About({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  return <div className="content-page about-page"><p className="overline"><span /> HOW THIS PROTOTYPE WORKS</p><h1>Play is the invitation.<br /><em>Evidence is the point.</em></h1><p className="about-lede">Impact Drive keeps three things separate: a fictional game, source-backed evidence, and explanations that point back to that evidence.</p><div className="about-pillars"><article><span>01 / PLAY</span><h2>Mission scenario</h2><p>Three freight and travel choices lead through short, fictional scenes. Game points do not represent operational AMF1 data.</p></article><article><span>02 / EVIDENCE</span><h2>Reviewed records</h2><p>The library contains a limited set of source-reviewed claims with source locations, reporting periods, review notes, and limitations. Illustrative samples stay separate; sources do not imply endorsement.</p></article><article><span>03 / EXPLANATION</span><h2>Race Engineer</h2><p>The Engineer retrieves only reviewed records and context you choose to include. A server-side provider is optional; prepared fallback and no-answer responses remain available.</p></article></div><div className="about-boundary"><ShieldCheck size={20} /><div><strong>Prototype boundary</strong><p>No sign-in, name or email collection, real-time telemetry, or claimed real-world impact. The campaign demo sends random IDs and action counts to the local API; your session summary stays in this browser.</p></div></div><button className="button button-primary" onClick={() => onNavigate("mission")}>Play the game <ArrowRight size={16} /></button></div>;
}

function EvidenceDialog({ record, onClose }: { record: LibraryRecord; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        event.preventDefault();
        closeButton.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [onClose]);
  if (isIllustrativeSample(record)) {
    return <div className="dialog-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="evidence-dialog" role="dialog" aria-modal="true" aria-labelledby="record-title"><button ref={closeButton} className="dialog-close icon-button" aria-label="Close record" onClick={onClose}><X size={19} /></button><p className="overline"><span /> EXAMPLE ONLY / {record.topic.toUpperCase()}</p><h2 id="record-title">{record.title}</h2><span className="review-label large"><span /> This is a layout example, not a reported result</span><p className="dialog-summary">{record.summary}</p><div className="record-fields"><div><span>WHAT KIND OF EXAMPLE</span><strong>{record.claimType}</strong></div><div><span>TIME PERIOD SHOWN</span><strong>{record.period}</strong></div><div><span>SOURCE SHOWN</span><strong>{record.source}</strong></div><div><span>PAGE SHOWN</span><strong>{record.page}</strong></div></div><div className="dialog-limits"><Info size={16} /><div><strong>What to keep in mind</strong>{record.limitations.map((limitation) => <p key={limitation}>{limitation}</p>)}</div></div><p className="dialog-footnote">Example content only — not live AMF1 data or a measured impact result.</p></section></div>;
  }

  const value = record.value === undefined ? "Not stated" : `${record.valueDisplay ?? record.value}${record.unit ? ` ${record.unit}` : ""}`;
  const explanation = evidenceCardCopy(record);
  const typeLabel = record.claimType === "report_result" ? "Reported result" : record.claimType === "target" ? "Target" : "Method";
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="evidence-dialog" role="dialog" aria-modal="true" aria-labelledby="record-title">
        <button ref={closeButton} className="dialog-close icon-button" aria-label="Close record" onClick={onClose}><X size={19} /></button>
        <p className="overline"><span /> REPORT CLAIM / {record.topic.toUpperCase()}</p>
        <h2 id="record-title">{record.title}</h2>
        <span className="review-label large"><span /> Checked against the cited report</span>
        <p className="dialog-summary">{record.claim}</p>
        <div className="dialog-plain-language"><strong>In plain language</strong><p>{explanation.plain}</p></div>
        <div className="record-fields">
          <div><span>TOPIC</span><strong>{record.topic}</strong></div>
          <div><span>TYPE OF INFORMATION</span><strong>{typeLabel}</strong></div>
          <div><span>NUMBER IN THE REPORT</span><strong>{value}</strong></div>
          <div><span>TIME PERIOD COVERED</span><strong>{record.reportingPeriod ?? "The report does not say"}</strong></div>
          <div><span>REPORT</span><strong>{record.source.title}</strong></div>
          <div><span>REPORT PUBLICATION DATE</span><strong>{record.source.publicationDate}</strong></div>
          <div><span>WHERE TO FIND IT</span><strong>{record.source.location ?? "Page not provided"}</strong></div>
          <div><span>REVIEWED BY</span><strong>{record.reviewer} · {record.reviewDate}</strong></div>
        </div>
        <div className="dialog-limits"><Info size={18} /><div>
          <strong>What to keep in mind</strong>
          <p>{explanation.caveat}</p>
          <strong>Source review note</strong><p>{record.reviewNote}</p>
          <strong>Corrections</strong>{record.history.length ? record.history.map((entry, index) => <p key={`${entry.date}-${index}`}>{entry.date}: {entry.claim}. {entry.note}</p>) : <p>No corrections have been recorded.</p>}
          <strong>Other limitations</strong>{record.limitations.map((limitation) => <p key={limitation}>{limitation}</p>)}
        </div></div>
        <p className="dialog-footnote"><a href={record.source.url} target="_blank" rel="noreferrer">Read the original report</a>. This source does not mean AMF1 endorses this app.</p>
      </section>
    </div>
  );
}

export default App;
