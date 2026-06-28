"use client";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en" translate="no" className="notranslate h-full">
      <body className="notranslate flex min-h-dvh flex-col items-center justify-center gap-4 bg-neutral-950 px-4 text-center text-neutral-300">
        <h1 className="text-lg font-semibold text-white">Something went wrong</h1>
        <p className="max-w-md text-sm leading-relaxed">
          Chrysty Ledger hit an unexpected error. If your browser is translating this page,
          turn off auto-translate and reload — translation can break the app.
        </p>
        {error.digest ? (
          <p className="text-xs text-neutral-500">Error ID: {error.digest}</p>
        ) : null}
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-950"
        >
          Reload app
        </button>
      </body>
    </html>
  );
}
