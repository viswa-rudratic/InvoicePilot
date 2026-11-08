import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'InvoicePilot - AI Invoice Agent for Freelancers',
  description: 'AI-assisted invoicing with PayPal Sandbox human-in-the-loop approval',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="antialiased min-h-screen bg-slate-50 text-slate-900"
      >
        {children}
      </body>
    </html>
  );
}
