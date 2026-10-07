import { useEffect, useRef, useState } from "react";

type Destination = "home" | "mission" | "video" | "library" | "rewards";

const links: Array<{ destination: Destination; step: string; label: string }> = [
  { destination: "mission", step: "01 / PLAY", label: "Game" },
  { destination: "video", step: "02 / WATCH", label: "Video" },
  { destination: "library", step: "03 / DISCOVER", label: "Reports & articles" },
  { destination: "rewards", step: "04 / GROW", label: "Pilot rewards" },
];

export function GarageHeader({ onNavigate }: { onNavigate: (screen: Destination) => void }) {
  const drawer = useRef<HTMLDialogElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const closing = useRef(false);
  const [open, setOpen] = useState(false);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  function openNavigation() {
    if (drawer.current?.open) return;
    closing.current = false;
    drawer.current?.showModal();
    setOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (drawer.current?.open && !closing.current) drawer.current.classList.add("is-visible");
    }));
  }

  function closeNavigation(destination?: Destination) {
    if (!drawer.current?.open || closing.current) return;
    closing.current = true;
    drawer.current.classList.add("is-closing");
    drawer.current.classList.remove("is-visible");
    setOpen(false);

    const finish = () => {
      drawer.current?.close();
      drawer.current?.classList.remove("is-closing");
      closing.current = false;
      if (destination) onNavigate(destination);
      else toggle.current?.focus();
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) finish();
    else closeTimer.current = window.setTimeout(finish, 520);
  }

  return (
    <div className="garage-chrome">
      <header className="premium-header">
        <button ref={toggle} type="button" className="menu-control" aria-label="Open navigation" aria-expanded={open} aria-controls="garage-navigation" onClick={openNavigation}>
          <span className="menu-lines" aria-hidden="true"><i /><i /></span><span className="menu-word">MENU</span>
        </button>
        <a className="team-logo-link" href="/" aria-label="Aston Martin Aramco Formula One Team — home" onClick={(event) => { event.preventDefault(); onNavigate("home"); }}>
          <img className="team-logo" src="/garage/assets/team-logo.png" alt="" />
        </a>
        <span className="header-caption">THE GARAGE <i aria-hidden="true" /></span>
      </header>
      <dialog ref={drawer} className="navigation-drawer" id="garage-navigation" aria-labelledby="garage-navigation-title" onCancel={(event) => { event.preventDefault(); closeNavigation(); }} onClick={(event) => {
        if (event.target !== drawer.current) return;
        const bounds = drawer.current.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeNavigation();
      }}>
        <div className="drawer-top">
          <button type="button" className="menu-control" aria-label="Close navigation" autoFocus onClick={() => closeNavigation()}><span className="menu-lines" aria-hidden="true"><i /><i /></span><span className="menu-word">CLOSE</span></button>
          <span>AMF1 / EXPLORE</span>
        </div>
        <div className="drawer-content">
          <p className="eyebrow" id="garage-navigation-title">YOUR NEXT LAP STARTS HERE</p>
          <nav aria-label="Garage navigation">
            {links.map(({ destination, step, label }) => <button key={destination} type="button" onClick={() => closeNavigation(destination)}><small>{step}</small><span>{label} <b aria-hidden="true">↗</b></span></button>)}
          </nav>
        </div>
        <div className="drawer-bottom">
          <button type="button" onClick={() => closeNavigation("home")}>Return to the garage <span aria-hidden="true">↗</span></button>
          <p>Four objects. Four ways to discover.</p>
        </div>
      </dialog>
    </div>
  );
}
