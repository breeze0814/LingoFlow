type TooltipIconButtonProps = {
  ariaLabel: string;
  children: React.ReactNode;
  disabled?: boolean;
  isActive?: boolean;
  isPrimary?: boolean;
  onClick: () => void;
  tooltip: string;
  size?: 'normal' | 'small';
};

export function IconTranslate() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 8l6 6" />
      <path d="M4 14l6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2v3" />
      <path d="M22 22l-5-10-5 10" />
      <path d="M14 18h6" />
    </svg>
  );
}

export function IconCopy() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function IconErase() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 21h10" />
      <path d="M5.636 5.636a9 9 0 0 0 0 12.728l.707.707L12 13.414l5.657 5.657.707-.707a9 9 0 0 0 0-12.728L12 12 5.636 5.636z" />
    </svg>
  );
}

export function IconPin() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 17 4 4" />
      <path d="M9 4.5 19.5 15l-3 1-3.5-3.5L9.5 16l-1.5-1.5 3.5-3.5L8 7.5l1-3Z" />
    </svg>
  );
}

export function IconChevronDown() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function IconChevronUp() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

export function TooltipIconButton(props: TooltipIconButtonProps) {
  const classNames = [
    'ocrIconBtn',
    props.size === 'small' ? 'ocrIconBtnSmall' : '',
    props.isPrimary ? 'ocrIconBtnPrimary' : '',
    props.isActive ? 'ocrIconBtnActive' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classNames}
      aria-label={props.ariaLabel}
      data-tooltip={props.tooltip}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}
