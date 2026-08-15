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
    <div className="space-y-8 animate-fade-in">
      {/* Rule-Based Suggestion Banner */}
      {recommendation && (
        <div
          className="p-4 rounded-2xl flex items-center gap-3 text-xs"
          style={{
            background: "rgba(59,130,246,0.1)",
            border: "1px solid rgba(59,130,246,0.3)",
            color: "#bfdbfe",
          }}
        >
          <Lightbulb className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <span className="font-bold text-sm block" style={{ color: "#dbeafe" }}>
              Rule-Based Capacity Suggestion
            </span>
            {recommendation}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Utilization Rate Chart */}
        <div
          className="glass-panel p-6 rounded-2xl space-y-4"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            Seated Seat-Segment Utilization (%)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={utilizationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
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
        </div>

        {/* No-Show Rate Chart */}
        <div
          className="glass-panel p-6 rounded-2xl space-y-4"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            No-Show Rate (%) per Route
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={noShowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
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
                <Bar dataKey="noShowRate" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
