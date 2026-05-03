import './globals.css';
import { LanguageProvider } from '@/context/LanguageContext';

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
    <html lang="es" dir="ltr">
      <body className="bg-[#f6f8fb]">
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
