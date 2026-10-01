import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, BookOpen, Check,
  ChevronDown, Compass, Info, MapPin, Menu, Search, ShieldCheck, Sparkles, X,
} from "lucide-react";
import { evidenceRecords, illustrativeSamples, routeOptions, telemetrySnapshots, type EvidenceRecord, type IllustrativeSample, type RouteId } from "./data";
import { EMPTY_DISCOVERY, hasDiscovery, parseDiscoveryRecap, type DiscoveryRecap } from "../shared/contracts/discovery";
import { createMissionOutcome } from "../shared/contracts/mission";
import { missionScenario } from "../shared/mission";

type Screen = "home" | "world" | "mission" | "library" | "telemetry" | "engineer" | "summary" | "about";
type EngineerReply = {
  answer: string;
  whatSourceStates: string;
  whatItMeans: string;
  limitations: string[];
  citations: Array<{ recordId: string; title: string; sourceTitle: string; sourceUrl: string; reportingPeriod: string | null; sourceLocation: string | null }>;
  relatedRecordIds: string[];
  mode: "grounded_ai" | "prepared_fallback" | "no_answer";
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

const navItems: Array<{ id: Screen; label: string; href: string }> = [
  { id: "world", label: "World", href: "/world" },
  { id: "mission", label: "Freight mission", href: "/mission" },
  { id: "library", label: "Evidence library", href: "/evidence" },
  { id: "telemetry", label: "Simulated live view", href: "/telemetry" },
  { id: "about", label: "How to read this", href: "/method" },
];

const screenPaths: Record<Screen, string> = {
  home: "/", world: "/world", mission: "/mission/freight", library: "/library",
  telemetry: "/telemetry", engineer: "/engineer", summary: "/summary", about: "/about",
};

function readSavedDiscovery(): DiscoveryRecap {
  try {
    const raw = localStorage.getItem("impact-drive-discovery");
    if (raw) return parseDiscoveryRecap(JSON.parse(raw)) ?? EMPTY_DISCOVERY;
  } catch { /* Start with a clean local session if storage is unavailable. */ }
  return EMPTY_DISCOVERY;
}

function screenFromPath(path: string): Screen {
  const route = path.replace(/\/$/, "") || "/";
  if (route === "/world") return "world";
  if (route === "/mission" || route === "/mission/freight") return "mission";
  if (route === "/evidence" || route === "/library" || route.startsWith("/library/")) return "library";
  if (route === "/telemetry") return "telemetry";
  if (route === "/engineer") return "engineer";
  if (route === "/summary") return "summary";
  if (route === "/method" || route === "/about") return "about";
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
  const [car, setCar] = useState({ x: 50, y: 30 });
  const [motionOn, setMotionOn] = useState(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState("All topics");
  const [evidenceView, setEvidenceView] = useState<EvidenceView>("reported");
  const [selectedRecord, setSelectedRecord] = useState<LibraryRecord | null>(() => {
    const id = window.location.pathname.startsWith("/library/") ? window.location.pathname.split("/")[2] : "";
    return findLibraryRecord(id);
  });
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<EngineerReply | null>(null);
  const [asking, setAsking] = useState(false);
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

  useEffect(() => {
    const onPop = () => {
      const path = window.location.pathname;
      setScreen(screenFromPath(path));
      const id = path.startsWith("/library/") ? path.split("/")[2] : "";
      setSelectedRecord(findLibraryRecord(id));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function navigate(next: Screen) {
    window.history.pushState({}, "", screenPaths[next]);
    setScreen(next);
    setSelectedRecord(null);
    setMenuOpen(false);
    setStatus("");
    window.scrollTo({ top: 0, behavior: motionOn ? "smooth" : "auto" });
  }

  function moveCar(dx: number, dy: number) {
    const next = { x: Math.min(92, Math.max(7, car.x + dx)), y: Math.min(85, Math.max(16, car.y + dy)) };
    setCar(next);
    if (next.x > 73 && next.y > 60) {
      setDiscovery((d) => d.foundToken ? d : { ...d, foundToken: true, topics: d.topics.includes("Environment") ? d.topics : [...d.topics, "Environment"] });
      setStatus("Freight discovery found. You can enter the mission whenever you’re ready.");
    }
  }

  useEffect(() => {
    if (screen !== "world") return;
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const movement: Record<string, [number, number]> = { arrowup: [0, -2], w: [0, -2], arrowdown: [0, 2], s: [0, 2], arrowleft: [-2, 0], a: [-2, 0], arrowright: [2, 0], d: [2, 0] };
      if (movement[key]) {
        event.preventDefault();
        moveCar(...movement[key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, car.x, car.y]);

  const visibleRecords = useMemo(() => {
    const records: LibraryRecord[] = evidenceView === "reported" ? evidenceRecords : illustrativeSamples;
    return records.filter((record) => {
      const searchableText = isIllustrativeSample(record)
        ? `${record.title} ${record.summary} ${record.topic} ${record.claimType} ${record.source}`
        : `${record.title} ${record.claim} ${record.topic} ${record.claimType} ${record.source.title}`;
      const matchesSearch = searchableText.toLowerCase().includes(search.toLowerCase());
      return matchesSearch && (topic === "All topics" || record.topic === topic);
    });
  }, [evidenceView, search, topic]);

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

  function retryMission() {
    setDiscovery((d) => ({ ...d, missionComplete: false, routeChoice: null }));
    setStatus("Mission reset. Choose a route to play again.");
  }

  function clearDiscoveries() {
    setDiscovery(EMPTY_DISCOVERY);
    setStatus("Your local recap was cleared.");
  }

  async function askEngineer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    setReply(null);
    try {
      const response = await fetch("/api/engineer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
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

  function finishMission() {
    if (!discovery.routeChoice) return;
    setDiscovery((d) => ({ ...d, missionComplete: true }));
    setStatus("Mission complete. Your route choice is recorded on this device only.");
  }

  const activeNav = screen === "home" ? "" : screen;

  return (
    <div className={`app-shell ${motionOn ? "motion-on" : "motion-reduced"}`}>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="topbar">
        <Logo />
        <button className="menu-toggle icon-button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={19} /> : <Menu size={20} />}
        </button>
        <nav className={`primary-nav ${menuOpen ? "open" : ""}`} aria-label="Main navigation">
          {navItems.map((item) => <a key={item.id} className={activeNav === item.id ? "active" : ""} href={item.href} aria-current={activeNav === item.id ? "page" : undefined} onClick={(e) => { e.preventDefault(); navigate(item.id); }}>{item.label}</a>)}
        </nav>
        <div className="topbar-meta"><span className="session-dot" /> Local prototype <span className="meta-divider">·</span> No account</div>
      </header>

      <main id="main" key={screen}>
        {screen === "home" && <Home />}
        {screen === "world" && <World car={car} moveCar={moveCar} found={discovery.foundToken} onFind={() => setDiscovery((d) => ({ ...d, foundToken: true, topics: d.topics.includes("Environment") ? d.topics : [...d.topics, "Environment"] }))} status={status} onNavigate={navigate} />}
        {screen === "mission" && <Mission discovery={discovery} onChoose={chooseRoute} onFinish={finishMission} onRetry={retryMission} onNavigate={navigate} status={status} />}
        {screen === "library" && <Library search={search} setSearch={setSearch} topic={topic} setTopic={setTopic} view={evidenceView} setView={setEvidenceView} records={visibleRecords} onOpen={openRecord} onNavigate={navigate} />}
        {screen === "telemetry" && <Telemetry index={telemetryIndex} onAdvance={() => setTelemetryIndex((index) => Math.min(index + 1, telemetrySnapshots.length - 1))} />}
        {screen === "engineer" && <Engineer question={question} setQuestion={setQuestion} reply={reply} asking={asking} onSubmit={askEngineer} currentChoice={discovery.routeChoice} detailLevel={detailLevel} setDetailLevel={setDetailLevel} includeMissionContext={includeMissionContext} setIncludeMissionContext={setIncludeMissionContext} includeTelemetryContext={includeTelemetryContext} setIncludeTelemetryContext={setIncludeTelemetryContext} telemetrySnapshot={telemetrySnapshots[telemetryIndex]} />}
        {screen === "summary" && <Summary discovery={discovery} onNavigate={navigate} onClear={clearDiscoveries} status={status} />}
        {screen === "about" && <TrustGuide onNavigate={navigate} />}
      </main>

      <footer className="site-footer">
        <span>MAKE A MARK <i>·</i> IMPACT DRIVE</span>
        <div><button onClick={() => setMotionOn(!motionOn)} aria-pressed={!motionOn}>{motionOn ? "Reduce motion" : "Motion reduced"}</button><a href="/method" onClick={(e) => { e.preventDefault(); navigate("about"); }}>How this prototype works</a><button onClick={() => navigate("summary")}>My discoveries</button></div>
      </footer>

      {selectedRecord && <EvidenceDialog record={selectedRecord} onClose={closeRecord} />}
    </div>
  );
}

function Telemetry({ index, onAdvance }: { index: number; onAdvance: () => void }) {
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
          </article>
        ))}
      </div>
      <div className="telemetry-controls">
        <p>Advance manually through the prepared sequence. No timestamps or values are generated from your device clock.</p>
        <button className="button button-primary" onClick={onAdvance} disabled={index === telemetrySnapshots.length - 1}>Next snapshot <ArrowRight size={17} /></button>
      </div>
    </section>
  );
}

function Home() {
  return (
    <div className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="hero-copy">
          <p className="overline"><span /> ONE MISSION. A WIDER PICTURE.</p>
          <h1 id="home-title">Come for the drive.<br /><em>Discover the impact.</em></h1>
          <p className="hero-description">Explore a freight mission, uncover the evidence behind real-world choices, and see the bigger picture along the way.</p>
          <div className="hero-actions"><a className="button button-primary" href="/mission">Start freight mission <ArrowRight size={17} /></a><a className="button button-quiet" href="/evidence">Browse evidence library</a></div>
          <div className="hero-footnote"><span className="footline" /> GAME SCENARIOS ARE FICTIONAL</div>
        </div>
        <div className="hero-landscape" role="img" aria-label="Illustrated logistics circuit linking a race track, freight hub and port">
          <div className="landscape-shade" />
          <div className="landscape-caption"><span>01 / 01</span><span>THE FREIGHT CIRCUIT</span></div>
          <div className="landscape-route-mark"><span className="route-pulse" /><span>DISCOVERY POINT</span></div>
        </div>
        <div className="route-panel entry-panel">
          <div className="panel-heading"><div><span className="panel-index">TWO WAYS TO EXPLORE</span><h2>Choose your starting point.</h2></div><span className="panel-chevron"><ArrowRight size={18} /></span></div>
          <div className="entry-path">
            <span className="entry-path-label">PLAY</span>
            <p>Take an untimed fictional freight mission with deterministic choices.</p>
            <a className="text-link" href="/mission">Start the mission <ArrowRight size={15} /></a>
          </div>
          <div className="entry-path">
            <span className="entry-path-label">VERIFY</span>
            <p>Go straight to the evidence library, with no mission required.</p>
            <a className="text-link" href="/evidence">Open the evidence library <ArrowRight size={15} /></a>
          </div>
          <a className="entry-method-link" href="/method">How to read the labels <ArrowUpRight size={15} /></a>
        </div>
        <div className="home-bottom"><div className="evidence-teaser"><span className="document-icon"><BookOpen size={20} /></span><div><h3>From the reports</h3><p>{evidenceRecords.length ? "Source-reviewed claims are available to browse." : "Source-reviewed claims will appear here when available."}</p><a href="/evidence">Explore evidence library <ArrowRight size={15} /></a></div></div><div className="control-teaser"><div className="key-cluster"><span>W</span><div><span>A</span><span>S</span><span>D</span></div></div><div><small>MOVE THROUGH THE WORLD</small><p>Use WASD or arrow keys.<br />Or choose the mission directly.</p></div></div><div className="local-note"><span className="local-note-mark">✳</span><p>Your discoveries stay<br />on this device.</p></div></div>
      </section>
      <section className="home-next"><div><span className="section-count">01</span><p>START WITH A CHOICE</p><h2>One route.<br />A lot to discover.</h2></div><div className="next-copy"><p>This is a short, fictional freight scenario. Your route shapes the game, then a clear line separates the game from source-backed evidence.</p><a className="text-link" href="/method">See how the evidence works <ArrowUpRight size={16} /></a></div><div className="next-aside"><span className="aside-rule" /><span>PLAY, THEN LOOK CLOSER</span></div></section>
    </div>
  );
}

function World({ car, moveCar, found, onFind, status, onNavigate }: { car: { x: number; y: number }; moveCar: (dx: number, dy: number) => void; found: boolean; onFind: () => void; status: string; onNavigate: (screen: Screen) => void }) {
  return (
    <div className="content-page world-page">
      <div className="page-heading world-heading"><div><p className="overline"><span /> ENVIRONMENT DISTRICT</p><h1>Find your line.</h1><p>Move around the freight circuit, or take the direct route to the mission.</p></div><button className="button button-primary" onClick={() => onNavigate("mission")}>Go to freight mission <ArrowRight size={17} /></button></div>
      <div className="world-frame">
        <div className="world-stage" role="region" aria-label="Interactive logistics circuit. Use WASD or arrow keys to move the car. A direct mission button is also available.">
          <img className="world-backdrop" src="/assets/impact-drive-world.png" alt="" />
          <div className="stage-vignette" />
          <button className={`discovery-crate ${found ? "collected" : ""}`} onClick={() => { onFind(); onNavigate("mission"); }} aria-label={found ? "Freight discovery found. Open the mission" : "Discover freight crate and open mission"}><span className="crate-glow" /><span className="crate-box">{found ? <Check size={20} /> : <MapPin size={19} />}</span><span>{found ? "DISCOVERY FOUND" : "FREIGHT DISCOVERY"}</span></button>
          <div className="player-car" style={{ left: `${car.x}%`, top: `${car.y}%` }} aria-hidden="true"><img src="/assets/impact-drive-car.png" alt="" /></div>
          <div className="stage-badge"><span className="stage-dot" /> LIVE WORLD <b>·</b> 2D PROTOTYPE</div>
          <div className="stage-legend"><span><i className="legend-car" /> YOUR CAR</span><span><i className="legend-discovery" /> DISCOVERY</span></div>
        </div>
        <div className="world-controls">
          <div className="control-copy"><span className="control-label">CONTROLS</span><strong>Take a lap, at your pace.</strong><span>Every destination is also available with a button.</span></div>
          <div className="desktop-keys" aria-label="Keyboard controls"><span>W</span><div><span>A</span><span>S</span><span>D</span></div><small>OR ARROW KEYS</small></div>
          <div className="touch-pad" aria-label="Touch movement controls"><button aria-label="Move up" onClick={() => moveCar(0, -4)}><ArrowUp size={17} /></button><div><button aria-label="Move left" onClick={() => moveCar(-4, 0)}><ArrowLeft size={17} /></button><button className="touch-center" aria-label="Move right" onClick={() => moveCar(4, 0)}><ArrowRight size={17} /></button></div><button aria-label="Move down" onClick={() => moveCar(0, 4)}><ArrowDown size={17} /></button></div>
          <div className="world-status" aria-live="polite">{status || (found ? "Freight discovery found. Continue to the mission." : "Find the freight marker, or go straight to the mission.")}</div>
          <button className="button button-small-quiet" onClick={() => onNavigate("mission")}>Skip driving <ArrowRight size={15} /></button>
        </div>
      </div>
      <div className="world-disclaimer"><Info size={15} /><p>The scene is a game world. Its choices and movement do not represent real freight operations or environmental outcomes.</p></div>
    </div>
  );
}

function Mission({ discovery, onChoose, onFinish, onRetry, onNavigate, status }: { discovery: DiscoveryRecap; onChoose: (id: RouteId) => void; onFinish: () => void; onRetry: () => void; onNavigate: (screen: Screen) => void; status: string }) {
  const route = routeOptions.find((item) => item.id === discovery.routeChoice);
  const outcome = route ? createMissionOutcome(missionScenario, {
    missionId: missionScenario.missionId,
    configId: missionScenario.configId,
    choiceId: route.id,
  }) : null;
  return (
    <div className="content-page mission-page">
      <div className="breadcrumb"><button onClick={() => onNavigate("world")}><ArrowLeft size={15} /> World</button><span>/</span><span>Environment mission</span></div>
      <div className="mission-layout">
        <section className="mission-main">
          <p className="overline"><span /> ENVIRONMENT / FREIGHT CHOICES</p>
          <h1>Deliver the parts.</h1>
          <p className="mission-lede">A shipment is waiting at the freight hub. Choose a route and see how the fictional mission unfolds.</p>
          <div className="scenario-banner"><span className="scenario-icon"><Compass size={19} /></span><div><strong>Mission scenario</strong><p>These choices and outcomes are fictional game values. They are not AMF1 logistics data.</p></div><span className="scenario-tag">GAME ONLY</span></div>
          <h2 className="choice-heading">How will your shipment travel?</h2>
          <div className="mission-route-list" role="radiogroup" aria-label="Choose a freight route">
            {routeOptions.map((item) => <button key={item.id} className={`mission-route ${discovery.routeChoice === item.id ? "selected" : ""}`} role="radio" aria-checked={discovery.routeChoice === item.id} onClick={() => onChoose(item.id)}>
              <span className="mission-route-icon">{item.id === "air" ? <PlaneIcon /> : item.id === "sea" ? <ShipIcon /> : <TruckIcon />}</span><span className="mission-route-body"><strong>{item.name}</strong><small>{item.mode}</small><em>{item.character}</em></span><span className="route-choice-state">{discovery.routeChoice === item.id ? <Check size={16} /> : <span />}</span>
            </button>)}
          </div>
          {outcome && <div className="mission-result" aria-live="polite"><div className="result-topline"><span>YOUR GAME RESULT</span><span>{outcome.outcomeLabel.toUpperCase()}</span></div><h3>{outcome.feedback}</h3><p>This describes this mission only. It does not measure emissions or a real delivery.</p><div className="result-actions">{discovery.missionComplete ? <button className="button button-primary" onClick={onRetry}>Retry mission <ArrowRight size={16} /></button> : <button className="button button-primary" onClick={onFinish}>Complete mission <ArrowRight size={16} /></button>}<button className="button button-quiet" onClick={() => onNavigate("engineer")}>Ask the Race Engineer <Sparkles size={15} /></button></div></div>}
          {!route && <div className="mission-empty"><span>01</span><p>Choose a route to see your game result.</p></div>}
          {status && <p className="success-line" role="status"><Check size={16} />{status}</p>}
        </section>
        <aside className="mission-aside">
          <div className="aside-image"><img src="/assets/impact-drive-world.png" alt="A fictional freight route through the miniature logistics world" /><span>THE FREIGHT CIRCUIT</span></div>
          <div className="aside-content"><span className="aside-kicker">THE EVIDENCE DEBRIEF</span><h2>See the source.<br />Read the limits.</h2><p>Browse a small set of source-reviewed claims with their reporting period, review notes, and limitations.</p><div className="evidence-status"><span className="status-dot" /> Limited reviewed subset</div><button className="text-link" onClick={() => onNavigate("library")}>Browse the evidence library <ArrowRight size={15} /></button></div>
          <div className="aside-rule-block"><ShieldCheck size={16} /><span>GAME CHOICES NEVER CHANGE REPORTED DATA.</span></div>
        </aside>
      </div>
    </div>
  );
}

function Library({ search, setSearch, topic, setTopic, view, setView, records, onOpen, onNavigate }: {
  search: string;
  setSearch: (value: string) => void;
  topic: string;
  setTopic: (value: string) => void;
  view: EvidenceView;
  setView: (value: EvidenceView) => void;
  records: LibraryRecord[];
  onOpen: (record: LibraryRecord) => void;
  onNavigate: (screen: Screen) => void;
}) {
  const isReportedView = view === "reported";
  return (
    <div className="content-page library-page">
      <div className="library-intro"><p className="overline"><span /> SOURCE-REVIEWED EVIDENCE</p><h1>Evidence library</h1><p>{evidenceRecords.length ? "Browse a limited set of claims with their source, reporting period, review note, and limitations in view." : "Reported impact claims will appear here when they have been checked against their published sources."}</p></div>
      <div className="library-trust"><ShieldCheck size={18} /><span>Only reviewed report results appear as <strong>Reported impact</strong>. Sources are not endorsements, and this library is not complete.</span></div>
      <div className="evidence-views" aria-label="Evidence views">
        <button aria-pressed={isReportedView} onClick={() => setView("reported")}>Reported impact</button>
        <button aria-pressed={!isReportedView} onClick={() => setView("illustrative")}>Illustrative samples</button>
      </div>
      {isReportedView && evidenceRecords.length === 0 ? (
        <section className="library-empty" aria-labelledby="library-empty-title">
          <ShieldCheck size={22} aria-hidden="true" />
          <div>
            <h2 id="library-empty-title">No source-reviewed impact reports are available yet.</h2>
            <p>There are no report claims to browse right now. Illustrative examples are not shown as reported evidence.</p>
            <a className="text-link" href="/method" onClick={(event) => { event.preventDefault(); onNavigate("about"); }}>How to read the labels <ArrowRight size={15} /></a>
          </div>
        </section>
      ) : (
        <>
          {!isReportedView && <p className="sample-explainer">Illustrative samples are examples, not reported claims. Illustrative demo data — not live AMF1 data or a measured impact result.</p>}
          <div className="library-toolbar"><label className="search-field"><Search size={17} /><span className="sr-only">Search evidence library</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search topics, terms, or claim types" /></label><label className="filter-select"><span className="sr-only">Filter by topic</span><select value={topic} onChange={(e) => setTopic(e.target.value)}><option>All topics</option><option>Environment</option><option>Belong</option><option>Community</option><option>Governance</option></select><ChevronDown size={15} /></label></div>
          <div className="library-count"><span>{records.length} {isReportedView ? "REPORTED CLAIM" : "ILLUSTRATIVE SAMPLE"}{records.length === 1 ? "" : "S"}</span><span>{isReportedView ? "REVIEWED CLAIMS ONLY" : "NOT REPORTED IMPACT"}</span></div>
          <div className="evidence-list">{records.length ? records.map((record, index) => {
            const illustrative = isIllustrativeSample(record);
            const summary = illustrative ? record.summary : record.claim;
            const claimType = illustrative ? record.claimType : record.claimType === "report_result" ? "Report result" : record.claimType === "target" ? "Target" : "Method";
            const period = illustrative ? record.period : record.reportingPeriod ?? "No reporting period stated";
            const source = illustrative ? record.source : `${record.source.title} · ${record.source.edition}`;
            const review = illustrative ? record.review : "Source-reviewed for this prototype";
            return <article className="evidence-row" key={record.id}>
              <div className="record-index">0{index + 1}</div><div className="record-main"><div className="record-meta"><span>{record.topic}</span><b>·</b><span>{claimType}</span></div><h2>{record.title}</h2><p>{summary}</p><button className="text-link" aria-label={`Open record: ${record.title}`} onClick={() => onOpen(record)}>Open record <ArrowRight size={15} /></button></div><div className="record-source"><span className="review-label"><span /> {review}</span><span>{period}</span><span>{source}</span></div><ArrowUpRight className="record-arrow" size={17} />
            </article>;
          }) : <div className="empty-results"><Search size={20} /><h2>No records match</h2><p>Try a different search or topic.</p></div>}</div>
          <div className="library-method"><span>01 — CONTENT STANDARD</span><p>Reporting period and publication date stay distinct. Targets, commitments, outputs, and outcomes keep their own labels.</p><span className="method-mark">MM</span></div>
        </>
      )}
    </div>
  );
}

function Engineer({ question, setQuestion, reply, asking, onSubmit, currentChoice, detailLevel, setDetailLevel, includeMissionContext, setIncludeMissionContext, includeTelemetryContext, setIncludeTelemetryContext, telemetrySnapshot }: {
  question: string;
  setQuestion: (value: string) => void;
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
  const sampleQuestions = ["What does the solar generation figure measure?", "How many nationalities were represented?", "Is the solar figure a team-wide renewable percentage?"];
  const modeLabel = reply?.mode === "grounded_ai" ? "GROUNDED EXPLANATION · CITATIONS VALIDATED"
    : reply?.mode === "no_answer" ? "NO ANSWER · LIMITED TO APPROVED CONTEXT"
      : "PREPARED RESPONSE · BOUNDED CONTEXT";
  return (
    <div className="content-page engineer-page">
      <div className="engineer-header"><span className="engineer-emblem"><Sparkles size={20} /></span><div><p className="overline"><span /> OPTIONAL EXPLANATION</p><h1>Ask the Race Engineer.</h1><p>Ask about source-reviewed records or context you choose to include. Unsupported factual questions receive a clear limitation.</p></div></div>
      <div className="engineer-grid"><section className="engineer-chat">
        <div className="chat-topline"><span><i /> READY</span><span>ASK ON SUBMIT · NO HISTORY</span></div>
        <div className="engineer-message"><span className="message-avatar"><Sparkles size={17} /></span><div><span className="message-label">RACE ENGINEER</span><p>I can explain reviewed records and selected fictional context. Citations link back to their approved source records.</p></div></div>
        {!reply && <div className="question-suggestions"><span>TRY A QUESTION</span>{sampleQuestions.map((sample) => <button key={sample} onClick={() => setQuestion(sample)}>{sample}<ArrowUpRight size={14} /></button>)}</div>}
        {reply && <div className="engineer-answer" aria-live="polite"><div className="answer-mode"><span /> {modeLabel}</div><p className="answer-text">{reply.answer}</p><div className="answer-detail"><span>{reply.mode === "no_answer" ? "GROUNDING CHECK" : reply.citations.length ? "WHAT THE SOURCE SAYS" : "WHAT THE SELECTED CONTEXT SAYS"}</span><p>{reply.whatSourceStates}</p></div><div className="answer-detail"><span>WHAT IT MEANS</span><p>{reply.whatItMeans}</p></div>{reply.citations.length > 0 && <div className="answer-detail"><span>CITED RECORDS</span><ul className="engineer-citations">{reply.citations.map((citation) => <li key={citation.recordId}><a href={citation.sourceUrl} target="_blank" rel="noreferrer">{citation.title} · {citation.sourceTitle}</a><small>{citation.reportingPeriod ?? "Reporting period not stated"}{citation.sourceLocation ? " · " + citation.sourceLocation : ""}</small></li>)}</ul></div>}{reply.limitations.map((limitation) => <div className="limitation-note" key={limitation}><Info size={14} />{limitation}</div>)}</div>}
        <form className="question-form" onSubmit={onSubmit}>
          <label htmlFor="engineer-question">YOUR QUESTION</label>
          <div><input id="engineer-question" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} placeholder="Ask about a report record or selected context…" /><button type="submit" disabled={asking || !question.trim()} aria-label="Send question">{asking ? <span className="spinner" /> : <ArrowRight size={18} />}</button></div>
          <small>Up to 500 characters. Questions are not saved on the server.</small>
          <label className="detail-level-label" htmlFor="engineer-detail">ANSWER DETAIL</label>
          <select id="engineer-detail" value={detailLevel} onChange={(event) => setDetailLevel(event.target.value as "concise" | "detailed")}><option value="concise">Concise</option><option value="detailed">Detailed</option></select>
          <fieldset className="engineer-context-options">
            <legend>OPTIONAL CONTEXT · SENT ONLY WHEN SELECTED</legend>
            <label><input type="checkbox" checked={includeMissionContext} disabled={!currentChoice} onChange={(event) => setIncludeMissionContext(event.target.checked)} /> Include fictional Mission scenario {currentChoice ? "· " + routeOptions.find((route) => route.id === currentChoice)?.name : "· choose a route first"}</label>
            <label><input type="checkbox" checked={includeTelemetryContext} onChange={(event) => setIncludeTelemetryContext(event.target.checked)} /> Include simulated snapshot · {telemetrySnapshot.stepId} ({telemetrySnapshot.status})</label>
          </fieldset>
        </form>
      </section><aside className="engineer-side"><div className="current-context"><span>MISSION CONTEXT</span><h2>Freight choices</h2><p>{currentChoice ? "Selected route: " + routeOptions.find((r) => r.id === currentChoice)?.name + ". It is sent only if you select its context above." : "Choose a route to make fictional Mission context available."}</p><div className="context-rule" /><span className="context-mark">01 <b>/</b> 01</span></div><div className="grounding-card"><ShieldCheck size={18} /><h3>Evidence first.</h3><p>Only reviewed records can be cited as reported impact. Mission and simulated snapshot details stay separate.</p><span>NO UNSOURCED FACTS</span></div></aside></div>
    </div>
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
        <div><span>WORLD</span><strong>{discovery.foundToken ? "Discovery found" : "Not explored yet"}</strong><small>Freight circuit</small></div>
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

function TrustGuide({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const categories = [
    {
      name: "Simulated live view",
      label: "A SCRIPTED SESSION",
      summary: "If shown, values and timestamps come from a local demonstration fixture, not a live AMF1 feed.",
      detail: "A simulated fixture advances only when a visitor chooses to advance it. Its status, units, and timestamps are part of the simulation.",
    },
    {
      name: "Reported impact",
      label: "A PUBLISHED CLAIM",
      summary: "A claim from a published report, shown with its source, reporting period, and limitations.",
      detail: "A source location is included when available. A reported claim is not described as AMF1-approved unless that approval has actually been given.",
    },
    {
      name: "Illustrative impact placeholder",
      label: "AN EXAMPLE VALUE",
      summary: "A fictional sample that demonstrates how a future impact value might appear. Label it: Illustrative demo data — not live AMF1 data or a measured impact result.",
      detail: "Keep this exact label beside every illustrative impact value so it cannot be mistaken for a live or measured result.",
    },
    {
      name: "Mission scenario",
      label: "A FICTIONAL RESULT",
      summary: "Freight choices and feedback are deterministic game content, not operational data or measured impact.",
      detail: "The game outcome is independent of telemetry and evidence. It does not calculate an emissions, delivery, or real-world impact score.",
    },
  ];

  return (
    <div className="content-page about-page method-page">
      <p className="overline"><span /> HOW TO READ THIS EXPERIENCE</p>
      <h1>Know what each value means.</h1>
      <p className="about-lede">Impact Drive separates a fictional mission, a simulated session, published report claims, and illustrative examples. This experience contains a limited set of source-reviewed claims, and labels stay beside the values they describe.</p>
      <div className="trust-guide">
        {categories.map((category, index) => (
          <article className="trust-category" key={category.name}>
            <span>{String(index + 1).padStart(2, "0")} / {category.label}</span>
            <h2>{category.name}</h2>
            <p>{category.summary}</p>
            <details>
              <summary>More detail</summary>
              <p>{category.detail}</p>
            </details>
          </article>
        ))}
      </div>
      <div className="about-boundary"><ShieldCheck size={20} /><div><strong>No live AMF1 feed or measured impact</strong><p>The mission and simulated values do not describe AMF1 operations. Reported claims remain connected to their source and limitations. The Race Engineer retrieves reviewed records and only the mission or simulated telemetry context you choose to include.</p></div></div>
      <div className="method-actions">
        <button className="button button-primary" onClick={() => onNavigate("mission")}>Start the freight mission <ArrowRight size={16} /></button>
        <button className="button button-quiet" onClick={() => onNavigate("library")}>Browse evidence library</button>
      </div>
    </div>
  );
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
    return <div className="dialog-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="evidence-dialog" role="dialog" aria-modal="true" aria-labelledby="record-title"><button ref={closeButton} className="dialog-close icon-button" aria-label="Close record" onClick={onClose}><X size={19} /></button><p className="overline"><span /> ILLUSTRATIVE SAMPLE / {record.topic.toUpperCase()}</p><h2 id="record-title">{record.title}</h2><span className="review-label large"><span /> {record.review.toUpperCase()}</span><p className="dialog-summary">{record.summary}</p><div className="record-fields"><div><span>CLAIM TYPE</span><strong>{record.claimType}</strong></div><div><span>REPORTING PERIOD</span><strong>{record.period}</strong></div><div><span>SOURCE</span><strong>{record.source}</strong></div><div><span>LOCATION</span><strong>{record.page}</strong></div></div><div className="dialog-limits"><Info size={16} /><div><strong>Limitations</strong>{record.limitations.map((limitation) => <p key={limitation}>{limitation}</p>)}</div></div><p className="dialog-footnote">Illustrative demo data — not live AMF1 data or a measured impact result.</p></section></div>;
  }

  const value = record.value === undefined ? "Not stated" : `${record.valueDisplay ?? record.value}${record.unit ? ` ${record.unit}` : ""}`;
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="evidence-dialog" role="dialog" aria-modal="true" aria-labelledby="record-title"><button ref={closeButton} className="dialog-close icon-button" aria-label="Close record" onClick={onClose}><X size={19} /></button><p className="overline"><span /> SOURCE-REVIEWED CLAIM / {record.topic.toUpperCase()}</p><h2 id="record-title">{record.title}</h2><span className="review-label large"><span /> Source-reviewed for this prototype</span><p className="dialog-summary">{record.claim}</p><div className="record-fields"><div><span>CLAIM TYPE</span><strong>{record.claimType.replace("_", " ")}</strong></div><div><span>REPORTED VALUE</span><strong>{value}</strong></div><div><span>REPORTING PERIOD</span><strong>{record.reportingPeriod ?? "No reporting period stated"}</strong></div><div><span>SOURCE TITLE / EDITION</span><strong>{record.source.title} · {record.source.edition}</strong></div><div><span>PUBLICATION DATE</span><strong>{record.source.publicationDate ?? "Not stated in source"}</strong></div><div><span>SOURCE LOCATION</span><strong>{record.source.location ?? "Not stated in source"}</strong></div></div><div className="dialog-limits"><Info size={16} /><div><strong>Review note</strong><p>{record.reviewNote}</p><strong>Limitations</strong>{record.limitations.map((limitation) => <p key={limitation}>{limitation}</p>)}</div></div><p className="dialog-footnote"><a href={record.source.url} target="_blank" rel="noreferrer">Open source report</a> · This source does not imply AMF1 endorsement of this app.</p></section></div>;
}

function PlaneIcon() { return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="m4 18 10-2 5-10c.5-1 2.3-.7 2.2.5L20 15l7-1.6c1.5-.3 2.2 1.5.8 2.2L20 20l-2 7c-.3 1.1-2 1.1-2.3 0L14 21l-7 1.2c-1.4.2-2-1.6-.7-2.2L12 17l-7-1c-1.4-.2-1.4-2.2 0-2l8 1.2" fill="currentColor" /></svg>; }
function ShipIcon() { return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 18h20l-2 7H9l-3-7Zm4-8h4v7h-4v-7Zm5-3h4v10h-4V7Zm5 6h3v4h-3v-4ZM4 27c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1 2 1 4 1v2c-2 0-2-1-4-1s-2 1-4 1-2-1-4-1-2 1-4 1-2-1-4-1-2 1-4 1v-2Z" fill="currentColor" /></svg>; }
function TruckIcon() { return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 8h16v13H3V8Zm16 5h6l5 5v3H19v-8Zm-11 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm16 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-16 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm16 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm0-9v3h4l-3-3h-1Z" fill="currentColor" /></svg>; }

export default App;
