# Flicker scanner

Finds z-fighting: two surfaces so close together that the depth buffer can't tell which is in front, so they
flicker against each other as the camera moves. Not part of the game.

How it works: every mesh is drawn in a flat colour of its own, twice, with the near plane nudged 3% in between.
The two pictures are identical except where two surfaces are too close to tell apart, and those pixels are counted
and traced back to the pair of meshes, where they are, and how far apart they really are.

Needs Node with Playwright, and the game served from the repository root (`python3 -m http.server 8765`).

    node mkviews.mjs                                  # writes views-g0..2.json (street level) and views-air.json (40 m and 150 m up)
    node zf.mjs views-air.json --near game --out air.json > air.log
    node agg.mjs air.log                              # the worst pairs over all views, with where to find them
    node zf.mjs "0,150,0,260,0,0" --rel --near game --shot look     # one view (camera x,y,z then target), with screenshots look-v.png and look-v-mask.png
    node who.mjs "332.5,3,140.4,0,-1,0"               # what a ray from a point hits: each mesh's material, size and place

`--near game` uses the near plane the game itself would pick at that spot (see `nearPlane` in `src/world/world.js`);
`--near .3` holds it at the street-level value. A reported gap of 0 mm means two faces are exactly level: move one.
A gap of a few centimetres that only shows from far away is the depth buffer running out: give the nearer surface a
polygon offset (see `PROUD` in `src/world/materials.js`). Pairs that meet along a line (a kerb and the road, the sea and
a beach) always show a pixel or two and are harmless. A view whose camera starts inside a building reports nonsense.
