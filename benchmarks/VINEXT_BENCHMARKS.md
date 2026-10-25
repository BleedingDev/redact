Ran all seven scenarios from the [Vinext benchmark suite](https://github.com/cloudflare/vinext/tree/5c2c5b76abff857bfcf9e0dc266cf750ad56b4a6/benchmarks/perf) on October 25, 2026. There were six measured rounds per implementation, 108 measurements total, plus one separate preflight round. Every benchmark and all six browser workload checks passed.

**Redact reduced Vinext's emitted client output by 39.4 KB gzip, or 25.4%.** The browser entry and its eager JavaScript imports were 39.2 KB smaller, or 27.2%. Both client measurements were identical across all six builds.

| Metric, median of six rounds | Next.js + React | Vinext + React | Vinext + Redact | Redact change within Vinext |
| --- | ---: | ---: | ---: | ---: |
| Dev cold start, App Router | 777 ms | 868 ms | 875 ms | +0.8%, inconclusive |
| Dev cold start, large Pages Router | 9,302 ms | 6,999 ms | 7,107 ms | +1.5%, inconclusive |
| Clean production build | 1,240 ms | 906 ms | 924 ms | +1.9%, 18 ms slower |
| All emitted client JS and CSS, gzip | 190.0 KB | 154.9 KB | 115.5 KB | 25.4% smaller |
| Browser entry and eager JS imports, gzip | Not provided by this suite | 144.2 KB | 105.0 KB | 27.2% smaller |
| RSC entry and eager imports, gzip | Not provided by this suite | 145.7 KB | 145.7 KB | Under 0.1% difference |
| All server JS and CSS, gzip | Not provided by this suite | 253.1 KB | 253.0 KB | Under 0.1% difference |

KB means 1,000 bytes. The total client figure includes output for lazy routes, so it is not the amount downloaded for one page. The browser-entry figure follows eager static imports and also does not include every possible route request.

Against this suite's pinned Next.js baseline, Vinext with Redact emitted 74.5 KB less compressed client output, or 39.2%. That comparison changes both the framework and browser renderer. The direct React versus Redact comparison holds the Vinext version and dependencies constant.

The timing results show a small build-time cost, with no clear startup improvement or regression. The paired 95% bootstrap intervals for the Redact change were -6.2% to +4.9% for App Router startup, -2.8% to +6.9% for large Pages Router startup, and +0.8% to +2.3% for production builds. These intervals enumerate all 46,656 resamples of the six paired rounds. This is a local workstation measurement with six rounds, so small differences should not be generalized to other machines or projects.

**This suite does not measure browser rendering, hydration time, interaction responsiveness, production SSR throughput, LCP, or INP.** The browser checks verified behavior and renderer identity, not speed. The server still uses native React in both Vinext configurations. The few bytes of server-output variation do not establish a server runtime improvement.

The generated workloads were unchanged: a 33-route App Router app, and a 30-page Pages Router app importing 3,200 components from 40 local packages. Content hashes matched across all three configurations. The only candidate configuration change was adding `redact()` after `vinext()` in both Vite configs.

The measurement adapters and generators came unchanged from upstream commit `5c2c5b76abff857bfcf9e0dc266cf750ad56b4a6`. Published, unpatched `vinext@1.3.0` was used in place of building Vinext from source. The same adapter commands were called directly by a local runner that used all six permutations of the three implementations. Builds and servers ran sequentially, cold-start caches were cleared by the upstream adapter, and sizes were measured after each production build. No measured samples were discarded. CodSpeed profiling was disabled.

The environment was macOS on an Apple M5 Pro with 18 CPU cores and 64 GiB RAM, Node 24.22.0, and the suite's Vite+ 1.3.0 toolchain. Vinext used React 19.3.1, React plugin 6.1.2, and RSC plugin 0.5.38. The Next.js fixture retained upstream's Next.js 16.2.7 and React 19.2.7 pins. Background iCloud processes consumed about two CPU cores during setup and completion; PerfPowerServices consumed about another core at completion.

The frozen Redact candidate tarball SHA-256 was `8a9d69cc858ad6ce31fce298e2e20312e75db92f2f2e1aaf10ded56b44bcba97`. Its package version is 0.1.5, but the hash identifies this candidate's contents. No runtime source or dependency patches were made for this measurement.

Before timing, Chromium 156.0.8078.4 checks passed for all three production App Router apps and all three development Pages Router apps. Production checks exercised the counter and search input. All six checks verified the intended browser renderer and had no uncaught browser errors.

[Raw results, versions, hashes, confidence intervals, and every measurement](results/vinext-official-2026-10-25.json) are saved with this report. The complete local experiment, dependency locks, runner, untouched upstream harness, and logs are in `/private/tmp/redact-vinext-official-benchmark-20261025`. It can be inspected without rebuilding anything. Reproduction commands are included in the JSON; use a fresh evidence directory when rerunning.
