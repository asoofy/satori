/** Satori's mark: an ensō, the brush-drawn circle of Zen calligraphy. */
export function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <path
        d="M36.5 10.5c-4-3.3-9.8-4.6-15.2-3.1C12.6 9.8 6.9 18.4 8.2 27.2c1.3 9 9.6 15.2 18.7 14.2 8.6-.9 14.6-8.2 14.2-16.5-.2-4.1-1.9-7.7-4.4-10.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <circle cx="37.6" cy="12" r="2.6" fill="currentColor" />
    </svg>
  );
}
