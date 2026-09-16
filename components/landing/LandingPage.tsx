"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { LiquidGlassScene } from "simple-liquid-glass/backdrop";
import { Wordmark } from "@/components/Wordmark";
import { Icon } from "./LandingIcon";
import { TextReveal } from "./TextReveal";
import { CapsuleStory, HeroScene, ScrollManifesto } from "./LandingMotion";
import { LandingNav } from "./LandingNav";
import { LandingGlass } from "./LandingGlass";

function Brand() {
  return (
    <Link
      href="/"
      className="landing-brand"
      aria-label="PrenotaEasy, pagina iniziale"
    >
      <span className="brand-symbol">
        <Icon name="calendar" size={23} />
      </span>
      <Wordmark tagline={null} />
    </Link>
  );
}

function DemoQR() {
  const [url, setUrl] = useState("/#demo");
  useEffect(() => setUrl(`${window.location.origin}/#demo`), []);
  return (
    <QRCodeSVG
      value={url}
      size={210}
      fgColor="#432c3c"
      bgColor="#fffdf9"
      marginSize={0}
      aria-label="QR code per aprire la demo di PrenotaEasy"
    />
  );
}

const SERVICES = [
  {
    name: "Taglio & styling",
    duration: "45 min",
    price: "35",
    icon: "scissors" as const,
  },
  {
    name: "Colore & luminosità",
    duration: "90 min",
    price: "65",
    icon: "sparkles" as const,
  },
  {
    name: "Trattamento beauty",
    duration: "30 min",
    price: "25",
    icon: "flower" as const,
  },
];
const DEMO_DAYS = [
  {
    day: "21",
    label: "Lun",
    full: "lunedì 21 settembre",
    slots: ["09:00", "10:30", "14:00", "16:30"],
  },
  {
    day: "22",
    label: "Mar",
    full: "martedì 22 settembre",
    slots: ["09:30", "11:00", "15:00", "17:30"],
  },
  {
    day: "23",
    label: "Mer",
    full: "mercoledì 23 settembre",
    slots: ["10:00", "12:00", "14:30", "16:00"],
  },
  {
    day: "24",
    label: "Gio",
    full: "giovedì 24 settembre",
    slots: ["09:00", "11:30", "15:30", "18:00"],
  },
];

function BookingDemo() {
  const [step, setStep] = useState(0);
  const [service, setService] = useState(0);
  const [day, setDay] = useState(0);
  const [time, setTime] = useState<string | null>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);

  useEffect(() => {
    if (previousStep.current !== step) {
      stepHeading.current?.focus({ preventScroll: true });
      previousStep.current = step;
    }
  }, [step]);
  return (
    <LandingGlass className="booking-glass" radius={48}>
      <div className="booking-demo" id="booking-preview">
        <div className="demo-browser">
          <span />
          <span />
          <span />
          <span className="demo-url">
            <Icon name="link" size={11} /> prenotaeasy · il tuo salone
          </span>
          <span className="demo-tag">DEMO</span>
        </div>
        <div className="demo-content">
          <div className="demo-salon">
            <span className="salon-monogram">a.</span>
            <div>
              <strong>Atelier Studio</strong>
              <span>Il tuo salone.</span>
            </div>
            <Icon name="sparkles" />
          </div>
          <div className="demo-step" key={step}>
            {step === 0 && (
              <>
                <div className="demo-step-title">
                  <h3 ref={stepHeading} tabIndex={-1}>
                    Di cosa hai voglia?
                  </h3>
                  <span>01 / 03</span>
                </div>
                <p className="demo-description">
                  Scegli un servizio.
                </p>
                <div
                  className="demo-services"
                  role="group"
                  aria-label="Scegli un servizio"
                >
                  {SERVICES.map((item, index) => (
                    <button
                      type="button"
                      key={item.name}
                      aria-pressed={service === index}
                      className={`demo-service ${service === index ? "selected" : ""}`}
                      onClick={() => setService(index)}
                    >
                      <span className="service-icon">
                        <Icon name={item.icon} />
                      </span>
                      <span>
                        <strong>{item.name}</strong>
                        <small>{item.duration}</small>
                      </span>
                      <span className="service-price">€{item.price}</span>
                      <span className="selection-dot">
                        {service === index && <Icon name="check" size={11} />}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="landing-button demo-next"
                  onClick={() => setStep(1)}
                >
                  Scegli quando <Icon name="arrow" size={17} />
                </button>
              </>
            )}
            {step === 1 && (
              <>
                <div className="demo-step-title">
                  <h3 ref={stepHeading} tabIndex={-1}>
                    Scegli quando.
                  </h3>
                  <span>02 / 03</span>
                </div>
                <p className="demo-description">
                  Settembre 2026 · {SERVICES[service].name}
                </p>
                <div
                  className="demo-days"
                  role="group"
                  aria-label="Scegli un giorno"
                >
                  {DEMO_DAYS.map((item, index) => (
                    <button
                      type="button"
                      key={item.day}
                      aria-pressed={day === index}
                      className={day === index ? "selected" : ""}
                      onClick={() => {
                        setDay(index);
                        setTime(null);
                      }}
                    >
                      <span>{item.label}</span>
                      <strong>{item.day}</strong>
                    </button>
                  ))}
                </div>
                <div
                  className="demo-slots"
                  role="group"
                  aria-label="Scegli un orario"
                >
                  {DEMO_DAYS[day].slots.map((slot) => (
                    <button
                      type="button"
                      key={slot}
                      className={time === slot ? "selected" : ""}
                      aria-pressed={time === slot}
                      onClick={() => setTime(slot)}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="landing-button demo-next"
                  disabled={!time}
                  onClick={() => setStep(2)}
                >
                  Conferma la demo <Icon name="arrow" size={17} />
                </button>
                <button
                  type="button"
                  className="demo-back"
                  onClick={() => setStep(0)}
                >
                  Torna ai servizi
                </button>
              </>
            )}
            {step === 2 && (
              <div className="demo-success" role="status">
                <span className="success-icon">
                  <Icon name="check" size={27} />
                </span>
                <h3 ref={stepHeading} tabIndex={-1}>
                  Ed è già fatto.
                </h3>
                <p>
                  {SERVICES[service].name}
                  <br /> {DEMO_DAYS[day].full}, ore {time}
                </p>
                <span className="success-note">
                  Simulazione: nessun appuntamento creato.
                </span>
                <button
                  type="button"
                  className="landing-button demo-next"
                  onClick={() => {
                    setStep(0);
                    setTime(null);
                  }}
                >
                  Prova un altro servizio <Icon name="arrow" size={17} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </LandingGlass>
  );
}

const AGENDA = [
  { name: "Chiara B.", service: "Trattamento", time: "09:00", operator: "Marco" },
  { name: "Anna P.", service: "Taglio & styling", time: "09:30", operator: "Giulia" },
  { name: "Elisa F.", service: "Colore", time: "10:00", operator: "Marco" },
];

function AgendaPreview() {
  return (
    <LandingGlass className="story-interface" radius={40}>
      <div className="agenda-preview">
        <div className="story-preview-heading"><strong>La tua agenda</strong><span>ESEMPIO</span></div>
        <div className="story-agenda-date">22 settembre <Icon name="calendar" size={26} /></div>
        <div className="agenda-events">
          {AGENDA.map((item, index) => (
            <div key={item.time} className={`agenda-event event-${index % 2}`}>
              <time>{item.time}</time>
              <div><strong>{item.name}</strong><span>{item.service}</span></div>
              <span className="agenda-operator">{item.operator}</span>
            </div>
          ))}
        </div>
      </div>
    </LandingGlass>
  );
}

function BookingPreview() {
  return (
    <LandingGlass className="story-interface story-booking-interface" radius={40}>
      <div className="story-booking-preview">
        <div className="story-preview-heading"><strong>Atelier Studio</strong><span>ESEMPIO</span></div>
        <div className="story-service"><span className="story-service-icon"><Icon name="scissors" size={32} /></span><strong>{SERVICES[0].name}</strong><span>{SERVICES[0].duration}</span></div>
        <div className="story-slots" aria-label="Esempio di orari disponibili"><span>09:00</span><span className="chosen">10:30 <Icon name="check" size={22} /></span><span>14:00</span></div>
        <div className="story-confirmation"><span><Icon name="check" size={24} /></span>Prenotazione ricevuta.</div>
      </div>
    </LandingGlass>
  );
}

const FAQS = [
  ["Serve un’app?", "No. Ai tuoi clienti basta il link o il QR del salone."],
  ["E il mio team?", "Ogni collaboratore ha la sua agenda. Tu hai una visione d’insieme."],
  ["WhatsApp è automatico?", "Il messaggio è già pronto. Lo controlli e lo invii tu."],
  ["Come si accede?", "Il servizio è su invito. Il tuo referente PrenotaEasy ti fornisce le credenziali."],
];

export function LandingPage({ backdropFontCSS }: { backdropFontCSS: string }) {
  return (
    <LiquidGlassScene className="landing landing-chapters" fontEmbedCSS={backdropFontCSS} maxCacheBytes={32 * 1024 * 1024}>
      <a className="landing-skip" href="#main">Vai al contenuto</a>
      <LandingNav />
      <main id="main">
        <HeroScene>
          <div className="hero-backdrop" aria-hidden="true">
            <Image src="/images/salon-editorial.jpg" alt="" fill priority sizes="100vw" className="hero-image" />
          </div>
          <div className="hero-content landing-container">
            <div className="hero-topline"><span className="eyebrow"><span className="status-dot" /> IL TUO SALONE, SENZA DISTRAZIONI.</span></div>
            <h1 id="hero-title"><span className="hero-title-line"><TextReveal text="FAI SPAZIO." /></span><span className="hero-title-line hero-title-accent"><TextReveal text="AL TALENTO." delay={0.12} /></span></h1>
            <div className="hero-bottom">
              <div className="hero-copy">
                <p className="hero-description">Prenotazioni, agenda e team.<br /> In un unico posto.</p>
                <LandingGlass className="hero-action-glass" tone="dark">
                  <a className="landing-button hero-primary" href="#demo">Prova la demo <span className="button-arrow"><Icon name="arrow" size={25} /></span></a>
                </LandingGlass>
              </div>
              <LandingGlass className="availability-glass" tone="dark">
                <div className="hero-availability"><strong>24/7</strong><span>Prenotazioni aperte.<br />Anche quando chiudi.</span></div>
              </LandingGlass>
            </div>
            <a className="hero-scroll" href="#funzionalita"><span className="scroll-arrow"><Icon name="arrow" size={25} /></span>Scopri</a>
          </div>
        </HeroScene>
        <ScrollManifesto />
        <CapsuleStory booking={<BookingPreview />} agenda={<AgendaPreview />} care={
          <Image src="/images/salon-care.jpg" alt="Una professionista si prende cura dei capelli di una cliente" fill sizes="100vw" />
        } />
        <section id="come-funziona" className="how-section chapter-demo">
          <div className="landing-container how-layout">
            <div className="how-copy">
              <span className="eyebrow">TOCCA A TE</span>
              <h2><TextReveal text="Provalo." /><br /><span className="heading-accent"><TextReveal text="È già semplice." /></span></h2>
              <div className="demo-qr-note"><DemoQR /><p>Un link. Un QR.<br />Nessuna app.</p></div>
            </div>
            <div className="demo-stage" id="demo">
              <BookingDemo />
              <p className="demo-disclaimer">Demo · Nessuna prenotazione reale</p>
            </div>
          </div>
        </section>
        <section id="domande" className="faq-section landing-container">
          <div><span className="eyebrow">PRIMA DI INIZIARE</span><h2>Tutto chiaro.</h2></div>
          <div className="faq-list">{FAQS.map(([question, answer]) => (
            <LandingGlass key={question} className="faq-glass" radius={36}>
              <details name="landing-faq"><summary><span>{question}</span><span className="faq-plus" aria-hidden="true">+</span></summary><p>{answer}</p></details>
            </LandingGlass>
          ))}</div>
        </section>
        <section className="chapter-closing" data-dark-backdrop aria-labelledby="closing-title">
          <Image src="/images/salon-editorial.jpg" alt="" fill sizes="100vw" />
          <div className="chapter-closing-content">
            <h2 id="closing-title"><TextReveal text="Il prossimo passo" /><br /><TextReveal text="è semplice." delay={0.12} /></h2>
            <LandingGlass className="closing-action-glass" tone="dark">
              <a href="#demo" className="chapter-closing-cta">Prova la demo <Icon name="arrow" size={28} /></a>
            </LandingGlass>
            <p>Accesso al servizio su invito.</p>
          </div>
        </section>
      </main>
      <footer className="landing-footer landing-container">
        <div className="footer-top"><Brand /><a href="#main" className="back-top">Torna su <Icon name="arrow" size={20} /></a></div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} PrenotaEasy</span><div><Link href="/privacy">Privacy</Link><Link href="/login">Accedi</Link></div></div>
      </footer>
    </LiquidGlassScene>
  );
}
