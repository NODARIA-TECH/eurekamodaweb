export default function LegalPage({
  title,
  updated = '6 de noviembre de 2026',
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="page">
      <div className="wrap legal">
        <div className="page-head">
          <span className="lab">Información legal</span>
          <h1>{title}</h1>
          <p>Última actualización: {updated}</p>
        </div>
        <div className="legal-body">{children}</div>
      </div>
    </main>
  );
}
