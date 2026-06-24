import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col justify-center overflow-y-auto px-4 py-10 lg:px-6">
      <div className="max-w-2xl">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.25em] text-accent">
          data/analyst
        </p>
        <h1 className="mt-2 text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
          Ask your data anything.
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          Two universal AI tools that turn raw data into real answers — computed,
          not guessed. Pick a source to start.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:max-w-4xl">
        <ToolCard
          href="/excel"
          eyebrow="Spreadsheets"
          title="Excel Analysis"
          body="Upload an .xlsx or .csv workbook. One tool reads every sheet, builds a data dictionary, and answers questions with sandbox-computed numbers."
          points={["Totals, trends, comparisons", "Conversational follow-ups", "7-part business report"]}
        />
        <ToolCard
          href="/screenshot"
          eyebrow="Images & Dashboards"
          title="Screenshot Analysis"
          body="Upload screenshots of dashboards, reports, tables, or charts. OCR extracts the data, then AI structures it for natural-language querying."
          points={["OCR text & table extraction", "Chart & KPI interpretation", "Direct answers + actions"]}
        />
      </div>
    </div>
  );
}

function ToolCard({
  href,
  eyebrow,
  title,
  body,
  points,
}: {
  href: string;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border border-line bg-card p-5 shadow-sm transition-colors hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
    >
      <span className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-muted">
        {eyebrow}
      </span>
      <h2 className="mt-1 text-xl font-semibold text-ink group-hover:text-accent">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
      <ul className="mt-4 flex flex-col gap-1">
        {points.map((p) => (
          <li key={p} className="flex items-center gap-2 font-mono text-[0.78rem] text-ink">
            <span className="text-accent">›</span>
            {p}
          </li>
        ))}
      </ul>
      <span className="mt-5 font-mono text-sm text-accent">Open →</span>
    </Link>
  );
}
