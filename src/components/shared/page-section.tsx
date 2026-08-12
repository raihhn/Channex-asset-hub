import type { ReactNode } from "react";

type PageSectionProps = {
  eyebrow?: string;
  title: string;
  children: ReactNode;
};

export function PageSection({ eyebrow, title, children }: PageSectionProps) {
  return (
    <section
      className="page-section"
      aria-labelledby={title.toLowerCase().replaceAll(" ", "-")}
    >
      <header className="page-section__header">
        {eyebrow ? <p className="page-section__eyebrow">{eyebrow}</p> : null}
        <h2 id={title.toLowerCase().replaceAll(" ", "-")}>{title}</h2>
      </header>
      {children}
    </section>
  );
}
