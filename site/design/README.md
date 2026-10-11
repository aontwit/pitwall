# Hero design sources

- `acoustics.autoneum.com.md` / `.json`: the reference site's design DNA and how pitwall adapts it.
- `hero.blend` (not committed, 28 MB): the Blender file the hero models were cut from. It is in `.gitignore`; keep a copy outside the repo.

## Hero models

| File | Source | Licence | Edits |
|------|--------|---------|-------|
| `public/models/car.glb` | [Formula 1 Car](https://sketchfab.com/models/e89589184eac42c08028db5cba3f6499) by spsvision | CC BY 4.0 | centred, nose to +X, body decimated to 30%, wheels rebuilt (hub origins, so they spin and steer), no textures, Draco |
| `public/models/engine.glb` | [V6 car engine](https://sketchfab.com/models/7309cf5e6b07435c962f954513ca170e) by Blendoriano | CC BY 4.0 | assembled engine only, joined into 8 named parts (`engine_intake`, `engine_heads` …), decimated, no textures, Draco |

The scene (`src/scripts/car.ts`) looks parts up by these node names: `body`, `wheel_fl` / `wheel_fr` / `wheel_rl` / `wheel_rr`, and `engine_<part>`. Keep them when re-exporting.

Export from Blender: glTF binary, selected objects, Y up, Draco on, images `None`, no UVs.
