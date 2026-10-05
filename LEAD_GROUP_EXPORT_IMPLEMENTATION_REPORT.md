# SPARK Lead-Group MAT Export Implementation Report

> Historical baseline: this report records the 1.1.2 Lead-Group export release.
> The current 1.1.3 electrode UI and missing-PLY viewer work is documented in
> `ELECTRODE_UI_VIEWER_FALLBACK_REPORT.md`.

Date: 2026-08-21

SPARK repository: `/Volumes/SM/bwh_comp/Development/netstim/LeadDBSDatabase`

Lead-DBS repository: `/Volumes/PdBwh/leaddbs`
Release version: `1.1.2`

## 1. Outcome

SPARK now has an **Export to Lead-Group…** action in the patient database. A user
selects patients in the existing table, chooses exactly one saved stimulation for
each patient, chooses one or more clinical outcomes, and exports a MATLAB Level-5
Lead-Group analysis file to:

`<dataset>/derivatives/leadgroup/<analysisId>/dataset-<datasetId>_analysis-<analysisId>.mat`

The exported file is a normal interactive Lead-Group `M` file. It is designed to
open through Lead-DBS `lead_group`; it is not an explorer-only pseudo-group file.
`M.elstruct` is intentionally omitted, as requested. Export is therefore limited
to Lead-DBS datasets and preflights every selected patient's canonical
reconstruction so Lead-DBS can repopulate electrode geometry.

## 2. Reference-file finding

The supplied example
`/Users/savirmadan/Documents/Enspire/analysis/outputs/restore_discfiberexplorer_group_bilateral_efields/dataset-RESTORE_analysis-RESTORE_discfiber_12_bilateral_efields.mat`
was inspected in MATLAB. It contains only an explorer-oriented pseudo-`M` and
does not contain the normal interactive fields `M.S`, `M.root`, `M.vatmodel`, or
`M.elstruct`. Lead-DBS `ea_checkStimParams` expects `M.S`, so copying that shape
would not produce a normal file that `lead_group` can open. The implementation
instead follows the canonical structures created by Lead-DBS
`ea_initializeM`/`ea_genGroupAnalysisFile`.

## 3. User workflow

1. Open a Lead-DBS dataset in SPARK's patient database.
2. Select one or more patient rows. Selection remains stable across sorting and
   searching; Select All applies to the currently filtered rows.
3. Click **Export to Lead-Group…**. The button is disabled, with an explanatory
   tooltip, for non-Lead-DBS datasets or when no patients are selected.
4. Enter an alphanumeric analysis ID.
5. Choose one saved stimulation for every patient. A sole available stimulation
   is selected automatically.
6. Choose one or more clinical variables. Both individual score items and a
   complete-score total are offered. The dialog shows cohort coverage.
7. By default, every selected outcome must exist for every selected patient. The
   user may explicitly allow missing values, which are written as MATLAB `NaN`.
8. Export. Success is shown only after the MAT file has been durably published.

The UI rejects mixed VTA models for a group, missing stimulation choices,
incomplete outcomes without explicit permission, and invalid analysis IDs before
enabling export. The backend repeats all of these checks rather than trusting the
renderer.

## 4. MAT-file contents

| Field | Written content |
|---|---|
| `M.patient.list` | `N x 1` cell array of canonical absolute Lead-DBS patient folders |
| `M.patient.group` | `N x 1` numeric vector assigning each patient to group 1 |
| `M.groups` | Default group label, color, and selection metadata |
| `M.guid` | User-supplied Lead-Group analysis ID |
| `M.clinical.vars` | `1 x K` cell array; each cell is an `N x 1` double vector aligned to patient order |
| `M.clinical.labels` | `1 x K` filesystem-safe, unique labels usable by Lead-DBS output paths |
| `M.S` | `1 x N` canonical stimulation struct array, one selected stimulation per patient |
| `M.vatmodel` | Common VTA model shared by all selected stimulations |
| `M.root` | Canonical analysis directory with trailing separator |
| `M.ui` | Normal Lead-Group UI defaults, including list and clinical selection state |
| `M.vilist`, `M.fclist` | Empty cell arrays, ready for later Lead-DBS analysis inputs |
| `M.notes` | Creation provenance and the explicit `elstruct` omission note |
| `M.spark` | Lossless SPARK provenance: schema version, timestamp, subject IDs/folders/stimulation timelines, and original clinical display labels |

`M.elstruct` is not written. Before export, each patient must have exactly one
nonempty canonical reconstruction at
`<patient>/reconstruction/<patient-folder>_desc-reconstruction.mat`.

Clinical item names are preserved in `M.spark.clinical`. The corresponding
`M.clinical.labels` are separately normalized to safe filenames, because
Lead-DBS later concatenates these labels into NIfTI paths. A total is considered
present only when every score item observed for that cohort/timeline is numeric;
a partially filled questionnaire is never silently summed as a complete score.

## 5. Stimulation normalization and compatibility

Every selected `S` is validated and normalized before serialization:

- all eight source structs (`Rs1`…`Rs4`, `Ls1`…`Ls4`) must be structurally valid;
- modern contact keys must be identical and consecutive (`k1`…`kN`);
- source amplitude, stimulation mode, pulse width, contact percentage, polarity,
  impedance, case return, and bilateral mode invariants are checked;
- `amplitude`, `activecontacts`, `active`, `sources`, `volume`, `numContacts`, and
  `ver` are emitted in canonical Lead-DBS shapes instead of trusting stale
  redundant JSON fields;
- active OSS-DBS sources must have a valid pulse width;
- all patients must use the same VTA model.

The known legacy format uses right keys `k0`…`k7` and left keys `k8`…`k15`.
Those fixed offsets are remapped only when the saved JSON also contains an
explicit integer `numContacts` from 1 through 8. Only the first `N` contacts on
each side are retained, matching Lead-DBS's own migration. A legacy JSON with no
contact count is rejected with an instruction to reopen and save it in Lead-DBS;
inferring eight contacts would be unsafe because a real four-contact Medtronic
3387 file in the test corpus carries all eight legacy slots.

## 6. Safety and filesystem behavior

- IPC payloads receive strict runtime validation; strings, booleans, arrays,
  duplicates, counts, and lengths are not coerced.
- The selected dataset is resolved with `realpath`; patient, session,
  reconstruction, and destination paths must remain inside it. No stale launch
  path fallback is used.
- Symlink-following is restricted for JSON inputs, and session files are resolved
  uniquely with a deliberate case-insensitive filename fallback.
- Discovery is bounded to 250 patients, 200 sessions per patient, 256 selected
  outcomes, 25 MB per JSON file, 128 MB aggregate JSON, 512 MB MAT output, and
  concurrency 8.
- Export claims a new analysis directory exclusively, writes a private random
  temporary file, flushes it, publishes it with a create-only hard link, flushes
  directories, and performs nonrecursive best-effort rollback on failure. An
  existing analysis ID is never overwritten.

## 7. Files changed for this feature

Line numbers below refer to the final 1.1.2 source tree.

| File | Lines | Change |
|---|---:|---|
| `src/renderer/components/group/ExportToLeadGroupDialog.tsx` | 1–626 | New dialog; loads options (134–204), builds coverage/model validation (217–310), invokes export (320–370), and renders patient stimulation/outcome/missing-value controls (375–622). |
| `src/renderer/components/patient/PatientDatabase.tsx` | 43, 53, 76, 151–320, 496–516, 705–718, 919–926 | Wires Lead-DBS mode, preserves selected patient IDs, makes filtered Select All deterministic, adds the toolbar button/tooltip, success state, and mounts the dialog. |
| `src/renderer/pages/App.tsx` | 68–80, 161–165 | Receives the main-process Lead-DBS detection flag and supplies it to the patient database. |
| `src/main/ipc/ipcHandlers.ts` | 6–13, 109–140 | Registers validated option-discovery and MAT-export invoke handlers and returns acknowledged export metadata. |
| `src/main/main.ts` | 828–843, 1108–1175 | Detects dataset/`derivatives/leaddbs`/`derivatives/leadgroup` paths consistently and sends the actual Lead-DBS flag with folder-selection events. |
| `src/main/utils/leadGroupExport.ts` | 1–1329 | New backend domain layer: contracts/limits (1–125), validation (184–277), root and patient containment (300–479), bounded JSON/session parsing (482–666), option/clinical discovery (668–977), reconstruction and final-data preflight (989–1159), and create-only durable publication (1185–1327). |
| `src/main/utils/leadGroupMat.ts` | 1–674 | New Lead-DBS stimulation normalizer and canonical `M` builder: scalar/contact validation (24–169), modern/legacy mapping (193–275), source/circuit validation (278–449), canonical `S` fields (452–497), safe clinical labels (502–547), and final `M` schema (549–671). |
| `src/main/utils/matFileWriter.ts` | 1–973 | New dependency-free MATLAB Level-5 writer supporting real numeric/logical arrays, UTF-16 strings, cells, structs, empty arrays, explicit shapes, column-major storage, and size/name/depth validation. Public helpers are at 155–307. |
| `src/main/utils/leadGroupExport.test.ts` | 1–659 | New integration/security tests, including canonical group creation (162–209), legacy four-contact regression (257–303), validation/model/safety/path/race behavior, clinical completeness, and case-variant filenames. |
| `src/main/utils/matFileWriter.test.ts` | 1–234 | New binary-format tests for Level-5 headers, numeric order/types, UTF-16, cells, structs, empty arrays, invalid values, and deterministic output. |
| `assets/version.json` | 2 | Release version `1.1.2`. |
| `package.json` | 287 | Root application version `1.1.2`. |
| `package-lock.json` | 3, 9 | Root lockfile version `1.1.2`. |
| `release/app/package.json` | 3 | Packaged application version `1.1.2`. |
| `release/app/package-lock.json` | 3, 9 | Packaged lockfile version `1.1.2`. |
| `/Volumes/PdBwh/leaddbs/programmer/ea_getProgrammerPath.m` | 4, 33–44 | Bumps the bundled/install target to `1.1.2`; continues to prefer the release archive shipped with the Lead-DBS checkout. |
| `/Volumes/PdBwh/leaddbs/programmer/app/release/LeadDBSProgrammer_maca64.zip` | binary | Installed Apple-silicon 1.1.2 application bundle. |
| `/Volumes/PdBwh/leaddbs/programmer/app/release/LeadDBSProgrammer_maci64.zip` | binary | Installed Intel 1.1.2 application bundle. |

The existing generic renderer `invoke` bridge already supports these two IPC
channels, so `src/main/preload.ts` did not need a feature-specific change.

## 8. Verification

- Focused Jest suite: **24/24 passed** (18 Lead-Group/export tests and 6 MAT
  writer tests).
- Production main and renderer builds: **passed**.
- Isolated strict TypeScript checks for new feature code: **passed**.
- Targeted ESLint and Prettier checks: **passed**. The only renderer build notice
  is the repository's existing stale Browserslist database warning.
- `git diff --check`: **passed**; the only printed notice is an existing CRLF
  warning for an unchanged bundled WASM file.
- Real saved-stimulation replay: **358/359 accepted with canonical invariants**.
  The sole rejection is the intentionally blocked ambiguous legacy four-contact
  file described above. Of the corpus entries with canonical reconstructions,
  there were zero modern contact-count mismatches.
- MATLAB R2025b loaded a fresh two-patient exported file and verified top-level
  `M`, `N x 1` patient cells, `1 x N` `S`, `1 x K` clinical cells with `N x 1`
  doubles, labels/models, and nested stimulation cells. `ea_checkremap_lg` and
  `ea_checkStimParams` accepted it without rewriting the file. `elstruct` was
  absent as designed.
- Both installed ZIP archives pass full `unzip -t` integrity checks and contain
  byte-identical packaged `app.asar` payloads.

### Release hashes

| Artifact | SHA-256 |
|---|---|
| Apple silicon `LeadDBSProgrammer_maca64.zip` | `3e5744fdcb70fe55577aa0a7d54b27eeb1e5c9c2ed37267f5bd8215b5d87779e` |
| Intel `LeadDBSProgrammer_maci64.zip` | `8e0bdb7d02c74083deb7e67001689f7c3a4fe5454230ed6c04963c22a02136fa` |
| Shared packaged `app.asar` | `e621b82811706f251a74b55151e31739c6ba85f02aeab6109bf3b5268b1f4b0e` |
| Installed `ea_getProgrammerPath.m` | `4f326368e985dcdd665fbde18b42cf8a6c46d1b9a97ccaab30c60ac437fd1998` |

Rollback copies of the prior 1.1.1 archives were retained as:

- `/Volumes/PdBwh/leaddbs/programmer/app/release/old/LeadDBSProgrammer_maca64-pre-1.1.2.zip`
- `/Volumes/PdBwh/leaddbs/programmer/app/release/old/LeadDBSProgrammer_maci64-pre-1.1.2.zip`

## 9. Deliberate limitations

- `M.elstruct` is intentionally omitted. Export is enabled only for Lead-DBS
  datasets and requires canonical reconstructions so Lead-DBS can restore it.
- The MAT writer targets the uncompressed MATLAB Level-5 subset needed here; it
  does not implement sparse, complex, object, function-handle, compressed, or
  v7.3/HDF5 values.
- Ambiguous legacy stimulation JSON without an explicit electrode contact count
  must be reopened and saved in Lead-DBS before export.
- Only macOS Intel and Apple-silicon bundles were produced in this environment.
- The macOS bundles are unsigned and not notarized because no Developer ID
  identity was configured.
- Automated, corpus, and MATLAB-level integration checks passed; a final manual
  click-through in the packaged Electron GUI was not performed.

## 10. Relationship to the earlier bug-fix report

`BUG_FIX_IMPLEMENTATION_REPORT.md` remains the historical 1.1.1 record for the
issues in `bugs/Notes.pdf` and `bugs/bugs.rtf`. This document is the current 1.1.2
handoff for the subsequent Lead-Group export feature.
