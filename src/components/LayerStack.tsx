export type Layer = {
  key: string;
  label: string;
  value: number;
  color: string;
};

/**
 * The cost stacked like layers on a build plate: each cost line is a
 * band whose width is its share of the total.
 */
export function LayerStack({ layers, total }: { layers: Layer[]; total: number }) {
  const visible = layers.filter((l) => l.value > 0);
  const summary = visible
    .map((l) => `${l.label} ${Math.round((l.value / total) * 100)}%`)
    .join(", ");

  return (
    <div
      role="img"
      aria-label={total > 0 ? `Composición del costo: ${summary}` : "Sin costos cargados"}
      className="flex h-7 w-full overflow-hidden rounded-[4px] bg-[color:var(--l-failure)]/40"
    >
      {total > 0
        ? visible.map((l) => (
            <div
              key={l.key}
              style={{ width: `${(l.value / total) * 100}%`, background: l.color }}
              className="h-full min-w-[2px] transition-[width] duration-300 ease-out"
            />
          ))
        : null}
    </div>
  );
}
