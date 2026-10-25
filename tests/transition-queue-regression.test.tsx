import {expect,it} from 'vitest'
import {createElement as h,Suspense,startTransition,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
const tick=()=>new Promise(r=>setTimeout(r,10))
it('replays a large queued transition around urgent work after repeated suspension',async()=>{
 let release!:()=>void,ready=false,set:any
 const promise=new Promise<void>(r=>release=()=>{ready=true;r()})
 function Child({value}:{value:number}){if(value&&!ready)throw promise;return h('b',null,value)}
 function App(){const [value,s]=useState(0);set=s;return h(Suspense,{fallback:'loading'},h(Child,{value}))}
 const host=document.createElement('div'),root=createRoot(host);document.body.append(host)
 try{
  flushSync(()=>root.render(h(App)));const original=host.firstChild
  startTransition(()=>{for(let i=0;i<64;i++)set((n:number)=>n+1)})
  await tick();expect(host.textContent).toBe('0');expect(host.firstChild).toBe(original)
  set((n:number)=>n*2);await tick()
  startTransition(()=>{for(let i=0;i<32;i++)set((n:number)=>n+1)})
  await tick();expect(host.textContent).toBe('0')
  release();await tick();expect(host.textContent).toBe('160');expect(host.firstChild).toBe(original)
 }finally{flushSync(()=>root.unmount());host.remove();release()}
})
