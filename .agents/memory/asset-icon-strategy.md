---
name: Asset icon library strategy
description: Which icon library and icon name to use for each investment asset type; known MDI type-definition gaps.
---

## Icon assignments per asset type

| Asset type     | Library                  | Icon name        | Notes |
|----------------|--------------------------|------------------|-------|
| gold           | MaterialCommunityIcons   | `gold`           | Gold bar shape — works perfectly |
| silver         | Feather                  | `disc`           | Round coin shape — MDI `coin` is NOT in the installed type definition |
| stock          | Feather                  | `trending-up`    | Better than `bar-chart-2` for directional stocks |
| real_estate    | MaterialCommunityIcons   | `home-city`      | Building with city backdrop |
| personal_asset | MaterialCommunityIcons   | `tag-multiple`   | Tags for misc assets |
| fixed_income   | MaterialCommunityIcons   | `bank-transfer`  | Bank/bond feel |

## MDI type-definition gaps (installed version)

- `coin` — NOT in the type map; causes TS2322. Use Feather `disc` instead for a coin/round shape.
- Always double-check new MDI icon names by running typecheck; the glyph map is large but not exhaustive for every MDI icon.

## Mixed-library tab bar pattern

When a component uses both Feather and MDI icons (e.g., markets.tsx tab bar), use a union discriminated type:

```ts
type TabIconSpec =
  | { lib: 'feather'; name: keyof typeof Feather.glyphMap }
  | { lib: 'mci'; name: string };

function TabIcon({ spec, size, color }) {
  if (spec.lib === 'mci') return <MaterialCommunityIcons name={spec.name as any} size={size} color={color} />;
  return <Feather name={spec.name} size={size} color={color} />;
}
```

Use `as any` on the MDI name when you're confident the icon exists at runtime but it isn't in the type definition.

## Reusable component

`components/AssetIcon.tsx` — accepts `type: AssetType` and renders the right icon from the right library.
Used in: HoldingCard.tsx (all types except personal_asset, which uses user-chosen Feather icon from `holding.icon`).

**Why:**
- Feather's icon set has no bullion/metal-specific icons — `award` (trophy) and `circle` (dot) were semantically wrong for gold/silver.
- MaterialCommunityIcons has `gold` (literal gold bar icon), making it the right library for precious metals.
