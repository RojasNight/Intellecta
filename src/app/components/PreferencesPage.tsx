import { Check } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { BRAND } from "./brand";
import { GENRES, GOALS, TOPICS } from "./data";
import { useAppContext } from "./Root";
import { useAuth } from "../auth/AuthContext";
import type { Preferences } from "./types";
import { PrimaryButton } from "./shared";

export function PreferencesPage() {
  const navigate = useNavigate();
  const { preferences, setPreferences } = useAppContext();
  const { profile } = useAuth();
  const [step, setStep] = useState(0);
  const [genres, setGenres] = useState<string[]>(preferences?.genres ?? []);
  const [topics, setTopics] = useState<string[]>(preferences?.topics ?? []);
  const [goals, setGoals] = useState<string[]>(preferences?.goals ?? []);
  const [cMin, setCMin] = useState<number>(preferences?.complexityMin ?? 1);
  const [cMax, setCMax] = useState<number>(preferences?.complexityMax ?? 3);
  const [excluded, setExcluded] = useState<string[]>(preferences?.excludedGenres ?? []);

  const toggle = <T,>(arr: T[], v: T) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const steps = [
    "Жанры", "Темы", "Цели", "Сложность", "Исключения",
  ];

  const save = () => {
    // TODO: Stage 10 - save preferences to Supabase user_preferences for profile?.id.
    setPreferences({ genres, topics, goals, complexityMin: cMin, complexityMax: cMax, excludedGenres: excluded });
    toast.success("Предпочтения сохранены");
    navigate("/recommendations");
  };

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 py-10">
      <div style={{ color: BRAND.slate, fontSize: 13, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        Шаг {step + 1} из {steps.length}
      </div>
      <h1 className="font-serif text-balance" style={{ color: BRAND.navy, fontSize: 32, marginTop: 6 }}>
        Ваши читательские предпочтения
      </h1>
      <p style={{ color: BRAND.slate, marginTop: 6, lineHeight: 1.6 }}>
        Это поможет объяснять рекомендации точнее. Можно изменить позже в профиле.
        {profile?.email ? ` Аккаунт: ${profile.email}.` : ""}
      </p>
      <div
        className="mt-4 h-1.5 rounded-full overflow-hidden"
        style={{ background: BRAND.beige }}
        aria-hidden
      >
        <div
          style={{
            width: `${((step + 1) / steps.length) * 100}%`,
            height: "100%",
            background: BRAND.navy,
            transition: "width .3s ease",
          }}
        />
      </div>

      <ol className="flex items-center gap-2 mt-8 flex-wrap" aria-label="Шаги">
        {steps.map((s, i) => {
          const active = i === step;
          const done = i < step;
          return (
            <li key={s} className="flex items-center gap-2">
              <button
                onClick={() => setStep(i)}
                className="rounded-full inline-flex items-center justify-center"
                style={{
                  width: 28,
                  height: 28,
                  background: active ? BRAND.navy : done ? BRAND.slate : BRAND.beige,
                  color: active || done ? "white" : BRAND.slate,
                  fontSize: 13,
                }}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check size={14} /> : i + 1}
              </button>
              <span style={{ color: active ? BRAND.navy : BRAND.slate, fontSize: 13 }}>{s}</span>
              {i < steps.length - 1 && <span style={{ color: BRAND.lightGray }}>—</span>}
            </li>
          );
        })}
      </ol>

      <div
        className="mt-8 rounded-2xl border p-6"
        style={{ background: "white", borderColor: BRAND.beige }}
      >
        {step === 0 && (
          <Group title="Любимые жанры" hint="Выберите один или несколько">
            <Chips items={GENRES} selected={genres} onToggle={(v) => setGenres((s) => toggle(s, v))} />
          </Group>
        )}
        {step === 1 && (
          <Group title="Темы, которые вам интересны">
            <Chips items={TOPICS} selected={topics} onToggle={(v) => setTopics((s) => toggle(s, v))} />
          </Group>
        )}
        {step === 2 && (
          <Group title="Цели чтения">
            <Chips items={GOALS} selected={goals} onToggle={(v) => setGoals((s) => toggle(s, v))} />
          </Group>
        )}
        {step === 3 && (
          <Group title="Желаемый уровень сложности" hint="От 1 (легко) до 4 (профессиональный)">
            <div className="flex items-center gap-4">
              <label style={{ color: BRAND.slate, fontSize: 14 }}>
                от
                <select
                  value={cMin}
                  onChange={(e) => setCMin(parseInt(e.target.value))}
                  className="ml-2 rounded-md border px-2 py-1"
                  style={{ borderColor: BRAND.lightGray }}
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label style={{ color: BRAND.slate, fontSize: 14 }}>
                до
                <select
                  value={cMax}
                  onChange={(e) => setCMax(parseInt(e.target.value))}
                  className="ml-2 rounded-md border px-2 py-1"
                  style={{ borderColor: BRAND.lightGray }}
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>
          </Group>
        )}
        {step === 4 && (
          <Group title="Исключённые жанры/темы" hint="Это не появится в рекомендациях">
            <Chips items={GENRES} selected={excluded} onToggle={(v) => setExcluded((s) => toggle(s, v))} />
          </Group>
        )}

        <div className="flex items-center justify-between mt-8">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            style={{ color: step === 0 ? BRAND.lightGray : BRAND.slate }}
          >
            ← Назад
          </button>
          {step < steps.length - 1 ? (
            <PrimaryButton onClick={() => setStep(step + 1)}>Дальше</PrimaryButton>
          ) : (
            <PrimaryButton onClick={save}>Сохранить</PrimaryButton>
          )}
        </div>
      </div>
    </main>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-serif" style={{ color: BRAND.navy, fontSize: 20 }}>{title}</div>
      {hint && <div style={{ color: BRAND.slate, fontSize: 13, marginTop: 4 }}>{hint}</div>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Chips({
  items,
  selected,
  onToggle,
}: {
  items: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => {
        const active = selected.includes(it);
        return (
          <button
            key={it}
            onClick={() => onToggle(it)}
            aria-pressed={active}
            className="rounded-full border"
            style={{
              padding: "6px 14px",
              background: active ? BRAND.navy : "white",
              borderColor: active ? BRAND.navy : BRAND.lightGray,
              color: active ? "white" : BRAND.charcoal,
              fontSize: 13,
            }}
          >
            {it}
          </button>
        );
      })}
    </div>
  );
}
