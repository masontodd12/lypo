"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden rounded-full bg-flame px-6 py-2.5 text-sm font-medium text-paper transition hover:bg-flame-bright"
    >
      print poster
    </button>
  );
}
