import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('compact default, Right expansion, regeneration, history and scope guards',async()=>{
 let plugin,effects=[],cleanup=[],states=[],cursor=0,tree;let requests=0,empty=false,phase='',commandError='';const slots=new Map(),listeners=new Map(),timers=new Map();let nextTimer=0;
 const R={Fragment:'fragment',createElement:(type,props,...children)=>({type,props:props??{},children:children.flat()}),useMemo:f=>f(),useRef:()=>({current:null}),useState:v=>{const i=cursor++;if(!(i in states))states[i]=v;return [states[i],x=>states[i]=typeof x==='function'?x(states[i]):x]},useEffect:f=>effects.push(f),useSyncExternalStore:(_s,g)=>g()};
 const storage=new Map(); const localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
 const window={__ModuleLoader__:{load:x=>plugin=x.factory(()=>R)},addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n)};
 vm.runInNewContext(fs.readFileSync(new URL('../client.js',import.meta.url),'utf8'),{window,localStorage,setTimeout:f=>{timers.set(++nextTimer,f);return nextTimer},clearTimeout:id=>timers.delete(id)});
 plugin.apply({remote:{commands:{execute:async(_id,line)=>{if(line.startsWith('/companion-titles ')){const {prompts}=JSON.parse(line.slice('/companion-titles '.length));return {ok:true,value:{result:{kind:'success',text:JSON.stringify({titles:prompts.map(()=> '下一步怎么做')})}}}}requests++;return {ok:true,value:{result:{kind:'success'}}}}}},slots:{inject:(_n,f)=>f(),register:({id},c)=>slots.set(id,c)}});
 let inserted=[],draft='',at=1,sessionId='a',history,pendingCandidates=false,pendingSummary=false;const view=()=>({at,sourceSeq:at,status:phase,batches:history,candidatesPending:pendingCandidates,summaryPending:pendingSummary,next:empty?[]:['第一条','第二条','第三条'],titles:empty?[]:['一','二','三']});
 const props=()=>({sessionId,useProjection:view,useInput:f=>f({draft}),useSession:f=>f({running:false}),inputActions:{setDraft:t=>inserted.push(t),persistDraft(){}}});
 function all(n,pred){if(!n||typeof n!=='object')return [];return [...(pred(n)?[n]:[]),...n.children.flatMap(c=>all(c,pred))]}
 const card={querySelector:()=>null},editor={isContentEditable:true,closest:()=>card};
 const render=()=>{cleanup.forEach(f=>f?.());effects=[];cursor=0;tree=slots.get('copilot-ghost')(props());cleanup=effects.map(f=>f());const list=all(tree,n=>n.props.role==='listbox')[0];if(list)list.props.ref.current={contains:()=>false,closest:()=>card};if(tree.props.hidden||tree.props.role==='region')tree.props.ref.current={contains:()=>false,closest:()=>card};return tree};
 const count=()=>all(tree,n=>n.props.role==='option').length;
 const key=(key,extra={})=>listeners.get('keydown')?.({key,target:editor,preventDefault(){},stopPropagation(){},...extra});
 render();assert.equal(count(),1);key('ArrowDown');assert.equal(inserted.length,0);render();assert.equal(count(),3);
 key('Escape');render();assert.equal(count(),1);assert.equal(inserted.length,0);key('ArrowRight');render();assert.equal(count(),3);
 key('ArrowDown');render();let prevented=false,stopped=false;
 key('Tab',{preventDefault(){prevented=true},stopImmediatePropagation(){stopped=true}});
 assert.equal(inserted.at(-1),'第二条');assert.ok(prevented && stopped);
 key('Escape');render();assert.equal(count(),1);key('Tab');assert.equal(inserted.at(-1),'第一条');
 inserted=[];
 for(const extra of [{shiftKey:true},{isComposing:true},{repeat:true},{ctrlKey:true},{target:{isContentEditable:true,closest:()=>({})}}])key('Tab',extra);
 assert.equal(inserted.length,0);
 draft='existing draft';render();key('Tab');key('ArrowDown');assert.equal(inserted.length,0);assert.equal(count(),0);
 draft='';render();key('ArrowRight');render();assert.equal(count(),3);at++;render();assert.equal(count(),1);
 sessionId='b';render();assert.equal(count(),1);
 key('ArrowRight');render();key('ArrowRight');await new Promise(resolve=>setImmediate(resolve));assert.equal(requests,1);
 history=[{at:100,next:['旧组'],titles:['旧']},{at:200,next:['新组'],titles:['新']}];render();
 assert.ok(JSON.stringify(tree).includes('新组'));key('ArrowLeft');render();assert.ok(JSON.stringify(tree).includes('旧组'));
 key('Tab');assert.equal(inserted.at(-1),'旧组');
 key('ArrowRight');render();await new Promise(resolve=>setImmediate(resolve));assert.equal(requests,1);assert.ok(JSON.stringify(tree).includes('新组'));
 key('ArrowRight');await new Promise(resolve=>setImmediate(resolve));assert.equal(requests,2);

 key('Escape');render();assert.equal(count(),1);
 key('Escape');render();assert.equal(count(),0);assert.equal(localStorage.getItem('pc.v1.predictions-hidden'),'true');
 key('ArrowRight');key('ArrowDown');render();assert.equal(count(),0);
 sessionId='another';at++;render();assert.equal(count(),0);
 draft='keep';render();key('Tab');assert.equal(localStorage.getItem('pc.v1.predictions-hidden'),'true');
 draft='';render();const before=inserted.length;key('Tab',{shiftKey:true});render();assert.equal(count(),0);
 key('Tab');render();assert.equal(count(),1);assert.equal(inserted.length,before);assert.equal(localStorage.getItem('pc.v1.predictions-hidden'),'false');
 key('Escape');render();assert.equal(count(),0);
 cleanup.forEach(f=>f?.());
 plugin.apply({remote:{commands:{execute:async(_id,line)=>{if(line==='/companion-refresh')requests++;return {ok:true,value:{result:commandError?{kind:'error',text:commandError}:{kind:'success'}}}}}},slots:{inject:(_n,f)=>f(),register:({id},c)=>slots.set(id,c)}});
 states=[];render();assert.equal(count(),0);key('Tab');render();assert.equal(count(),1);
 // New candidates can be adopted while their group is still arriving.
 history=[{at:300,next:['先完成的一条'],titles:['解释原理'],candidatesPending:true,summaryPending:true}];pendingCandidates=true;pendingSummary=true;render();
 key('Tab');assert.equal(inserted.at(-1),'先完成的一条');key('ArrowRight');render();const beforePending=requests;key('ArrowRight');await new Promise(resolve=>setImmediate(resolve));assert.equal(requests,beforePending);
 history=[{at:300,next:['先完成的一条','后完成的二条'],titles:['解释原理','举个例子'],summaryPending:true}];pendingCandidates=false;render();assert.equal(count(),2);key('ArrowRight');await new Promise(resolve=>setImmediate(resolve));assert.equal(requests,beforePending);
 history=[{at:300,next:['先完成的一条','后完成的二条','第三条'],titles:['解释原理','举个例子','下一步']}];pendingSummary=false;render();assert.equal(count(),3);key('ArrowRight');await new Promise(resolve=>setImmediate(resolve));assert.equal(requests,beforePending+1);
 // No prediction: Tab requests one, feedback is visible, Escape persists hiding.
 empty=true;history=[];sessionId='no-prediction';render();let baseline=requests;
 key('Tab');key('Tab');await new Promise(resolve=>setImmediate(resolve));assert.equal(requests,baseline+1);
 phase='pending';render();assert.ok(JSON.stringify(tree).includes('正在生成预测'));key('Tab');await new Promise(resolve=>setImmediate(resolve));assert.equal(requests,baseline+1);
 key('Escape');render();assert.equal(localStorage.getItem('pc.v1.predictions-hidden'),'true');
 phase='ready';empty=false;render();assert.equal(count(),0);key('Tab');render();assert.equal(count(),1);assert.equal(requests,baseline+1);
 // Empty new session reports the host explanation, and does not leak it to another session.
 sessionId='empty-new';empty=true;phase='';commandError='请先发送一条消息，再按 Tab 生成预测。';render();key('Tab');await new Promise(resolve=>setImmediate(resolve));render();assert.ok(JSON.stringify(tree).includes('请先发送'));
 sessionId='elsewhere';render();assert.equal(JSON.stringify(tree).includes('请先发送'),false);
 draft='keep my draft';render();baseline=requests;key('Tab');await new Promise(resolve=>setImmediate(resolve));assert.equal(requests,baseline);
 cleanup.forEach(f=>f?.());
});
