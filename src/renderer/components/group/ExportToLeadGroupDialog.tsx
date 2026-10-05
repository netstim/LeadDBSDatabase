import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';

interface SelectedPatient {
  id: string;
}

interface StimulationOption {
  timeline: string;
  label?: string;
  model?: string;
}

interface ClinicalOutcomeValue {
  key: string;
  label?: string;
  scoreType?: string;
  item?: string;
  mode?: string;
  value?: number | null;
}

interface ClinicalSessionOption {
  timeline: string;
  outcomes?: ClinicalOutcomeValue[];
}

interface PatientExportOptions {
  id: string;
  stimulations?: StimulationOption[];
  clinicalSessions?: ClinicalSessionOption[];
}

interface OutcomeOption {
  key: string;
  label?: string;
  scoreType?: string;
  item?: string;
  mode?: string;
  coverage?: number | { available?: number; total?: number };
}

interface ExportOptionsResponse {
  patients?: PatientExportOptions[];
  outcomes?: OutcomeOption[];
  success?: boolean;
  error?: string;
  warnings?: string[];
}

interface OutcomeCatalogEntry extends OutcomeOption {
  label: string;
  availablePatientIds: Set<string>;
  availableCount: number;
  missingPatientIds: string[];
}

interface ExportToLeadGroupDialogProps {
  open: boolean;
  directoryPath: string | null;
  leadDBS: boolean;
  patients: SelectedPatient[];
  onClose: () => void;
  onExportSuccess: (filePath: string) => void;
}

const analysisIdPattern = /^[A-Za-z0-9]+$/;

const outcomeLabel = (outcome: OutcomeOption): string => {
  if (outcome.label) return outcome.label;
  const detail = outcome.item || outcome.mode;
  return [outcome.scoreType, detail].filter(Boolean).join(' — ') || outcome.key;
};

const providedCoverageCount = (
  coverage: OutcomeOption['coverage'],
  patientCount: number,
): number | null => {
  if (typeof coverage === 'object' && coverage !== null) {
    return typeof coverage.available === 'number'
      ? Math.max(0, Math.min(patientCount, coverage.available))
      : null;
  }
  if (typeof coverage !== 'number' || !Number.isFinite(coverage)) return null;
  return Math.max(0, Math.min(patientCount, coverage));
};

function ExportToLeadGroupDialog({
  open,
  directoryPath,
  leadDBS,
  patients,
  onClose,
  onExportSuccess,
}: ExportToLeadGroupDialogProps) {
  const [options, setOptions] = useState<ExportOptionsResponse | null>(null);
  const [stimulationSelections, setStimulationSelections] = useState<
    Record<string, string>
  >({});
  const [selectedOutcomeKeys, setSelectedOutcomeKeys] = useState<string[]>([]);
  const [analysisId, setAnalysisId] = useState('');
  const [allowMissing, setAllowMissing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;

    let active = true;
    const loadOptions = async () => {
      setLoading(true);
      setError('');
      setOptions(null);
      setStimulationSelections({});
      setSelectedOutcomeKeys([]);
      setAnalysisId('');
      setAllowMissing(false);

      try {
        if (!directoryPath) {
          throw new Error('Choose a dataset before exporting to Lead-Group.');
        }
        if (patients.length === 0) {
          throw new Error('Select at least one patient to export.');
        }

        const response = (await window.electron.ipcRenderer.invoke(
          'get-lead-group-export-options',
          {
            directoryPath,
            leadDBS,
            patientIds: patients.map(({ id }) => id),
          },
        )) as ExportOptionsResponse;

        if (!response || response.success === false) {
          throw new Error(
            response?.error || 'Lead-Group export options could not be loaded.',
          );
        }

        const responsePatients = Array.isArray(response.patients)
          ? response.patients
          : [];
        const automaticSelections: Record<string, string> = {};
        patients.forEach(({ id }) => {
          const patientOptions = responsePatients.find(
            (candidate) => candidate.id === id,
          );
          if (patientOptions?.stimulations?.length === 1) {
            automaticSelections[id] = patientOptions.stimulations[0].timeline;
          }
        });

        if (active) {
          setOptions({ ...response, patients: responsePatients });
          setStimulationSelections(automaticSelections);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Lead-Group export options could not be loaded.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadOptions();
    return () => {
      active = false;
    };
  }, [open, directoryPath, leadDBS, patients]);

  const patientOptionsById = useMemo(
    () =>
      new Map(
        (options?.patients || []).map((patientOptions) => [
          patientOptions.id,
          patientOptions,
        ]),
      ),
    [options],
  );

  const outcomeCatalog = useMemo<OutcomeCatalogEntry[]>(() => {
    const catalog = new Map<
      string,
      OutcomeOption & {
        availablePatientIds: Set<string>;
        sawPatientValues: boolean;
      }
    >();

    (options?.outcomes || []).forEach((outcome) => {
      if (!outcome?.key) return;
      catalog.set(outcome.key, {
        ...outcome,
        availablePatientIds: new Set<string>(),
        sawPatientValues: false,
      });
    });

    patients.forEach(({ id }) => {
      const patientOptions = patientOptionsById.get(id);
      (patientOptions?.clinicalSessions || []).forEach((session) => {
        (session.outcomes || []).forEach((outcome) => {
          if (!outcome?.key) return;
          const existing = catalog.get(outcome.key) || {
            ...outcome,
            availablePatientIds: new Set<string>(),
            sawPatientValues: false,
          };
          existing.sawPatientValues = true;
          if (
            typeof outcome.value === 'number' &&
            Number.isFinite(outcome.value)
          ) {
            existing.availablePatientIds.add(id);
          }
          catalog.set(outcome.key, existing);
        });
      });
    });

    return Array.from(catalog.values()).map((outcome) => {
      const providedCount = providedCoverageCount(
        outcome.coverage,
        patients.length,
      );
      const availableCount = outcome.sawPatientValues
        ? outcome.availablePatientIds.size
        : providedCount ?? 0;
      return {
        ...outcome,
        label: outcomeLabel(outcome),
        availableCount,
        missingPatientIds: outcome.sawPatientValues
          ? patients
              .filter(({ id }) => !outcome.availablePatientIds.has(id))
              .map(({ id }) => id)
          : [],
      };
    });
  }, [options, patientOptionsById, patients]);

  const outcomeByKey = useMemo(
    () => new Map(outcomeCatalog.map((outcome) => [outcome.key, outcome])),
    [outcomeCatalog],
  );

  const missingStimulationPatients = patients.filter(
    ({ id }) => !stimulationSelections[id],
  );
  const incompleteOutcomes = selectedOutcomeKeys
    .map((key) => outcomeByKey.get(key))
    .filter(
      (outcome): outcome is OutcomeCatalogEntry =>
        !!outcome && outcome.availableCount < patients.length,
    );
  const selectedModels = patients
    .map(({ id }) => {
      const timeline = stimulationSelections[id];
      return patientOptionsById
        .get(id)
        ?.stimulations?.find((option) => option.timeline === timeline)?.model;
    })
    .filter((model): model is string => Boolean(model));
  const hasMixedModels = new Set(selectedModels).size > 1;
  const analysisIdIsValid = analysisIdPattern.test(analysisId.trim());
  const canExport =
    !loading &&
    !exporting &&
    !!options &&
    analysisIdIsValid &&
    missingStimulationPatients.length === 0 &&
    selectedOutcomeKeys.length > 0 &&
    !hasMixedModels &&
    (allowMissing || incompleteOutcomes.length === 0);

  const handleOutcomeChange = (event: SelectChangeEvent<string[]>) => {
    const { value } = event.target;
    setSelectedOutcomeKeys(
      typeof value === 'string' ? value.split(',').filter(Boolean) : value,
    );
    setError('');
  };

  const handleExport = async () => {
    if (!canExport || !directoryPath) return;

    setExporting(true);
    setError('');
    try {
      const result = (await window.electron.ipcRenderer.invoke(
        'export-lead-group',
        {
          directoryPath,
          leadDBS,
          analysisId: analysisId.trim(),
          subjects: patients.map(({ id }) => ({
            id,
            stimulationTimeline: stimulationSelections[id],
          })),
          outcomeKeys: selectedOutcomeKeys,
          allowMissing,
        },
      )) as {
        success?: boolean;
        error?: string;
        filePath?: string;
        analysisPath?: string;
        analysisFile?: string;
        manifestPath?: string;
        outputPath?: string;
        path?: string;
      };

      if (!result || result.success === false) {
        throw new Error(result?.error || 'The Lead-Group export failed.');
      }

      const filePath =
        result.filePath ||
        result.analysisPath ||
        result.analysisFile ||
        result.manifestPath ||
        result.outputPath ||
        result.path ||
        `Lead-Group analysis "${analysisId.trim()}"`;
      onExportSuccess(filePath);
      onClose();
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : 'The Lead-Group export failed.',
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={exporting ? undefined : onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="export-lead-group-title"
    >
      <DialogTitle id="export-lead-group-title">
        Export selected patients to Lead-Group
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Typography variant="body2" color="text.secondary">
            Choose one saved stimulation for each of the {patients.length}{' '}
            selected patient{patients.length === 1 ? '' : 's'}, then add one or
            more clinical outcomes.
          </Typography>

          <TextField
            label="Analysis ID"
            value={analysisId}
            onChange={(event) => {
              setAnalysisId(event.target.value);
              setError('');
            }}
            error={analysisId.length > 0 && !analysisIdIsValid}
            helperText="Use letters and numbers only."
            disabled={loading || exporting}
            fullWidth
            required
          />

          {loading && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1.5,
                py: 4,
              }}
            >
              <CircularProgress size={24} />
              <Typography>Loading saved sessions and outcomes…</Typography>
            </Box>
          )}

          {!loading && options && (
            <>
              {Array.isArray(options.warnings) &&
                options.warnings.length > 0 && (
                  <Alert severity="warning">
                    Some saved sessions could not be read:
                    <Box component="ul" sx={{ mb: 0, mt: 1, pl: 3 }}>
                      {options.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </Box>
                  </Alert>
                )}
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Stimulation sessions
                </Typography>
                <TableContainer
                  sx={{ maxHeight: 280, border: '1px solid #ddd' }}
                >
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Patient</TableCell>
                        <TableCell>Saved stimulation</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {patients.map(({ id }) => {
                        const stimulationOptions =
                          patientOptionsById.get(id)?.stimulations || [];
                        return (
                          <TableRow key={id}>
                            <TableCell component="th" scope="row">
                              {id}
                            </TableCell>
                            <TableCell>
                              {stimulationOptions.length > 0 ? (
                                <FormControl fullWidth size="small" required>
                                  <InputLabel id={`stimulation-label-${id}`}>
                                    Stimulation
                                  </InputLabel>
                                  <Select
                                    labelId={`stimulation-label-${id}`}
                                    label="Stimulation"
                                    value={stimulationSelections[id] || ''}
                                    onChange={(event) => {
                                      setStimulationSelections((current) => ({
                                        ...current,
                                        [id]: event.target.value,
                                      }));
                                      setError('');
                                    }}
                                    disabled={exporting}
                                  >
                                    {stimulationOptions.map((stimulation) => (
                                      <MenuItem
                                        key={stimulation.timeline}
                                        value={stimulation.timeline}
                                      >
                                        {stimulation.label ||
                                          stimulation.timeline}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              ) : (
                                <Alert severity="warning">
                                  No saved stimulation
                                </Alert>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              {hasMixedModels && (
                <Alert severity="error">
                  A Lead-Group analysis uses one VTA model. Choose stimulation
                  sessions that use the same model for every patient.
                </Alert>
              )}

              <FormControl fullWidth required disabled={exporting}>
                <InputLabel id="lead-group-outcomes-label">
                  Clinical outcomes
                </InputLabel>
                <Select
                  labelId="lead-group-outcomes-label"
                  multiple
                  label="Clinical outcomes"
                  value={selectedOutcomeKeys}
                  onChange={handleOutcomeChange}
                  renderValue={(selected) =>
                    selected
                      .map((key) => outcomeByKey.get(key)?.label || key)
                      .join(', ')
                  }
                >
                  {outcomeCatalog.map((outcome) => (
                    <MenuItem key={outcome.key} value={outcome.key}>
                      <Checkbox
                        checked={selectedOutcomeKeys.includes(outcome.key)}
                      />
                      <ListItemText
                        primary={outcome.label}
                        secondary={`${outcome.availableCount} of ${patients.length} patients`}
                      />
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  Each outcome becomes a patient-aligned Lead-Group variable.
                </FormHelperText>
              </FormControl>

              {outcomeCatalog.length === 0 && (
                <Alert severity="warning">
                  No saved clinical outcomes were found for the selected
                  patients.
                </Alert>
              )}

              {selectedOutcomeKeys.length > 0 && (
                <Stack spacing={1}>
                  <Typography variant="subtitle2">Outcome coverage</Typography>
                  {selectedOutcomeKeys.map((key) => {
                    const outcome = outcomeByKey.get(key);
                    if (!outcome) return null;
                    const incomplete = outcome.availableCount < patients.length;
                    return (
                      <Alert
                        key={key}
                        severity={incomplete ? 'warning' : 'success'}
                      >
                        {outcome.label}: {outcome.availableCount} of{' '}
                        {patients.length} patients
                        {outcome.missingPatientIds.length > 0
                          ? ` (missing: ${outcome.missingPatientIds.join(
                              ', ',
                            )})`
                          : ''}
                      </Alert>
                    );
                  })}
                </Stack>
              )}

              <FormControlLabel
                control={
                  <Checkbox
                    checked={allowMissing}
                    onChange={(event) => {
                      setAllowMissing(event.target.checked);
                      setError('');
                    }}
                    disabled={exporting}
                  />
                }
                label="Allow missing outcome values (export them as NaN)"
              />
            </>
          )}

          {error && <Alert severity="error">{error}</Alert>}
          {!error && !loading && missingStimulationPatients.length > 0 && (
            <Alert severity="info">
              Select a stimulation for every patient before exporting.
            </Alert>
          )}
          {!error &&
            !loading &&
            selectedOutcomeKeys.length > 0 &&
            incompleteOutcomes.length > 0 &&
            !allowMissing && (
              <Alert severity="info">
                Some outcomes are incomplete. Choose complete outcomes or allow
                missing values.
              </Alert>
            )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={exporting}>
          Cancel
        </Button>
        <Button
          onClick={handleExport}
          variant="contained"
          disabled={!canExport}
          startIcon={exporting ? <CircularProgress size={16} /> : undefined}
        >
          {exporting ? 'Exporting…' : 'Export to Lead-Group'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ExportToLeadGroupDialog;
