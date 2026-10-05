# SPARK Electrode UI and 3D Fallback Implementation Report

Date: 2026-08-21

SPARK repository: `/Volumes/SM/bwh_comp/Development/netstim/LeadDBSDatabase`

Lead-DBS repository: `/Volumes/PdBwh/leaddbs`
Release version: `1.1.3`

## 1. Outcome

The stimulation editor's contact controls no longer use 32-pixel values and
negative offsets inside a fixed 100-pixel field. OFF/negative/positive labels,
numeric values, and units now occupy separate responsive regions, long values
shrink to fit, and the exact value remains available to assistive technology and
in a tooltip.

The single-patient and group 3D viewers no longer require an electrode PLY. A
valid PLY remains authoritative. If it is absent or malformed, SPARK constructs
a clearly labeled schematic electrode from Lead-DBS reconstruction contact
centroids and head/tail markers. Right-only, left-only, bilateral, legacy, and
current reconstruction JSON shapes are supported. If neither a usable PLY nor
usable reconstruction coordinates exist, the viewer shows an actionable message
instead of silently displaying an empty scene.

Lead-DBS now refreshes derived reconstruction JSON whenever the selected patient
set is prepared. Each side is exported independently, so one missing hemisphere
cannot collapse a valid unilateral reconstruction to `{}`.

## 2. Electrode-screen styling

- Contact controls use a bounded responsive width, a compact three-column
  polarity row, a dedicated quantity row, tabular numerals, and a reserved unit
  cell.
- Numeric display size adapts from 24 to 15 pixels as the value gets longer.
  Normal decimals display with up to two places and very small nonzero values
  with up to four; the underlying value is not rounded during saving.
- Number-input spinners are hidden, keyboard focus is visible, and polarity and
  quantity controls have descriptive accessibility labels.
- The editor no longer overrides Bootstrap's global `.container` class or relies
  on a negative outer margin. Its scoped flex layout may shrink without forcing
  the electrode controls outside the available window.
- Contact-name labels use responsive, non-wrapping, tabular text with a subtle
  contrast shadow.
- The same shared contact component is used for IPG, left, center, and right
  placements, so the fix covers every supported electrode drawing.

## 3. Missing-PLY behavior

The viewer load order is:

1. Resolve the selected dataset and patient with canonical real paths.
2. Attempt to read `combined_electrodes.ply` as an exact-length `ArrayBuffer`.
3. Independently read the case-insensitive, uniquely matched
   `<patient>_desc-reconstruction.json`.
4. Use a valid PLY, including a PLY without vertex colors.
5. Otherwise generate schematic geometry from reconstruction data.
6. Otherwise show an explicit reconstruction/geometry error.

The generated geometry uses physical MNI coordinates directly. Each available
side receives a thin shaft and small contact-centroid markers. Shaft direction is
chosen in this order:

1. valid reconstruction `head`/`tail` markers;
2. means of the electrode model's directional contact tiers (`etageidx`);
3. a principal-component axis through the contact centroids.

Tier means prevent directional contact segments around one level from being
mistaken for the electrode's longitudinal axis. The camera fits the requested
side, or the remaining side for a unilateral reconstruction. Existing and
generated electrode meshes replace one another cleanly rather than accumulating
duplicates.

The group viewer applies the same PLY-to-reconstruction fallback independently to
each visible patient and lists patients using schematic or unavailable geometry.

## 4. Lead-DBS reconstruction JSON

`ea_initialize_programmer` now rebuilds the DBS reconstruction JSON from the
canonical reconstruction MAT on each selected-patient preparation. The bilateral
schema remains compatible:

- `coords_right` and `coords_left` are validated independently;
- `head1`/`tail1` and `head2`/`tail2` are independently optional;
- directionality is emitted only when the corresponding native `head` and `y`
  markers are valid;
- unavailable values serialize as `[]`;
- a valid unilateral side is never discarded because the other side is absent;
- output is written to a same-directory temporary file and then replaced, with
  cleanup on failure;
- one corrupt patient reconstruction produces a warning without aborting the
  remaining selected patients, and any existing JSON is preserved byte-for-byte.

This JSON remains derived data. Exact surfaces and directional roll still come
from a proper Lead-DBS PLY when one is available.

## 5. Files changed for this release

Line numbers refer to the final 1.1.3 source.

| File | Lines | Change |
|---|---:|---|
| `src/renderer/components/electrode/ContactParameters.js` | 5–121, 170–215 | Responsive polarity/quantity layout, adaptive number formatting, unit placement, focus treatment, and accessibility text. |
| `src/renderer/components/electrode/Electrode.tsx` | 3556 | Replaces the global Bootstrap `container` class with the scoped editor layout. All four existing contact placements reuse the updated shared component. |
| `src/renderer/styles/electrode/Styling.css` | 7–20, 1597–1608 | Scoped shrinkable editor flex layout and hardened contact-name typography. |
| `src/renderer/utils/electrodeFallbackGeometry.ts` | 1–479 | New PLY validation, reconstruction normalization, unilateral bounds, marker/tier/PCA axes, and renderer-native schematic geometry. |
| `src/renderer/utils/electrodeFallbackGeometry.test.ts` | 1–170 | Seven regression tests covering legacy/current data, malformed coordinates, finite geometry, directional tiers, unilateral camera bounds, marker-only data, and colorless PLY. |
| `src/renderer/components/viewers/PlyViewer.tsx` | 48–216, 572–606, 1740–1791, 2384–2470, 4199–4227, 4264–4284 | PLY-first fallback, replacement/disposal, scene readiness, camera fitting, guarded directionality, listener/animation cleanup, and visible status. |
| `src/renderer/components/group/GroupViewer.js` | 17–20, 61–66, 511–617, 779–840, 1249–1261, 1340–1355 | Per-patient group fallback, lifecycle cleanup, and fallback/missing patient status. |
| `src/main/ipc/ipcHandlers.ts` | 40–134, 697–792 | Exact binary payloads, dataset/patient/file real-path containment, nullable PLY/anatomy loading, and unique reconstruction JSON resolution. |
| `src/main/main.ts` | 1640–1794 | Group-viewer loader no longer requires PLY; validates contained patient paths and returns optional PLY plus reconstruction JSON. |
| `/Volumes/PdBwh/leaddbs/programmer/ea_initialize_programmer.m` | 184–212, 269–436 | Per-patient isolated refresh, MAT preflight, independent unilateral/bilateral extraction, validation, and temporary-write replacement. |
| `assets/version.json` | 2 | Release version `1.1.3`. |
| `package.json` | 287 | Root application version `1.1.3`. |
| `package-lock.json` | 3, 9 | Root lockfile release version `1.1.3`. |
| `release/app/package.json` | 3 | Packaged application version `1.1.3`. |
| `release/app/package-lock.json` | 3, 9 | Packaged lockfile release version `1.1.3`. |
| `/Volumes/PdBwh/leaddbs/programmer/ea_getProgrammerPath.m` | 4 | Bundled/install target `1.1.3`. |
| `/Volumes/PdBwh/leaddbs/programmer/app/release/LeadDBSProgrammer_maca64.zip` | binary | Installed Apple-silicon 1.1.3 application bundle. |
| `/Volumes/PdBwh/leaddbs/programmer/app/release/LeadDBSProgrammer_maci64.zip` | binary | Installed Intel 1.1.3 application bundle. |

## 6. Verification

- Focused Jest suites: **31/31 passed** (7 viewer fallback, 18 Lead-Group
  export, and 6 MATLAB writer tests).
- Production main and renderer builds: **passed** under version 1.1.3.
- Targeted ESLint: **passed**. The only notice is the repository's existing
  stale Browserslist database warning.
- `git diff --check`: **passed**, apart from the existing informational CRLF
  warning for an unchanged bundled WASM file.
- Both architecture ZIPs passed complete `unzip -tq` integrity checks.
- Both packaged `Info.plist` files report short/build version `1.1.3`.
- Apple-silicon and Intel packages contain byte-identical `app.asar` payloads.
- Packaged renderer/main source-map contents match every source file changed for
  this UI/viewer feature; the packaged CSS source map likewise matches the final
  electrode stylesheet.
- Installed Lead-DBS ZIPs and MATLAB helpers match the staged artifacts
  byte-for-byte.
- MATLAB real-data fixtures verified right-unilateral and bilateral JSON output.
  A refresh fixture replaced deliberately stale JSON for two subjects and left
  no temporary files. MATLAB analyzer output had no new finding or syntax
  category relative to the existing baseline.
- A corrupt-existing/corrupt-absent/valid-next-patient fixture verified failure
  isolation: the old JSON remained byte-identical, no invalid JSON was created,
  and the later valid unilateral patient still refreshed.
- The optional DMG phase failed in `hdiutil`; Lead-DBS installs from the fully
  validated ZIPs, so this does not affect the deployed application.
- A static-browser preview cannot exercise this Electron screen because it lacks
  the Electron preload bridge. No final interactive packaged-GUI click-through
  was performed.

### Release hashes

| Artifact | SHA-256 |
|---|---|
| Apple silicon `LeadDBSProgrammer_maca64.zip` | `e39caf0a789772c4f12800c85e21453b879926af27c6eb3b8cb9723dad11f517` |
| Intel `LeadDBSProgrammer_maci64.zip` | `4f4f5c88a6352a64a479d930ae38b5f48e812cd5972511d3a0f62b6441901e1a` |
| Shared packaged `app.asar` | `92dbeb56eea8658b40c22fe6818721172a55d37ace742245ef0adbaa6e2a0f4c` |
| Installed `ea_initialize_programmer.m` | `d2d75b03c3b1d845496e4a7e994a00c89fdcf91e5f868d1337ead15991d56687` |
| Installed `ea_getProgrammerPath.m` | `71416094841654bab10910b4173fb11e708517f5f15cd9f25566885aa032e22d` |

## 7. Deployment and rollback

The installed Lead-DBS release archives are version 1.1.3. The next
`ea_getProgrammerPath` call updates the per-user installed application when its
version marker differs.

Exact pre-1.1.3 rollback copies are retained at:

- `/Volumes/PdBwh/leaddbs/programmer/app/release/old/LeadDBSProgrammer_maca64-pre-1.1.3.zip`
- `/Volumes/PdBwh/leaddbs/programmer/app/release/old/LeadDBSProgrammer_maci64-pre-1.1.3.zip`
- `/Volumes/PdBwh/leaddbs/programmer/app/release/old/ea_initialize_programmer-pre-1.1.3.m`
- `/Volumes/PdBwh/leaddbs/programmer/app/release/old/ea_getProgrammerPath-pre-1.1.3.m`

The macOS bundles are unsigned and not notarized because no Developer ID was
configured in this environment.

## 8. Deliberate limitations

- The generated model is a labeled schematic, not the exact Lead-DBS transformed
  insulation/contact surface. It intentionally avoids implying exact segmented
  contact volume or directional roll when those data are unavailable.
- Reconstruction coordinates are required for fallback. If both PLY and JSON
  geometry are unavailable, the viewer explains how to regenerate them.
- Existing historical directionality metadata remains an approximate flattened
  angle. It is not used to invent the fallback electrode surface.
- Only macOS Apple-silicon and Intel packages were produced in this environment.

## 9. Relationship to earlier reports

`BUG_FIX_IMPLEMENTATION_REPORT.md` records the 1.1.1 bug-fix release, and
`LEAD_GROUP_EXPORT_IMPLEMENTATION_REPORT.md` records the 1.1.2 Lead-Group MAT
export release. This document is the current 1.1.3 handoff.
