import { Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Recipe } from "@/features/recipes/types";

const UNIT_RX =
  /(мл|л|гр|г|кг|шт|штук(?:а|и)?|порц(?:ия|ии|ий)?|порц|ст\.л|ч\.л|уп|кап(?:ля|ли|ель)|дольк(?:а|и|ек)|слайс(?:а|ов)?|лист(?:а|ьев)?|зерн(?:о|а|ёрен)|веточк(?:а|и|ек)|палочк(?:а|и|ек)|зубчик(?:а|ов)?|ломтик(?:а|ов)?|кус(?:ок|ка|ков)|дэш(?:а|ей)?|dash(?:es)?)/i;

function parseIngredient(line: string) {
  const expression = new RegExp(
    `(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_RX.source})\\.?`,
    "i"
  );
  const match = line.match(expression);

  if (!match || match.index == null) return null;

  const value = Number(match[1].replace(",", "."));
  if (!Number.isFinite(value)) return null;

  return {
    value,
    numberIndex: match.index,
    numberEnd: match.index + match[1].length
  };
}

function formatNumber(value: number) {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return String(rounded).replace(".", ",");
}

function scaleLine(line: string, multiplier: number) {
  const parsed = parseIngredient(line);
  if (!parsed) return line;

  return (
    line.slice(0, parsed.numberIndex) +
    formatNumber(parsed.value * multiplier) +
    line.slice(parsed.numberEnd)
  );
}

function parsePortions(value: string) {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function isCalculable(recipe: Recipe) {
  return (
    /(настой|кордиал|заготовк)/i.test(
      `${recipe.category} ${recipe.subcategory}`
    ) && recipe.ingredients.some((line) => parseIngredient(line) != null)
  );
}

export function RecipeCalculator({ recipe }: { recipe: Recipe }) {
  const [rawPortions, setRawPortions] = useState("1");
  const portions = parsePortions(rawPortions);

  const scaled = useMemo(
    () =>
      recipe.ingredients.map((line) => scaleLine(line, portions)),
    [portions, recipe.ingredients]
  );

  function step(delta: number) {
    const next = Math.max(
      0,
      Math.round((portions + delta) * 100) / 100
    );
    setRawPortions(formatNumber(next));
  }

  return (
    <section
      aria-labelledby="recipe-calculator-title"
      className="rounded-2xl border border-[color:color-mix(in_srgb,var(--bf-copper-hi),transparent_72%)] bg-[color:color-mix(in_srgb,var(--bf-copper),transparent_92%)] p-4"
    >
      <p className="eyebrow">МАСШТАБИРОВАНИЕ</p>
      <h2
        id="recipe-calculator-title"
        className="mt-1 text-xl font-extrabold"
      >
        Количество порций
      </h2>
      <p className="mt-1 text-sm leading-5 text-[var(--bf-muted)]">
        Меняется только число. Названия и единицы остаются как в техкарте.
      </p>

      <div className="mt-4 grid grid-cols-[44px_1fr_44px] gap-2">
        <Button
          type="button"
          size="icon"
          aria-label="Уменьшить количество порций"
          onClick={() => step(-0.5)}
        >
          <Minus className="size-4" aria-hidden />
        </Button>

        <label className="sr-only" htmlFor="recipe-portions">
          Количество порций
        </label>
        <Input
          id="recipe-portions"
          value={rawPortions}
          inputMode="decimal"
          autoComplete="off"
          className="text-center font-extrabold"
          onChange={(event) => {
            const next = event.target.value
              .replace(/[^\d.,]/g, "")
              .replace(/([.,].*)[.,]/g, "$1");
            setRawPortions(next);
          }}
          onBlur={() => setRawPortions(formatNumber(portions))}
        />

        <Button
          type="button"
          size="icon"
          aria-label="Увеличить количество порций"
          onClick={() => step(0.5)}
        >
          <Plus className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="mt-4 divide-y divide-[var(--bf-line)] border-y border-[var(--bf-line)]">
        {scaled.map((line, index) => (
          <div
            key={`${line}-${index}`}
            className="py-2.5 text-[15px] leading-6 text-[var(--bf-cream)]"
          >
            {line}
          </div>
        ))}
      </div>
    </section>
  );
}
