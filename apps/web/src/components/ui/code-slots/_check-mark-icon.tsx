export function CheckMarkIcon({
  size = 26,
  strokeWidth = 2.4,
}: {
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 14L8.5 17.5L19 6.5" />
    </svg>
  );
}
