import './globals.css';

export const metadata = {
  title: 'flowgent — AI Wizard UX patterns',
  description: 'Five UX contracts every AI-driven multi-step flow needs.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif',
          margin: 0,
          background: 'var(--bg)',
          color: 'var(--text)',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        {children}
      </body>
    </html>
  );
}
