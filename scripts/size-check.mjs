#!/usr/bin/env node
import { measureSizes } from './measure-size.mjs'

// These are intentional release budgets, not a claim that the expanded API
// surface is smaller than the previous release. See benchmarks/SHIP_RESULTS.md.
// Keep the built package under test, source-only checks missed baked-in dev code.
const BUDGETS = {
  'redact': 2793,
  'redact/jsx-runtime': 217,
  // Hydration and Suspense correctness costs are measured against pristine main.
  // Only exceeded limits changed, with no added margin.
  // See benchmarks/HYDRATION_SUSPENSE_RECOVERY.md for the complete comparison.
  'redact/dom': 25949,
  'redact/dom-client': 25461,
  'redact/server': 9318,
  'client total': 28634,
  'client total (default Vite)': 23814,
  'redact/dom-client (activity=stub)': 24911,
  'redact/dom-client (fragmentRefs=stub)': 23273,
  'redact/dom-client (viewTransitions=stub)': 20674,
  'redact/dom-client (portal=stub)': 25428,
  'redact/dom-client (context=stub)': 25179,
  'redact/dom-client (suspense=stub)': 23907,
  'redact/dom-client (memo=stub)': 25371,
  'redact/dom-client (forwardRef=stub)': 25415,
  'redact/dom-client (lazy=stub)': 25449,
  'redact/dom-client (classComponents=stub)': 24857,
  'redact/dom-client (hydration=stub)': 22986,
  'redact/dom-client (nano)': 12905,
}

let failed = false
for (const tree of ['src', 'dist']) {
  for (const row of await measureSizes(tree)) {
    const budget = BUDGETS[row.name]
    const ok = budget !== undefined && row.gz <= budget
    failed ||= !ok
    console.log(`${ok ? 'PASS' : 'FAIL'} ${tree} ${row.name}: ${row.gz} B gzip, budget ${budget ?? 'missing'}`)
  }
}
if (failed) {
  console.error('\nSize budget exceeded or missing. Review the measured cost before changing a budget.')
  process.exitCode = 1
} else console.log('\nAll source and built-package size budgets passed.')
