import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {validateEdits} from '../review.js';
test('correction patches must be unique, disjoint and preserve other text',()=>{
 const text='没想到好点子、没学到好idea，我都会高兴。';
 const edits=validateEdits(text,{edits:[{before:'没想到',after:'每想到',reason:'笔误'},{before:'没学到',after:'每学到',reason:'笔误'}]});
 let result=text;for(const e of [...edits].reverse())result=result.slice(0,e.start)+e.after+result.slice(e.end);
 assert.equal(result,'每想到好点子、每学到好idea，我都会高兴。');
 assert.throws(()=>validateEdits(text,{edits:[{before:'没',after:'每',reason:''}]}));
 assert.throws(()=>validateEdits(text,{edits:[{before:'没想到',after:'每想到',reason:''},{before:'想到',after:'学到',reason:''}]}));
 assert.deepEqual(validateEdits(text,{edits:[]}),[]);
 const rewrite={edits:[{before:text,after:'新方向'.repeat(80),reason:'重新组织需求'}]};
 assert.throws(()=>validateEdits(text,rewrite));assert.equal(validateEdits(text,rewrite,'deep').length,1);
});
test('draft threshold, stale response, Tab acceptance, Escape dismissal and session isolation',async()=>{
 let plugin,states=[],refs=[],i=0,j=0,effects=[],oldEffects=[],tree,draft='',sessionId='a',running=false,requests=[],pending=[];
 const timers=new Map(), listeners=new Map(),slots=new Map();let timerId=0,now=0;
 const R={Fragment:'fragment',createElement:(type,props,...children)=>({type,props:props??{},children:children.flat()}),useState:v=>{const n=i++;if(!(n in states))states[n]=v;return[states[n],v=>states[n]=v]},useRef:v=>{const n=j++;return refs[n]??(refs[n]={current:v})},useEffect:(fn,deps)=>effects.push({fn,deps})};
 const window={__ModuleLoader__:{load:x=>plugin=x.factory(()=>R)},addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:(n,f)=>{if(listeners.get(n)===f)listeners.delete(n)}};
 vm.runInNewContext(fs.readFileSync(new URL('../client.js',import.meta.url),'utf8'),{window,localStorage:{getItem:()=>null},setTimeout:(f,ms)=>{timers.set(++timerId,{f,at:now+ms});return timerId},clearTimeout:id=>timers.delete(id)});
 plugin.apply({slots:{inject:(_,f)=>f(),register:({id},c)=>slots.set(id,c)},remote:{commands:{execute:async(...args)=>{requests.push(args);return new Promise(resolve=>pending.push(resolve))}}}});
 const editor={isContentEditable:true,closest:()=>card,focus(){}},card={querySelector:()=>editor};
 const props=()=>({sessionId,useInput:f=>f({draft}),useSession:f=>f({running}),inputActions:{setDraft:t=>{draft=t},persistDraft(){}}});
 const render=()=>{i=0;j=0;effects=[];tree=slots.get('copilot-review')(props());tree.props.ref.current={closest:()=>card,contains:()=>false};effects.forEach((e,n)=>{const old=oldEffects[n];if(!old||e.deps.some((d,k)=>d!==old.deps[k])){old?.cleanup?.();e.cleanup=e.fn()}else e.cleanup=old.cleanup});oldEffects=effects;return tree};
 const tick=(ms=5000)=>{now+=ms;for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);void t.f()}};
 const settle=async(edits)=>{pending.shift()({ok:true,value:{result:{kind:'success',text:JSON.stringify({edits})}}});await new Promise(r=>setImmediate(r));render()};
 const key=(key,extra={})=>listeners.get('keydown')?.({key,target:editor,preventDefault(){},stopPropagation(){},...extra});
 render();draft='错'.repeat(59);render();tick();assert.equal(requests.length,0);
 draft+='字';render();tick(4999);assert.equal(requests.length,0);tick(1);assert.equal(requests.length,1);
 const edit={start:0,end:1,before:'错',after:'对',reason:'笔误'};
 draft+='新';render();await settle([edit]);assert.equal(tree.props.hidden,true);
 draft+='文'.repeat(59);render();tick();assert.equal(requests.length,2);await settle([edit]);assert.equal(tree.type,'section');
 key('Tab',{isComposing:true});assert.ok(draft.startsWith('错'));
 key('Tab');assert.ok(draft.startsWith('对'));render();assert.equal(tree.props.hidden,true);tick();assert.equal(requests.length,2);
 draft+='a'.repeat(60);render();tick();await settle([edit]);key('Escape');render();assert.equal(tree.props.hidden,true);tick();assert.equal(requests.length,3);
 draft+='b'.repeat(60);render();tick();sessionId='b';draft='other'.repeat(20);render();await settle([edit]);assert.equal(tree.props.hidden,true);tick();assert.equal(requests.length,4);
 // A small edit waits fifteen seconds; continued typing restarts the idle timer.
 draft+='小';render();tick(14999);assert.equal(requests.length,4);
 draft+='改';render();tick(14999);assert.equal(requests.length,4);tick(1);assert.equal(requests.length,5);await settle([]);assert.ok(JSON.stringify(tree).includes('未发现明显笔误'));tick(2500);render();assert.equal(tree.props.hidden,true);
 running=true;render();running=false;render();tick(10000);assert.equal(requests.length,5);
 // Deletions also use the slow path, and identical drafts do not retry.
 draft=draft.slice(0,-1);render();tick(15000);assert.equal(requests.length,6);await settle([]);tick(10000);assert.equal(requests.length,6);
 // Manual checking bypasses unchanged-text/length gates, but double press sends only deep.
 key('Tab',{shiftKey:true});tick(449);assert.equal(requests.length,6);tick(1);assert.equal(requests.length,7);
 assert.equal(JSON.parse(requests.at(-1)[1].slice('/companion-review '.length)).mode,'basic');await settle([]);
 key('Tab',{shiftKey:true});tick(200);key('Tab',{shiftKey:true});assert.equal(requests.length,8);
 assert.equal(JSON.parse(requests.at(-1)[1].slice('/companion-review '.length)).mode,'deep');tick(500);assert.equal(requests.length,8);await settle([edit]);
 render();assert.ok(JSON.stringify(tree).includes('深度改写'));
 key('Escape');render();assert.equal(tree.props.hidden,true);
 key('Tab',{shiftKey:true});key('Escape');tick(1000);assert.equal(requests.length,8);
 for(const extra of [{isComposing:true},{repeat:true},{ctrlKey:true},{target:{isContentEditable:true,closest:()=>({})}}])key('Tab',{shiftKey:true,...extra});tick(1000);assert.equal(requests.length,8);
 // Editing during the double-press window cancels the manual check.
 key('Tab',{shiftKey:true});draft+='z';render();tick(450);assert.equal(requests.length,8);
 oldEffects.forEach(e=>e.cleanup?.());
});
import {reviewInput,validateConfig} from '../index.js';
import {REVIEW_SYSTEM,DEEP_REVIEW_SYSTEM} from '../review.js';
test('host deep review includes conversation and selects an independent prompt',async()=>{
 const calls=[];const draft='我该怎么办';const replacement='先帮我找出失败原因，再决定下一步。';
 const ctx={llm:{async *stream(input){calls.push(input);yield {type:'text-delta',text:JSON.stringify({edits:[{before:draft,after:replacement,reason:'先定位问题'}]})}}}};
 const session={log:[{type:'user/message',data:{source:{kind:'user'},content:[{type:'text',text:'我在排查缓存失效。'}]}},{type:'assistant/message',data:{message:{content:[{type:'text',text:'可以先看失效条件。'}]}}}]};
 const result=await reviewInput(ctx,validateConfig(),session,draft,'deep',new AbortController().signal);
 assert.equal(calls[0].messages[0].content[0].text,DEEP_REVIEW_SYSTEM);
 assert.ok(JSON.parse(calls[0].messages[1].content[0].text).context.includes('缓存失效'));
 assert.equal(result.edits[0].after,replacement);
 await reviewInput(ctx,validateConfig(),session,draft,'basic',new AbortController().signal);
 assert.equal(calls[1].messages[0].content[0].text,REVIEW_SYSTEM);
 assert.deepEqual(JSON.parse(calls[1].messages[1].content[0].text),{draft});
});
