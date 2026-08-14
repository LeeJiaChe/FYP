"use client";

import { Plus, Edit } from "lucide-react";

interface BusesTabProps {
  buses: any[];
  onOpenModal: () => void;
  onEditBus: (bus: any) => void;
}

export default function BusesTab({ buses, onOpenModal, onEditBus }: BusesTabProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="section-title text-xl">Bus Fleet Management</h2>
          <p className="section-subtitle">{buses.length} buses registered</p>
        </div>
        <button onClick={onOpenModal} className="btn-primary flex items-center gap-1.5 text-xs">
          <Plus className="w-4 h-4" /> Add Bus
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {buses.map((b, idx) => (
          <div
            key={b.id}
            className="glass-card p-5 rounded-2xl space-y-3 animate-slide-up"
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            <div className="flex justify-between items-start">
              <span className="font-extrabold text-lg" style={{ color: "var(--text-primary)" }}>{b.plateNumber}</span>
              <span
                className="badge"
                style={b.status === "ACTIVE"
                  ? { background: "rgba(34,197,94,0.15)", color: "#4ade80", borderColor: "rgba(34,197,94,0.3)" }
                  : { background: "rgba(245,158,11,0.15)", color: "#fbbf24", borderColor: "rgba(245,158,11,0.3)" }}
              >
                {b.status}
              </span>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Capacity: <span className="font-bold" style={{ color: "var(--text-primary)" }}>{b.seatedCapacity} seated + {b.standingCapacity} standing</span>
            </p>
            <div className="flex items-center justify-between mt-2">
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Trips Scheduled: {b._count?.trips || 0}</p>
              <button 
                onClick={() => onEditBus(b)} 
                className="btn-ghost flex items-center gap-1 text-[11px] px-2 py-1"
              >
                <Edit className="w-3 h-3" /> Edit
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
