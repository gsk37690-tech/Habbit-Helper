import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#273b43",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "QuestLife – RPG Habit Tracker & Quest Calendar",
  description: "Gamify your habits, organize daily rituals, and plan upcoming adventures with QuestLife's RPG quest board and visual calendar schedule.",
  keywords: ["habit tracker", "RPG gamification", "quest calendar", "daily habits", "schedule planner", "productivity RPG", "QuestLife", "interactive calendar"],
  authors: [{ name: "QuestLife" }],
  creator: "QuestLife",
  publisher: "QuestLife",
  applicationName: "QuestLife",
  metadataBase: new URL("https://questlife.app"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "QuestLife – RPG Habit Tracker & Quest Calendar",
    description: "Gamify your habits, organize daily rituals, and plan upcoming adventures with QuestLife's RPG quest board and visual calendar schedule.",
    type: "website",
    siteName: "QuestLife",
    locale: "en_US",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "QuestLife – RPG Habit Tracker & Quest Calendar",
    description: "Gamify your habits, organize daily rituals, and plan upcoming adventures with QuestLife's RPG quest board and visual calendar schedule.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": "https://questlife.app/#app",
      "name": "QuestLife",
      "applicationCategory": "ProductivityApplication",
      "operatingSystem": "All",
      "description": "Gamify your habits, organize daily rituals, and plan upcoming adventures with QuestLife's RPG quest board and visual calendar schedule.",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
      },
      "featureList": [
        "Interactive RPG Quest Board",
        "Visual Monthly Quest Calendar and Schedule",
        "Daily Habit and Ritual Tracker",
        "Consecutive Streak Flame Tracker",
        "Character Progression and Level Mastery",
        "Achievements and Inventory Rewards",
      ],
    },
    {
      "@type": "SoftwareApplication",
      "name": "QuestLife Calendar",
      "applicationCategory": "ScheduleApplication",
      "operatingSystem": "All",
      "description": "Visual monthly quest calendar and habit schedule to view active missions, deadlines, and daily achievements.",
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
