import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, BookOpen, Check,
  ChevronDown, Compass, Info, MapPin, Menu, Search, ShieldCheck, Sparkles, X,
} from "lucide-react";
import { evidenceRecords, routeOptions, type EvidenceRecord, type RouteId } from "./data";
import { EMPTY_DISCOVERY, hasDiscovery, parseDiscoveryRecap, type DiscoveryRecap } from "../shared/contracts/discovery";
import { createMissionOutcome } from "../shared/contracts/mission";
import { missionScenario } from "../shared/mission";

type Screen = "home" | "world" | "mission" | "library" | "engineer" | "summary" | "about";
type EngineerReply = {
  answer: string;
  whatSourceStates: string;
  whatItMeans: string;
  limitations: string[];
  citations: Array<{ recordId: string; sourceDocument: string; sourcePage: number }>;
  mode: "grounded_ai" | "prepared_fallback" | "no_answer";
};

const navItems: Array<{ id: Screen; label: string }> = [
  { id: "world", label: "World" },
  { id: "mission", label: "Freight mission" },
  { id: "library", label: "Evidence library" },
];

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
  if (route === "/mission/freight") return "mission";
  if (route === "/library" || route.startsWith("/library/")) return "library";
  if (route === "/engineer") return "engineer";
  if (route === "/summary") return "summary";
  if (route === "/about") return "about";
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
  const [selectedRecord, setSelectedRecord] = useState<EvidenceRecord | null>(() => {
    const id = window.location.pathname.startsWith("/library/") ? window.location.pathname.split("/")[2] : "";
    return evidenceRecords.find((record) => record.id === id) ?? null;
  });
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<EngineerReply | null>(null);
  const [asking, setAsking] = useState(false);
  const [status, setStatus] = useState("");

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
      setSelectedRecord(evidenceRecords.find((record) => record.id === id) ?? null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function navigate(next: Screen) {
    const path: Record<Screen, string> = {
      home: "/", world: "/world", mission: "/mission/freight", library: "/library",
      engineer: "/engineer", summary: "/summary", about: "/about",
    };
    window.history.pushState({}, "", path[next]);
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

  const visibleRecords = useMemo(() => evidenceRecords.filter((record) => {
    const matchesSearch = `${record.title} ${record.summary} ${record.topic} ${record.claimType}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (topic === "All topics" || record.topic === topic);
  }), [search, topic]);

  function openRecord(record: EvidenceRecord) {
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
        body: JSON.stringify({ question: question.trim(), currentMission: "freight", currentChoice: discovery.routeChoice }),
      });
      if (!response.ok) throw new Error("Engineer unavailable");
      setReply(await response.json() as EngineerReply);
    } catch {
      setReply({
        answer: "The prepared engineer response is available even while the service is offline: this prototype has no approved report records yet, so I can explain the game but cannot make a factual claim.",
        whatSourceStates: "No approved source records are connected in this prototype.",
        whatItMeans: "Route descriptions are fictional game scenarios, not AMF1 operational data.",
        limitations: ["Prepared offline response", "No approved evidence is available to cite"], citations: [], mode: "prepared_fallback",
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
          {navItems.map((item) => <a key={item.id} className={activeNav === item.id ? "active" : ""} href={item.id === "world" ? "/world" : item.id === "mission" ? "/mission/freight" : "/library"} onClick={(e) => { e.preventDefault(); navigate(item.id); }}>{item.label}</a>)}
        </nav>
        <div className="topbar-meta"><span className="session-dot" /> Local prototype <span className="meta-divider">·</span> No account</div>
      </header>

      <main id="main" key={screen}>
        {screen === "home" && <Home discovery={discovery} onChoose={chooseRoute} onNavigate={navigate} />}
        {screen === "world" && <World car={car} moveCar={moveCar} found={discovery.foundToken} onFind={() => setDiscovery((d) => ({ ...d, foundToken: true, topics: d.topics.includes("Environment") ? d.topics : [...d.topics, "Environment"] }))} status={status} onNavigate={navigate} />}
        {screen === "mission" && <Mission discovery={discovery} onChoose={chooseRoute} onFinish={finishMission} onRetry={retryMission} onNavigate={navigate} status={status} />}
        {screen === "library" && <Library search={search} setSearch={setSearch} topic={topic} setTopic={setTopic} records={visibleRecords} onOpen={openRecord} />}
        {screen === "engineer" && <Engineer question={question} setQuestion={setQuestion} reply={reply} asking={asking} onSubmit={askEngineer} currentChoice={discovery.routeChoice} />}
        {screen === "summary" && <Summary discovery={discovery} onNavigate={navigate} onClear={clearDiscoveries} status={status} />}
        {screen === "about" && <About onNavigate={navigate} />}
      </main>

      <footer className="site-footer">
        <span>MAKE A MARK <i>·</i> IMPACT DRIVE</span>
        <div><button onClick={() => setMotionOn(!motionOn)} aria-pressed={!motionOn}>{motionOn ? "Reduce motion" : "Motion reduced"}</button><button onClick={() => navigate("about")}>How this prototype works</button><button onClick={() => navigate("summary")}>My discoveries</button></div>
      </footer>

      {selectedRecord && <EvidenceDialog record={selectedRecord} onClose={closeRecord} />}
    </div>
  );
}

function Home({ discovery, onChoose, onNavigate }: { discovery: DiscoveryRecap; onChoose: (id: RouteId) => void; onNavigate: (screen: Screen) => void }) {
  const [choice, setChoice] = useState<RouteId | null>(discovery.routeChoice);
  const route = routeOptions.find((item) => item.id === choice);
  return (
    <div className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="hero-copy">
          <p className="overline"><span /> ONE MISSION. A WIDER PICTURE.</p>
          <h1 id="home-title">Come for the drive.<br /><em>Discover the impact.</em></h1>
          <p className="hero-description">Explore a freight mission, uncover the evidence behind real-world choices, and see the bigger picture along the way.</p>
          <div className="hero-actions"><button className="button button-primary" onClick={() => onNavigate("world")}>Enter the world <ArrowRight size={17} /></button><button className="button button-quiet" onClick={() => onNavigate("mission")}>Go to freight mission</button></div>
          <div className="hero-footnote"><span className="footline" /> GAME SCENARIOS ARE FICTIONAL</div>
        </div>
        <div className="hero-landscape" role="img" aria-label="Illustrated logistics circuit linking a race track, freight hub and port">
          <div className="landscape-shade" />
          <div className="landscape-caption"><span>01 / 01</span><span>THE FREIGHT CIRCUIT</span></div>
          <div className="landscape-route-mark"><span className="route-pulse" /><span>DISCOVERY POINT</span></div>
        </div>
        <div className="route-panel">
          <div className="panel-heading"><div><span className="panel-index">01 / ENVIRONMENT</span><h2>Freight choices</h2></div><span className="panel-chevron"><ArrowRight size={18} /></span></div>
          <p className="panel-intro">Choose how to move the shipment, then explore what the reports say.</p>
          <div className="route-options" role="radiogroup" aria-label="Choose a fictional freight route">
            {routeOptions.map((item, index) => <button key={item.id} role="radio" aria-checked={choice === item.id} className={`route-option ${choice === item.id ? "selected" : ""}`} onClick={() => { setChoice(item.id); onChoose(item.id); }}>
              <span className={`route-icon route-icon-${item.id}`} aria-hidden="true">{index === 0 ? <PlaneIcon /> : index === 1 ? <ShipIcon /> : <TruckIcon />}</span><span className="route-copy"><strong>{item.name}</strong><small>{item.mode}</small></span><span className="radio-dot" />
            </button>)}
          </div>
          <div className="fiction-label"><span className="fiction-mark">G</span><span>Game scenario <b>·</b> fictional values</span><Info size={14} /></div>
          {route && <p className="route-outcome" aria-live="polite">{route.feedback}</p>}
          <button className="button button-panel" onClick={() => onNavigate(choice ? "mission" : "mission")}>{choice ? "Continue mission" : "Set your route"}<ArrowRight size={16} /></button>
        </div>
        <div className="home-bottom"><div className="evidence-teaser"><span className="document-icon"><BookOpen size={20} /></span><div><h3>From the reports</h3><p>Reviewed evidence will appear here.</p><button onClick={() => onNavigate("library")}>Explore evidence library <ArrowRight size={15} /></button></div></div><div className="control-teaser"><div className="key-cluster"><span>W</span><div><span>A</span><span>S</span><span>D</span></div></div><div><small>MOVE THROUGH THE WORLD</small><p>Use WASD or arrow keys.<br />Or choose a route directly.</p></div></div><div className="local-note"><span className="local-note-mark">✳</span><p>Your discoveries stay<br />on this device.</p></div></div>
      </section>
      <section className="home-next"><div><span className="section-count">01</span><p>START WITH A CHOICE</p><h2>One route.<br />A lot to discover.</h2></div><div className="next-copy"><p>This is a short, fictional freight scenario. Your route shapes the game, then a clear line separates the game from source-backed evidence.</p><button className="text-link" onClick={() => onNavigate("about")}>See how the evidence works <ArrowUpRight size={16} /></button></div><div className="next-aside"><span className="aside-rule" /><span>PLAY, THEN LOOK CLOSER</span></div></section>
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
          <div className="aside-content"><span className="aside-kicker">THE EVIDENCE DEBRIEF</span><h2>Real evidence,<br />when it’s ready.</h2><p>Approved report records will appear here, alongside their source, reporting period, and limitations.</p><div className="evidence-status"><span className="status-dot" /> No approved records connected</div><button className="text-link" onClick={() => onNavigate("library")}>Browse the evidence library <ArrowRight size={15} /></button></div>
          <div className="aside-rule-block"><ShieldCheck size={16} /><span>GAME CHOICES NEVER CHANGE REPORTED DATA.</span></div>
        </aside>
      </div>
    </div>
  );
}

function Library({ search, setSearch, topic, setTopic, records, onOpen }: { search: string; setSearch: (value: string) => void; topic: string; setTopic: (value: string) => void; records: EvidenceRecord[]; onOpen: (record: EvidenceRecord) => void }) {
  return (
    <div className="content-page library-page">
      <div className="library-intro"><p className="overline"><span /> EVIDENCE GARAGE</p><h1>Look under the bonnet.</h1><p>Explore how evidence will be presented: with its source, period, review status, and limitations in view.</p></div>
      <div className="library-trust"><ShieldCheck size={18} /><span>All records shown here are <strong>illustrative samples</strong>. They are not AMF1 claims and cannot support factual answers.</span></div>
      <div className="library-toolbar"><label className="search-field"><Search size={17} /><span className="sr-only">Search evidence previews</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search topics, terms, or claim types" /></label><label className="filter-select"><span className="sr-only">Filter by topic</span><select value={topic} onChange={(e) => setTopic(e.target.value)}><option>All topics</option><option>Environment</option><option>Belong</option><option>Community</option><option>Governance</option></select><ChevronDown size={15} /></label></div>
      <div className="library-count"><span>{records.length} SAMPLE RECORD{records.length === 1 ? "" : "S"}</span><span>APPROVAL STATUS SHOWN ON EVERY RECORD</span></div>
      <div className="evidence-list">{records.length ? records.map((record, index) => <article className="evidence-row" key={record.id}>
        <div className="record-index">0{index + 1}</div><div className="record-main"><div className="record-meta"><span>{record.topic}</span><b>·</b><span>{record.claimType}</span></div><h2>{record.title}</h2><p>{record.summary}</p><button className="text-link" onClick={() => onOpen(record)}>Open record <ArrowRight size={15} /></button></div><div className="record-source"><span className="review-label"><span /> {record.review}</span><span>{record.period}</span><span>{record.source}</span></div><ArrowUpRight className="record-arrow" size={17} />
      </article>) : <div className="empty-results"><Search size={20} /><h2>No preview records match</h2><p>Try a different search or topic.</p></div>}</div>
      <div className="library-method"><span>01 — CONTENT STANDARD</span><p>Reporting period and publication date stay distinct. Targets, commitments, outputs, and outcomes keep their own labels.</p><span className="method-mark">MM</span></div>
    </div>
  );
}

function Engineer({ question, setQuestion, reply, asking, onSubmit, currentChoice }: { question: string; setQuestion: (value: string) => void; reply: EngineerReply | null; asking: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void; currentChoice: RouteId | null }) {
  const sampleQuestions = ["What happens in the freight mission?", "Can I see the report evidence?", "Is my route result a real emissions figure?"];
  return (
    <div className="content-page engineer-page">
      <div className="engineer-header"><span className="engineer-emblem"><Sparkles size={20} /></span><div><p className="overline"><span /> OPTIONAL EXPLANATION</p><h1>Ask the Race Engineer.</h1><p>A prepared prototype response can explain the game and its limits. Approved report evidence isn’t connected yet.</p></div></div>
      <div className="engineer-grid"><section className="engineer-chat">
        <div className="chat-topline"><span><i /> READY</span><span>PREPARED MODE</span></div>
        <div className="engineer-message"><span className="message-avatar"><Sparkles size={17} /></span><div><span className="message-label">RACE ENGINEER</span><p>Ask me about the route choices or how this prototype handles evidence. I’ll be clear about what I can and can’t support.</p></div></div>
        {!reply && <div className="question-suggestions"><span>TRY A QUESTION</span>{sampleQuestions.map((sample) => <button key={sample} onClick={() => setQuestion(sample)}>{sample}<ArrowUpRight size={14} /></button>)}</div>}
        {reply && <div className="engineer-answer" aria-live="polite"><div className="answer-mode"><span /> PREPARED RESPONSE · NOT LIVE AI</div><p className="answer-text">{reply.answer}</p><div className="answer-detail"><span>WHAT THE SOURCE SAYS</span><p>{reply.whatSourceStates}</p></div><div className="answer-detail"><span>WHAT IT MEANS</span><p>{reply.whatItMeans}</p></div>{reply.limitations.map((limitation) => <div className="limitation-note" key={limitation}><Info size={14} />{limitation}</div>)}</div>}
        <form className="question-form" onSubmit={onSubmit}><label htmlFor="engineer-question">YOUR QUESTION</label><div><input id="engineer-question" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} placeholder="Ask about your route or the evidence…" /><button type="submit" disabled={asking || !question.trim()} aria-label="Send question">{asking ? <span className="spinner" /> : <ArrowRight size={18} />}</button></div><small>Up to 500 characters. Questions are not saved by the server.</small></form>
      </section><aside className="engineer-side"><div className="current-context"><span>MISSION CONTEXT</span><h2>Freight choices</h2><p>{currentChoice ? `Your selected route: ${routeOptions.find((r) => r.id === currentChoice)?.name}.` : "Choose a route to give the Engineer more context."}</p><div className="context-rule" /><span className="context-mark">01 <b>/</b> 01</span></div><div className="grounding-card"><ShieldCheck size={18} /><h3>Evidence first.</h3><p>When approved records are connected, factual answers will link back to their source and explain limitations.</p><span>NO UNSOURCED FACTS</span></div></aside></div>
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

function About({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  return <div className="content-page about-page"><p className="overline"><span /> HOW THIS PROTOTYPE WORKS</p><h1>Play is the invitation.<br /><em>Evidence is the point.</em></h1><p className="about-lede">Impact Drive keeps three things separate: a fictional game, source-backed evidence, and explanations that point back to that evidence.</p><div className="about-pillars"><article><span>01 / PLAY</span><h2>Mission scenario</h2><p>Freight route choices and outcomes are deterministic game scenarios. They are not operational AMF1 data.</p></article><article><span>02 / EVIDENCE</span><h2>Reviewed records</h2><p>This prototype uses illustrative content only. Approved source records will include a source location, reporting period, review state, and limitations.</p></article><article><span>03 / EXPLANATION</span><h2>Prepared response</h2><p>The Race Engineer is currently a prepared fallback. Live AI is not connected, and prepared text is labelled as such.</p></article></div><div className="about-boundary"><ShieldCheck size={20} /><div><strong>Prototype boundary</strong><p>No sign-in, personal-data collection, real-time telemetry, or claimed real-world impact. Your session summary stays in this browser.</p></div></div><button className="button button-primary" onClick={() => onNavigate("world")}>Enter the world <ArrowRight size={16} /></button></div>;
}

function EvidenceDialog({ record, onClose }: { record: EvidenceRecord; onClose: () => void }) {
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
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="evidence-dialog" role="dialog" aria-modal="true" aria-labelledby="record-title"><button ref={closeButton} className="dialog-close icon-button" aria-label="Close record" onClick={onClose}><X size={19} /></button><p className="overline"><span /> ILLUSTRATIVE RECORD / {record.topic.toUpperCase()}</p><h2 id="record-title">{record.title}</h2><span className="review-label large"><span /> {record.review.toUpperCase()}</span><p className="dialog-summary">{record.summary}</p><div className="record-fields"><div><span>CLAIM TYPE</span><strong>{record.claimType}</strong></div><div><span>REPORTING PERIOD</span><strong>{record.period}</strong></div><div><span>SOURCE</span><strong>{record.source}</strong></div><div><span>LOCATION</span><strong>{record.page}</strong></div></div><div className="dialog-limits"><Info size={16} /><div><strong>Limitations</strong>{record.limitations.map((limitation) => <p key={limitation}>{limitation}</p>)}</div></div><p className="dialog-footnote">A source link will be shown here when approved report material is added.</p></section></div>;
}

function PlaneIcon() { return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="m4 18 10-2 5-10c.5-1 2.3-.7 2.2.5L20 15l7-1.6c1.5-.3 2.2 1.5.8 2.2L20 20l-2 7c-.3 1.1-2 1.1-2.3 0L14 21l-7 1.2c-1.4.2-2-1.6-.7-2.2L12 17l-7-1c-1.4-.2-1.4-2.2 0-2l8 1.2" fill="currentColor" /></svg>; }
function ShipIcon() { return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 18h20l-2 7H9l-3-7Zm4-8h4v7h-4v-7Zm5-3h4v10h-4V7Zm5 6h3v4h-3v-4ZM4 27c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1 2 1 4 1v2c-2 0-2-1-4-1s-2 1-4 1-2-1-4-1-2 1-4 1-2-1-4-1-2 1-4 1v-2Z" fill="currentColor" /></svg>; }
function TruckIcon() { return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 8h16v13H3V8Zm16 5h6l5 5v3H19v-8Zm-11 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm16 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-16 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm16 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm0-9v3h4l-3-3h-1Z" fill="currentColor" /></svg>; }

export default App;
