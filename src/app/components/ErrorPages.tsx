import { Lock, ShieldAlert, SearchX, AlertTriangle } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { BRAND } from "./brand";
import { GhostButton, PrimaryButton } from "./shared";

interface Props {
  code: 401 | 403 | 404 | 500;
  reason?: string;
}

export function ErrorPage({ code, reason }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const traceId = "trace_" + Math.random().toString(36).slice(2, 10);

  const block = (() => {
    if (code === 401) {
      return {
        icon: <Lock size={28} />,
        title: "Необходима авторизация",
        text: "Войдите в аккаунт, чтобы продолжить покупку, сохранить избранное и получить персональные рекомендации.",
        actions: (
          <>
            <PrimaryButton onClick={() => navigate("/login", { state: { from: location } })}>Войти</PrimaryButton>
            <GhostButton onClick={() => navigate("/register", { state: { from: location } })}>Зарегистрироваться</GhostButton>
          </>
        ),
      };
    }
    if (code === 403) {
      return {
        icon: <ShieldAlert size={28} />,
        title: "Недостаточно прав",
        text: "Этот раздел доступен только администратору.",
        actions: <PrimaryButton onClick={() => navigate("/catalog")}>Вернуться в каталог</PrimaryButton>,
      };
    }
    if (code === 404) {
      return {
        icon: <SearchX size={28} />,
        title: "Страница или книга не найдена",
        text: "Возможно, ссылка устарела или книга была убрана из каталога.",
        actions: (
          <>
            <PrimaryButton onClick={() => navigate("/catalog")}>В каталог</PrimaryButton>
            <GhostButton onClick={() => navigate("/")}>На главную</GhostButton>
          </>
        ),
      };
    }
    return {
      icon: <AlertTriangle size={28} />,
      title: "Что-то пошло не так",
      text: "Мы уже знаем о проблеме и работаем над ней. Попробуйте обновить страницу или вернуться позже.",
      actions: <PrimaryButton onClick={() => navigate("/")}>На главную</PrimaryButton>,
    };
  })();

  return (
    <main className="max-w-2xl mx-auto px-4 md:px-8 py-16 md:py-24 text-center fade-in">
      <div
        className="mx-auto rounded-full inline-flex items-center justify-center"
        style={{ width: 64, height: 64, background: BRAND.beige, color: BRAND.navy }}
        aria-hidden
      >
        {block.icon}
      </div>
      <div
        className="font-serif mt-5"
        style={{ color: BRAND.navy, fontSize: 56, letterSpacing: "-0.02em", lineHeight: 1 }}
      >
        {code}
      </div>
      <h1 className="font-serif mt-3" style={{ color: BRAND.navy, fontSize: 28 }}>
        {block.title}
      </h1>
      <p className="text-balance" style={{ color: BRAND.slate, marginTop: 10, lineHeight: 1.6, maxWidth: 460, marginInline: "auto" }}>
        {reason || block.text}
      </p>
      <div className="mt-7 flex justify-center gap-3 flex-wrap">{block.actions}</div>
      <div style={{ color: BRAND.gray, fontSize: 12, marginTop: 18 }}>
        Идентификатор обращения: <code>{traceId}</code>
      </div>
    </main>
  );
}
