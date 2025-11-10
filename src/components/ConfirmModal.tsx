import { useEffect } from "react";

type Props = {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  open,
  title = "Potvrzení",
  message,
  confirmText = "Ano",
  cancelText = "Zrušit",
  onConfirm,
  onCancel
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onConfirm, onCancel]);

  if (!open) return null;

  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999
  };
  const box: React.CSSProperties = {
    width: 420,
    background: "#fff",
    borderRadius: 6,
    boxShadow: "0 10px 30px rgba(0,0,0,.25)",
    padding: 18,
    color: "#111",
    fontFamily: "sans-serif"
  };

  return (
    <div style={overlay} onClick={onCancel}>
      <div style={box} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>{title}</h3>
        <p style={{ marginTop: 0 }}>{message}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onCancel}>{cancelText}</button>
          <button onClick={onConfirm} style={{ background: "#c5000b", color: "#fff" }}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}