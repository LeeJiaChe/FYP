"use client";

import { Edit, Plus } from "lucide-react";

export default function DriversTab({ drivers, onCreate, onEdit }: { drivers: any[]; onCreate: () => void; onEdit: (driver: any) => void }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div><h2 className="section-title text-xl">Drivers</h2><p className="section-subtitle">Accounts eligible for Trip assignment</p></div>
        <button onClick={onCreate} className="btn-primary flex items-center gap-1.5 text-xs"><Plus className="w-4 h-4" /> Create Driver</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {drivers.map((driver) => (
          <div key={driver.id} className="glass-card p-5 rounded-2xl flex justify-between items-center">
            <div><h3 className="font-bold">{driver.name}</h3><p className="text-xs" style={{ color: "var(--text-muted)" }}>{driver.email}</p></div>
            <button onClick={() => onEdit(driver)} className="btn-ghost flex items-center gap-1 text-[11px]"><Edit className="w-3 h-3" /> Edit</button>
          </div>
        ))}
      </div>
    </div>
  );
}
