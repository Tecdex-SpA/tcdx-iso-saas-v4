import './globals.css';
export const metadata = {
  title: 'TCDX Compliance',
  description: 'Sistema de cumplimiento',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-[#1b2733]">
        {children}
      </body>
    </html>
  );
}
