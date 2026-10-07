import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Info, Play, X } from "lucide-react";
import { TrackedYouTubeVideo } from "./TrackedYouTubeVideo";

const BRIGHTCOVE_ACCOUNT = "6057949432001";
const BRIGHTCOVE_PLAYER = "k9CLwmWhs";
const BRIGHTCOVE_VIDEO = "1842625384022247341";
const BRIGHTCOVE_SCRIPT = `https://players.brightcove.net/${BRIGHTCOVE_ACCOUNT}/${BRIGHTCOVE_PLAYER}_default/index.min.js`;
const ESG_REPORT_URL = "https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2024.pdf#page=34";

type BrightcovePlayer = {
  ready: (callback: () => void) => void;
  on: (event: "play" | "timeupdate" | "ended", callback: () => void) => void;
  currentTime: () => number;
  play: () => Promise<void> | void;
  dispose: () => void;
};

type BrightcoveApi = { getPlayer: (id: string) => BrightcovePlayer };

declare global {
  interface Window { videojs?: BrightcoveApi }
}

let brightcoveScriptLoad: Promise<void> | null = null;

function loadBrightcovePlayer() {
  if (window.videojs) return Promise.resolve();
  if (!brightcoveScriptLoad) {
    brightcoveScriptLoad = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = BRIGHTCOVE_SCRIPT;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        brightcoveScriptLoad = null;
        reject(new Error("Brightcove player failed to load."));
      };
      document.head.append(script);
    });
  }
  return brightcoveScriptLoad;
}

export function VideoExperience({ onNavigate, onWatch }: {
  onNavigate: (screen: "library") => void;
  onWatch: (id: string) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [showEsgPopup, setShowEsgPopup] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const playerMount = useRef<HTMLDivElement>(null);
  const popupDismissed = useRef(false);
  const watchCallback = useRef(onWatch);
  watchCallback.current = onWatch;

  useEffect(() => {
    if (!playing || !playerMount.current) return;

    const playerId = "amf1-race-clip-player";
    const playerElement = document.createElement("video-js");
    playerElement.id = playerId;
    playerElement.className = "video-js vjs-fluid";
    playerElement.setAttribute("controls", "");
    playerElement.setAttribute("data-account", BRIGHTCOVE_ACCOUNT);
    playerElement.setAttribute("data-player", BRIGHTCOVE_PLAYER);
    playerElement.setAttribute("data-embed", "default");
    playerElement.setAttribute("data-video-id", BRIGHTCOVE_VIDEO);
    playerElement.setAttribute("data-application-id", "");
    playerMount.current.replaceChildren(playerElement);

    let disposed = false;
    let player: BrightcovePlayer | undefined;
    void loadBrightcovePlayer().then(() => {
      if (disposed || !window.videojs) return;
      player = window.videojs.getPlayer(playerId);
      player.ready(() => {
        if (disposed || !player) return;
        player.on("play", () => watchCallback.current(BRIGHTCOVE_VIDEO));
        player.on("timeupdate", () => {
          if (player && player.currentTime() >= 10 && !popupDismissed.current) setShowEsgPopup(true);
        });
        player.on("ended", () => {
          setShowEsgPopup(false);
          popupDismissed.current = false;
        });
        void Promise.resolve(player.play()).catch(() => undefined);
      });
    }).catch(() => setPlayerError(true));

    return () => {
      disposed = true;
      if (player) player.dispose();
      playerMount.current?.replaceChildren();
    };
  }, [playing]);

  return (
    <section className="film-page" aria-labelledby="film-title">
      <div className="film-heading">
        <div><p className="launch-eyebrow">02 / WATCH THE STORY</p><h1 id="film-title">The race has<br /><em>another story.</em></h1><p>Watch a pit-stop film, then discover an environmental effort happening beyond the track. Start a video here or open its YouTube link to earn 1 Carbon Coin.</p></div>
        <button className="film-back" type="button" onClick={() => onNavigate("library")}>Explore the evidence <ArrowUpRight size={16} /></button>
      </div>
      <div className="film-stage">
        {!playing ? <><img src="/assets/pit-stop-concept.png" alt="Illustrative pit-stop scene with a green race car and crew changing tires" /><button className="film-play" type="button" onClick={() => { onWatch(BRIGHTCOVE_VIDEO); popupDismissed.current = false; setShowEsgPopup(false); setPlayerError(false); setPlaying(true); }}><Play size={22} fill="currentColor" /> Play Alonso’s race-to-pit clip</button></> : <div className="film-player-mount" ref={playerMount} />}
        {playerError && <p className="film-player-error" role="status">The video player could not load. Please try again.</p>}
        {showEsgPopup && <aside className="film-esg-popup" aria-label="AMF1 sustainability fact">
          <div className="film-esg-popup-heading"><span><Info size={14} aria-hidden="true" /> BEYOND THE PIT LANE · ESG REPORT</span><button type="button" onClick={() => { popupDismissed.current = true; setShowEsgPopup(false); }} aria-label="Close sustainability fact"><X size={17} /></button></div>
          <p>AMF1 says carbon-fibre waste from its laminating department is sorted and recycled with Gen 2 Carbon into reusable resources.</p>
          <a href={ESG_REPORT_URL} target="_blank" rel="noopener noreferrer">2024 Make A Mark ESG report <ArrowUpRight size={14} /></a>
        </aside>}
      </div>
      <section className="film-more" aria-label="Three more AMF1 videos">
        <div className="film-more-grid">
          <article className="film-more-card">
            <TrackedYouTubeVideo id="N2UT8yCM1PQ" title="Sustainability achievements of Aston Martin Aramco Formula One Team" onWatch={onWatch} />
            <div className="film-more-copy"><span>BSI GROUP · SUSTAINABILITY</span><h3>Sustainability achievements of Aston Martin Aramco</h3><p>The team discusses its sustainability ambitions and achievements with BSI.</p><a href="https://www.youtube.com/watch?v=N2UT8yCM1PQ" target="_blank" rel="noopener noreferrer" onClick={() => onWatch("N2UT8yCM1PQ")}>Open on YouTube <ArrowUpRight size={15} /></a></div>
          </article>
          <article className="film-more-card">
            <TrackedYouTubeVideo id="cUJsRvytEP4" title="Aston Martin Aramco Make A Mark Sustainability Day" onWatch={onWatch} />
            <div className="film-more-copy"><span>ASTON MARTIN ARAMCO · MAKE A MARK</span><h3>Make A Mark Sustainability Day</h3><p>A look at the team’s sustainability event and its discussion of sustainable leadership in F1.</p><a href="https://www.youtube.com/watch?v=cUJsRvytEP4" target="_blank" rel="noopener noreferrer" onClick={() => onWatch("cUJsRvytEP4")}>Open on YouTube <ArrowUpRight size={15} /></a></div>
          </article>
          <article className="film-more-card">
            <TrackedYouTubeVideo id="UII48mXdmlA" title="Additional video" onWatch={onWatch} />
            <div className="film-more-copy"><span>MORE TO WATCH</span><h3>Additional video</h3><a href="https://www.youtube.com/watch?v=UII48mXdmlA" target="_blank" rel="noopener noreferrer" onClick={() => onWatch("UII48mXdmlA")}>Open on YouTube <ArrowUpRight size={15} /></a></div>
          </article>
        </div>
      </section>
    </section>
  );
}
