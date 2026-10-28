import { cssToken as token } from "../css-token";
export { token };

/** Mark colours offered in Markup, in swatch order. */
export const markInks = () =>
  (
    [
      ["Lavender", "--paint-glow"],
      ["Rose", "--paint-rose"],
      ["Mint", "--paint-mint"],
      ["Moon", "--paint-moon"],
      ["White", "--paint-paper"],
      ["Ink", "--paint-ink"],
    ] as const
  ).map(([name, variable]) => ({ name, color: token(variable) }));
