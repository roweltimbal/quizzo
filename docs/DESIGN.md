# Quizzo — Design System

Quizzo turns a book chapter into a quiz you play solo or live with friends. The look is soft and friendly: a faint lavender canvas, white cards with big rounded corners, one violet for actions, and pastel tints to tell books apart. It should feel like a calm study app, not a game show.

This is a small first system, made from mood references (soft pastel learning dashboards) rather than an existing brand, so there is no logo yet: the app name is set in plain type (Plus Jakarta Sans, 800 weight).

## Voice

- Short, plain, encouraging. "Nice work — 4 of 6." not "AMAZING!!! 🎉".
- Buttons are verbs in sentence case: "Upload book", "Play solo", "Host room", "Submit".
- Feedback points to the book: "See p. 98." Never blame the player.
- No emoji in UI text.

## Visual foundations

- **Canvas and cards.** Pages sit on `canvas`; content sits on `surface` cards with `radius-lg` and `shadow-card`. Padding `space-4` on mobile, `space-6` on desktop.
- **One action color.** `brand` violet is for the one main action on a screen (a primary button), progress, links and focus. Everything else stays neutral.
- **Tints are for books, not states.** Each book card takes one of `tint-lilac`, `tint-peach`, `tint-mint`, `tint-pink`, assigned in order and repeating. Text on tints is always `ink` or `ink-muted`.
- **Right and wrong.** Correct uses `success` / `success-soft` with a ✓ icon; incorrect uses `error` / `error-soft` with a ✗ icon. The icon is required — never rely on green vs. red alone.
- **Type.** One family, Plus Jakarta Sans (Google Fonts, weights 400–800). `title` for screen titles, `heading` for card titles and questions, `body` for answers and text, `label` for buttons and chips, `caption` for meta. `room-code` only for the lobby code (QZ-4821). Use `display` sparingly, for the Result score.
- **Shape.** Buttons and chips are pills (`radius-pill`). Answer options use `radius-md`. Inputs use `radius-sm`.
- **Mobile first.** Design at 390px wide; tap targets at least 44px tall.

## Components (build these in the app, with Tailwind)

- **Button.** Height 48px, `radius-pill`, `label` text, padding `space-6` sideways. Primary: `brand` fill, `on-brand` text, `brand-strong` on press. Secondary: `brand-soft` fill, `brand-strong` text. Only one primary per screen. Disabled: 40% opacity.
- **Answer option.** Full-width row, min height 56px, `radius-md`, `body` text, `space-4` padding, `space-2` gap between options.
  - At rest: `surface` fill, 1px `line-strong` border.
  - Selected: `brand-soft` fill, 2px `brand` border.
  - Correct (Result): `success-soft` fill, 2px `success` border, ✓ on the right.
  - Incorrect (Result): `error-soft` fill, 2px `error` border, ✗ on the right.
  - Locked (live, after answering): selected style plus an "Answer locked" `caption`.
- **Card.** `surface`, `radius-lg`, `shadow-card`. A book card uses a tint fill instead of `surface`, with the title in `heading` and page count in `caption` `ink-muted`.
- **Text input.** Height 48px (or 120px for the short-answer box), `surface` fill, 1px `line-strong` border, `radius-sm`; focus = 2px `brand` border.
- **Progress bar.** 8px tall pill: track `brand-soft`, fill `brand`. Shown with "3/6" in `label` beside it.
- **Chip.** Pill, 32px tall, `label` text. At rest `surface` with `line` border; selected `ink` fill with `surface` text (used for the chapter list and player strip).
- **Player strip (live).** A row of chips: "Drew 3/5".
- **Room code.** `room-code` style in `ink`, centered on a `brand-soft` card; tap to copy.

## Focus and accessibility

- Keyboard focus: 2px `brand` ring with a 2px `surface` gap.
- All text pairs meet 4.5:1 (checked: `ink-muted` on every tint is at least 5.2:1; `on-brand` on `brand` is 6.1:1).
- Control edges use `line-strong` (3.5:1), not `line`.

## Using this system in code

Map the tokens to the Tailwind theme (CSS variables named after each token, e.g. `--brand`, `--radius-lg`), then use only those names in components. Don't add new colors or one-off radii; if something is missing, add a token here first.

## Tokens as CSS variables

Put these in the app's global stylesheet and expose them in the Tailwind theme (e.g. `bg-[var(--brand)]` or theme keys named after the tokens). Load the font with Google Fonts: Plus Jakarta Sans, weights 400–800.

```css
:root {
  --canvas: #F6F4FB;
  --surface: #FFFFFF;
  --ink: #1C1830;
  --ink-muted: #5F5A74;
  --line: #E6E2F0;
  --line-strong: #8A84A0;
  --brand: #5B3DF5;
  --brand-strong: #4B2FD6;
  --brand-soft: #EEE9FF;
  --on-brand: #FFFFFF;
  --tint-lilac: #E9E3FF;
  --tint-peach: #FFE8D6;
  --tint-mint: #DDF5EA;
  --tint-pink: #FCE4EC;
  --success: #1A7A4C;
  --success-soft: #DFF5E8;
  --error: #B42B3D;
  --error-soft: #FDE6E8;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --radius-sm: 12px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-pill: 999px;
  --shadow-card: 0 1px 2px rgba(28,24,48,0.06), 0 8px 24px rgba(28,24,48,0.06);
  --font-sans: "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
}
```

## Type scale

| Style | Size / line | Weight |
|---|---|---|
| `room-code` | 56px / 60px | 800 |
| `display` | 40px / 44px | 700 |
| `title` | 28px / 34px | 700 |
| `heading` | 20px / 28px | 600 |
| `body` | 16px / 24px | 400 |
| `label` | 14px / 20px | 600 |
| `caption` | 12px / 16px | 500 |
