type RadarItem = { label: string; score: number };

interface RadarChartProps {
  items: RadarItem[];
  size?: number;
  showValues?: boolean;
  ariaLabel?: string;
}

function polarPoint(index: number, total: number, radius: number, center: number) {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / total;
  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius,
  };
}

function points(items: RadarItem[], radius: number, center: number, scale = 1) {
  return items
    .map((item, index) => {
      const point = polarPoint(index, items.length, radius * Math.max(0, Math.min(100, item.score)) / 100 * scale, center);
      return `${point.x},${point.y}`;
    })
    .join(" ");
}

export function RadarChart({ items, size = 320, showValues = true, ariaLabel = "Couverture des connaissances par domaine" }: RadarChartProps) {
  if (items.length < 3) return null;

  const view = 360;
  const center = view / 2;
  const radius = 112;
  const labelRadius = 150;
  const rings = [25, 50, 75, 100];

  return (
    <div className="w-full" style={{ maxWidth: size }}>
      <svg viewBox={`0 0 ${view} ${view}`} role="img" aria-label={ariaLabel} className="h-auto w-full overflow-visible">
        {rings.map((ring) => (
          <polygon
            key={ring}
            points={items
              .map((_, index) => {
                const point = polarPoint(index, items.length, radius * (ring / 100), center);
                return `${point.x},${point.y}`;
              })
              .join(" ")}
            className="fill-none stroke-border"
            strokeWidth={ring === 100 ? 1.5 : 1}
            opacity={ring === 100 ? 1 : 0.7}
          />
        ))}

        {items.map((_, index) => {
          const end = polarPoint(index, items.length, radius, center);
          return <line key={index} x1={center} y1={center} x2={end.x} y2={end.y} className="stroke-border" strokeWidth="1" />;
        })}

        <polygon points={points(items, radius, center)} className="fill-accent/15 stroke-accent" strokeWidth="2.5" />

        {items.map((item, index) => {
          const dot = polarPoint(index, items.length, radius * Math.max(0, Math.min(100, item.score)) / 100, center);
          const label = polarPoint(index, items.length, labelRadius, center);
          const anchor = Math.abs(label.x - center) < 10 ? "middle" : label.x < center ? "end" : "start";
          const dy = label.y < center - 20 ? -4 : label.y > center + 20 ? 12 : 4;
          return (
            <g key={item.label}>
              <circle cx={dot.x} cy={dot.y} r="4" className="fill-accent stroke-card" strokeWidth="2" />
              <text x={label.x} y={label.y + dy} textAnchor={anchor} className="fill-foreground text-[12px] font-semibold">
                {item.label}
              </text>
              {showValues && (
                <text x={label.x} y={label.y + dy + 15} textAnchor={anchor} className="fill-muted-foreground text-[10px]">
                  {Math.round(item.score)}%
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
