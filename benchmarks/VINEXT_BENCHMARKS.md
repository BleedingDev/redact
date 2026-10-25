Ran all seven scenarios from the [Vinext benchmark suite](https://github.com/cloudflare/vinext/tree/5c2c5b76abff857bfcf9e0dc266cf750ad56b4a6/benchmarks/perf) on October 25, 2026 using the final compatibility candidate. There were six measured rounds per implementation, 108 measurements total, plus one separate preflight round. Every benchmark and all six browser workload checks passed.

**Redact reduced Vinext's emitted client output by 39.4 KB gzip, or 25.4%.** The browser entry and its eager JavaScript imports were 39.2 KB smaller, or 27.2%. Both client measurements were identical across all six builds.

| Metric, median of six rounds | Next.js + React | Vinext + React | Vinext + Redact | Redact change within Vinext |
| --- | ---: | ---: | ---: | ---: |
| Dev cold start, App Router | 737 ms | 920 ms | 900 ms | 2.2% faster, 20 ms |
| Dev cold start, large Pages Router | 8,817 ms | 6,568 ms | 6,248 ms | 4.9% faster, 320 ms |
| Clean production build | 1,240 ms | 940 ms | 940 ms | No clear difference |
| All emitted client JS and CSS, gzip | 190.0 KB | 154.9 KB | 115.5 KB | 25.4% smaller |
| Browser entry and eager JS imports, gzip | Not provided by this suite | 144.2 KB | 105.0 KB | 27.2% smaller |
| RSC entry and eager imports, gzip | Not provided by this suite | 145.7 KB | 145.7 KB | Under 0.1% difference |
| All server JS and CSS, gzip | Not provided by this suite | 253.1 KB | 253.0 KB | Under 0.1% difference |

KB means 1,000 bytes. The total client figure includes output for lazy routes, so it is not the amount downloaded for one page. The browser-entry figure follows eager static imports and also does not include every possible route request.

Against this suite's pinned Next.js baseline, Vinext with Redact emitted 74.5 KB less compressed client output, or 39.2%. That comparison changes both the framework and browser renderer. The direct React versus Redact comparison holds the Vinext version, dependencies, workloads, and maintained framework corrections constant.

The timing results show modest development-startup reductions on this machine and no clear build-time difference. The paired 95% bootstrap intervals for the Redact change were -3.9% to -0.3% for App Router startup, -6.0% to -4.0% for large Pages Router startup, and -1.4% to +1.7% for production builds. These intervals enumerate all 46,656 resamples of the six paired rounds. This is a local workstation measurement with six rounds, so small differences should not be generalized to other machines or projects.

**This suite does not measure browser rendering, hydration time, interaction responsiveness, production SSR throughput, LCP, or INP.** The browser checks verified behavior and renderer identity, not speed. The server still uses native React in both Vinext configurations. The few bytes of server-output variation do not establish a server runtime improvement.

The generated workloads were unchanged: a 33-route App Router app, and a 30-page Pages Router app importing 3,200 components from 40 local packages. Content hashes matched across all three configurations and the prior experiment. Both Vinext configurations add the shipped Redact integration after `vinext()`, with `renderer: 'react'` for the native control and `renderer: 'redact'` for the candidate. This applies the same framework corrections to both while preserving the intended browser renderer.

The measurement adapters and generators came unchanged from upstream commit `5c2c5b76abff857bfcf9e0dc266cf750ad56b4a6`. Published `vinext@1.3.0` was used in place of building Vinext from source. Redact's maintained corrections run through Vite hooks, without edits to installed Vinext files. Both variants use the documented Satori override to fflate 0.7.5. The same adapter commands were called directly by a local runner that used all six permutations of the three implementations. Builds and servers ran sequentially, cold-start caches were cleared by the upstream adapter, and sizes were measured after each production build. No measured samples were discarded. CodSpeed profiling was disabled.

The environment was macOS on an Apple M5 Pro with 18 CPU cores and 64 GiB RAM, Node 24.22.0, and the suite's Vite+ 1.3.0 toolchain. Vinext used React 19.3.1, React plugin 6.1.2, and RSC plugin 0.5.38. The Next.js fixture retained upstream's Next.js 16.2.7 and React 19.2.7 pins. Local compatibility and hosted verification finished before the measured rounds. Each sample records system load and free memory.

The frozen Redact candidate tarball SHA-256 was `6f8592d92061ab3845b11a5635a2853ec5ba61b600f7ca213cfa42b510ec1099`, from source commit `0e879521fbd4ae7637bfcadae1841c2ef0f44c97`. Its package version is 0.1.5, but the hash identifies this candidate's contents. It is the same tarball used for the complete local and hosted Vinext compatibility gates.

Before timing, Chromium checks passed for all three production App Router apps and all three development Pages Router apps. Production checks exercised the counter and search input. All six checks verified the intended browser renderer and had no uncaught browser errors.

[Raw final results, versions, hashes, confidence intervals, and every measurement](results/vinext-final-2026-10-25.json) are saved with this report. The complete local experiment, dependency locks, runner, untouched upstream harness, and logs are in `/private/tmp/redact-vinext-final-benchmark-20261025`. Use a fresh evidence directory when rerunning.

The [earlier candidate's measurements](results/vinext-official-2026-10-25.json) remain available. That run recorded an 18 ms build cost and inconclusive startup differences. The final candidate reproduces its client sizes, while the new timing results above supersede those earlier launch claims.
