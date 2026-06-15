// EX4: <Wizard> mounts the engine, renders default UI, and honors uiOverrides
// per-component.

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Wizard } from '../src/components/Wizard.js';
import { makeBridge, makeConfig, makeItem } from './helpers.js';
import type { UIComponentMap } from '../src/types.js';

afterEach(cleanup);

const CustomPlanStrip: UIComponentMap['PlanStrip'] = () => <div>CUSTOM PLAN STRIP</div>;

describe('<Wizard> top-level component (EX4)', () => {
  it('mounts engine and renders default UI components', () => {
    const bridge = makeBridge();
    render(<Wizard config={makeConfig()} bridge={bridge} />);

    expect(screen.getByLabelText('Wizard steps')).toBeTruthy(); // default StepNav
    expect(screen.getByText('No items yet.')).toBeTruthy(); // default PlanStrip
    expect(screen.getByText('No active question.')).toBeTruthy(); // idle state
    bridge.destroy();
  });

  it('uiOverrides take precedence over defaults per-component', () => {
    const bridge = makeBridge();
    const config = makeConfig({ uiOverrides: { PlanStrip: CustomPlanStrip } });
    render(<Wizard config={config} bridge={bridge} />);

    expect(screen.getByText('CUSTOM PLAN STRIP')).toBeTruthy();
    expect(screen.queryByText('No items yet.')).toBeNull(); // default replaced
    bridge.destroy();
  });

  it('non-overridden components still render defaults', () => {
    const bridge = makeBridge();
    const config = makeConfig({ uiOverrides: { PlanStrip: CustomPlanStrip } });
    render(<Wizard config={config} bridge={bridge} />);

    // StepNav was not overridden → its default is still present.
    expect(screen.getByLabelText('Wizard steps')).toBeTruthy();
    bridge.destroy();
  });

  it('re-mount preserves Bridge subscription correctly', async () => {
    const bridge = makeBridge({ aiGenerate: async () => [makeItem('e1', 'design')] });
    const { unmount } = render(<Wizard config={makeConfig()} bridge={bridge} />);
    unmount();

    const { container } = render(<Wizard config={makeConfig()} bridge={bridge} />);
    await act(async () => {
      await bridge.submit('x'); // stages a proposal → ConfirmCard renders
    });

    expect(container.textContent).toContain('Review what the AI proposed');
    bridge.destroy();
  });
});
