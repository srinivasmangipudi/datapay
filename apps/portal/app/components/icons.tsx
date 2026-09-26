// Line icons for the portal, hand-drawn from simple geometry rather than
// pulled from a pack — same posture as SystemDiagram and the marketing
// page's step icons. All inherit `currentColor` and share a 24x24 box and
// 1.7 stroke so they sit together evenly wherever they're used.

interface IconProps {
  size?: number;
}

function Svg({ size = 22, children }: IconProps & { children: React.ReactNode }): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Households / members. */
export function IconUsers(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5a5.5 5.5 0 0111 0" />
      <path d="M16 5.2a3.2 3.2 0 010 5.8" />
      <path d="M17.5 14.6a5.5 5.5 0 013 4.9" />
    </Svg>
  );
}

/** A token — a coin around the ◈ the product already uses for token counts. */
export function IconToken(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.6l3.1 4.4-3.1 4.4-3.1-4.4z" />
    </Svg>
  );
}

/** The reward pool. A bank facade, not a safe — a dial-and-door safe turns
    into an unreadable aperture once it's down at 22px. */
export function IconVault(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M3.5 9.2L12 4l8.5 5.2" />
      <path d="M3.5 20.5h17" />
      <path d="M6.2 12v5.6M10.1 12v5.6M13.9 12v5.6M17.8 12v5.6" />
    </Svg>
  );
}

/** Aggregated demand — bars rising. */
export function IconChart(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M3.5 20.5h17" />
      <path d="M6.5 20.5v-6M11 20.5V8M15.5 20.5v-4M20 20.5V11" />
    </Svg>
  );
}

/** Nothing here yet — an open, empty tray. */
export function IconInbox(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M3.5 13.5h4l1.5 3h6l1.5-3h4" />
      <path d="M5.8 5.2h12.4l2.3 8.3v4a2 2 0 01-2 2H5.5a2 2 0 01-2-2v-4z" />
    </Svg>
  );
}

/** Privacy / the k-anonymity floor. */
export function IconShield(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M12 3l7.5 3v5.2c0 4.6-3.1 8.1-7.5 9.8-4.4-1.7-7.5-5.2-7.5-9.8V6z" />
      <path d="M9 12l2.2 2.2L15.2 10" />
    </Svg>
  );
}
