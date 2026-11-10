export function Marquee({ items, tone = "rust" }: { items: string[]; tone?: "rust" | "line" }) {
  const row = [...items, ...items];
  return (
    <div className={`relative overflow-hidden whitespace-nowrap border-y ${tone === "rust" ? "border-rust bg-rust" : "border-line bg-surface"}`}>
      <div className="animate-marquee flex w-max">
        {[row, row].map((r, k) => (
          <ul key={k} className="flex shrink-0" aria-hidden={k === 1}>
            {r.map((t, i) => (
              <li key={i} className="mono flex items-center gap-6 px-6 py-3 text-micro font-bold uppercase tracking-[0.14em]">
                {t}
                <span className={tone === "rust" ? "text-bone/50" : "text-rust"}>✦</span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
