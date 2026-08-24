import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { ThemeProvider, type ThemeId } from "@/lib/theme";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "TAR UMT Shuttle Management System",
  description: "Journey reservation, QR boarding validation, fleet operations and simulated GPS tracking prototype",
  formatDetection: {
    telephone: false,
  },
};

export async function generateViewport(): Promise<Viewport> {
  const cookieStore = await cookies();
  const isDark = cookieStore.get("fyp-theme")?.value !== "light";
  return {
    themeColor: isDark ? "#0b0e12" : "#f3f1ed",
    width: "device-width",
    initialScale: 1,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const savedTheme = cookieStore.get("fyp-theme")?.value;
  const initialTheme: ThemeId = savedTheme === "light" ? "light" : "dark";

  return (
    <html lang="en" className={`h-full theme-${initialTheme}`} data-theme={initialTheme}>
      <body className="font-sans min-h-full flex flex-col antialiased">
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <ThemeProvider initialTheme={initialTheme}>
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
