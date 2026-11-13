import { useEffect, useMemo, useState } from "react";
import { apiFetch, getGymId } from "../services/api";

type Trend = { date: string; count: number };
type Renewal = { month: string; count: number };
type RiskMember = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  lastAttendance: string | null;
  daysSinceVisit: number | null;
  daysToExpiry: number;
  reason: string;
};
type AnalyticsData = {
  attendanceTrend: Trend[];
  renewalTrend: Renewal[];
  renewalsDueSoon: number;
  riskMembers: RiskMember[];
};

const dateLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short" });
const monthLabel = (value: string) => new Date(`${value}-15T12:00:00`).toLocaleDateString("en-IN", { month: "short" });

function TrendChart({ values, labels, color, empty }: { values: number[]; labels: string[]; color: string; empty: string }) {
  const max = Math.max(...values, 1);
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!total) return <div className="retention-chart-empty">{empty}</div>;
  const width = 620;
  const height = 190;
  const left = 26;
  const bottom = 26;
  const chartHeight = height - bottom - 14;
  const step = (width - left * 2) / Math.max(values.length - 1, 1);
  const points = values.map((value, index) => `${left + step * index},${14 + chartHeight - (value / max) * chartHeight}`).join(" ");
  return <div className="retention-chart-wrap">
    <svg className="retention-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Trend chart, ${total} total`}>
      {[0, 1, 2].map((line) => <line key={line} x1={left} x2={width - left} y1={14 + chartHeight * line / 2} y2={14 + chartHeight * line / 2} className="retention-gridline" />)}
      <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((value, index) => {
        const x = left + step * index;
        const y = 14 + chartHeight - (value / max) * chartHeight;
        return <g key={labels[index]}><circle cx={x} cy={y} r="4" fill={color} /><text x={x} y={height - 4} textAnchor="middle" className="retention-axis-label">{labels[index]}</text></g>;
      })}
    </svg>
  </div>;
}

export default function RetentionAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const gymId = getGymId();
        if (!gymId) throw new Error("Gym information is missing");
        const response = await apiFetch(`/api/gyms/${gymId}/dashboard/retention`);
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Unable to load retention analytics");
        if (!cancelled) setData(result);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load retention analytics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const attendanceTotal = useMemo(() => data?.attendanceTrend.reduce((sum, item) => sum + item.count, 0) ?? 0, [data]);
  const renewalTotal = useMemo(() => data?.renewalTrend.reduce((sum, item) => sum + item.count, 0) ?? 0, [data]);

  if (loading) return <div className="retention-state">Loading retention insights…</div>;
  if (error || !data) return <div className="retention-state retention-error">{error || "Analytics are unavailable."}</div>;

  return <section className="retention-page">
    <div className="retention-intro"><div><p className="eyebrow">MEMBER HEALTH</p><h3>Retention analytics</h3><p>Spot changes in attendance, track renewals, and follow up with members who may need support.</p></div><span className="retention-updated">Updated just now</span></div>
    <div className="retention-kpis">
      <article className="retention-kpi"><span>Members at risk</span><strong>{data.riskMembers.length}</strong><small>Low attendance or plan ending soon</small></article>
      <article className="retention-kpi"><span>Renewals due soon</span><strong>{data.renewalsDueSoon}</strong><small>Active plans ending in 14 days</small></article>
      <article className="retention-kpi"><span>Renewals · 6 months</span><strong>{renewalTotal}</strong><small>Members who continued within 60 days</small></article>
      <article className="retention-kpi"><span>Check-ins · 7 days</span><strong>{attendanceTotal}</strong><small>Daily gym attendance</small></article>
    </div>
    <div className="retention-trends">
      <article className="retention-panel"><div className="retention-panel-heading"><div><h4>Attendance trend</h4><p>Check-ins over the last 7 days</p></div><strong>{attendanceTotal}<small> check-ins</small></strong></div><TrendChart values={data.attendanceTrend.map((item) => item.count)} labels={data.attendanceTrend.map((item) => dateLabel(item.date))} color="#18a39a" empty="No check-ins recorded in the last 7 days." /></article>
      <article className="retention-panel"><div className="retention-panel-heading"><div><h4>Membership renewals</h4><p>Renewed within 60 days of a previous plan</p></div><strong>{renewalTotal}<small> renewals</small></strong></div><TrendChart values={data.renewalTrend.map((item) => item.count)} labels={data.renewalTrend.map((item) => monthLabel(item.month))} color="#8065df" empty="Renewals will appear here as members continue their plans." /></article>
    </div>
    <article className="retention-panel retention-risk-panel"><div className="retention-panel-heading"><div><h4>Members to check in with</h4><p>Active members with 7+ days away or a plan ending in 14 days</p></div><span className="retention-risk-count">{data.riskMembers.length} members</span></div>
      {data.riskMembers.length ? <div className="retention-table-wrap"><table className="retention-table"><thead><tr><th>Member</th><th>Last visit</th><th>Plan ends</th><th>Reason to follow up</th></tr></thead><tbody>{data.riskMembers.map((member) => <tr key={member.id}><td><strong>{member.name}</strong><small>{member.phone || member.email || `Member #${member.id}`}</small></td><td>{member.lastAttendance ? `${member.daysSinceVisit} days ago` : "No visits yet"}</td><td>{member.daysToExpiry <= 14 ? `${Math.max(0, member.daysToExpiry)} days` : "—"}</td><td><span className="retention-reason">{member.reason}</span></td></tr>)}</tbody></table></div> : <div className="retention-all-clear"><span>✓</span><div><strong>No members need follow-up right now</strong><p>Keep an eye on this list as attendance and plan dates change.</p></div></div>}
    </article>
  </section>;
}
