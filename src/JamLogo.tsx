/** Jam jar mark shared by the app wordmark, footer, and install dialog. */
export default function JamLogo({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="6" y="2.5" width="12" height="4" rx="1.5" />
      <path d="M7 6.5v2c0 1.5-2 2-2 4v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-6c0-2-2-2.5-2-4v-2" />
      <path d="M5.5 12h13M5.5 18h13" opacity=".3" />
      <path
        d="M10.5 13.5C8 12 8.5 16.5 12 18c3.5-1.5 4-6 1.5-4.5-.8-.6-2.2-.6-3 0Z"
        fill="currentColor"
        stroke="none"
      />
      <path d="M12 13.5c0-1.5 1-2.5 2.3-2.5" strokeWidth="1.3" />
    </svg>
  );
}
