# Vendored: @mlightcad/libredwg-web 0.7.11

Browser build of [LibreDWG](https://www.gnu.org/software/libredwg/) (DWG/DXF parser) compiled to WebAssembly.
Loaded lazily by `js/dwg-processing.js` the first time a drawing is parsed.

| Item | Value |
|---|---|
| Package | `@mlightcad/libredwg-web` |
| Version | 0.7.11 (published 2026-09-16) |
| License | GPL-3.0, see [LICENSE](LICENSE) (upstream file `COPYING`) |
| Upstream | https://github.com/mlightcad/libredwg-web |
| Registry | https://www.npmjs.com/package/@mlightcad/libredwg-web |

## Files

| Path | Source | SHA-256 |
|---|---|---|
| `dist/libredwg-web.js` | https://cdn.jsdelivr.net/npm/@mlightcad/libredwg-web@0.7.11/dist/libredwg-web.js | `03ce16040f152f774b0982731e8bebdfae0a7686f000e9b90ce475db42ab758e` |
| `wasm/libredwg-web.js` | https://cdn.jsdelivr.net/npm/@mlightcad/libredwg-web@0.7.11/wasm/libredwg-web.js | `62deaef11c2d6cf8fd0a0ee83d29120ca40bdabc2cdd9baa1f7911410bf9d73f` |
| `wasm/libredwg-web.wasm` | https://cdn.jsdelivr.net/npm/@mlightcad/libredwg-web@0.7.11/wasm/libredwg-web.wasm | `d8b78f6d5e63e6e178cf7343cfd08ebe798d75b6754c593e15d8f948b823e038` |

`dist/libredwg-web.js` imports `../wasm/libredwg-web.js`, which fetches `libredwg-web.wasm` from its own directory.
Keep the two folders side by side. Serve `.wasm` as `application/wasm` so the browser can stream-compile it
(GitHub Pages and `python -m http.server` both do; any other MIME type falls back to a slower non-streaming instantiate).

## Updating

1. List versions: `npm view @mlightcad/libredwg-web versions`
2. Download the three files above with the new version number in the URL.
3. Update version, date, and hashes in this file (`sha256sum dist/libredwg-web.js wasm/libredwg-web.js wasm/libredwg-web.wasm`).
4. Parse both drawings in `assets/test-files/` and compare entity, layer, room, and area counts with the previous version.
