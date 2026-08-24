"use client";

import { Edit, Plus, Trash2 } from "lucide-react";

export default function StopsTab({ stops, onCreate, onEdit, onDeactivate }: { stops: any[]; onCreate: () => void; onEdit: (stop: any) => void; onDeactivate: (stop: any) => void }) {
  return <div className="management-view animate-fade-in"><header className="management-header"><div><p className="eyebrow">Route topology</p><h1 className="section-title">Stops</h1><p className="section-subtitle">Active directional-topology locations.</p></div><button onClick={onCreate} className="btn-primary"><Plus aria-hidden className="size-4" /> Add stop</button></header><div className="management-table-wrap"><table className="management-table"><thead><tr><th>Code</th><th>Display name</th><th>Latitude</th><th>Longitude</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{stops.map((stop) => <tr key={stop.id}><td><strong>{stop.code}</strong></td><td>{stop.name}</td><td className="tabular-nums">{stop.latitude}</td><td className="tabular-nums">{stop.longitude}</td><td><div className="row-actions"><button onClick={() => onEdit(stop)} className="btn-ghost"><Edit aria-hidden className="size-3.5" /> Edit</button><button onClick={() => onDeactivate(stop)} className="btn-ghost danger"><Trash2 aria-hidden className="size-3.5" /> Deactivate</button></div></td></tr>)}</tbody></table></div></div>;
}
