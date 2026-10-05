# Current Steering Implementation Report

Date: 2026-09-06

## Outcome

Current steering now has one device-aware state engine shared by contact clicks,
quantity edits, amplitude edits, unit changes, directional steering, device
changes, imported stimulation files, exported Lead-DBS stimulation files, and
the 3D viewer's optimization actions.

For percentage and current modes, positive and negative polarity are two
independent pools. If present, each pool always carries its full budget:

- `%`: 100% negative and 100% positive.
- `mA`: one source-amplitude budget on each active polarity.
- The case/IPG is contact `0` and follows the same rules as electrode contacts.
- The first and only contact on a polarity receives its entire budget.
- Adding another contact with a polarity toggle preserves the existing
  allocation and initially gives the new contact zero, after which either
  contact can be edited. Abbott instead reapplies its equal-topology rule.
- Editing one contact keeps that requested value and redistributes the remaining
  budget across same-polarity peers in proportion to their prior shares.
- OFF contacts always have zero quantity. Invalid, negative, and over-budget
  input is bounded safely.

Voltage is intentionally not treated as a 100% current pool.

## Device behavior

| Programmer        | Modes          | Steering behavior                                                                                                                                                          |
| ----------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Boston            | `%`, `mA`      | Separate 100% pools in `%`; separate source-current pools in `mA`; conversion preserves relative shares.                                                                   |
| Medtronic Percept | `mA`           | Contact values sum to the source current independently for each active polarity.                                                                                           |
| Medtronic Activa  | `mA`, `V`      | `mA` is distributed like Percept. In `V`, every active contact and the case receive the full source voltage and contact voltage fields are read-only.                      |
| Abbott            | `mA`           | Topology, amplitude, and device changes restore equal sharing per polarity; users may still manually edit a distribution afterward.                                        |
| Master            | `%`, `mA`, `V` | `%` and `mA` use the standard pools. `V` permits independent per-contact values. The existing internal/serialized identifier remains `Research`; the UI label is `Master`. |

## User-experience improvements

- Contact values can be selected, replaced, and committed with Enter or blur;
  intermediate typing no longer fires several conflicting state updates.
- Enter, blur, polarity selection, and OFF-to-negative quantity entry are atomic
  updates, preventing stale callbacks from undoing the user's action.
- Each contact displays its actual unit and an accessible exact-value label.
- The panel displays live negative and positive totals against their target.
- Abbott explains when a newly activated contact is equalized and that a
  subsequent edit can customize the distribution.
- `Split Even` and `Normalize` use the same device-aware engine.
- Directional controls move 10% of the displayed allocation, keep polarity
  pools separate, and refuse a move that would overlap opposing polarities.
- Directional actions are disabled in voltage mode and explain blocked actions.
- The amplitude field supports normal draft editing and commits once.
- The 3D viewer's suggested programs now enter through the same atomic steering
  adapter instead of directly overwriting three independent state values.
- Zero source amplitude is handled safely in viewer calculations.
- NIfTI optimization seeds and proposals always match the electrode's actual
  contact-coordinate count, including four-contact leads.

## Lead-DBS compatibility

Existing Lead-DBS fields remain authoritative and unchanged for ordinary
programs:

- `S.Ls1` ... `S.Ls4`, `S.Rs1` ... `S.Rs4`
- `case` and `kN` contact structures
- `pol`, `perc`, `amp`, and `va`
- `activecontacts`, `sources`, and `amplitude`

Physical `mA` values are converted to Lead-DBS percentages on export and
restored from `perc * amp` on import. Every initialized source is exported,
including source slots the user did not visit. Before each source is rebuilt,
old `kN` fields from a cloned template are removed so contacts from a previous
larger electrode cannot survive the export. Lead-DBS source numbers are local
to each hemisphere, so every export uses `S.sources = [1, 2, 3, 4]`; UI slots
5-8 map to `Rs1`-`Rs4` and are never written as invalid sources 5-8.

Three additive fields preserve programmer-only information without changing
the standard representation:

- `S.ipg`
- `S.programmerUnits`
- `S.programmerVoltageQuantities`, using MATLAB-safe `case`/`kN` field names,
  for lossless independent Master voltage values.

Standard Lead-DBS voltage data uses `perc` as an on/off flag, so an app-only
sidecar was not enough: unequal Master voltages would otherwise all simulate at
the full source amplitude. A guarded Lead-DBS helper now validates the IPG,
unit, source mode, amplitude, complete contact set, and unchanged polarities
before applying the independent values. If any check fails, Lead-DBS follows
its original behavior.

The helper is integrated with OSS-DBS stimulation vectors, Horn, FastField,
and the single-contact Dembek, Kuncel, and Maedler paths. An active case is used
as the grounded reference and its signed voltage is subtracted from electrode
contact potentials. The empirical Dembek/Kuncel/Maedler models retain their
existing one-active-contact-per-source limitation; they do not approximate a
multi-contact field.

## Files and current line anchors

Line numbers below describe this working tree on 2026-09-06 and may move after
future edits.

| File                                                          |                                                                           Current lines | Change                                                                                                                                                                                                       |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/renderer/utils/currentSteering.ts`                       |                                                                                   1-296 | New canonical steering engine; device/unit matrix, two-polarity balancing, case behavior, edits, amplitude changes, and unit conversion.                                                                     |
| `src/renderer/utils/currentSteering.test.ts`                  |                                                                                   1-543 | New regression coverage for all device modes, case/contact transitions, Abbott activation, distributions, malformed values, and conversions.                                                                 |
| `src/renderer/utils/directionalSteering.ts`                   |                                                                                   1-181 | New pure directional transport/preset engine with polarity collision protection.                                                                                                                             |
| `src/renderer/utils/directionalSteering.test.ts`              |                                                                                   1-229 | New directional steering regression and repeated-move stability tests.                                                                                                                                       |
| `src/renderer/utils/stimulationUnits.ts`                      |                                                                                   1-279 | New import normalization, export conversion, IPG inference, whole-program device conversion, strict Master snapshot validation, and MATLAB-safe unit/voltage metadata.                                       |
| `src/renderer/utils/stimulationUnits.test.ts`                 |                                                                                   1-326 | New Lead-DBS import/export, malformed-pool and snapshot, Master-voltage, and device-switch regression tests.                                                                                                 |
| `src/renderer/utils/viewerProgram.ts`                         |                                                                                    1-82 | New pure adapter for device-aware viewer proposals and safe NIfTI optimizer conversion.                                                                                                                      |
| `src/renderer/utils/viewerProgram.test.ts`                    |                                                                                    1-98 | New viewer proposal tests for every device mode, case handling, amplitude changes, and short/invalid optimizer output.                                                                                       |
| `src/renderer/utils/leadDbsSources.ts`                        |                                                                                    1-17 | Defines valid per-hemisphere source indices and removes obsolete cloned `kN` fields before rebuilding a source.                                                                                              |
| `src/renderer/utils/leadDbsSources.test.ts`                   |                                                                                    1-35 | Verifies source numbering and stale contact removal without mutating retained source settings.                                                                                                               |
| `src/renderer/components/electrode/ContactParameters.js`      |                                                                                   5-252 | Compact responsive styling, draft quantity input, atomic callbacks, limits, units, and accessibility.                                                                                                        |
| `src/renderer/components/electrode/ContactParameters.test.js` |                                                                                   1-123 | New six-case interaction suite for polarity and quantity editing.                                                                                                                                            |
| `src/renderer/components/electrode/Electrode.tsx`             | 27-38, 160-211, 273-294, 638-656, 2396-2420, 2686-2745, 3115-3137, 3223-3592, 3644-3915 | Connects every active programmer control and the viewer to the canonical engines; adds totals, notices, units, limits, and accessible directional actions.                                                   |
| `src/renderer/components/viewers/PlyViewer.tsx`               |                59-117, 1320-1332, 1453-1457, 2570-2629, 2801-2850, 2880-2885, 3119-3206 | Uses the canonical unit, safe physical-unit visualization, contact-count-safe NIfTI optimization, tested short-output conversion, and a single atomic callback for optimized programs.                       |
| `src/renderer/components/electrode/ManageElectrode.tsx`       |         23-33, 361-370, 628, 656-746, 841-843, 897-907, 1005-1093, 1103-1199, 1416-1450 | Initializes sources canonically, clears stale template contacts, exports per-hemisphere source indices, imports all eight sources, writes valid Lead-DBS units, and safely handles functional state updates. |
| `src/renderer/components/stimulation/StimulationSettings.tsx` |                                                                        290-310, 781-804 | Converts every source when IPG hardware changes; retains the Master UI label.                                                                                                                                |
| `src/renderer/components/group/GroupArchitecture.js`          |                                                                                  94-105 | Correctly evaluates functional nested setters for each group patient.                                                                                                                                        |
| `src/renderer/pages/Programmer.tsx`                           |                                                       22-31, 345-424, 889-907, 930-1273 | Hydrates and exports every source with canonical quantity/unit conversion, per-hemisphere source numbering, stale-contact cleanup, and metadata, including Lead-Group patients.                              |
| `src/renderer/styles/electrode/Styling.css`                   |                                                                                 106-137 | Styles the distribution summary, directional presets, and steering notices.                                                                                                                                  |

### Lead-DBS files

| File                                                                |           Current lines | Change                                                                                                                                                                                                 |
| ------------------------------------------------------------------- | ----------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/Volumes/PdBwh/leaddbs/helpers/ea_get_programmer_voltage_vector.m` |                   1-156 | New fully guarded Master-voltage parser, defensive scalar/type validation, polarity mapping, active mask, and case-reference calculation.                                                              |
| `/Volumes/PdBwh/leaddbs/helpers/ea_has_active_programmer_voltage.m` |                    1-42 | New guarded check that lets a raw 0 V contact remain active when the case makes its relative voltage nonzero.                                                                                          |
| `/Volumes/PdBwh/leaddbs/helpers/ea_get_OneSourceStimVector.m`       |                   38-46 | Applies independent voltages in the per-source OSS-DBS path.                                                                                                                                           |
| `/Volumes/PdBwh/leaddbs/helpers/ea_getStimVector.m`                 |                 114-130 | Applies and combines independent voltages in the legacy/all-source OSS-DBS path.                                                                                                                       |
| `/Volumes/PdBwh/leaddbs/ea_genvat_horn.m`                           | 35-44, 265-281, 299-305 | Recognizes case-relative contacts, uses signed independent potentials, and avoids legacy bipolar halving when validated metadata is active.                                                            |
| `/Volumes/PdBwh/leaddbs/ea_genvat_fastfield.m`                      |           32-41, 68-117 | Recognizes case-relative contacts, resets per-source impedance state, skips zero-field sources, and converts independent cathodic voltages into unequal weights while retaining its anode restriction. |
| `/Volumes/PdBwh/leaddbs/ea_genvat_dembek.m`                         |                  46-128 | Skips inactive source slots, selects contacts after case referencing, and uses the requested voltage for its supported single active contact.                                                          |
| `/Volumes/PdBwh/leaddbs/ea_genvat_kuncel.m`                         |                  45-123 | Skips inactive source slots, selects contacts after case referencing, and uses the requested voltage for its supported single active contact.                                                          |
| `/Volumes/PdBwh/leaddbs/ea_genvat_maedler.m`                        |                  45-123 | Skips inactive source slots, selects contacts after case referencing, and uses the requested voltage for its supported single active contact.                                                          |

## Verification

- `npm test -- --runInBand`: 9 suites passed, 130 tests passed.
- `npm run build:renderer`: production renderer build passed.
- Targeted ESLint for the new steering utilities and tests: passed with zero
  errors and zero warnings.
- `git diff --check`: passed; Git only reported the repository's existing CRLF
  normalization notice for `.erb/dll/364efbac574d0e337e3d.wasm`.
- MATLAB R2025b assertions passed for Master case-relative voltage mapping,
  raw-zero/case-shifted active detection, the actual OSS-DBS one-source vector
  path, stale and malformed metadata fallback, unchanged legacy voltage
  behavior, inactive empirical sources, and parse checks for all nine modified
  or new MATLAB files.

The older large UI components still contain pre-existing lint debt, so this
report does not claim that the repository-wide legacy lint baseline is clean.
