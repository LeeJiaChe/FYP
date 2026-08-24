import React from "react";

// Journey topology visual owned by the booking feature.
function ConnectedRouteLine({
  stops,
  fromStop,
  toStop,
}: {
  stops: string[];
  fromStop?: string;
  toStop?: string;
}) {
  const fromIdx = fromStop ? stops.indexOf(fromStop) : -1;
  const toIdx = toStop ? stops.indexOf(toStop) : -1;
  const totalStops = stops.length;

  return (
    <div className="connected-route">
      <div className="connected-route-line">
        <div className="connected-route-track" />

        {/* Active Segment Fill */}
        {fromIdx !== -1 && toIdx !== -1 && toIdx > fromIdx && totalStops > 1 && (
          <div
            className="connected-route-active"
            style={{
              left: `calc(${(fromIdx / (totalStops - 1)) * 100}% + 12px)`,
              width: `calc(${((toIdx - fromIdx) / (totalStops - 1)) * 100}% - 24px)`,
            }}
          />
        )}

        {/* Nodes and Stop Labels */}
        {stops.map((stop, idx) => {
          const isFromNode = fromStop ? stop === fromStop : idx === 0;
          const isToNode = toStop ? stop === toStop : idx === totalStops - 1;
          const isSelectedLeg =
            fromIdx !== -1 && toIdx !== -1 && idx >= fromIdx && idx <= toIdx;

          return (
            <div key={idx} className="connected-route-stop">
              <div className={`connected-route-node ${isFromNode ? "from" : isToNode ? "to" : isSelectedLeg ? "selected" : ""}`}>
                {isSelectedLeg && <div />}
              </div>
              <span
                className={isFromNode || isToNode || isSelectedLeg ? "selected" : ""}
                title={stop}
              >
                {stop}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ConnectedRouteLine;
