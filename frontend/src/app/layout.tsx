import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';

const inter = Inter({ 
  subsets: ['latin'], 
  variable: '--font-inter',
  display: 'swap',
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900']
});

export const metadata: Metadata = {
  title: 'MLA — Election Management System',
  description: 'Centralized digital platform for campaign management, voter surveys, and constituency intelligence.',
};

import { Toaster } from 'react-hot-toast';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const savedTheme = localStorage.getItem('theme');
                  // Set default theme to light mode as requested
                  const theme = savedTheme || 'light';
                  document.documentElement.classList.add(theme === 'dark' ? 'dark' : 'light');
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} font-inter antialiased tracking-tight bg-white dark:bg-dark-950 transition-colors duration-300`}>
        <AuthProvider>
          <ThemeProvider>
            {children}
            <Toaster 
              position="top-right"
              reverseOrder={false}
              toastOptions={{
                duration: 4000,
                style: {
                  background: 'var(--toast-bg)',
                  color: 'var(--toast-color)',
                  fontSize: '13px',
                  fontWeight: '600',
                  borderRadius: '16px',
                  padding: '12px 20px',
                  border: '1px solid var(--toast-border)',
                  boxShadow: 'var(--toast-shadow)',
                  fontFamily: 'var(--font-inter)',
                  maxWidth: '400px',
                },
                success: {
                  iconTheme: {
                    primary: '#f97316',
                    secondary: '#fff',
                  },
                },
                error: {
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
