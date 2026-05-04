import { BRAND } from "./brand";
import { getSupabaseHealth } from "../../lib/supabaseHealth";

export function SupabaseStatus() {
  if (!import.meta.env.DEV) return null;

  const status = getSupabaseHealth();

  return (
    <div
      className="mt-5 rounded-xl border px-4 py-3"
      style={{ background: "white", borderColor: BRAND.beige }}
      aria-label="Статус подключения Supabase"
    >
      <div style={{ color: BRAND.slate, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Только для разработки
      </div>
      <div style={{ color: status.configured ? "#2E5E37" : "#8C2A2A", marginTop: 4 }}>
        {status.configured ? "Supabase подключен" : "Supabase не настроен"}
      </div>
    </div>
  );
}
