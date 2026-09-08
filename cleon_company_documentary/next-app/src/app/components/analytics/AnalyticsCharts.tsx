"use client";

export function AnalyticsProgress({
  label,
  value,
  text,
}: {
  label: string;
  value: number;
  text: string;
}) {
  return (
    <div className="reach-bar">
      <div>
        <span>{label}</span>
        <strong>{text}</strong>
      </div>
      <div>
        <i style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
      </div>
    </div>
  );
}

export function AnalyticsLineChart({
  points,
  lines,
  percentage = false,
}: {
  points: { date: string; [key: string]: string | number }[];
  lines: { key: string; label: string; color: string }[];
  percentage?: boolean;
}) {
  const width = 760;
  const height = 230;
  const pad = 25;
  const values = lines.flatMap((line) =>
    points.map((point) => Number(point[line.key]) || 0),
  );
  const max = percentage ? 100 : Math.max(...values, 1);
  const pointString = (line: { key: string }) =>
    points
      .map(
        (point, index) =>
          `${pad + (index / Math.max(points.length - 1, 1)) * (width - pad * 2)},${height - pad - ((Number(point[line.key]) || 0) / max) * (height - pad * 2)}`,
      )
      .join(" ");
  return (
    <div className="line-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Analytics trend chart"
      >
        <line
          x1={pad}
          x2={width - pad}
          y1={height - pad}
          y2={height - pad}
          stroke="#eee6ed"
        />
        {lines.map((line) => (
          <polyline
            key={line.key}
            points={pointString(line)}
            fill="none"
            stroke={line.color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <div className="chart-axis">
        <span>{points[0]?.date || ""}</span>
        <span>{points[Math.floor(points.length / 2)]?.date || ""}</span>
        <span>{points[points.length - 1]?.date || ""}</span>
      </div>
    </div>
  );
}
