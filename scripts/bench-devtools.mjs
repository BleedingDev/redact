import { build } from 'esbuild'
import { chromium } from 'playwright'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'

const baseline = process.argv[2]
if (!baseline) throw new Error('Pass the baseline repository directory.')
const current = resolve(import.meta.dirname, '..')
const workload = process.env.BENCH_WORKLOAD || 'full'
const sparseIndex = Number(process.env.BENCH_LEAF || 0)
if (!['full', 'sparse'].includes(workload)) throw new Error('BENCH_WORKLOAD must be full or sparse.')
const reactVersion = createRequire(import.meta.url)('react/package.json').version
const backend = await build({
  stdin: {
    contents: `import {initialize} from 'react-devtools-inline/backend'; initialize(window);`,
    resolveDir: resolve(current, 'tests'),
  },
  bundle: true, write: false, format: 'iife', platform: 'browser',
  tsconfigRaw: { compilerOptions: { useDefineForClassFields: true } },
  define: { 'process.env.NODE_ENV': '"development"' },
})
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_CHANNEL ? { channel: process.env.CHROME_CHANNEL } : {}) })
try {
  for (const attached of [false, true]) {
    const results = { baseline: [], current: [], react: [] }
    const bundles = {}
    for (const [name, directory] of [['baseline', baseline], ['current', current], ['react', current]]) {
      const source = resolve(directory, 'packages/redact/src')
      const result = await build({
        stdin: {
          contents: `
            import {createElement as h, useState, useMemo} from ${JSON.stringify(name === 'react' ? 'react' : source + '/react/index.ts')};
            import {createRoot} from ${JSON.stringify(name === 'react' ? 'react-dom/client' : source + '/dom/client.ts')};
            import {flushSync} from ${JSON.stringify(name === 'react' ? 'react-dom' : source + '/dom/index.ts')};
            let update;
            function Leaf({value}) {
              const [local,set]=useState(0);
              if (${JSON.stringify(workload)}==='sparse' && value===${sparseIndex}) update=set;
              const label=useMemo(()=>String(value+local),[value,local]);return h('span',null,label);
            }
            function App() {
              const [value,set]=useState(0); if (${JSON.stringify(workload)}==='full') update=set;
              return h('div',null,Array.from({length:${workload === 'sparse' ? 1000 : 300}},(_,i)=>h(Leaf,{key:i,value:value+i})));
            }
            window.runBenchmark=()=>{
              const host=document.createElement('div');document.body.append(host);
              const root=createRoot(host);flushSync(()=>root.render(h(App)));
              for(let i=1;i<=20;i++)flushSync(()=>update(i));
              const start=performance.now();
              for(let i=21;i<=120;i++)flushSync(()=>update(i));
              const elapsed=performance.now()-start;
              flushSync(()=>root.unmount());host.remove();return elapsed;
            };
          `,
          resolveDir: current,
        },
        bundle: true, write: false, format: 'iife', metafile: true,
        tsconfigRaw: { compilerOptions: { useDefineForClassFields: true } },
        define: { 'process.env.NODE_ENV': '"development"' },
      })
      if (name === 'react' && !Object.keys(result.metafile.inputs).some(path => path.includes('/react-dom/cjs/'))) throw new Error('The reference must bundle real React DOM, not a source alias.')
      bundles[name] = result.outputFiles[0].text
    }
    const rounds = Number(process.env.BENCH_ROUNDS || 12)
    for (let round = 0; round < rounds; round++) {
      for (const name of round % 2 ? ['react', 'current', 'baseline'] : ['baseline', 'current', 'react']) {
        const page = await browser.newPage()
        if (attached) await page.addScriptTag({ content: backend.outputFiles[0].text })
        await page.addScriptTag({ content: bundles[name] })
        const profiler = process.env.DEVTOOLS_CPU_PROFILE && attached && name === 'current' && round === 0 ? await page.context().newCDPSession(page) : null
        if (profiler) { await profiler.send('Profiler.enable'); await profiler.send('Profiler.start') }
        results[name].push(await page.evaluate(() => window.runBenchmark()))
        if (profiler) {
          const { profile } = await profiler.send('Profiler.stop')
          const nodes = new Map(profile.nodes.map(node => [node.id, node.callFrame.functionName]))
          const totals = new Map()
          profile.samples.forEach((id, index) => totals.set(nodes.get(id), (totals.get(nodes.get(id)) || 0) + profile.timeDeltas[index]))
          console.log('CPU profile', [...totals].sort((a,b)=>b[1]-a[1]).slice(0,25))
          await profiler.detach()
        }
        await page.close()
      }
    }
    const median = values => { const sorted = [...values].sort((a,b)=>a-b); return (sorted[Math.floor((sorted.length - 1)/2)] + sorted[Math.floor(sorted.length/2)])/2 }
    console.log(JSON.stringify({ workload, sparseIndex, reactVersion, attached, samples: results, medianBaselineMs: median(results.baseline), medianCurrentMs: median(results.current), medianReactMs: median(results.react), ratio: median(results.current)/median(results.baseline) }))
  }
} finally {
  await browser.close()
}
