import Link from "next/link";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

// Dark action control for the AppHeader `actions` slot.
//
// Renders a Next <Link> when given `href`, or a <button> when given `onClick`
// (a discriminated union — exactly one is required). Icon-only by default;
// passing `label` adds the responsive label (hidden on mobile, shown from
// `sm:`) and lets the control grow to fit, matching the existing header
// button markup class-for-class.
//
// Deliberately NOT a client component: it stays server-renderable so a Server
// Component page (e.g. history) can use the <Link> form without pushing a
// client boundary. The onClick form is only used from parents that are already
// client components.

type HeaderActionButtonBaseProps = {
  icon: LucideIcon;
  // Optional responsive label. When present the control shows text from `sm:`
  // up and grows (`sm:w-auto sm:px-4`); when absent it stays a square icon.
  label?: string;
  // Tooltip / accessible name. Kept explicit so each call site reproduces its
  // current `title` attribute exactly.
  title?: string;
};

type HeaderActionButtonProps = HeaderActionButtonBaseProps &
  (
    | { href: string; onClick?: never }
    | { onClick: () => void; href?: never }
  );

export function HeaderActionButton(props: HeaderActionButtonProps) {
  const { icon: Icon, label, title } = props;

  const className = clsx(
    "flex h-10 w-10 items-center justify-center rounded-xl border border-slate-600 bg-slate-900 text-sm font-medium text-white hover:bg-slate-700",
    label && "gap-2 sm:w-auto sm:px-4",
  );

  const content = (
    <>
      <Icon size={16} />
      {label ? <span className="hidden sm:inline">{label}</span> : null}
    </>
  );

  if (props.href !== undefined) {
    return (
      <Link href={props.href} title={title} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={props.onClick} title={title} className={className}>
      {content}
    </button>
  );
}
