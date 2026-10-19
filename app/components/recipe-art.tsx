// Generated photographic references, never evidence of an actual preparation.
export default function RecipeArt({
  meal = "Almuerzo",
  name = "",
}: {
  variant?: number;
  meal?: string;
  name?: string;
}) {
  const title = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const kind = /sopa|crema|caldo/.test(title)
    ? "soup"
    : /pescado|atun/.test(title)
      ? "fish"
      : meal === "Desayuno" && /avena|yogur|papaya|fruta|panqueque/.test(title)
        ? "fruit"
        : meal === "Desayuno"
          ? "eggs"
          : !/pollo|carne/.test(title) &&
              /quinoa|lenteja|garbanzo|vegetal|frijol|tortilla espanola/.test(
                title,
              )
            ? "vegetables"
            : "chicken";
  return <div className={`dish-photo dish-${kind}`} aria-hidden="true" />;
}
