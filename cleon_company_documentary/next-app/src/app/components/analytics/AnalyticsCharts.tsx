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

function formatAxisValue(value: number, percentage: boolean) {
  if (percentage) return `${Math.round(value)}%`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  if (Number.isInteger(value) || value >= 10) return String(Math.round(value));
  return value.toFixed(1);
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
  const pad = { top: 18, right: 25, bottom: 32, left: 52 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const values = lines.flatMap((line) =>
    points.map((point) => Number(point[line.key]) || 0),
  );
  const max = percentage ? 100 : Math.max(...values, 1);
  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => (max / tickCount) * index);

  const xAt = (index: number) =>
    pad.left + (index / Math.max(points.length - 1, 1)) * innerWidth;
  const yAt = (value: number) =>
    pad.top + innerHeight - (value / max) * innerHeight;

  const pointString = (line: { key: string }) =>
    points
      .map(
        (point, index) =>
          `${xAt(index)},${yAt(Number(point[line.key]) || 0)}`,
      )
      .join(" ");

  return (
    <div className="line-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Analytics trend chart"
      >
        {ticks.map((tick) => {
          const y = yAt(tick);
          return (
            <g key={tick}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y}
                y2={y}
                stroke="#eee6ed"
                strokeDasharray={tick === 0 ? undefined : "4 4"}
              />
              <text
                x={pad.left - 8}
                y={y + 4}
                textAnchor="end"
                className="chart-y-label"
              >
                {formatAxisValue(tick, percentage)}
              </text>
            </g>
          );
        })}
        <line
          x1={pad.left}
          x2={width - pad.right}
          y1={pad.top + innerHeight}
          y2={pad.top + innerHeight}
          stroke="#ddd5dc"
        />
        <line
          x1={pad.left}
          x2={pad.left}
          y1={pad.top}
          y2={pad.top + innerHeight}
          stroke="#ddd5dc"
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
        {lines.map((line) =>
          points.map((point, index) => (
            <circle
              key={`${line.key}-${index}`}
              cx={xAt(index)}
              cy={yAt(Number(point[line.key]) || 0)}
              r="3.5"
              fill="#fff"
              stroke={line.color}
              strokeWidth="2"
            />
          )),
        )}
      </svg>
      <div className="chart-axis">
        <span>{points[0]?.date || ""}</span>
        <span>{points[Math.floor(points.length / 2)]?.date || ""}</span>
        <span>{points[points.length - 1]?.date || ""}</span>
      </div>
    </div>
  );
}
