---
name: "Конструктор"
description: "A restrained SVG composition editor extending the prepared library."
colors:
  ink: "#181817"
  muted: "#4b4b4b"
  surface: "#ffffff"
  chrome: "#effafa"
  line: "#bee2e2"
  accent: "#ffd4f2"
  accent-strong: "#181817"
  hover: "#dbf2f2"
  focus: "#181817"
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
  example: "5px"
  search: "7px"
spacing:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary: {backgroundColor: "{colors.ink}", textColor: "{colors.surface}", rounded: "{rounded.control}", padding: "9px 14px"}
  button-quiet: {backgroundColor: "transparent", textColor: "{colors.ink}", rounded: "{rounded.control}", padding: "9px 14px"}
---

# Design System: Конструктор

## Overview
The Composition inspector now places a compact backdrop section after the palette. Two source previews select dots/lines or the table edge. Color comes from the shared scene palette, with no separate backdrop color control. Existing solid/transparent modes are retained under «Оформление». Source motifs use their S/L dimensions and corner anchors across aspect ratios. Visual verification is recorded in qa/backdrop-layout/desktop.png and mobile-controls.png; 106 tests passed, browser export and JSON retained the selection without changing subject poses, and the 390px document had no horizontal overflow.

Operate editor whose interface colors follow the selected original SVG palette. Typography and geometry retain the existing catalog's Avenir Next controls and Georgia wordmark. The current composition leads; controls support selection and repeated editing.
The v3 extension was checked in the browser at the actual 870px viewport, desktop 1365px and phone 390px. Screenshots: qa/ui-v3/. No horizontal overflow was observed at any checked width.

## Colors
Editor colors are derived from the selected original illustration palette: background.base supplies pale working surfaces, background.dark supplies the primary action, and source ink supplies body text. Lavender uses white button text; peach and aqua use source ink for contrast. Ink anchors primary actions; muted supports secondary copy; line separates panels; hover and accent mark interaction. Danger is reserved for deletion/errors.

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

## V2 control update
A rotation slider and ±15°/reset controls complement the exact angle input. Two pressed-state buttons mirror horizontally or vertically. The browser verified a book at 15° with a negative horizontal scale; changing to the lavender palette changed the primary action to rgb(120,100,215). Fifteen engine tests separately verify vector preservation, projects and transforms.

Theme token values in the frontmatter describe the default aqua CSS fallback. At runtime applyTheme derives pale surfaces by mixing the selected source background.base with white; source background.dark and ink determine actions. Authoritative source colors remain in library/palettes.json. Other supported palette families are lavender and peach. Canvas content intentionally meets the artboard edge; it must not receive padding.

## V3 placement controls
The context footer below scene scale uses a 13px bold scene title and 12px supporting relationship text. Remember/update actions reuse quiet buttons; the saved-layout badge and reset action appear only for a matching local template. Controls wrap below the explanation on phones. No new visual palette is introduced.

The selected-subject inspector uses a labelled position fieldset with X/Y number inputs, alongside the existing angle and mirror controls. X/Y inputs sit side by side on desktop and stack in the phone inspector. Values update the canvas during entry; change/blur commits one undoable edit. The semantic scene algorithm remains product logic rather than a visual token.

V3 evidence includes saved-layout restoration after regeneration/reload and direct coordinate editing in the browser. The separate 22-test engine suite covers 504 semantic arrangements and vector preservation. The review disposition was ship at the supplied source/screenshot scope. Documentation was completed by the primary agent after the documenter handoff was interrupted; this did not replace the independent finish review.

## V4 geometry correction
Geometry validation now uses disjoint object envelopes including authored shadows and rotation. Known subject pairs share layer and ground-edge constraints. Manual translation stops at the neighbor clearance; a colliding rotation is rejected. Existing visual tokens, layout and controls are unchanged. Browser evidence for the reported wide L book/lamp regression: qa/ui-v4/collision-fixed.jpg. A separate 27-test suite covers collision and vector invariants.

## V5 reference extension
Two labelled native selects continue the context footer: semantic focus and framing. They reuse the existing select-control typography, borders and focus states. The controls wrap from two columns without horizontal overflow; supporting copy remains 12px with 1.5 line height. The footer and framing row share a continuous toolbar surface: the footer's bottom padding supplies the inset before the framing labels, so the framing row has no additional top padding.

The artboard supports authored phone/book and puzzle/book contact and cropped close framing. Cropping is part of the composition, not a padded UI container; relative object scale and source geometry remain fixed. No new palette, font or decorative component was introduced. Verified browser screenshots: qa/ui-v5/1365.jpg, 870.jpg and 390.jpg. Interaction evidence includes manual focus selection and saved framing after regeneration/reload. Engine validation is separate: 34 tests.

## V6 publication and registry extension
V6 supersedes the older universal rectangle-collision and exact-point contact behavior. The label is now «Акцентный кадр». Contextual subjects use supplied background states when enabled; focus remains the dominant colored subject. Existing palette, wordmark, typography and editor chrome are preserved.

The local registry uses a Georgia34px title,14px explanatory copy,12px control labels and the existing source-palette surfaces. Labelled native selects wrap; three SVG previews stack on phones. A native100-cell matrix scrolls within its own region, with explicit row/column headers and labelled buttons. Both source-reference and visually assessed allowances are identified. Zone graphics are documentation overlays, not exported illustration objects. A quiet link below the editor framing controls opens the registry.

Publication composition uses the original SVGs, common scale, optical anchors and protected recognition regions. Camera numeric criteria are implementation settings, not normative design standards. Literature links live beside the rules in rules.html. Screenshots: qa/ui-v6/editor-1365.jpg,editor-870.jpg,editor-390.jpg andregistry equivalents; all actual viewport sizes match their names.41 engine tests and final3 focused regressions are separate from browser evidence. Live mouse dragging was not verified; coordinate and keyboard group movement were verified. Intentional detector exceptions remain the flush artboard and continuous framing-footer inset supplied by the preceding context row.

## V7 free editing and automatic depth
V7 preserves the incumbent visual tokens, layout and controls. Manual position, rotation, reflection and layer order are free; pointer release commits history without collision repair, and X/Y fields and arrow keys move without resolving overlaps. Reload, JSON import and new manual templates preserve placement. The top undo button and Ctrl/⌘ Z remain available; physical KeyZ supports the Russian keyboard layout. Automatic depth uses explicit back/front relationships independently of source color roles, including book-behind-lamp ordering across every role combination and the dense packing path.

Browser evidence in qa/ui-v7/ covers editor and registry at actual widths of 1365, 870 and 390px, with no horizontal overflow or JavaScript errors. Free coordinate overlap, undo, redo and persistence after reload were verified. Live pointer dragging remains unverified. Separate engine evidence is 45 passing tests, including 576 regular book/lamp configurations and 32 dense configurations across all color roles. This note supersedes the earlier manual collision constraints; it introduces no visual-world changes.

## V8 consolidated inspector
V8 supersedes the earlier editor layout descriptions while preserving the source-palette theme, typography and visual tokens. All scene settings share one inspector with Composition, Object and Layers ARIA tabs. Selecting an object opens Object; arrow keys and Home/End navigate tabs without moving artwork. The canvas retains only its caption, editing hint and guide button. Desktop uses a viewport-bounded three-column workspace with independently scrolling sidebars: 248px / flexible / 320px by default, 200px / flexible / 290px at 761–1100px, and 282px / flexible / 340px from 1600px. At 760px and below, the bounded settings panel precedes the canvas (460px panel maximum; 350px scrolling body maximum), with the library after it.

V8 browser evidence is qa/ui-v8/desktop.jpg (1365px), user-870.jpg (870px), mobile.jpg (390px) and object.jpg (1365px). Format, framing, tab keyboard navigation, layer selection opening Object, 15° rotation, mirroring, palette and backdrop changes were verified. No horizontal overflow, JavaScript errors or duplicate IDs were reported; the canvas region contains zero settings controls. App syntax passed and the final visual review found no UI issues. The engine is unchanged: its 45 passing tests are V7 evidence and were not rerun for this relocation. Live pointer dragging remains unverified. The detector launcher returned permission denied, so no detector pass is claimed. Detailed evidence: qa/settings-review.json.

## V9 placement grammar and writing focus
V9 preserves V8's interface world, visual tokens and source SVG geometry. The registry now exposes authored direction choices and actual separate-placement previews. Ten subject support profiles and 45 unique pair rules define 100 directed decisions. Valid surface contacts override separate-side rules and inherit their root group's placement; packing filters directions, context compaction preserves them and automatic output validates the result. These side choices are art direction measured from root centers, not physical simulation or a guarantee of publication quality. Manual edits remain unrestricted.

The eighth recipe, «Обучение письму», uses a main pen with a background book and no added lamp. «Собрать» restores automatic focus even for an unchanged query; «Пересобрать» and explicit manual focus preserve the user's choice. Framing protects readable pen width while measuring the supporting page's visible canvas coverage. Browser evidence confirms that both a changed query and the same query replace stale manual book focus with «Авто · Ручка». Screenshots in qa/ui-v9/ are writing-1365.jpg, writing-870.jpg, writing-390.jpg, rules-1365.jpg and rules-390.jpg; inspector scroll positions are intentional. No JavaScript errors were reported, and the 390px editor had no horizontal overflow.

The full V9 validation passed 50 tests, including 8,640 pair cases, 576 overview cases and 576 focus cases; eleven examples were rendered. The reviewer accepted the generated screens and source, with the final same-query focus fix resolved afterward. The original user screenshot could not be opened by the reviewer because file access was denied, so that comparison used its description. Live pointer dragging remains unverified. The detector was not rerun for this change; its prior launcher was unavailable and no detector pass is claimed.

## V10 horizontal reading order
V10 interprets «перед книгой» as left-to-right reading order: lamp LEFT, book RIGHT. The authored pair rule, its inverse and related lamp/object directions now agree; packing and validation enforce the left-side constraint. Z-order remains separate and unchanged. This supersedes any earlier interpretation of that phrase as depth. The 45-pair placement grammar, V8's consolidated inspector, unrestricted manual editing, source geometry and visual tokens remain in place. Direct manual coordinate assignment also retains the requested value more precisely. Remembered manual templates remain unconstrained only when their rulesVersion matches the current rules; stale templates are validated and repaired, so an old right-side lamp placement cannot be restored by an outdated template.

V10 supersedes V9's eighth writing recipe, special pen zoom/page-coverage exceptions and automatic query focus resets. The seven original recipes and designer-selected focus/framing are restored. The checked writing scene uses overview, book focus and background support disabled: book, lamp and pen are three main subjects, with the pen at its ordinary scale and the lamp left of the book (rendered centers approximately 274.85 and 819.72 respectively). Browser evidence is qa/ui-v10/desktop.jpg (1365px), user-870.jpg (870px) and mobile.jpg (390px); all three were visually reviewed. No JavaScript errors or horizontal overflow at 390px were reported. Full validation passed 51 tests, including 8,640 pair cases, 576 all-role book/lamp cases, 504 overview and 504 focus cases, plus 32 dense book/lamp cases; eleven examples were rendered. The fresh review disposition was ship with no UI fixes. Live pointer dragging remains unverified, and no detector run or pass is claimed for this change without CSS changes.


## V11 Gemini integration
Retain the existing editorial SVG workspace, typography, source palettes and inspector. A compact Gemini/keyword selector is added above the prompt. A temporary, hideable panel below it shows the last Gemini plan with a concise explanation, model/time/token metadata and collapsible JSON/prompt views. The model explanation describes a completed decision; internal chain-of-thought is not requested or displayed. Pending requests keep the canvas visible, have a stop button, and cannot overwrite a scene edited after submission. Errors and unavailable subjects preserve the canvas. Debug text is inserted as text, never rendered as model HTML.

V11 verification: the full57-test suite passed, then all6 targeted AI tests passed after the live Google schema correction. Browser checks confirmed real Gemini results, explicit unsupported-subject handling, cancellation without canvas changes, prompt/JSON disclosures and hiding the explanation panel. Screenshots are in qa/ui-v11/. At390px the document width was390px; no console errors were reported.


## Background visibility update
Gemini decides whether background objects help the request. Only an explicit text ban prohibits background roles. The inspector checkbox now controls showSupporting independently of model planning. Hiding preserves objects, transforms and scale, and excludes them from canvas and SVG export; JSON and layers retain them. Legacy scenes default to visible backgrounds. The old supporting field remains for the deterministic engine API and is not sent to Gemini as a restriction.


## V13 inspector and composition alternatives
The inspector now has Composition and Object tabs. Source palette comes first, followed by format, inline layer rows with visibility/reordering, three numbered arrangement alternatives with a visible construction principle, descriptive source-detail choices, backdrop, camera controls and scale. Empty-canvas clicks and Escape deselect and return to Composition.
Focus and framing use a serialized camera transform while item positions, roles, rotations, mirrors and layer order remain unchanged. Pointer coordinates are mapped through the inverse camera. Gemini returns exactly three strategy/title/principle definitions (balanced, spacious, diagonal), and the deterministic engine calculates three validated layouts. Switching layouts uses the saved plans locally and makes no additional model call. The ordinary engine retains its original support anchor; alternatives explicitly select other reviewed anchors.

V13 verification:65 automated tests passed. A real Gemini response supplied three construction principles. Browser checks confirmed3 distinct arrangement signatures, unchanged object transforms during focus/framing changes, object selection, Escape/empty-space return, per-layer hide/restore, no console errors, and no horizontal overflow at390px. Evidence: qa/ui-v13/. Live pointer dragging was not tested. The Impeccable context launcher could not run; context was read directly. No detector pass is claimed.


## Automatic main-object succession
Hiding the only visible main object promotes the first visible object below it in the displayed layer list. Hidden layers and globally hidden background objects are skipped. If there is no visible lower layer, the nearest visible upper layer is used. Promotion changes role and focus without rearranging item coordinates, transforms or layer order. Focus framing follows the new main object through the camera only. The visibility change and promotion are one undo action. If another main object remains visible, no promotion occurs; if nothing remains visible, no hidden layer is revealed. Restoring a hidden main object retains its stored role.


## Inspector simplification · 4 November 2026
The requested Arrangement, Environment, semantic-focus and framing blocks are removed from the Composition inspector. Palette import, backdrop, format/S/L, layers and object editing retain the incumbent visual tokens and behavior. This supersedes older descriptions of those removed controls; the composition engine and independent demonstration page are unchanged.
