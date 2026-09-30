"use client";

// Last-resort boundary for errors in a root layout. It replaces the whole
// document, so it brings its own <html>/<body> and inline styles (globals.css
// isn't loaded here).
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          fontFamily: "system-ui, sans-serif",
          background: "#0a0a0a",
          color: "#fff",
          textAlign: "center",
          padding: 24,
        }}
      >
        <title>RepOne — something went wrong</title>
        <h1 style={{ margin: 0 }}>Something went wrong</h1>
        <p style={{ margin: 0, opacity: 0.7 }}>The app couldn&apos;t load. Try again.</p>
        {error.digest && (
          <p style={{ margin: 0, fontSize: 12, opacity: 0.5 }}>Reference: {error.digest}</p>
        )}
        <button
          onClick={() => retry()}
          style={{
            padding: "12px 24px",
            border: 0,
            borderRadius: 8,
            background: "#e11d2e",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
