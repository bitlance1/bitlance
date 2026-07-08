import type { Metadata } from "next";
import "./globals.css";
import GoogleAnalytics from "@/components/organisms/GoogleAnalytics";

const inter = {
  variable: "font-inter",
};

export const metadata: Metadata = {
  title: "Bitlance - Bitcoin Freelancing Platform",
  description: "Connect with Bitcoin-native freelancers and clients worldwide",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col font-inter">
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}
