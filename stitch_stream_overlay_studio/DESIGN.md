---
name: Broadcast Precision UI
colors:
  surface: '#111317'
  surface-dim: '#111317'
  surface-bright: '#37393e'
  surface-container-lowest: '#0c0e12'
  surface-container-low: '#1a1c20'
  surface-container: '#1e2024'
  surface-container-high: '#282a2e'
  surface-container-highest: '#333539'
  on-surface: '#e2e2e8'
  on-surface-variant: '#c9c4d8'
  inverse-surface: '#e2e2e8'
  inverse-on-surface: '#2f3035'
  outline: '#938ea1'
  outline-variant: '#484555'
  surface-tint: '#cabeff'
  primary: '#cabeff'
  on-primary: '#31009a'
  primary-container: '#947dff'
  on-primary-container: '#2a0088'
  inverse-primary: '#603ce2'
  secondary: '#6cffbf'
  on-secondary: '#003824'
  secondary-container: '#00e5a0'
  on-secondary-container: '#006141'
  tertiary: '#ffb780'
  on-tertiary: '#4e2600'
  tertiary-container: '#d7791f'
  on-tertiary-container: '#442000'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e6deff'
  primary-fixed-dim: '#cabeff'
  on-primary-fixed: '#1c0062'
  on-primary-fixed-variant: '#4816cb'
  secondary-fixed: '#47ffb8'
  secondary-fixed-dim: '#00e29e'
  on-secondary-fixed: '#002114'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdcc4'
  tertiary-fixed-dim: '#ffb780'
  on-tertiary-fixed: '#2f1400'
  on-tertiary-fixed-variant: '#6f3800'
  background: '#111317'
  on-background: '#e2e2e8'
  surface-variant: '#333539'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  data-mono:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
    letterSpacing: -0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.5rem
  margin: 0.75rem
  space-xs: 0.125rem
  space-sm: 0.25rem
  space-md: 0.5rem
  space-lg: 0.75rem
  space-xl: 1rem
---

## Brand & Style

This design system is engineered for a professional, high-performance desktop live-stream overlay studio and broadcast compositor. The aesthetic merges the spatial density and utilitarian rigor of digital audio workstations (DAWs) and CAD tools like Figma with the real-time operational clarity of OBS and broadcast switchers.

The interface prioritizes dark workspace focus: chrome elements recede into deep neutral tones, allowing user overlays, video viewports, and streaming canvas elements to command optical priority. High-stakes live actions (such as streaming states and active layer indicators) are punctuated with surgical, high-luminance functional signals. 

Visual style characteristics:
- **Compact Professional Utility:** Dense data presentation, minimal macro-padding, and direct manipulation tools.
- **Micro-tactile Precision:** Crisp 1px division lines, sub-pixel aligned micro-radii, and tactile input states designed for intensive mouse and keyboard-shortcut workflows.
- **Low Visual Fatigue:** Carefully graded charcoal surfaces minimize eye strain during extended multi-hour production sessions.

## Colors

The palette is engineered around dark-mode operational ergonomics:

- **Canvas Base (`#0F1115`):** The master ambient backdrop, used behind the viewport canvas, deep application gutters, and framing chrome.
- **Surface Panels (`#171A21`):** Applied to the docked sidebars, floating toolbars, inspector palettes, modal sheets, and header bars.
- **Structural Borders (`#262B36`):** The primary delineator for docked panel splits, segmented controllers, input bounds, and structural grid rules.
- **Sub-surface Troughs (`#12141A`):** Recessed wells for numeric inputs, scrubbers, canvas ruler tracks, and layer hierarchy trees.
- **Primary Violet Accent (`#7C5CFF`):** Dedicated to active selection bounds, marquee transform handles, primary actions, active tool selection, and drag-and-drop drop-targets.
- **Live On-Air Emerald (`#00E5A0`):** Reserved exclusively for live telemetry, active camera signals, "On Air" stream toggles, audio gain peaks within safe zones, and confirmed live output sync.
- **Primary Typography (`#E6E8EE`):** Crisp high-contrast off-white for layer labels, parameter values, and active interface indicators.
- **Secondary Typography (`#8B93A7`):** Neutral slate tone for field labels, hotkey badges, axis labels (X, Y, W, H), and passive indicators.
- **Warning & Hazard (`#FF4D4D`):** Micro-dosed strictly for stream dropping, dropped frames, audio clipping, and destructive overlay deletion.

## Typography

Typography is set exclusively in **Inter**, configured for hyper-legibility at compact desktop scales. 

Implementation Rules:
- **Tabular Figures:** All numeric property fields (coordinates, angles, percentages, frame counts, bitrates) must enable OpenType tabular numbers (`tnum`) to eliminate spatial shifting during scrubber drag and live telemetry changes.
- **Label Hierarchy:** All inspector properties (e.g., `X`, `Y`, `W`, `H`, `OPACITY`) use `label-sm` with uppercase treatment and `#8B93A7` coloring.
- **Density Over Display:** Headline levels are deliberately constrained to desktop panel proportions (maximum 18px). The application does not deploy consumer display-scale typography.

## Layout & Spacing

The layout architecture employs a fixed multi-dock studio grid optimized for wide-aspect desktop displays:

- **Application Grid Structure:**
  - **Top Global Utility Bar:** Fixed 40px height for document status, stream toggles, layout modes, and master output indicators.
  - **Left Rail (Layer & Asset Hierarchy):** Fixed 260px width. Collapsible to 48px icon-only strip.
  - **Center Canvas Viewport:** Fluid flex-grow container with minimum 640px constraint. Holds the infinite canvas with pixel-grid snap rules and zoom anchors.
  - **Right Rail (Precision Property Inspector):** Fixed 280px width. Organizes transform, compositing, visual filters, keyframing, and stream triggers.
  - **Bottom Dock (Timeline / Scene Switcher):** Fixed 180px height or collapsible to 28px status shelf.

- **Spacing Cadence:**
  - Built on a strict 4px base increment (`0.25rem`), scaling down to 2px (`0.125rem`) micro-adjustments for input nudging and nested icon alignment.
  - Form property lines adhere to 28px standard item heights with 4px element gaps to maximize visible vertical parameters without requiring extensive scrolling.

## Elevation & Depth

Visual separation relies on **tonal stepping** and **low-contrast 1px outlines** rather than heavy blurred drop shadows, preserving optical crispness on desktop monitors.

- **Level 0 (Canvas Base):** Surface color `#0F1115`.
- **Level 1 (Docked Panels):** Surface color `#171A21` bounded by a 1px border of `#262B36`. No drop shadow.
- **Level 2 (Recessed Inputs & Cavities):** Surface color `#12141A` inset within panels, bounded by `#262B36`.
- **Level 3 (Floating Canvas Overlays / Toolbars):** Surface color `#171A21` with a 1px `#262B36` border and an ambient structural shadow: `0px 4px 16px rgba(0, 0, 0, 0.45)`.
- **Level 4 (Context Menus, Modal Overlays & Flyouts):** Surface color `#1B1F27`, 1px border `#3A4150`, accompanied by high-isolation depth: `0px 8px 24px rgba(0, 0, 0, 0.65)`.
- **Selection Elevation:** Selected nodes do not lift via shadow; instead, they project a crisp 1px solid stroke in `#7C5CFF` accompanied by 6px x 6px square geometric transform handles.

## Shapes

The design system enforces a precise, compact shape language based on exact 6px corner radii for containers and inputs.

- **Standard Elements (6px / `0.375rem`):** Applied uniformly to property inputs, icon buttons, segmented controller caps, dropdown triggers, and modal containers.
- **Nested Inner Elements (3px to 4px):** Used inside 6px containers (such as color preview chips, slider thumbs, and badge containers) to maintain mathematical concentricity.
- **Canvas Nodes & Bounding Box Handles:** 0px sharp corners for transformation anchor handles (6px x 6px squares) to convey surgical geometric precision.
- **Status Pills:** Fully rounded / pill shapes (`9999px`) are restricted exclusively to high-visibility telemetry flags, such as the `● LIVE` transmission pill and recording indicators.

## Components

### Precision Property Inputs
- **Numeric Scrubbers:** 24px or 28px height. Background `#12141A`, border 1px solid `#262B36`. Displays monospace axis prefix (e.g., `X`, `Y`) in `#8B93A7` on the left edge. Hovering the label changes cursor to horizontal scrub arrows (`ew-resize`). Active editing focuses a 1px ring in `#7C5CFF` with full value selection.
- **Inline Steppers / Dual Inputs:** Paired horizontal fields (e.g., Width + Height with constrain-proportions lock icon) separated by a 2px gap.

### Buttons & Action Controls
- **Toolbox Icon Buttons:** 28px x 28px square buttons with 6px border radius. Default state: transparent background, icon in `#8B93A7`. Hover: `#262B36` background, icon in `#E6E8EE`. Active/Selected: `#7C5CFF` background, icon in `#FFFFFF`.
- **Primary Studio Action:** `#7C5CFF` background, `#FFFFFF` text, bold 12px weight. Hover: brightness(1.1). Active: brightness(0.95).
- **Go Live / On-Air Button:** Standalone high-contrast switch. Idle: `#262B36` outline with `#00E5A0` text and status dot. Armed/Live: `#00E5A0` background, `#0F1115` bold text, with a pulsing glow ring.

### Layer Tree & Outliner
- **Layer Item:** 26px row height with 6px corner radius. Includes lock/visibility hover toggles, nested hierarchy indentation (12px per tier), item type icon, and editable text label.
- **States:** Hover reveals quick-action visibility eye and padlock. Selected state highlights background with `rgba(124, 92, 255, 0.15)` and left border highlight in `#7C5CFF`.

### Segmented Controls & Sliders
- **Segmented Toggle Group:** `#12141A` container, 1px border `#262B36`, 2px internal padding. Segment items have 4px radius; selected item receives `#262B36` background and `#E6E8EE` text.
- **Scrubber Sliders:** 4px high horizontal track in `#262B36`. Filled portion in `#7C5CFF`. Thumb is a 10px circular node with a 1px solid `#FFFFFF` border, visible upon row hover.

### Checkboxes & Toggle Switches
- **Checkboxes:** 14px x 14px box with 3px radius. Border 1px solid `#3A4150`. Checked state filled with `#7C5CFF`, featuring an ultra-crisp white checkmark.
- **Micro Toggles:** 24px wide by 14px high track. Off: `#262B36`. On: `#00E5A0` for stream triggers, `#7C5CFF` for visual effects. 10px thumb shifts with zero spring lag.

### Audio / Video Telemetry Gauges
- **Peak Meters:** Segmented LED-style vertical and horizontal bars. -inf to -12dB in `#00E5A0`, -12dB to -3dB in `#FFB800`, -3dB to 0dB+ in `#FF4D4D`. Recessed container in `#12141A`.