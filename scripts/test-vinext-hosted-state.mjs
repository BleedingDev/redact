import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import HostedCache from './vinext-hosted-cache.mjs'
const root=fileURLToPath(new URL('..', import.meta.url))
const consumer=process.env.VINEXT_TEST_CONSUMER
assert.ok(consumer, 'Set VINEXT_TEST_CONSUMER to the installed package fixture')
const { build }=createRequire(root+'/package.json')('esbuild')
const { Miniflare, convertV4MiniflareOptions }=createRequire(consumer+'/package.json')('miniflare')
const source=await readFile(root+'/scripts/vinext-hosted-state.mjs','utf8')
const built=await build({stdin:{contents:source,resolveDir:consumer},bundle:true,write:false,platform:'neutral',format:'esm',external:['cloudflare:workers','node:*']})
const mf=new Miniflare(convertV4MiniflareOptions({name:'state',modules:true,script:built.outputFiles[0].text,compatibilityDate:'2026-10-24',compatibilityFlags:['nodejs_compat'],bindings:{TEST_KEY:'test'},durableObjects:{STATE:{className:'HostedTestState',useSQLite:true}}}))
try {
 const worker=await mf.getWorker()
 const cache=new HostedCache({env:{REDACT_TEST_STATE:worker,REDACT_CACHE_NAMESPACE:'app'}})
 const second=new HostedCache({env:{REDACT_TEST_STATE:worker,REDACT_CACHE_NAMESPACE:'app'}})
 const first=await cache.get('missing')
 assert.equal(first,null)
 await worker.cache('app','set',['record',{kind:'FETCH',data:{headers:{},body:'old',url:'https://example.test'},revalidate:false},{tags:['record']}])
 assert.equal((await second.get('record')).value.data.body,'old')
 assert.equal(await worker.cache('other-app','get',['record']),null)
 await cache.revalidateTag(['record'])
 assert.equal(await second.get('record'),null)
 const bytes=new Uint8Array([0,128,255])
 await worker.cache('app','set',['flight',{kind:'APP_PAGE',html:'<h1>Saved</h1>',rscData:bytes},{tags:['page']}])
 assert.deepEqual((await worker.cache('app','get',['flight'])).value.rscData,bytes)
 const waiting=mf.dispatchFetch('http://localhost/test/wait').then(response=>response.text())
 const deadline=Date.now()+10000
 while(!(await(await mf.dispatchFetch('http://localhost/test')).json()).pending) {
  assert.ok(Date.now()<deadline); await new Promise(done=>setTimeout(done,20))
 }
 assert.deepEqual(await(await mf.dispatchFetch('http://localhost/test',{method:'POST'})).json(),{released:1})
 assert.equal(await waiting,'released')
 assert.equal((await mf.dispatchFetch('http://localhost/wrong')).status,404)
 const response=await mf.dispatchFetch('http://localhost/test/records/key',{method:'PUT',body:'saved'})
 assert.equal(response.status,204)
 assert.deepEqual(await(await mf.dispatchFetch('http://localhost/test/records/key')).json(),{value:'saved'})
 console.log('PASS: shared cache, tag invalidation, application isolation, binary Flight payloads, and durable records')
} finally {await mf.dispose()}
