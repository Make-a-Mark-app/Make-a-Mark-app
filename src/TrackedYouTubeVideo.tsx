import { useEffect, useRef } from "react";

type YouTubePlayer = { destroy: () => void };
type YouTubeApi = { Player: new (element: HTMLElement, options: { videoId: string; playerVars: Record<string, string | number>; events: { onStateChange: (event: { data: number }) => void } }) => YouTubePlayer };

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeLoad: Promise<YouTubeApi> | null = null;

function loadYouTube() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!youtubeLoad) youtubeLoad = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    window.onYouTubeIframeAPIReady = () => window.YT?.Player ? resolve(window.YT) : reject(new Error("YouTube API unavailable"));
    script.onerror = () => { youtubeLoad = null; reject(new Error("YouTube API unavailable")); };
    document.head.append(script);
  });
  return youtubeLoad;
}

export function TrackedYouTubeVideo({ id, title, onWatch }: { id: string; title: string; onWatch: (id: string) => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const callback = useRef(onWatch);
  callback.current = onWatch;

  useEffect(() => {
    const container = mount.current;
    if (!container) return;
    let disposed = false;
    let player: YouTubePlayer | null = null;
    void loadYouTube().then((api) => {
      if (disposed) return;
      const target = document.createElement("div");
      container.replaceChildren(target);
      player = new api.Player(target, {
        videoId: id,
        playerVars: { enablejsapi: 1, origin: window.location.origin, rel: 0 },
        events: { onStateChange: (event) => { if (event.data === 1) callback.current(id); } },
      });
    }).catch(() => {
      if (disposed) return;
      const fallback = document.createElement("iframe");
      fallback.title = title;
      fallback.src = `https://www.youtube-nocookie.com/embed/${id}`;
      fallback.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share";
      fallback.allowFullscreen = true;
      container.replaceChildren(fallback);
    });
    return () => { disposed = true; player?.destroy(); container.replaceChildren(); };
  }, [id, title]);

  return <div className="film-more-player" ref={mount} aria-label={title} />;
}
