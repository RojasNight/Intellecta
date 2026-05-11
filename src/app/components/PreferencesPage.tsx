import { Check } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { BRAND } from "./brand";
import { GENRES, GOALS, TOPICS } from "./data";
import { useAppContext } from "./Root";
import { useAuth } from "../auth/AuthContext";
import type { Preferences } from "./types";
import { PrimaryButton } from "./shared";
import {
  getUserPreferences,
  upsertUserPreferences,
  type UpdateUserPreferencesInput,
} from "../../services/preferencesService";

const DEFAULT_PREFERENCES: Preferences = {
  genres: [],
  topics: [],
  goals: [],
  complexityMin: 1,
  complexityMax: 5,
  excludedGenres: [],
};

const COMPLEXITY_OPTIONS = [1, 2, 3, 4, 5];

function uniqueClean(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function toEditablePreferences(preferences: Preferences | null): Preferences {
  return preferences ?? DEFAULT_PREFERENCES;
}

function validationError(input: UpdateUserPreferencesInput): string | null {
  const genres = uniqueClean(input.genres);
  const topics = uniqueClean(input.topics);
  const goals = uniqueClean(input.goals);
  const excludedGenres = uniqueClean(input.excludedGenres);

  const complexityMin = Number(input.complexityMin);
  const complexityMax = Number(input.complexityMax);

  if (!Number.isFinite(complexityMin) || !Number.isFinite(complexityMax)) {
    return "Укажите корректный диапазон сложности";
  }

  if (complexityMin < 1 || complexityMax > 5) {
    return "Сложность должна быть в диапазоне от 1 до 5";
  }

  if (complexityMin > complexityMax) {
    return "Минимальная сложность не может быть больше максимальной";
  }

  const excluded = new Set(excludedGenres);
  const conflict = genres.find((genre) => excluded.has(genre));
  if (conflict) {
    return `Жанр «${conflict}» нельзя одновременно выбрать и исключить`;
  }

  if (topics.some((topic) => topic.length > 80) || goals.some((goal) => goal.length > 80)) {
    return "Проверьте длину выбранных тем и целей";
  }

  return null;
}

export function PreferencesPage() {
  const navigate = useNavigate();
  const { preferences, setPreferences } = useAppContext();
  const { user, profile, loading: authLoading } = useAuth();
  const [step, setStep] = useState(0);
  const [genres, setGenres] = useState<string[]>(preferences?.genres ?? []);
  const [topics, setTopics] = useState<string[]>(preferences?.topics ?? []);
  const [goals, setGoals] = useState<string[]>(preferences?.goals ?? []);
  const [cMin, setCMin] = useState<number>(preferences?.complexityMin ?? DEFAULT_PREFERENCES.complexityMin);
  const [cMax, setCMax] = useState<number>(preferences?.complexityMax ?? DEFAULT_PREFERENCES.complexityMax);
  const [excluded, setExcluded] = useState<string[]>(preferences?.excludedGenres ?? []);
  const [loadingPreferences, setLoadingPreferences] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const toggle = <T,>(arr: T[], v: T) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const steps = [
    "Жанры", "Темы", "Цели", "Сложность", "Исключения",
  ];

  const currentInput = useMemo<UpdateUserPreferencesInput>(() => ({
    genres: uniqueClean(genres),
    topics: uniqueClean(topics),
    goals: uniqueClean(goals),
    complexityMin: cMin,
    complexityMax: cMax,
    excludedGenres: uniqueClean(excluded),
  }), [genres, topics, goals, cMin, cMax, excluded]);

  useEffect(() => {
    let mounted = true;

    async function loadPreferences() {
      if (authLoading) return;

      if (!user) {
        setPreferences(null);
        setGenres([]);
        setTopics([]);
        setGoals([]);
        setCMin(DEFAULT_PREFERENCES.complexityMin);
        setCMax(DEFAULT_PREFERENCES.complexityMax);
        setExcluded([]);
        setLoadError("Войдите, чтобы сохранить профиль чтения");
        setLoadingPreferences(false);
        return;
      }

      setLoadingPreferences(true);
      setLoadError(null);
      setFormError(null);
      setSavedAt(null);

      setPreferences(null);
      setGenres([]);
      setTopics([]);
      setGoals([]);
      setCMin(DEFAULT_PREFERENCES.complexityMin);
      setCMax(DEFAULT_PREFERENCES.complexityMax);
      setExcluded([]);

      try {
        const savedPreferences = await getUserPreferences(user.id);
        if (!mounted) return;

        const editable = toEditablePreferences(savedPreferences);
        setPreferences(savedPreferences);
        setGenres(editable.genres);
        setTopics(editable.topics);
        setGoals(editable.goals);
        setCMin(editable.complexityMin);
        setCMax(editable.complexityMax);
        setExcluded(editable.excludedGenres);
      } catch (err) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : "Не удалось загрузить предпочтения";
        setLoadError(message);
      } finally {
        if (mounted) setLoadingPreferences(false);
      }
    }

    loadPreferences();

    return () => {
      mounted = false;
    };
  }, [authLoading, user?.id, setPreferences]);

  const save = async () => {
    if (!user) {
      setFormError("Войдите, чтобы сохранить профиль чтения");
      toast.error("Войдите, чтобы сохранить профиль чтения");
      return;
    }

    const error = validationError(currentInput);
    if (error) {
      setFormError(error);
      toast.error(error);
      return;
    }

    setSaving(true);
    setFormError(null);
    setSavedAt(null);

    try {
      const savedPreferences = await upsertUserPreferences(currentInput);
      setPreferences({
        genres: savedPreferences.genres,
        topics: savedPreferences.topics,
        goals: savedPreferences.goals,
        complexityMin: savedPreferences.complexityMin,
        complexityMax: savedPreferences.complexityMax,
        excludedGenres: savedPreferences.excludedGenres,
      });
      setSavedAt(savedPreferences.updatedAt ?? new Date().toISOString());
      toast.success("Предпочтения сохранены");
      navigate("/recommendations");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось сохранить предпочтения";
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loadingPreferences) {
    return (
      <main className="max-w-3xl mx-auto px-4 md:px-8 py-10">
        <div className="rounded-2xl border p-6" style={{ background: "white", borderColor: BRAND.beige }}>
          <div className="font-serif" style={{ color: BRAND.navy, fontSize: 24 }}>
            Загружаем профиль чтения…
          </div>
          <p style={{ color: BRAND.slate, marginTop: 8 }}>
            Проверяем сохраненные предпочтения в Supabase.
          </p>
        </div>
      </main>
    );
  }

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

      {loadError && (
        <div className="mt-4 rounded-xl border px-4 py-3" style={{ borderColor: "#D18A8A", background: "#FFF7F7", color: "#7A2D2D" }} role="alert">
          {loadError}
        </div>
      )}

      {formError && (
        <div className="mt-4 rounded-xl border px-4 py-3" style={{ borderColor: "#D18A8A", background: "#FFF7F7", color: "#7A2D2D" }} role="alert">
          {formError}
        </div>
      )}

      {savedAt && !formError && (
        <div className="mt-4 rounded-xl border px-4 py-3" style={{ borderColor: BRAND.beige, background: "white", color: BRAND.slate }} role="status">
          Предпочтения сохранены в Supabase.
        </div>
      )}

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
                type="button"
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
            <Chips items={GENRES} selected={genres} onToggle={(v) => setGenres((s) => toggle(s, v))} disabled={saving} />
          </Group>
        )}
        {step === 1 && (
          <Group title="Темы, которые вам интересны">
            <Chips items={TOPICS} selected={topics} onToggle={(v) => setTopics((s) => toggle(s, v))} disabled={saving} />
          </Group>
        )}
        {step === 2 && (
          <Group title="Цели чтения">
            <Chips items={GOALS} selected={goals} onToggle={(v) => setGoals((s) => toggle(s, v))} disabled={saving} />
          </Group>
        )}
        {step === 3 && (
          <Group title="Желаемый уровень сложности" hint="От 1 (легко) до 5 (профессиональный)">
            <div className="flex items-center gap-4 flex-wrap">
              <label style={{ color: BRAND.slate, fontSize: 14 }}>
                от
                <select
                  value={cMin}
                  onChange={(e) => setCMin(parseInt(e.target.value, 10))}
                  className="ml-2 rounded-md border px-2 py-1"
                  style={{ borderColor: BRAND.lightGray }}
                  disabled={saving}
                >
                  {COMPLEXITY_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label style={{ color: BRAND.slate, fontSize: 14 }}>
                до
                <select
                  value={cMax}
                  onChange={(e) => setCMax(parseInt(e.target.value, 10))}
                  className="ml-2 rounded-md border px-2 py-1"
                  style={{ borderColor: BRAND.lightGray }}
                  disabled={saving}
                >
                  {COMPLEXITY_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>
          </Group>
        )}
        {step === 4 && (
          <Group title="Исключённые жанры/темы" hint="Это не появится в рекомендациях">
            <Chips items={GENRES} selected={excluded} onToggle={(v) => setExcluded((s) => toggle(s, v))} disabled={saving} />
          </Group>
        )}

        <div className="flex items-center justify-between mt-8 gap-4">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0 || saving}
            style={{ color: step === 0 || saving ? BRAND.lightGray : BRAND.slate }}
            type="button"
          >
            ← Назад
          </button>
          {step < steps.length - 1 ? (
            <PrimaryButton onClick={() => setStep(step + 1)} disabled={saving}>Дальше</PrimaryButton>
          ) : (
            <PrimaryButton onClick={save} disabled={saving}>
              {saving ? "Сохраняем…" : "Сохранить"}
            </PrimaryButton>
          )}
        </div>
      </div>
    </main>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
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
  disabled = false,
}: {
  items: string[];
  selected: string[];
  onToggle: (v: string) => void;
  disabled?: boolean;
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
            disabled={disabled}
            type="button"
            className="rounded-full border"
            style={{
              padding: "6px 14px",
              background: active ? BRAND.navy : "white",
              borderColor: active ? BRAND.navy : BRAND.lightGray,
              color: active ? "white" : BRAND.charcoal,
              fontSize: 13,
              opacity: disabled ? 0.65 : 1,
            }}
          >
            {it}
          </button>
        );
      })}
    </div>
  );
}
