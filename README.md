# SVG Path Positioning Tool - Built with ClaudeAI

Parse SVG path data, render it in an SVG viewport, and reposition paths
visually (drag) or numerically while coordinates auto-update.

## Run

```bash
npm install
npm run dev        # start dev server
npm test           # run parser + operations unit tests (38 tests)
npm run build      # type-check + production build
npm run preview    # serve the production build
```

## Architecture

```
src/
  parser/svgParser.ts          hand-written path tokenizer/parser (no 3rd-party libs)
  pathOperations/
    boundingBox.ts             analytic bbox (Bézier extrema + arc sampling)
    translate.ts               coordinate translation engine
    serialize.ts               commands -> path string / full SVG doc
  components/                  Canvas, PathRenderer, Inspector, PositionControls, ...
  hooks/usePathTransform.ts    memoized bbox / transform
  store/usePathStore.ts        Zustand state + undo/redo
```

## Notes
- Parser supports M m L l H h V v C c S s Q q T t A a Z z, implicit/repeated
  commands, commas/spaces, negatives, floats, scientific notation, and
  arc-flag packing (e.g. `a25 25 0 1 0 50 0`).
- Bounding boxes are exact: cubic/quadratic extrema via derivative roots,
  arcs flattened from a W3C endpoint->center conversion.
- React Flow / Framer Motion were intentionally omitted; dragging uses a
  native pointer handler with requestAnimationFrame throttling so 10k+ point
  paths stay smooth (no re-parse or re-serialize per frame).
