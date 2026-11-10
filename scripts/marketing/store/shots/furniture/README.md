# The pop-out furniture, shot by shot

One file per batch of shots. Each exports a plain map from the shot's number
to its furniture, and `furniture/index.mjs` merges them. `std()` in
premium.mjs looks a shot's entry up, so a batch can be written without
touching any other batch's file.

```js
export const F = {
  7: {
    pops: [
      { side: "left",  at: 0.02, center: true, kind: "cells", tab: "Costs", ... },
      { side: "right", at: 1.02, center: true, kind: "line",  tab: "Tonight", ... },
    ],
    props:   [{ name: "hotel", x: 0.04, y: 0.80, size: 220, rot: -7 }],
    figures: [{ text: "₦150,000", rx: 0.06, y: 0.30, size: 150, rot: -3 }],
  },
};
```

See furniture.mjs for what each field means and callouts.mjs for the four
container contents (`stat`, `line`, `cells`, `counters`).
