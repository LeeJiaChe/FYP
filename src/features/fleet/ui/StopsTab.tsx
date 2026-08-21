"use client";

import { Edit, Plus, Trash2 } from "lucide-react";

export default function StopsTab({
  stops,
  onCreate,
  onEdit,
  onDeactivate,
}: {
  stops: any[];
  onCreate: () => void;
  onEdit: (stop: any) => void;
  onDeactivate: (stop: any) => void;
}) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div><h2 className="section-title text-xl">Stops</h2><p className="section-subtitle">Active directional-topology locations</p></div>
        <button onClick={onCreate} className="btn-primary flex items-center gap-1.5 text-xs"><Plus className="w-4 h-4" /> Add Stop</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stops.map((stop) => (
          <div key={stop.id} className="glass-card p-5 rounded-2xl space-y-2">
            <h3 className="font-bold">{stop.code} — {stop.name}</h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{stop.latitude}, {stop.longitude}</p>
            <div className="flex gap-2">
              <button onClick={() => onEdit(stop)} className="btn-ghost flex items-center gap-1 text-[11px]"><Edit className="w-3 h-3" /> Edit</button>
              <button onClick={() => onDeactivate(stop)} className="btn-ghost flex items-center gap-1 text-[11px]"><Trash2 className="w-3 h-3" /> Deactivate</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
