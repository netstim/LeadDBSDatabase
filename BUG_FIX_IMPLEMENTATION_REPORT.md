# SPARK / Lead-DBS Bug-Fix Implementation Report

> Historical baseline: this report records the 1.1.1 bug-fix release completed on
> 2026-08-20. The 1.1.2 Lead-Group MAT export work is documented in
> `LEAD_GROUP_EXPORT_IMPLEMENTATION_REPORT.md`; the current 1.1.3 electrode UI
> and missing-PLY viewer work is documented in
> `ELECTRODE_UI_VIEWER_FALLBACK_REPORT.md`. Line anchors below remain a snapshot
> of the 1.1.1 handoff.

Date: 2026-08-20

SPARK repository: `/Volumes/SM/bwh_comp/Development/netstim/LeadDBSDatabase`

Lead-DBS repository: `/Volumes/PdBwh/leaddbs`
Release version: `1.1.1`

## 1. Outcome

All explicit issues described in `bugs/Notes.pdf` and `bugs/bugs.rtf` have source-level fixes. The work covers the SPARK/Electron application, its Lead-DBS launch and response contract, Lead-Group integration, OSS-DBS settings round-tripping, patient/session and clinical-score behavior, amplitude constraints, and the stimulation import workbook.

The user-supplied `bugs/` folder was used only as input and was not modified. Page 3 of `Notes.pdf` contains a broken image placeholder but no separate written SPARK issue.

## 2. Reported issues and resolutions

### 2.1 `bugs/Notes.pdf`

| ID | Reported issue | Resolution | Primary current anchors |
|---|---|---|---|
| N1 | Opening SPARK without selected patients should warn instead of failing. | Launches now validate the selected set and show a clear warning. Standalone preparation uses the Lead-DBS UI selection rather than every BIDS subject. | `src/renderer/components/patient/PatientDatabase.tsx:321-382,504-508`; `/Volumes/PdBwh/leaddbs/programmer/ea_initialize_programmer.m:9-29`; `/Volumes/PdBwh/leaddbs/lead_group.m:1322-1327` |
| N2 | Added sessions should be erasable in the UI. | Added confirmation, acknowledged deletion, progress/error state, tree cleanup, safe deletion of known session files, and atomic pruning of stale `dataset_master.json` entries. | `src/renderer/components/patient/PatientDetails.js:190-230,408-421`; `src/main/ipc/ipcHandlers.ts:339-419` |
| N3 | Warn before leaving unsaved clinical scores; show save feedback. | Added dirty tracking, close/back/switch warnings, acknowledged saves, visible saving/success/failure feedback, and dirty-state reset only after success. | `src/renderer/utils/ClinicalScores.js:62-77,212-234,357-371,578-579,637-664,744-754,918-931`; `src/main/ipc/ipcHandlers.ts:302-337` |
| N4 | OSS-DBS Settings button did nothing. | Restored the mounted modal, controlled its state, validated canonical OSS values, persisted settings into each stimulation, and added a MATLAB-owned preference bridge. | `src/renderer/components/electrode/Electrode.tsx:3605-3626,4242-4250`; `src/renderer/components/electrode/ManageElectrode.tsx:141-163,489,856`; `src/renderer/utils/OSSSettings.ts:8-182`; `/Volumes/PdBwh/leaddbs/programmer/ea_programmer_get_runsettings.m:1-133`; `/Volumes/PdBwh/leaddbs/programmer/ea_programmer_apply_runsettings.m:1-244` |
| N5 | Frequency unit was written as lowercase `hz`. | Display now uses `Hz`. | `src/renderer/components/electrode/Electrode.tsx:3736-3747` |
| N6 | UPDRS images should enlarge on click, not on hover. | Removed hover enlargement, standardized thumbnails, and added an explicit click-to-preview modal. | `src/renderer/assets/icons/icons.css:5-26`; `src/renderer/utils/ClinicalScores.js:440-461,899-917` |
| N7 | Returning via the macOS Dock caused a duplicate IPC-handler JavaScript error. | IPC handlers now have a one-time registration guard and are registered during app readiness only; Dock activation recreates only the window. | `src/main/ipc/ipcHandlers.ts:11-95,122-130`; `src/main/main.ts:1715-1734`; `src/renderer/pages/App.tsx:35,59-70,151` |
| N8 | The total/maximum amplitude and electrode-contact amplitudes could disagree. | Polarity changes and direct edits now share a cumulative same-polarity budget; total edits rescale active contacts; invalid totals are rejected; zero conversions are guarded; input maxima expose the same remaining budget. | `src/renderer/components/electrode/Electrode.tsx:626-649,2514-2537,2836-2881,2925-2934,3531-3552`; `src/renderer/components/electrode/ContactParameters.js:92-106,145-160` |
| N9 | The stimulation-parameter Excel template triggered Excel recovery and then appeared blank. | Rebuilt a valid OOXML workbook with the expected headers, 72 supported electrode models, a named range, and list validation for electrode columns. Download now returns the exact bytes. Import validates sheets, required cells, models, rows, and reports row-specific failures. | `public/Stimulation_Parameters_Template.xlsx` (binary); `src/renderer/utils/Import.js:120-123,350-390,499-535,771-775`; `src/main/ipc/ipcHandlers.ts:716-782,1106-1109` |
| N10 | Opening a saved session could require clicking Add twice and could lose state/crash. | Timeline children are idempotent, the first click opens the requested editor, existing items display Open, and selection is guarded. | `src/renderer/components/patient/PatientDetails.js:112-140,169-230,297-320,403-438` |
| N11 | Adding a clinical outcome gave no immediate confirmation. | Added validation, duplicate-name checks, acknowledged atomic persistence, immediate list/state selection, modal close on success, and visible success/error status. | `src/renderer/utils/ClinicalScores.js:674-754,811-832`; `src/main/ipc/ipcHandlers.ts:799-833` |

### 2.2 `bugs/bugs.rtf`

| ID | Reported issue | Resolution | Primary current anchors |
|---|---|---|---|
| R1 | OSS settings button did not work. | Fixed by N4. | See N4. |
| R2 | Saving OSS settings should close the modal and make the result clear. | Save now validates, commits, closes, and shows that settings will be saved with the stimulation. Final stimulation saves wait for a success/error acknowledgement. | `src/renderer/components/electrode/OSSSettingsModal.tsx:44-76,636-654`; `src/renderer/components/electrode/Electrode.tsx:3622-3626,4242-4250`; `src/renderer/components/electrode/ManageElectrode.tsx:899-963,1452-1472` |
| R3 | It was unclear how to launch SPARK for Lead-Group. | Lead-Group now exposes SPARK outside developer mode. Its dialog explicitly explains that this path edits the group and that the electrode-scene path edits only the active patient. Group requests and responses are keyed and validated by patient. | `/Volumes/PdBwh/leaddbs/lead_group.m:1302-1423`; `/Volumes/PdBwh/leaddbs/programmer/ea_input_programmer_group.m:1-42`; `src/renderer/pages/Programmer.tsx:707-750,837-890,1277-1330`; `src/main/ipc/ipcHandlers.ts:195-272` |
| R4 | Electrode-scene launch should prepare/check only the active patient. | `ea_elvis` supplies the current subject ID, the initializer restricts preparation to that ID, and both launch and renderer use explicit patient scope. | `/Volumes/PdBwh/leaddbs/ea_elvis.m:642-648`; `/Volumes/PdBwh/leaddbs/programmer/ea_initialize_programmer.m:9-29`; `/Volumes/PdBwh/leaddbs/programmer/ea_input_programmer.m:1-61`; `src/main/main.ts:118-289`; `src/renderer/pages/Programmer.tsx:66-120` |
| R5 | `Estimate in Template` and other settings were not propagated to OSS-DBS. | Lead-DBS settings enter each request, remain in per-patient React state, return in each `S`, are allowlist-validated in MATLAB, and are applied before OSS preparation. MATLAB remains the only writer of Lead-DBS preferences. | `/Volumes/PdBwh/leaddbs/programmer/ea_programmer_get_runsettings.m:1-133`; `src/renderer/pages/Programmer.tsx:483-750,1254-1273`; `src/renderer/components/electrode/ManageElectrode.tsx:856-874`; `/Volumes/PdBwh/leaddbs/programmer/ea_programmer_apply_runsettings.m:1-244`; `/Volumes/PdBwh/leaddbs/ea_genvat_butenko.m:34-41`; `/Volumes/PdBwh/leaddbs/classes/leadgroup/ea_calc_biophysical_lg.m:90-98` |
| R6 | `Estimate in Template` became unchecked. | Imports now normalize the incoming value instead of defaulting to false, group state carries it per patient, exports preserve it, Lead-DBS no longer force-resets it for a native scene, and the applied value updates both `vatsettings.estimateInTemplate` and `options.native`. | `src/renderer/pages/Programmer.tsx:66-71,483-488,1254`; `src/renderer/components/electrode/Electrode.tsx:3598-3607`; `src/renderer/components/group/GroupArchitecture.js:537-540`; `/Volumes/PdBwh/leaddbs/ea_elvis.m:653-667`; `/Volumes/PdBwh/leaddbs/programmer/ea_programmer_apply_runsettings.m:22-50` |

## 3. Integration design after the fixes

1. Lead-DBS creates an explicit launch request with `schemaVersion`, `runId`, `scope`, an exact `responsePath`, settings, and keyed subjects.
2. SPARK reads the launch once, materializes only the requested patient scope, and keeps the selected patient IDs stable through editing and export.
3. Group output is ordered and validated against the requested IDs before it is written atomically.
4. Each stimulation carries `estimateInTemplate` and `ossSettings`; legacy files without them receive launch-setting fallbacks.
5. MATLAB allowlists and maps returned fields into the existing complete `vatsettings` structure. It never replaces the preference structure with the frontend subset.
6. Runtime patient-specific preference overlays are preserved. Optional persistence updates the global `vatsettings` only.
7. Multi-Tract morphology is safe: unchanged heterogeneous diameter/length arrays are retained, edited scalars are repeated to the original vector shape, and a newly selected Multi-Tract connectome repeats values to its discovered tract count.

The frontend uses canonical OSS-DBS values, including `V/m`, `McNeal1976`, `MRG2002`, `MRG2002_DS`, supported fiber diameters, and the Lead-DBS signal names. Connectomes are supplied dynamically by Lead-DBS and unknown imported values are preserved. Controls that cannot yet be represented safely (custom morphology and full pPAM configuration) are visibly disabled rather than silently writing incomplete data.

## 4. SPARK repository change inventory

Line anchors refer to the current post-fix source. Binary files do not have line anchors.

| File | Current changed anchors | Purpose |
|---|---:|---|
| `assets/version.json` | 2 | Release version `1.1.1`. |
| `package.json` | 287 | Root release version `1.1.1`; all scripts/dependencies/build configuration preserved. |
| `package-lock.json` | 3, 9 | Root lockfile version consistency. |
| `release/app/package.json` | 3 | Packaged-app version consistency. |
| `release/app/package-lock.json` | 3, 9 | Packaged-app lockfile version consistency. |
| `public/Stimulation_Parameters_Template.xlsx` | Binary | Repaired stimulation import workbook. |
| `src/main/helpers/helpers.ts` | 42-83, 165-199 | Scope-aware patient/group folder resolution, `folder`/`patientFolder` compatibility, and legacy fallback support. |
| `src/main/ipc/ipcHandlers.ts` | 11-84, 90-95, 140-272, 290-419, 716-782, 799-833, 1106-1109 | One-time handler registration, atomic writes, acknowledged saves, keyed group validation, clinical/session operations, import summaries, score-type creation, and exact template bytes. |
| `src/main/main.ts` | 118-289, 459, 812, 1035-1107, 1718-1728 | One-shot launch parsing, scoped patient materialization, settings sidecar, corrected folder selection with no group fall-through, and readiness-only initialization. |
| `src/renderer/pages/App.tsx` | 35, 59-70, 151 | Removed render-time duplicate IPC registration and forced remount behavior. |
| `src/renderer/components/patient/PatientDatabase.tsx` | 35, 53-70, 85-87, 293-382, 504-508 | One-shot acknowledged launch/navigation and visible selection warning. |
| `src/renderer/pages/Programmer.tsx` | 21-120, 142-168, 280-341, 483-750, 837-926, 1023-1045, 1254-1330, 1387-1410 | Explicit launch scope, patient IDs/models, settings import/export, group ordering, zero guards, and acknowledged final save. |
| `src/renderer/components/group/GroupArchitecture.js` | 17, 69-70, 537-540 | Per-patient template/OSS state plumbing. |
| `src/renderer/components/stimulation/StimulationSettings.tsx` | 17, 70-71, 123-124, 852-853 | Controlled template/OSS state plumbing into the editor. |
| `src/renderer/assets/icons/icons.css` | 5-26 | Stable UPDRS thumbnails and click-preview styling. |
| `src/renderer/components/electrode/ContactParameters.js` | 66-76, 92-106, 145-160 | Numeric clamping, remaining-budget maximum, and unit display. |
| `src/renderer/components/electrode/Electrode.tsx` | 78-113, 533, 626-649, 2514-2537, 2836-2881, 2925-2934, 3531-3552, 3622-3626, 4007-4250 | Controlled OSS modal, cumulative amplitude constraints, safe total/zero handling, unit text, and editor wiring. |
| `src/renderer/components/electrode/ManageElectrode.tsx` | 75-163, 296-313, 489, 856, 899-963, 1410-1411, 1452-1472 | OSS round-trip, model defaults, and acknowledged save feedback for both explore and stimulate paths. |
| `src/renderer/components/electrode/OSSSettingsModal.tsx` | 9-76, 190-192, 401-526, 646 | Canonical supported values, dynamic connectomes, draft reset, validation, and clear save/close behavior. |
| `src/renderer/utils/OSSSettings.ts` | 8-40, 43-83, 88-101, 104-182 | Typed schema, defaults, validation, backward-compatible normalization, and preservation metadata for Multi-Tract settings. |
| `src/renderer/components/patient/PatientDetails.js` | 35-37, 104-140, 169-230, 297-320, 403-438 | Idempotent add/open behavior and acknowledged session deletion. |
| `src/renderer/utils/ClinicalScores.js` | 56-95, 212-330, 357-371, 440-461, 578-754, 811-832, 899-932 | Reliable load/save, dirty warnings, outcome creation feedback, and click-to-preview images. |
| `src/renderer/utils/Import.js` | 11, 120-123, 350-390, 499-535, 771-775 | Visible-sheet workbook selection, row/model validation, and acknowledged stimulation import summaries. |

Task-created repository outputs:

| File | Purpose |
|---|---|
| `outputs/bugfix_20260820/Stimulation_Parameters_Template.xlsx` | Byte-identical handoff copy of the repaired workbook. |
| `BUG_FIX_IMPLEMENTATION_REPORT.md` | This report. |

## 5. Lead-DBS change inventory

| File | Current anchors | Purpose |
|---|---:|---|
| `/Volumes/PdBwh/leaddbs/classes/leadgroup/ea_calc_biophysical_lg.m` | 91-98 | Applies each group stimulation's settings and template/native choice before calculation. |
| `/Volumes/PdBwh/leaddbs/ea_elvis.m` | 642-667 | Restricts electrode-scene preparation to the active patient; launches, imports, applies, and saves the result without force-resetting template space. |
| `/Volumes/PdBwh/leaddbs/ea_genvat_butenko.m` | 34-41 | Applies stimulation-carried settings before OSS-DBS preparation. |
| `/Volumes/PdBwh/leaddbs/lead_group.m` | 1302-1423 | Exposes and explains SPARK group mode, validates patients/results, launches safely, imports by ID, and cleans communication files. |
| `/Volumes/PdBwh/leaddbs/programmer/ea_getProgrammerPath.m` | 1-111 | Version `1.1.1` installer/updater, bundled archive preference, staged replacement, rollback on replacement failure, and refreshed Lead-DBS path preference. |
| `/Volumes/PdBwh/leaddbs/programmer/ea_initialize_programmer.m` | 1-94, 320-378 | Selected-subject preparation and standalone settings sidecar. |
| `/Volumes/PdBwh/leaddbs/programmer/ea_input_programmer.m` | 1-61 | Versioned, patient-scoped launch request with settings and exact response path. |
| `/Volumes/PdBwh/leaddbs/programmer/ea_input_programmer_group.m` | 1-42 | Versioned, keyed group request with per-subject stimulation/settings data. |
| `/Volumes/PdBwh/leaddbs/programmer/ea_launch_programmer.m` | 1-23 | New shared path-safe launcher with foreground/background behavior and exit-status reporting. |
| `/Volumes/PdBwh/leaddbs/programmer/ea_process_programmer.m` | 1-104 | Legacy/versioned response normalization and guaranteed communication-file cleanup. |
| `/Volumes/PdBwh/leaddbs/programmer/ea_programmer_apply_runsettings.m` | 1-244 | New allowlisted settings mapper, patient-overlay preservation, optional global persistence, template/native application, and Multi-Tract vector safety. |
| `/Volumes/PdBwh/leaddbs/programmer/ea_programmer_get_runsettings.m` | 1-133 | New JSON-safe Lead-DBS settings export with dynamic connectomes and lossless morphology metadata. |

Installed Lead-DBS bundle files:

| File | Architecture / purpose |
|---|---|
| `/Volumes/PdBwh/leaddbs/programmer/app/release/LeadDBSProgrammer_maca64.zip` | Final Apple Silicon bundle used by `ea_getProgrammerPath`. |
| `/Volumes/PdBwh/leaddbs/programmer/app/release/LeadDBSProgrammer_maci64.zip` | Final Intel macOS bundle used by `ea_getProgrammerPath`. |
| `/Volumes/PdBwh/leaddbs/programmer/app/release/old/LeadDBSProgrammer_maca64-pre-1.1.1.zip` | Preserved pre-1.1.1 archive for reference. |

The App Designer entry point itself remains unchanged: `lead_dbs.mlapp` calls `ea_initialize_programmer(..., "standalone")`; the corrected initializer now derives the selected subjects from the supplied handles.

## 6. Built artifacts and hashes

| Artifact | SHA-256 |
|---|---|
| `release/build/LeadDBSProgrammer-1.1.1-arm64-mac.zip` | `ccd624cb3ba4b647d7f4e62e5df3d41a21a2174d10f711c73db9b246d96c32ed` |
| `/Volumes/PdBwh/leaddbs/programmer/app/release/LeadDBSProgrammer_maca64.zip` | `ccd624cb3ba4b647d7f4e62e5df3d41a21a2174d10f711c73db9b246d96c32ed` |
| `release/build/LeadDBSProgrammer-1.1.1-mac.zip` | `c9f43553863b5de87f7a5b9f91f31754413f2a0e24df33fa611c464101bbfc5d` |
| `/Volumes/PdBwh/leaddbs/programmer/app/release/LeadDBSProgrammer_maci64.zip` | `c9f43553863b5de87f7a5b9f91f31754413f2a0e24df33fa611c464101bbfc5d` |
| `public/Stimulation_Parameters_Template.xlsx` | `f35d8bc568619de87af027cf7e5696719cc8b33f108aff2b2a8cdeef9d0f5f21` |
| `outputs/bugfix_20260820/Stimulation_Parameters_Template.xlsx` | `f35d8bc568619de87af027cf7e5696719cc8b33f108aff2b2a8cdeef9d0f5f21` |

Both macOS archives contain the same `app.asar` (`309445cdd33ba653e99b1e0cc5deeec5cb9406c19d8c40b9831c6c0bf04f8adb`). Their packaged JavaScript, CSS, source maps, and source-map `sourcesContent` match the frozen repository build, and each archive contains the exact repaired workbook.

## 7. Verification performed

- `npm run build`: production main and renderer builds passed. The only warning was the repository's outdated Browserslist data notice.
- `npm test -- --runInBand --passWithNoTests`: exited successfully; the repository currently contains no Jest tests.
- `git diff --check`: passed. It emitted only a benign CRLF notice for an unchanged generated WASM file.
- All five version locations and both packaged `Info.plist` version fields report `1.1.1`.
- Both final ZIPs passed complete archive integrity checks.
- All 12 staged Lead-DBS source files match the installed copies byte-for-byte.
- MATLAB `checkcode` reported zero findings for the two new settings helpers.
- MATLAB fixtures passed for legacy/versioned response normalization, OSS field mapping, template/native behavior, patient-specific preference preservation, unchanged Multi-Tract vectors, edited Multi-Tract scalar expansion, and newly selected Multi-Tract tract-count expansion.
- The workbook passed ZIP/OOXML integrity checks, can be opened by the workbook runtime, contains the expected sheets/range, and contains Excel list validation on the electrode-model columns.
- The full multi-target packaging command produced valid Apple Silicon and Intel ZIPs. Its optional DMG phase failed in `hdiutil`; this does not affect the validated ZIPs installed into Lead-DBS.

## 8. Deployment and rollback notes

- The next call to `ea_getProgrammerPath` will install/update SPARK under the Lead-DBS preferences directory when the installed marker is not `1.1.1`, then refresh `Preferences.json` to the active Lead-DBS checkout.
- The macOS bundles are not Developer-ID signed or notarized. The updater clears quarantine for this local deployment; a public distribution should be signed and notarized.
- No Windows or Linux bundle was built in this task.
- Source rollback snapshots exist at `/private/tmp/leaddbs_programmer_baseline` and `/private/tmp/leaddbs_programmer_fix` for this working session. Durable rollback should use version control and a coordinated archive/version change.

## 9. Out-of-scope pre-existing follow-up candidates

These were not listed in either bug file and were intentionally not mixed into this fix set:

- The manual-folder detector in `src/main/main.ts:825-834` still treats a manually selected folder as Lead-DBS unconditionally.
- Clinical and demographic bulk-import paths still use older optimistic/fire-and-forget feedback; stimulation import is now acknowledged and row-specific.
- Launch parsing still materializes stimulation JSON inputs before the user presses the final Save button.
- The repository's full TypeScript/lint baseline contains extensive pre-existing debt, so verification used production builds, targeted checks, fixtures, archive/source-map comparison, and diff validation.
- A final interactive MATLAB-to-Electron-to-OSS calculation on real patient data is still recommended before a clinical release.
