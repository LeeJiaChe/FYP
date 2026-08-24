"use client";

import { Edit, Plus } from "lucide-react";

export default function DriversTab({ drivers, onCreate, onEdit }: { drivers: any[]; onCreate: () => void; onEdit: (driver: any) => void }) {
  return <div className="management-view animate-fade-in"><header className="management-header"><div><p className="eyebrow">Assignment accounts</p><h1 className="section-title">Drivers</h1><p className="section-subtitle">Accounts eligible for Trip assignment.</p></div><button onClick={onCreate} className="btn-primary"><Plus aria-hidden className="size-4" /> Add driver</button></header><div className="management-table-wrap"><table className="management-table"><thead><tr><th>Driver</th><th>Email</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{drivers.map((driver) => <tr key={driver.id}><td><strong>{driver.name}</strong></td><td>{driver.email}</td><td><div className="row-actions"><button onClick={() => onEdit(driver)} className="btn-ghost"><Edit aria-hidden className="size-3.5" /> Edit</button></div></td></tr>)}</tbody></table></div></div>;
}
