import { useEffect, useRef } from "react";

type Destination = "mission" | "video" | "library" | "rewards";

const destinations: Record<string, Destination> = {
  game: "mission",
  video: "video",
  reports: "library",
  shop: "rewards",
};

export function Home({ onNavigate }: { onNavigate: (screen: Destination) => void }) {
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "AMF1 — The Interactive Garage";

    function handleGarageNavigation(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type !== "garage:navigate") return;
      const destination = destinations[event.data.destination];
      if (destination) onNavigate(destination);
    }

    window.addEventListener("message", handleGarageNavigation);
    return () => {
      document.title = previousTitle;
      window.removeEventListener("message", handleGarageNavigation);
    };
  }, [onNavigate]);

  return (
    <section className="garage-home" aria-label="Explore the interactive garage">
      <iframe ref={frame} className="garage-home-frame" src="/garage/index.html" title="Interactive Make A Mark garage" />
    </section>
  );
}
