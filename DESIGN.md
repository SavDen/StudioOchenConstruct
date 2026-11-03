---
name: "Сборка"
description: "A restrained SVG composition editor extending the prepared library."
colors:
  ink: "#263c33"
  muted: "#596a60"
  surface: "#ffffff"
  chrome: "#f5f6f2"
  line: "#dde2d9"
  accent: "#d7e7a9"
  accent-strong: "#304c3e"
  hover: "#edf1e8"
  focus: "#5c7862"
  danger: "#9f3c36"
typography:
  wordmark: {fontFamily: "Georgia, serif", fontSize: "27px", fontWeight: 400}
  headline: {fontFamily: "Avenir Next, Trebuchet MS, sans-serif", fontSize: "20px", fontWeight: 600}
  body: {fontFamily: "Avenir Next, Trebuchet MS, sans-serif", fontSize: "14px", fontWeight: 450}
  action: {fontFamily: "Avenir Next, Trebuchet MS, sans-serif", fontSize: "13px", fontWeight: 600}
  label: {fontFamily: "Avenir Next, Trebuchet MS, sans-serif", fontSize: "12px", fontWeight: 500}
rounded:
  tag: "4px"
  compact: "6px"
  control: "8px"
  popover: "10px"
spacing:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary: {backgroundColor: "{colors.ink}", textColor: "{colors.surface}", rounded: "{rounded.control}", padding: "9px 14px"}
  button-quiet: {backgroundColor: "transparent", textColor: "{colors.ink}", rounded: "{rounded.control}", padding: "9px 14px"}
---

# Design System: Сборка

## Overview
Operate editor inheriting the existing SVG catalog's green chrome, pale working surfaces, Avenir Next controls and Georgia wordmark. The current composition leads; controls support selection and repeated editing.
This record reflects source inspection, not browser screenshots.

## Colors
Editor colors are independent from the three supplied illustration palettes. Ink anchors primary actions; muted supports secondary copy; line separates panels; hover and accent mark interaction. Danger is reserved for deletion/errors.

## Typography
Use the 14px base, 20px task heading, 13px action/section labels and 12px supporting controls. Functional text has a 12px floor. Phone task heading is 18px; wordmark is 24px. The subtitle is hidden on phones.
Zero-size responsive labels are replaced by visible icons or the SVG export label; they are not a text-size role.

## Layout
Desktop: 76px header, 282px prompt/library column, flexible canvas with 360px minimum, 248px inspector.
At 1600px: side columns become 310px and 270px.
At 1190px: 248px / flexible minimum 300px / 218px.
At 960px: inspector moves below the two-column workspace.
At 680px: prompt, canvas, library, inspector form a vertical flow. The library has four columns; inspector has two with layers spanning both. Header is 66px. Undo, redo, project menu and export remain available.
At 370px: gaps and header controls tighten.
Artboard preserves composition proportions. The dotted working ground and transparency checkerboard indicate the actual editing canvas.

## Elevation & Depth
Panels primarily use borders and tones. Artboard: 0 12px 32px #263c331c. Project menu: 0 10px 30px #263c3326. Toast: 0 8px 20px #263c3326.

## Shapes
Controls and asset buttons use 8px corners; segmented controls 6px; tags 4px. Palette selectors and add markers are circular. The rectangular artboard follows the selected format.

## Components
Primary actions use ink/white; quiet actions use transparent fill and a border. Keyboard focus uses a 3px outline with a 3px offset. Disabled actions use .38 opacity.
Library buttons contain actual SVGs. Selection and layers identify the active subject; role changes select the existing main/background source variant.
Scale range expands to include generated/imported percentages before assigning the thumb value.
The project menu remains available on phones with an accessible icon summary.
State transitions last 150ms and are disabled for reduced motion. Status messages use polite live regions.

## Do's and Don'ts
- Preserve source geometry, source versions and original artwork palettes.
- Keep the artboard prominent and controls familiar.
- Keep functional text at least 12px and keyboard focus visible.
- Keep project operations available on phones.
- Do not invent decorative illustration objects.
- Do not treat source inspection or composition PNGs as browser UI verification.
