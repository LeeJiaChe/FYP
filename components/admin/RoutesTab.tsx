"use client";

import { Plus } from "lucide-react";

interface RoutesTabProps {
  routes: any[];
  onOpenModal: () => void;
}

export default function RoutesTab({ routes, onOpenModal }: RoutesTabProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="section-title text-xl">Routes Management</h2>
          <p className="section-subtitle">{routes.length} routes configured</p>
        </div>
        <button onClick={onOpenModal} className="btn-primary flex items-center gap-1.5 text-xs">
          <Plus className="w-4 h-4" /> Add Route
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {routes.map((r, idx) => (
          <div
            key={r.id}
            className="glass-card p-5 rounded-2xl space-y-3 animate-slide-up"
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            <h3 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>{r.name}</h3>
            <div className="flex flex-wrap gap-2">
              {r.stops?.map((stop: string, i: number) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 rounded-lg font-medium"
                  style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                >
                  {stop}
                </span>
              ))}
            </div>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{r.stops?.length || 0} stops</p>
          </div>
        ))}
      </div>
    </div>
  );
}
