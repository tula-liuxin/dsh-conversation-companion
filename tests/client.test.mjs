import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('dismiss, Tab reopen, no button, scope and drafts',()=>{
 let plugin,effects=[],keys=[],refs=[];const slots=new Map();
 const R={Fragment:'fragment',createElement:(type,props,...children)=>({type,props:props??{},children:children.flat()}),useMemo:f=>f(),useRef:()=>{const r={current:null};refs.push(r);return r},useState:v=>[typeof v==='function'?v():v,()=>{}],useEffect:f=>effects.push(f),useSyncExternalStore:(_s,g)=>g()};
 const window={__ModuleLoader__:{load:x=>plugin=x.factory(()=>R)},addEventListener:(n,f)=>{if(n==='keydown')keys.push(f)},removeEventListener:()=>{}};
 vm.runInNewContext(fs.readFileSync(new URL('../client.js',import.meta.url),'utf8'),{window});
 plugin.apply({slots:{inject:(_n,f)=>f(),register:({id},c)=>slots.set(id,c)}});
 const p=(sessionId='a',at=1,draft='')=>({sessionId,useProjection:()=>({at,next:['继续解释'],titles:['解释']}),useInput:f=>f({draft}),useSession:f=>f({running:false})});
 const render=(id,props)=>{effects=[];keys=[];refs=[];return slots.get(id)(props)};
 function find(n,pred){if(!n||typeof n!=='object')return;if(pred(n))return n;for(const c of n.children){const r=find(c,pred);if(r)return r}}
 let tree=render('copilot-ghost',p());find(tree,n=>n.props['aria-label']==='收起预测').props.onClick();
 let collapsed=render('copilot-ghost',p());assert.equal(collapsed.props.hidden,true);
 const card={};collapsed.props.ref.current={closest:()=>card};effects.forEach(f=>f());
 assert.equal(keys.length,1);
 let prevented=false;const event={key:'Tab',target:{isContentEditable:true,closest:()=>card},preventDefault(){prevented=true},stopPropagation(){}};
 keys[0]({...event,shiftKey:true});assert.equal(prevented,false);
 keys[0]({...event,target:{isContentEditable:true,closest:()=>({})}});assert.equal(prevented,false);
 keys[0](event);assert.equal(prevented,true);assert.notEqual(render('copilot-ghost',p()).props.hidden,true);
 assert.equal(find(render('copilot-wand',p()),n=>n.children.includes('展开预测')),undefined);
 find(render('copilot-ghost',p()),n=>n.props['aria-label']==='收起预测').props.onClick();
 render('copilot-ghost',p('a',1,'draft'));effects.forEach(f=>f());assert.equal(keys.length,0);
 assert.notEqual(render('copilot-ghost',p('b')).props.hidden,true);
 assert.equal(render('copilot-ghost',p()).props.hidden,true);
 assert.notEqual(render('copilot-ghost',p('a',2)).props.hidden,true);
});
