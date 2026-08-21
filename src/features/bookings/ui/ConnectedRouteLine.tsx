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
    <div className="py-4 px-2">
      <div className="relative flex items-center justify-between">
        {/* Track Line Background */}
        <div className="absolute left-4 right-4 top-2 h-1 bg-slate-800 rounded-full" />

        {/* Active Segment Fill */}
        {fromIdx !== -1 && toIdx !== -1 && toIdx > fromIdx && totalStops > 1 && (
          <div
            className="absolute top-2 h-1 bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 rounded-full transition-all duration-300 shadow-sm shadow-indigo-500/30"
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
            <div key={idx} className="relative z-10 flex flex-col items-center group">
              <div
                className={`w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${
                  isFromNode
                    ? "bg-indigo-500 border-indigo-200 ring-4 ring-indigo-500/25 scale-110"
                    : isToNode
                    ? "bg-emerald-500 border-emerald-200 ring-4 ring-emerald-500/25 scale-110"
                    : isSelectedLeg
                    ? "bg-sky-400 border-white"
                    : "bg-slate-900 border-slate-700"
                }`}
              >
                {isSelectedLeg && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <span
                className={`text-[10px] mt-2 font-semibold text-center leading-tight max-w-[90px] truncate ${
                  isFromNode
                    ? "text-indigo-400 font-extrabold"
                    : isToNode
                    ? "text-emerald-400 font-extrabold"
                    : isSelectedLeg
                    ? "text-slate-200 font-bold"
                    : "text-slate-400"
                }`}
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
