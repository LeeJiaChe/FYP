import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "TAR UMT Bus Booking & Real-Time Management System",
  description: "Campus Bus Seat Booking, QR Boarding & Real-Time Fleet Occupancy System",
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#080d1a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full theme-dark" data-theme="dark" suppressHydrationWarning>
      <body className="font-sans min-h-full flex flex-col antialiased">
        <ThemeProvider>
          {children}
          <Toaster 
            position="bottom-center" 
            toastOptions={{ 
              style: { 
                background: 'var(--bg-card)', 
                color: 'var(--text-primary)', 
                border: '1px solid var(--border)' 
              } 
            }} 
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
