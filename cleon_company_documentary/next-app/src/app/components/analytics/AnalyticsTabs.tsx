"use client";

import { BarChart3 } from "lucide-react";
import type { DocumentaryAnalyticsDashboard } from "../../../../lib/types";
import { AnalyticsLineChart, AnalyticsProgress } from "./AnalyticsCharts";
import {
  ContentTable,
  formatAnalyticsDuration,
  TrendList,
} from "./AnalyticsShared";

export function AnalyticsOverview({
  data,
}: {
  data: DocumentaryAnalyticsDashboard;
}) {
  const item = data.overview;
  const metrics: [string, string, string][] = [
    [
      "Total views",
      item.total_views.toLocaleString(),
      "starts in selected period",
    ],
    [
      "Viewer rate",
      `${item.viewer_rate.toFixed(1)}%`,
      `${item.unique_viewers.toLocaleString()} of ${item.eligible_employees.toLocaleString()} eligible employees`,
    ],
    [
      "Total watch time",
      formatAnalyticsDuration(item.total_watch_seconds),
      `Average ${formatAnalyticsDuration(item.average_watch_seconds)}`,
    ],
    [
      "Completion rate",
      `${item.completion_rate.toFixed(1)}%`,
      `Average completion ${item.average_completion.toFixed(1)}%`,
    ],
    [
      "Engagement rate",
      `${item.engagement_rate.toFixed(1)}%`,
      "Meaningful viewer interaction",
    ],
    [
      "Compliance",
      `${item.compliance_rate.toFixed(1)}%`,
      `${item.mandatory_completed} of ${item.mandatory_assignments} assignments`,
    ],
  ];
  return (
    <div className="analytics-tab-content">
      <div className="analytics-metric-grid">
        {metrics.map(([label, value, hint], index) => (
          <div
            className={`analytics-metric${index === 0 ? " is-primary" : ""}`}
            key={label}
          >
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
          </div>
        ))}
      </div>
      <div className="analytics-panel">
        <div className="analytics-panel-heading">
          <div>
            <h3>Views over time</h3>
            <p>Daily starts and unique viewers across the selected period.</p>
          </div>
          <span className="chart-legend">
            <i className="legend-pink" /> Views <i className="legend-purple" />{" "}
            Unique viewers
          </span>
        </div>
        <AnalyticsLineChart
          points={data.views_over_time}
          lines={[
            { key: "views", label: "Views", color: "#e83e8c" },
            {
              key: "unique_viewers",
              label: "Unique viewers",
              color: "#7259d8",
            },
          ]}
        />
      </div>
      <div className="analytics-two-column">
        <div className="analytics-panel compact">
          <h3>Reach snapshot</h3>
          <div className="reach-bars">
            <AnalyticsProgress
              label="Eligible employees"
              value={item.eligible_employees ? 100 : 0}
              text={item.eligible_employees.toLocaleString()}
            />
            <AnalyticsProgress
              label="Unique viewers"
              value={item.viewer_rate}
              text={`${item.unique_viewers.toLocaleString()} · ${item.viewer_rate.toFixed(1)}%`}
            />
            <AnalyticsProgress
              label="Completed viewers"
              value={item.completion_rate}
              text={`${item.mandatory_completed.toLocaleString()} completed`}
            />
          </div>
        </div>
        <div className="analytics-panel compact">
          <h3>Watch quality</h3>
          <div className="quality-stat">
            <strong>
              {formatAnalyticsDuration(item.median_watch_seconds)}
            </strong>
            <span>Median watch time</span>
          </div>
          <div className="quality-stat">
            <strong>{item.average_completion.toFixed(1)}%</strong>
            <span>Average completion</span>
          </div>
          <div className="quality-stat">
            <strong>
              {data.trends.period_change_percent >= 0 ? "+" : ""}
              {data.trends.period_change_percent.toFixed(1)}%
            </strong>
            <span>Period view change</span>
          </div>
        </div>
      </div>
      {(data.caption_usage || data.completion_bands || data.approval_compliance) && (
        <div className="analytics-three-column">
          {data.caption_usage && (
            <div className="analytics-panel compact">
              <h3>Caption usage</h3>
              <div className="quality-stat">
                <strong>{data.caption_usage.usage_rate.toFixed(1)}%</strong>
                <span>{data.caption_usage.unique_viewers} viewers used captions</span>
              </div>
            </div>
          )}
          {data.completion_bands && (
            <div className="analytics-panel compact">
              <h3>Completion bands</h3>
              <AnalyticsProgress label="< 25%" value={(data.completion_bands.under_25 / Math.max(data.completion_bands.under_25 + data.completion_bands.between_25_75 + data.completion_bands.over_75, 1)) * 100} text={String(data.completion_bands.under_25)} />
              <AnalyticsProgress label="25–75%" value={(data.completion_bands.between_25_75 / Math.max(data.completion_bands.under_25 + data.completion_bands.between_25_75 + data.completion_bands.over_75, 1)) * 100} text={String(data.completion_bands.between_25_75)} />
              <AnalyticsProgress label="≥ 75%" value={(data.completion_bands.over_75 / Math.max(data.completion_bands.under_25 + data.completion_bands.between_25_75 + data.completion_bands.over_75, 1)) * 100} text={String(data.completion_bands.over_75)} />
            </div>
          )}
          {data.approval_compliance && (
            <div className="analytics-panel compact">
              <h3>Approval compliance</h3>
              <div className="quality-stat">
                <strong>{data.approval_compliance.pending_count}</strong>
                <span>Pending approval</span>
              </div>
              <div className="quality-stat">
                <strong>{data.approval_compliance.approved_count}</strong>
                <span>Approved videos</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AnalyticsDepartments({
  data,
}: {
  data: DocumentaryAnalyticsDashboard;
}) {
  return (
    <div className="analytics-tab-content">
      <div className="analytics-panel">
        <div className="analytics-panel-heading">
          <div>
            <h3>Views by department</h3>
            <p>Reach compared with viewer adoption.</p>
          </div>
        </div>
        <div className="department-bars">
          {data.department_chart.slice(0, 10).map((row) => (
            <div className="department-bar-row" key={row.name}>
              <span>{row.name}</span>
              <div>
                <i
                  style={{
                    width: `${Math.min((row.views / Math.max(data.department_chart[0]?.views || 1, 1)) * 100, 100)}%`,
                  }}
                />
              </div>
              <strong>{row.views.toLocaleString()}</strong>
            </div>
          ))}
        </div>
      </div>
      <div className="analytics-panel table-panel">
        <div className="analytics-panel-heading">
          <div>
            <h3>Department performance</h3>
            <p>
              Sorted by total views. Performance combines reach, completion, and
              watch depth.
            </p>
          </div>
          <span className="table-sort">Total views ↓</span>
        </div>
        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Eligible</th>
                <th>Viewer rate</th>
                <th>Total views</th>
                <th>Avg watch time</th>
                <th>Completion</th>
                <th>Performance</th>
              </tr>
            </thead>
            <tbody>
              {data.departments.map((row) => (
                <tr key={row.name}>
                  <td>
                    <strong>{row.name}</strong>
                  </td>
                  <td>{row.eligible_employees}</td>
                  <td>{row.viewer_rate.toFixed(1)}%</td>
                  <td>
                    <strong>{row.total_views.toLocaleString()}</strong>
                  </td>
                  <td>{formatAnalyticsDuration(row.average_watch_seconds)}</td>
                  <td>
                    <div className="table-progress">
                      <i style={{ width: `${row.average_completion}%` }} />
                      <span>{row.average_completion.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`performance-badge ${row.performance.toLowerCase().replaceAll(" ", "-")}`}
                    >
                      {row.performance}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function AnalyticsEngagement({
  data,
}: {
  data: DocumentaryAnalyticsDashboard;
}) {
  const distribution = data.engagement_distribution;
  const total =
    distribution.strong + distribution.developing + distribution.at_risk;
  const strongEnd = total ? (distribution.strong / total) * 100 : 0;
  const developingEnd = total
    ? ((distribution.strong + distribution.developing) / total) * 100
    : 0;
  return (
    <div className="analytics-tab-content">
      <div className="engagement-summary">
        <div
          className="engagement-donut"
          style={{
            background: `conic-gradient(#c42875 0 ${strongEnd}%, #d28caa ${strongEnd}% ${developingEnd}%, #ead4df ${developingEnd}% 100%)`,
          }}
        >
          <div>
            <strong>{total.toLocaleString()}</strong>
            <span>viewer records</span>
          </div>
        </div>
        <div className="engagement-legend">
          <div>
            <i className="legend-deep-pink" />
            <strong>{distribution.strong.toLocaleString()}</strong>
            <span>Strong · 75%+ completion</span>
          </div>
          <div>
            <i className="legend-soft-pink" />
            <strong>{distribution.developing.toLocaleString()}</strong>
            <span>Developing · 40–74%</span>
          </div>
          <div>
            <i className="legend-pale-pink" />
            <strong>{distribution.at_risk.toLocaleString()}</strong>
            <span>At risk · below 40%</span>
          </div>
        </div>
      </div>
      <div className="analytics-two-column">
        <div className="analytics-panel">
          <div className="analytics-panel-heading">
            <div>
              <h3>Daily activity</h3>
              <p>Views and unique viewers.</p>
            </div>
          </div>
          <AnalyticsLineChart
            points={data.engagement_over_time}
            lines={[
              { key: "views", label: "Views", color: "#e83e8c" },
              {
                key: "unique_viewers",
                label: "Unique viewers",
                color: "#7259d8",
              },
            ]}
          />
        </div>
        <div className="analytics-panel">
          <div className="analytics-panel-heading">
            <div>
              <h3>Average completion</h3>
              <p>Completion trend for active viewer records.</p>
            </div>
          </div>
          <AnalyticsLineChart
            points={data.engagement_over_time}
            lines={[
              {
                key: "average_completion",
                label: "Average completion",
                color: "#3d9b79",
              },
            ]}
            percentage
          />
        </div>
      </div>
      <div className="analytics-panel table-panel">
        <div className="analytics-panel-heading">
          <div>
            <h3>Content engagement leaders</h3>
            <p>High-reach videos with completion context.</p>
          </div>
        </div>
        <ContentTable rows={data.content_performance.slice(0, 8)} />
      </div>
    </div>
  );
}

export function AnalyticsTrends({
  data,
}: {
  data: DocumentaryAnalyticsDashboard;
}) {
  return (
    <div className="analytics-tab-content">
      <div className="trend-callout">
        <div>
          <span className="eyebrow">Period movement</span>
          <strong>
            {data.trends.period_change_percent >= 0 ? "+" : ""}
            {data.trends.period_change_percent.toFixed(1)}%
          </strong>
          <p>
            Views in the second half of the selected period compared with the
            first half.
          </p>
        </div>
        <BarChart3 size={28} />
      </div>
      <div className="analytics-three-column">
        <TrendList
          title="Rising reach"
          description="Most viewed content in the period"
          rows={data.trends.rising}
        />
        <TrendList
          title="Completion watchlist"
          description="Content with the lowest completion"
          rows={data.trends.declining}
        />
        <TrendList
          title="Mandatory at risk"
          description="Required content needing attention"
          rows={data.trends.at_risk}
        />
      </div>
      <div className="analytics-panel">
        <div className="analytics-panel-heading">
          <div>
            <h3>Completion funnel</h3>
            <p>Use this to locate the stage where viewers drop away.</p>
          </div>
        </div>
        <div className="funnel">
          <div style={{ width: "100%" }}>
            <span>Eligible employees</span>
            <strong>{data.overview.eligible_employees.toLocaleString()}</strong>
          </div>
          <div style={{ width: `${Math.max(data.overview.viewer_rate, 8)}%` }}>
            <span>Started a video</span>
            <strong>{data.overview.unique_viewers.toLocaleString()}</strong>
          </div>
          <div
            style={{
              width: `${Math.max(data.overview.average_completion, 8)}%`,
            }}
          >
            <span>Average completion</span>
            <strong>{data.overview.average_completion.toFixed(1)}%</strong>
          </div>
          <div
            style={{ width: `${Math.max(data.overview.compliance_rate, 8)}%` }}
          >
            <span>Mandatory completed</span>
            <strong>
              {data.overview.mandatory_completed.toLocaleString()}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}
