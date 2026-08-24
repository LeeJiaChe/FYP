"use client";

import { Lightbulb } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface AnalyticsTabProps {
  recommendation?: string;
  utilizationData: any[];
  noShowData: any[];
}

export default function AnalyticsTab({
  recommendation,
  utilizationData,
  noShowData,
}: AnalyticsTabProps) {
  return (
    <div className="analytics-view animate-fade-in">
      <header><p className="eyebrow">Operational evidence</p><h1 className="section-title">Analytics</h1><p className="section-subtitle">Existing seated seat-segment utilisation, route no-show rates and rule-based capacity guidance.</p></header>
      {/* Rule-Based Suggestion Banner */}
      {recommendation && (
        <aside className="analytics-recommendation">
          <Lightbulb aria-hidden />
          <div>
            <strong>
              Rule-Based Capacity Suggestion
            </strong>
            <p>{recommendation}</p>
          </div>
        </aside>
      )}

      <div className="analytics-workspace">
        {/* Utilization Rate Chart */}
        <section className="analytics-section">
          <h2>
            Seated Seat-Segment Utilization (%)
          </h2>
          <div className="analytics-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={utilizationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="routeName" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-surface)",
                    borderColor: "var(--border)",
                    borderRadius: "12px",
                    fontSize: "12px",
                    color: "var(--text-primary)",
                  }}
                />
                <Bar dataKey="seatedUtilizationRate" fill="var(--accent-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="analytics-data responsive-table"><table><thead><tr><th>Route</th><th>Utilisation</th></tr></thead><tbody>{utilizationData.map((item) => <tr key={item.routeName}><td>{item.routeName}</td><td className="tabular-nums">{item.seatedUtilizationRate}%</td></tr>)}</tbody></table></div>
        </section>

        {/* No-Show Rate Chart */}
        <section className="analytics-section">
          <h2>
            No-Show Rate (%) per Route
          </h2>
          <div className="analytics-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={noShowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="routeName" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-surface)",
                    borderColor: "var(--border)",
                    borderRadius: "12px",
                    fontSize: "12px",
                    color: "var(--text-primary)",
                  }}
                />
                <Bar dataKey="noShowRate" fill="var(--danger)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="analytics-data responsive-table"><table><thead><tr><th>Route</th><th>No-show rate</th></tr></thead><tbody>{noShowData.map((item) => <tr key={item.routeName}><td>{item.routeName}</td><td className="tabular-nums">{item.noShowRate}%</td></tr>)}</tbody></table></div>
        </section>
      </div>
    </div>
  );
}
