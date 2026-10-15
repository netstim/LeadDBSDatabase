import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildSeegMatlabCommand, prepareSeegModeling, resolveLeadDbsRoot } from './seegModeling';

describe('sEEG modeling launch preparation', () => {
  let tempRoot: string;
  let datasetRoot: string;
  let leaddbsRoot: string;
  let stimDir: string;
  let matlabPath: string;
  const patientId = 'sub-01';
  const previousMatlabBin = process.env.MATLAB_BIN;
  const previousLeadDbsRoot = process.env.LEADDBS_ROOT;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seeg-model-'));
    datasetRoot = path.join(tempRoot, 'dataset');
    leaddbsRoot = path.join(tempRoot, 'leaddbs');
    stimDir = path.join(datasetRoot, 'derivatives', 'leaddbs', patientId, 'stimulations');
    matlabPath = path.join(tempRoot, 'matlab');
    fs.mkdirSync(stimDir, { recursive: true });
    fs.mkdirSync(path.join(leaddbsRoot, 'ext_libs', 'OSS-DBS', 'sEEG'), { recursive: true });
    fs.mkdirSync(path.join(leaddbsRoot, 'templates', 'space'), { recursive: true });
    fs.writeFileSync(path.join(leaddbsRoot, 'ext_libs', 'OSS-DBS', 'sEEG', 'sEEG_RF_pipeline.m'), '');
    fs.writeFileSync(matlabPath, '');
    process.env.MATLAB_BIN = matlabPath;
    fs.writeFileSync(
      path.join(stimDir, `${patientId}_stimparameters.tsv`),
      'name\tx\ty\tz\tgroup\telectrode\nA1\t1\t2\t3\tA\tDIXI D08-08AM',
    );
    fs.writeFileSync(
      path.join(stimDir, `${patientId}_stimparameters_A.csv`),
      'A1\n+2.5\nNone',
    );
  });

  afterEach(() => {
    if (previousMatlabBin === undefined) delete process.env.MATLAB_BIN;
    else process.env.MATLAB_BIN = previousMatlabBin;
    if (previousLeadDbsRoot === undefined) delete process.env.LEADDBS_ROOT;
    else process.env.LEADDBS_ROOT = previousLeadDbsRoot;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('reads the installed Lead-DBS path from Programmer preferences', () => {
    delete process.env.LEADDBS_ROOT;
    const installDir = path.join(tempRoot, 'Programmer');
    fs.mkdirSync(installDir);
    fs.writeFileSync(
      path.join(installDir, 'Preferences.json'),
      JSON.stringify({ LeadDBS_Path: leaddbsRoot }),
    );
    const executable = path.join(
      installDir, 'LeadDBSProgrammer.app', 'Contents', 'MacOS', 'LeadDBSProgrammer',
    );
    expect(resolveLeadDbsRoot(undefined, executable)).toBe(leaddbsRoot);
    expect(resolveLeadDbsRoot('/explicit/leaddbs', executable)).toBe('/explicit/leaddbs');
  });

  it('uses the selected patient without requiring a patient T2 anchor', () => {
    const prepared = prepareSeegModeling(datasetRoot, patientId, leaddbsRoot);
    expect(prepared.matlabPath).toBe(matlabPath);
    expect(prepared.command).toContain(`sEEG_RF_pipeline('${stimDir}');`);
    expect(prepared.command).not.toContain('t2.nii');
    expect(prepared.logPath).toBe(path.join(stimDir, `${patientId}_desc-seegModeling.log`));
  });

  it('rejects incomplete amplitudes before the app closes', () => {
    fs.writeFileSync(path.join(stimDir, `${patientId}_stimparameters_A.csv`), 'A1\n+');
    expect(() => prepareSeegModeling(datasetRoot, patientId, leaddbsRoot)).toThrow(/numeric amplitude/);
  });

  it('rejects a Lead-DBS checkout without space templates', () => {
    fs.rmdirSync(path.join(leaddbsRoot, 'templates', 'space'));
    expect(() => prepareSeegModeling(datasetRoot, patientId, leaddbsRoot)).toThrow(/space templates/);
  });

  it('escapes apostrophes in MATLAB string arguments', () => {
    expect(buildSeegMatlabCommand("/data/O'Brien", '/stim'))
      .toContain("'/data/O''Brien'");
  });
});
