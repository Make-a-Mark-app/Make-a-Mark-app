import { useEffect, useRef, useState } from "react";
import { ArrowRight, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { finalScene, gameLayers, missionEnding, sceneFor, type GameChoice, type GameLayer } from "./missionStory";

type Phase = "intro" | "scene" | "choice" | "outcome" | "ending" | "scoreboard";
type Scene = { file: string; location: string };

function SceneMedia({ scene, phase, transitioning, onStart, onHome, onLastSecond, onEnded }: {
  scene: Scene;
  phase: Phase;
  transitioning: boolean;
  onStart: () => void;
  onHome: () => void;
  onLastSecond: () => void;
  onEnded: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [playBlocked, setPlayBlocked] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const interactive = phase === "intro" || phase === "scene" || phase === "ending";

  async function playVideo() {
    const video = videoRef.current;
    if (!video) return;
    try {
      await video.play();
      setPlayBlocked(false);
    } catch {
      setPlayBlocked(true);
    }
  }

  useEffect(() => {
    if (phase === "scene" || phase === "ending") void playVideo();
  }, [scene.file, phase === "scene" || phase === "ending"]);

  return <div className="game-media">
    {failed ? <img src={imageFailed ? "/assets/impact-drive-world.png" : `/assets/mission/${scene.file}.jpg`} onError={() => setImageFailed(true)} alt={`${scene.location} scenario still`} /> :
      <video ref={videoRef} src={`/assets/mission/${scene.file}.mp4`} preload="auto" playsInline muted={muted} onError={() => setFailed(true)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(event) => {
        const video = event.currentTarget;
        if (phase === "scene" && Number.isFinite(video.duration) && video.duration - video.currentTime <= 1) onLastSecond();
      }} onEnded={onEnded} aria-label={`${scene.location} scenario video`} tabIndex={-1} />}
    {phase === "intro" && <div className="game-intro"><p>MAKE A MARK · FREIGHT MISSION</p><h1 id="game-title">Get the team to Singapore.</h1><span>Three choices. One race weekend.</span><div className="game-intro-actions"><button type="button" disabled={transitioning} onClick={() => { onStart(); void playVideo(); }}>Start mission <Play size={18} aria-hidden="true" /></button><button type="button" className="game-return-home" disabled={transitioning} onClick={onHome}>Return to main page</button></div></div>}
    {interactive && phase !== "intro" && <div className="game-media-controls">
      {failed ? <button type="button" onClick={phase === "ending" ? onEnded : onLastSecond}>{phase === "ending" ? "View scoreboard" : "Show decision"} <ArrowRight size={16} aria-hidden="true" /></button> : <>
        <button type="button" onClick={() => { if (playing) videoRef.current?.pause(); else void playVideo(); }} aria-label={playing ? "Pause scene" : "Play scene"}>{playing ? <Pause size={17} /> : <Play size={17} />}</button>
        <button type="button" onClick={() => setMuted((value) => !value)} aria-label={muted ? "Unmute scene" : "Mute scene"}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button>
      </>}
    </div>}
    {playBlocked && !failed && interactive && phase !== "intro" && <button className="game-play-prompt" type="button" onClick={() => void playVideo()}>Play scene <Play size={17} aria-hidden="true" /></button>}
    {(phase === "scene" || phase === "ending") && <span className="game-location">{scene.location}</span>}
  </div>;
}

export function MissionGame({ onTransport, onStart, onComplete, onHome }: {
  onTransport: (id: "sea" | "road" | "air") => void;
  onStart: () => void;
  onComplete: (earnedCoins: number) => void;
  onHome: () => void;
}) {
  const [layer, setLayer] = useState<GameLayer>(0);
  const [phase, setPhase] = useState<Phase>("intro");
  const [choices, setChoices] = useState<GameChoice[]>([]);
  const [lessonAnswer, setLessonAnswer] = useState<"report" | "game" | null>(null);
  const [lessonWarning, setLessonWarning] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const transitionTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
  }, []);
  const current = gameLayers[layer];
  const ending = missionEnding(choices);
  const scene = phase === "ending" || phase === "scoreboard" ? finalScene : sceneFor(layer, choices[0]);
  const selected = choices[layer];

  function choose(choice: GameChoice) {
    if (phase !== "choice" || transitioning) return;
    advance(() => {
      setChoices((previous) => [...previous.slice(0, layer), choice]);
      if (layer === 0) onTransport(choice.id as "sea" | "road" | "air");
      setPhase("outcome");
    });
  }

  function continueAfterOutcome() {
    advance(() => {
      if (layer === 2) { setPhase("ending"); return; }
      setLayer((layer + 1) as GameLayer);
      setPhase("scene");
    });
  }

  function advance(next: () => void) {
    if (transitionTimer.current !== null) return;
    setTransitioning(true);
    transitionTimer.current = window.setTimeout(() => {
      setTransitioning(false);
      transitionTimer.current = null;
      next();
    }, 1000);
  }

  return <section className="game-shell" aria-label="Freight mission game">
    <div className="game-frame">
      <SceneMedia key={scene.file} scene={scene} phase={phase} transitioning={transitioning} onStart={() => advance(() => { onStart(); setPhase("scene"); })} onHome={() => advance(onHome)} onLastSecond={() => setPhase((value) => value === "scene" ? "choice" : value)} onEnded={() => setPhase((value) => value === "ending" ? "scoreboard" : value === "scene" ? "choice" : value)} />
      {phase === "choice" && <div className="game-choice-overlay" aria-live="polite"><div className="game-choice-content"><p className="game-step">SCENARIO {layer + 1} · {current.title.toUpperCase()}</p><h2>{current.question}</h2><div className="game-options">{current.choices.map((choice) => <button type="button" key={choice.id} disabled={transitioning} onClick={() => choose(choice)}><span>{choice.label}</span><ArrowRight size={17} aria-hidden="true" /></button>)}</div></div></div>}
      {phase === "outcome" && selected && <div className="game-result-overlay" aria-live="polite"><div className="game-result-content"><p className="game-complete-eyebrow">MISSION UPDATE · {selected.rating.toUpperCase()} CHOICE</p><h1>Scenario {layer + 1} complete</h1><p className="game-result-choice">{selected.label}</p><p className="game-result-copy">{selected.outcome}</p><p className="game-report-context">{selected.reportContext} <a href={selected.reportUrl} target="_blank" rel="noreferrer">{selected.reportLabel}</a></p><strong className="game-points">{selected.points > 0 ? "+" : ""}{selected.points} points</strong><button type="button" className="game-continue" disabled={transitioning} onClick={continueAfterOutcome}>{layer === 2 ? "See final scene" : `Continue to Scenario ${layer + 2}`} <ArrowRight size={17} aria-hidden="true" /></button></div></div>}
      {phase === "scoreboard" && <div className="game-scoreboard" aria-live="polite"><div className="game-scoreboard-content"><p className="game-complete-eyebrow">SINGAPORE GRAND PRIX</p><h1>Scoreboard</h1><p className="game-scoreboard-intro">Your three decisions and their fictional game outcomes. Earn 1 Carbon Coin per 300 points, up to 3.</p><ol>{choices.map((choice, index) => <li key={choice.id}><span className="game-score-index">0{index + 1}</span><div><strong>{choice.label}</strong><small>{choice.rating} · {choice.outcome}</small></div><b>{choice.points > 0 ? "+" : ""}{choice.points}</b></li>)}</ol><div className="game-totals"><span>Score <strong>{ending.score}</strong></span><span>Carbon Coins earned <strong>{ending.coins}</strong></span></div><fieldset className="game-lesson-check"><legend>One final learning check: what does the reported 14% refer to?</legend><label><input type="radio" name="lesson-check" checked={lessonAnswer === "report"} onChange={() => { setLessonAnswer("report"); setLessonWarning(false); }} /> AMF1 reported travel and logistics emissions were 14% lower</label><label><input type="radio" name="lesson-check" checked={lessonAnswer === "game"} onChange={() => { setLessonAnswer("game"); setLessonWarning(false); }} /> My game decisions reduced real emissions by 14%</label></fieldset>{lessonWarning && <p className="game-lesson-warning" role="alert">🔒 Answer the learning check to unlock the finish button.</p>}{lessonAnswer === "game" && <p className="game-lesson-feedback" role="status">Game decisions are fictional. Choose the statement from the AMF1 report to finish.</p>}{lessonAnswer === "report" && <p className="game-lesson-feedback" role="status">Correct. This is a reported team result, not a measurement from your game.</p>}<button type="button" className={`game-continue${lessonAnswer !== "report" ? " is-locked" : ""}`} aria-disabled={lessonAnswer !== "report"} onClick={() => { if (transitioning) return; if (lessonAnswer !== "report") { setLessonWarning(true); return; } advance(() => onComplete(ending.coins)); }}>{lessonAnswer === "report" ? `Finish mission and collect ${ending.coins} Carbon ${ending.coins === 1 ? "Coin" : "Coins"}` : "🔒 Answer to unlock finish"} <ArrowRight size={17} aria-hidden="true" /></button></div></div>}
    </div>
  </section>;
}
