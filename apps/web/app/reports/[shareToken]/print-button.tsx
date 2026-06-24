"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden rounded-md border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-100 transition hover:border-neutral-500"
    >
      Print / Save as PDF
    </button>
  );
}
