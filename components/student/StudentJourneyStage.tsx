"use client";

import { ArrowRight, ChevronRight } from "lucide-react";

interface StudentJourneyStageProps {
  onPlanJourney: () => void;
}

export default function StudentJourneyStage({ onPlanJourney }: StudentJourneyStageProps) {
  return (
    <section className="jstage" aria-label="Plan your shuttle journey">
      <div className="jstage-atmosphere" aria-hidden="true" />

      <div className="jstage-card">
        <svg
          className="jstage-route-path"
          viewBox="0 0 72 188"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="jstage-route-accent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--jstage-route-head)" stopOpacity=".66" />
              <stop offset=".58" stopColor="var(--jstage-route-mid)" stopOpacity=".28" />
              <stop offset="1" stopColor="var(--jstage-route-tail)" stopOpacity=".38" />
            </linearGradient>
          </defs>
          <path
            className="jstage-route-channel"
            d="M32 31 C22 55 24 79 42 114 C48 126 44 145 50 160"
          />
          <path
            className="jstage-route-line"
            d="M32 31 C22 55 24 79 42 114 C48 126 44 145 50 160"
          />
        </svg>

        <button
          type="button"
          onClick={onPlanJourney}
          className="jstage-stop"
          aria-label="Boarding stop: Choose boarding stop"
        >
          <span className="jstage-stop-node is-origin" aria-hidden="true" />
          <span className="jstage-stop-copy">
            <span className="jstage-stop-label">Boarding</span>
            <span className="jstage-stop-value">Choose boarding stop</span>
          </span>
          <span className="jstage-stop-chevron" aria-hidden="true">
            <ChevronRight />
          </span>
        </button>

        <button
          type="button"
          onClick={onPlanJourney}
          className="jstage-stop is-destination"
          aria-label="Destination stop: Choose destination"
        >
          <span className="jstage-stop-node is-destination" aria-hidden="true" />
          <span className="jstage-stop-copy">
            <span className="jstage-stop-label">Destination</span>
            <span className="jstage-stop-value">Choose destination</span>
          </span>
          <span className="jstage-stop-chevron" aria-hidden="true">
            <ChevronRight />
          </span>
        </button>

        <div className="jstage-action">
          <button type="button" onClick={onPlanJourney} className="jstage-cta">
            <span>Find shuttle</span>
            <span className="jstage-cta-icon" aria-hidden="true">
              <ArrowRight />
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
