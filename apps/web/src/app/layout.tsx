import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlameEye | AI fire and smoke detection",
  description: "AI fire and smoke detection for the cameras and DVR systems your sites already use."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
