import clsx from "clsx";

// Shared footer for the two-button Modal dialogs: a muted Cancel on the left
// and a primary Confirm/Save on the right, right-aligned.
//
// Reproduces the existing footer markup class-for-class. The confirm tone
// covers the three primaries already in use:
//   * primary — slate-800 (most modals: shift, station, …)
//   * dark    — slate-900 (destructive-adjacent confirms: sign out)
//   * danger  — red-600  (destructive: reset / clear)
// Each tone carries its existing paired hover + disabled-opacity so migrated
// modals stay pixel-identical.
//
// Out of scope (kept feature-specific): footers with a left-aligned Reset /
// Delete button, bordered cancels, mixed-in form controls, or icon/summary
// content — their markup diverges from this canonical two-button shape.

const CONFIRM_TONE = {
  primary: "bg-slate-800 hover:bg-slate-700 disabled:opacity-30",
  dark: "bg-slate-900 hover:bg-slate-800 disabled:opacity-60",
  danger: "bg-red-600 hover:bg-red-500 disabled:opacity-40",
} as const;

export type ModalFooterProps = {
  onCancel: () => void;
  cancelLabel?: string;
  cancelDisabled?: boolean;
  onConfirm: () => void;
  confirmLabel: string;
  confirmDisabled?: boolean;
  confirmTone?: keyof typeof CONFIRM_TONE;
  // When true the confirm button is disabled and shows `loadingLabel`.
  confirmLoading?: boolean;
  loadingLabel?: string;
};

export function ModalFooter({
  onCancel,
  cancelLabel = "Cancel",
  cancelDisabled,
  onConfirm,
  confirmLabel,
  confirmDisabled,
  confirmTone = "primary",
  confirmLoading = false,
  loadingLabel,
}: ModalFooterProps) {
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={cancelDisabled}
        className="rounded-lg px-4 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-40"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={confirmDisabled || confirmLoading}
        className={clsx(
          "rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors",
          CONFIRM_TONE[confirmTone],
        )}
      >
        {confirmLoading && loadingLabel ? loadingLabel : confirmLabel}
      </button>
    </div>
  );
}
