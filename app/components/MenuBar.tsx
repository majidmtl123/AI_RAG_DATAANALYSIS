"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/excel", label: "Excel Analysis" },
  { href: "/screenshot", label: "Screenshot Analysis" },
];

export function MenuBar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-line bg-paper/90 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-2.5 lg:px-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-mono text-sm font-semibold tracking-tight text-ink">
            data<span className="text-accent">/</span>analyst
          </span>
        </Link>
        <ul className="flex items-center gap-1 overflow-x-auto">
          {LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap rounded-md px-2.5 py-1 text-sm transition-colors ${
                    active
                      ? "bg-ink text-paper"
                      : "text-muted hover:bg-card hover:text-ink"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
