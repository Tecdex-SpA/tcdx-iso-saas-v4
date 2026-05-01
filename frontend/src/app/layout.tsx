import './globals.css';
export const metadata = {
  title: 'TCDX Compliance | ISO SaaS',
  description: 'Gobierno ISO, auditorías, evidencias, riesgos e IA senior.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-[#f6f8fb]">
        {children}
      </body>
    </html>
  );
}
