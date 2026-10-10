# Design Map

Source: https://acoustics.autoneum.com/ (1440×900, single page; the site is one 100vh WebGL stage with no scroll)

## Spacing Scale
- Edge inset of corner chrome: 42px (logo left, MENU right), logo baseline y≈49px
- Title block: centred, title at y≈107–118px, lede 2 lines on 18px line-height
- Stepper nodes: 5 nodes, ~68px vertical pitch, along the left arc
- Stage ring: ~960px diameter, centred on the car

## Font Hierarchy
| Role | Family | Size | Tracking | Case |
|------|--------|------|----------|------|
| Screen title | Bebas | 28px / 50.4px | 0.18em | upper |
| Nav label (stepper, MENU) | Bebas | 20px | 0.15em | upper |
| Option label | Bebas | 16px | 0.15em | upper |
| Eyebrow ("STEP 1") | Bebas | 14px / 18.2px | 0.35em | upper |
| Status line | DIN | 13px / 20.8px | 0.2em | upper |
| Lede | DIN | 10px / 18px | 0.18em | upper |
| Utility (language) | Montserrat | 10–11px / 20px | 0.15em | upper |

## Color Palette
- Background `rgb(16, 21, 26)`
- Overlay bar `#090909`
- Text `#FFFFFF`, hierarchy by opacity: 1 (active), 0.8, 0.6 (MENU, CONTACT US), 0.4, 0.3 (future steps)
- Accent `#BAC529` (logo, active language)
- Accent-muted text `#C2CB88` (selected option label)

## Image Ratios
- No raster images. One full-bleed WebGL2 canvas (1800×1125 at 1.25 dpr) plus a 440×440 2D canvas widget

## Component Tokens
- Radius: 2px (small controls), 15px (pill buttons, cookie bar), 9999px (stepper nodes, ring)
- Node ring: `0 0 0 2px #FFF`
- Active node glow: `inset 0 0 0 2px #FFF, 0 0 8px 4px rgba(255,255,255,.15), inset 0 0 8px 4px rgba(255,255,255,.15)`
- Motion: reveal `opacity 2s cubic-bezier(.215,.61,.355,1)`; move `transform .6s cubic-bezier(.25,.46,.45,.94)`; fade `opacity .5s cubic-bezier(.455,.03,.515,.955)`
- Grid: none; four-corner chrome around a centred circular stage
- Missing: no `:focus-visible` rules, no `prefers-reduced-motion` handling

---

# Taste DNA

### Drawn in light, not modelled
- **Trigger**: When the car had to carry the whole first screen
- **Decision**: A dark stage where the car exists only as glowing strokes, over a shaded, textured 3D model
- **Reason**: The subject is sound, which nobody can see; light-trails read as energy moving through the body, which a photoreal car would hide behind paint
- **Evidence**: `rgb(16, 21, 26)` stage, full-bleed WebGL2 canvas, outline strokes in white + `#BAC529` with a faint floor reflection, zero `<img>` on the page

### The circle is the navigation
- **Trigger**: When five sequential steps (Body style → Engine → Presets → Customize → Calculate) needed a progress UI
- **Decision**: Nodes strung along a ~960px ring around the car, over a top tab bar or a linear sidebar
- **Reason**: The ring frames the object and the journey at once; the eye never leaves the car to check where it is
- **Evidence**: 5 circular nodes ~68px apart on the left arc; the current option ("HATCHBACK") pinned to the right arc; active node gets the inset ring + 8px/4px glow

### One accent, the rest is white at volume levels
- **Trigger**: When the UI needed hierarchy across title, active, upcoming and disabled states
- **Decision**: Pure `#FFFFFF` at opacity 1 / 0.8 / 0.6 / 0.4 / 0.3 plus a single lime, over a grey ramp or a multi-colour state palette
- **Reason**: Opacity on a dark stage dims like a fader on a mixing desk; every state stays one hue, so the lime only ever means "brand" or "selected"
- **Evidence**: the only text colour on the page is `rgb(255,255,255)`; MENU / CONTACT US at 0.6; future steps ~0.3; lime appears on the logo, active language and (muted `#C2CB88`) the selected option

### Instrument-panel labelling
- **Trigger**: When setting even the explanatory sentence under the title
- **Decision**: Uppercase tracked type everywhere (10px DIN at 0.18em for the lede), over sentence-case body copy
- **Reason**: Short tracked caps read like labels on hardware; the page asks you to tune, not to read
- **Evidence**: Bebas 28px/0.18em title, Bebas 14px/0.35em eyebrow, DIN 10px/1.8px lede; only the cookie bar uses normal case

---

# Pitwall adaptation

What we take, what we change, and why.

| Theirs | Pitwall docs |
|--------|--------------|
| Lime `#BAC529` | F1 red `#E10600` with white; swap in `site/src/styles/global.css` |
| `rgb(16, 21, 26)` stage | carbon black `rgb(21, 21, 30)` |
| Car drawn in light, engine through the body, drivable | A CC BY F1 model (`public/models/car.glb`) in near-black paint lit only by a turning matcap of thin strips, plus bloom: the streaks follow the real surfaces. On the Lap stage the body goes see-through and a V6 (`engine.glb`) comes apart, one labelled part per step of a lap. A Drive button gives keyboard / touch control, a chase camera, a speed gauge and shift lights. See `site/design/README.md` |
| Stepper on the ring, options on the right arc | Hero: the loop's stages as nodes, each with its own camera pose; that stage's commands stacked on the right arc. Docs pages: plain left sidebar |
| Bebas / DIN | Bebas Neue (display) + Barlow (DIN-like, body) + JetBrains Mono (code); all OFL |
| Uppercase everywhere | Uppercase only for labels, nav and headings. Docs body is sentence case at 17px, since docs get read, not tuned |
| No focus / reduced-motion | Add both: `:focus-visible` ring with the glow token; the hero falls back to a static SVG ring under `prefers-reduced-motion` |
| Their models, textures, code, copy, logo | Not used; only the techniques above |
