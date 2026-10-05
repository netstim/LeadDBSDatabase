/** @jest-environment node */

import withoutStimulationContacts, {
  LEAD_DBS_SOURCE_INDICES,
} from './leadDbsSources';

test('uses the four source indices shared by both Lead-DBS hemispheres', () => {
  expect([...LEAD_DBS_SOURCE_INDICES]).toEqual([1, 2, 3, 4]);
});

test('removes every old electrode contact while retaining source settings', () => {
  const source = {
    case: { perc: 100, pol: 2 },
    k1: { perc: 50, pol: 1 },
    k8: { perc: 50, pol: 1 },
    k16: { perc: 100, pol: 2 },
    keeper: { k1: 'nested values are not source contacts' },
    amp: 4,
    frequency: 130,
    pulseWidth: 60,
  };

  expect(withoutStimulationContacts(source)).toEqual({
    case: { perc: 100, pol: 2 },
    keeper: { k1: 'nested values are not source contacts' },
    amp: 4,
    frequency: 130,
    pulseWidth: 60,
  });
  expect(source.k16).toEqual({ perc: 100, pol: 2 });
});

test('handles a missing source', () => {
  expect(withoutStimulationContacts(undefined)).toEqual({});
});
