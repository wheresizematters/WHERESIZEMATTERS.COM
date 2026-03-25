import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* SEO */}
        <title>SIZE. — Where Size Matters</title>
        <meta name="description" content="Verify your size via AI, earn $SIZE tokens, launch DickCoins, and compete on the global leaderboard. SocialFi on Base." />

        {/* Open Graph */}
        <meta property="og:title" content="SIZE. — Where Size Matters" />
        <meta property="og:description" content="Verify your size via AI, earn $SIZE tokens, launch DickCoins, and compete on the global leaderboard. SocialFi on Base." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://wheresizematters.com" />
        <meta property="og:site_name" content="SIZE." />
        <meta property="og:image" content="https://wheresizematters.com/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SIZE. — Where Size Matters" />
        <meta name="twitter:description" content="Verify your size via AI, earn $SIZE tokens, launch DickCoins, and compete on the global leaderboard." />
        <meta name="twitter:image" content="https://wheresizematters.com/og-image.png" />

        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="application-name" content="SIZE." />
        <meta name="theme-color" content="#0A0A0A" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* iOS PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="SIZE." />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icon.png" />

        {/* Canonical */}
        <link rel="canonical" href="https://wheresizematters.com" />

        <ScrollViewStyleReset />
        <style>{`
          @font-face {
            font-family: 'Ionicons';
            src: url('/Ionicons.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
          }
          html, body, #root { background-color: #0A0A0A; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
