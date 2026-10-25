import {expect,it} from 'vitest'
import {createElement as h,Fragment,Suspense} from 'react'
import {renderToString,renderToReadableStream} from 'react-dom/server'
it('restores SVG and text adjacency across nested foreignObject scopes',()=>{
 const tree=h('svg',null,h('g',{strokeWidth:1},'a','b'),h('foreignObject',null,h('div',{strokeWidth:2},'c','d')),h('g',{strokeWidth:3},'e','f'))
 expect(renderToString(tree)).toBe('<svg><g stroke-width="1">a<!-- -->b</g><foreignObject><div strokewidth="2">c<!-- -->d</div></foreignObject><g stroke-width="3">e<!-- -->f</g></svg>')
})
it('restores state before a suspended SVG host falls back into HTML text flow',()=>{
 const pending=new Promise(()=>{})
 function Suspend(){throw pending}
 const tree=h('main',null,'a',h(Suspense,{fallback:h(Fragment,null,h('i',{strokeWidth:2},'b','c'),'d','e')},h('svg',null,h('g',null,'partial',h(Suspend)))),'f','g')
 const html=renderToString(tree)
 expect(html).toContain('<i strokewidth="2">b<!-- -->c</i>d<!-- -->e')
 expect(html).not.toContain('partial')
 expect(html).toContain('f<!-- -->g</main>')
})
it('keeps nested public SSR and the outer flow independent',()=>{
 const nested:string[]=[]
 function Child(){nested.push(renderToString(h('svg',null,h('g',{strokeWidth:4},'x','y'))));return h(Fragment,null,'b','c')}
 expect(renderToString(h('div',null,'a',h(Child),'d'))).toBe('<div>a<!-- -->b<!-- -->c<!-- -->d</div>')
 expect(nested).toEqual(['<svg><g stroke-width="4">x<!-- -->y</g></svg>'])
})
it('preserves the same nested SVG and text output in a completed readable stream',async()=>{
 const tree=h('div',null,'a',h('svg',null,h('foreignObject',null,h('p',{strokeWidth:2},'b','c'))),'d','e')
 const expected=renderToString(tree), stream:any=await renderToReadableStream(tree)
 await stream.allReady
 const reader=stream.getReader(),decoder=new TextDecoder();let actual=''
 for(;;){const {done,value}=await reader.read();if(done)break;actual+=decoder.decode(value,{stream:true})}
 actual+=decoder.decode();expect(actual).toBe(expected)
})
it('isolates nested SSR invoked by a pipe destination write callback',async()=>{
 const {Writable}=await import('node:stream')
 const {renderToPipeableStream}=await import('react-dom/server')
 const tree=h('svg',null,h('g',{strokeWidth:1},'a','b'),h('foreignObject',null,h('p',{strokeWidth:2},'c','d')))
 let nested=''
 const actual=await new Promise<string>((resolve,reject)=>{
  const chunks:string[]=[]
  const sink=new Writable({write(chunk,_encoding,done){
   try{if(!nested)nested=renderToString(h('div',null,'nested','text'));chunks.push(chunk.toString());done()}catch(error){done(error as Error)}
  }})
  sink.on('finish',()=>resolve(chunks.join('')));sink.on('error',reject)
  const handle=renderToPipeableStream(tree,{onShellReady(){handle.pipe(sink)},onError:reject})
 })
 expect(actual).toBe(renderToString(tree))
 expect(nested).toBe('<div>nested<!-- -->text</div>')
})
