export function FlameMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="lypo-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#E8542F" />
          <stop offset="100%" stopColor="#F4A340" />
        </linearGradient>
      </defs>
      <path
        d="M20 2 C 11 14, 5 24, 12 36 C 17 44, 27 44, 30 35 C 33 41, 39 39, 38 30 C 37 17, 28 8, 20 2 Z"
        fill="url(#lypo-flame)"
      />
    </svg>
  );
}