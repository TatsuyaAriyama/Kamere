import { useEffect, useState } from "react";
import { useToastStore } from "../../store/useToastStore";

export default function Toast() {
  const message = useToastStore((s) => s.message);
  const token = useToastStore((s) => s.token);
  const clear = useToastStore((s) => s.clear);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const hide = window.setTimeout(() => setVisible(false), 1500);
    const drop = window.setTimeout(() => clear(), 1800);
    return () => {
      window.clearTimeout(hide);
      window.clearTimeout(drop);
    };
  }, [token, message, clear]);

  if (!message) return null;
  return (
    <div className={`toast${visible ? " is-visible" : ""}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}
