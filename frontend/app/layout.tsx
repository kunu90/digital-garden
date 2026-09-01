import type { Metadata } from "next";
import { Geist_Mono, Roboto } from "next/font/google";
import "material-symbols/outlined.css";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { MotionProvider } from "@/components/motion-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["100", "300", "400", "500", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-sans",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Digital Garden",
  description: "Your personal digital garden",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("antialiased font-sans", roboto.variable, fontMono.variable)}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>
          <MotionProvider>
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
