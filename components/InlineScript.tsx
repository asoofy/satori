"use client";

/**
 * An inline script that runs during HTML parsing on full page loads, without React's
 * dev warning about <script> tags rendered on the client (it becomes inert text/plain there).
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
