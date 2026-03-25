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
        <meta name="twitter:site" content="@wheresize" />

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
      <body>
        <noscript>
          <div style={{padding: '60px 24px', maxWidth: 720, margin: '0 auto', fontFamily: 'system-ui, sans-serif', color: '#f5f5f5', backgroundColor: '#0A0A0A'}}>
            <h1 style={{fontSize: 48, fontWeight: 900, letterSpacing: 4, color: '#E8500A'}}>SIZE.</h1>
            <p style={{fontSize: 20, color: '#a0a0a0', marginTop: 12}}>Where size matters.</p>
            <p style={{fontSize: 16, color: '#a0a0a0', marginTop: 24, lineHeight: 1.8}}>
              SIZE. is a men's SocialFi platform on Base where users verify their size via AI,
              earn and stake $SIZE tokens, launch personal memecoins (DickCoins), and compete
              on a global leaderboard. Sign in with Google or X to get started.
            </p>
            <p style={{marginTop: 24}}>
              <a href="/privacy" style={{color: '#a0a0a0', marginRight: 16}}>Privacy Policy</a>
              <a href="/terms" style={{color: '#a0a0a0'}}>Terms of Service</a>
            </p>
          </div>
        </noscript>
        {children}
      </body>
    </html>
  );
}
