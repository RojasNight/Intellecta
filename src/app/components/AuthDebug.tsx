import { BRAND } from "./brand";
import { useAuth } from "../auth/AuthContext";

export function AuthDebug() {
  const { isAuthenticated, profile, role, loading } = useAuth();

  if (!import.meta.env.DEV) return null;

  return (
    <div
      className="rounded-xl border p-4 mt-4"
      style={{ background: "white", borderColor: BRAND.beige, color: BRAND.slate, fontSize: 13 }}
    >
      <div style={{ color: BRAND.navy, fontWeight: 600 }}>Auth debug</div>
      <div>Авторизован: {isAuthenticated ? "да" : "нет"}</div>
      <div>Email: {profile?.email ?? "—"}</div>
      <div>Роль: {role}</div>
      <div>Профиль загружен: {profile ? "да" : "нет"}</div>
      <div>Загрузка: {loading ? "да" : "нет"}</div>
    </div>
  );
}
