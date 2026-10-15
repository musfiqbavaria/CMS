import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { MoreVertical } from "lucide-react";

export interface RowMenuItem {
  label: string;
  icon?: ReactNode;
  to?: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
  dividerBefore?: boolean;
}

const MENU_WIDTH = 192;
const MENU_MARGIN = 8;

/** Compact per-row actions dropdown rendered in a portal so table scroll
 *  containers can never clip it. Flips above the trigger near the viewport bottom. */
export default function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, above: false });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Measure after open so the menu lands under the trigger.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? items.length * 36 + 16;
    const below = rect.bottom + MENU_MARGIN + menuHeight;
    const above = below > window.innerHeight && rect.top - MENU_MARGIN - menuHeight > 0;
    setPos({
      top: above ? rect.top - MENU_MARGIN - menuHeight : rect.bottom + MENU_MARGIN,
      left: Math.max(MENU_MARGIN, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - MENU_MARGIN)),
      above,
    });
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    function close() {
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  return (
    <>
      <button
        ref={triggerRef}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        <MoreVertical size={16} />
      </button>
      {open &&
        createPortal(
          <>
            <div
              aria-hidden
              onMouseDown={() => setOpen(false)}
              className="fixed inset-0 z-40 cursor-default"
            />
            <div
              ref={menuRef}
            role="menu"
            style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
            className="fixed z-50 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-600 dark:bg-slate-800"
          >
            {items.map((item, i) => (
              <div key={`${item.label}-${i}`}>
                {item.dividerBefore && <div className="my-1 border-t border-slate-100 dark:border-slate-700" />}
                {item.to ? (
                  <Link
                    role="menuitem"
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ) : item.href ? (
                  <a
                    role="menuitem"
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    {item.icon}
                    {item.label}
                  </a>
                ) : (
                  <button
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      item.onClick?.();
                    }}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${
                      item.danger ? "text-red-600" : "text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                )}
              </div>
            ))}
          </div>
          </>,
          document.body,
        )}
    </>
  );
}
