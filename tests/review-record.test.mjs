import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
function setup(){let plugin;const slots=new Map();const R={createElement:(type,props,...children)=>({type,props:props||{},children:children.flat()})};vm.runInNewContext(fs.readFileSync(new URL('../client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:x=>plugin=x.factory(()=>R)}}});plugin.apply({slots:{inject:(_n,f)=>f(),register:(o,c)=>slots.set(o.key||o.id,c)}});return slots.get('companion-review');}
function expand(node){if(!node||typeof node!=='object')return node;if(typeof node.type==='function')return expand(node.type(node.props));return {...node,children:node.children?.map(expand)};}
const record=(id,text='{"edits":[]}')=>({commandId:id,name:'companion-review',outcome:{kind:'success',text}});
test('one collapsed row per input round; nested records retain safe readable details',()=>{
 const render=setup(),a=record('a',JSON.stringify({mode:'deep',edits:[{before:'<script>old</script>',after:'new',reason:'更清楚'}]})),b=record('b'),c=record('c');
 const views=[{key:'a',kind:'command',data:a},{key:'b',kind:'command',data:b},{key:'user1',kind:'user'},{key:'tool',kind:'tool'},{key:'c',kind:'command',data:c},{key:'user2',kind:'user'}];
 const snapshot={order:views.map(v=>v.key),nodes:{get:key=>views.find(v=>v.key===key)}};
 const useChat=f=>f(snapshot);const tree=expand(render({node:a,useChat}));const text=JSON.stringify(tree);
 assert.match(text,/输入检查 · 2 次/);assert.match(text,/深度改写 · 1 处建议/);assert.match(text,/修改前/);assert.match(text,/建议改为/);assert.match(text,/更清楚/);assert.match(text,/不代表你已采用/);assert.ok(!text.includes('dangerouslySetInnerHTML'));
 const details=[];const walk=n=>{if(n?.type==='details')details.push(n);n?.children?.forEach(walk)};walk(tree);assert.equal(details.length,3);assert.ok(details.every(d=>d.props.open===undefined));
 assert.equal(render({node:b,useChat}).props.className,'pc-review-hidden');assert.match(JSON.stringify(expand(render({node:c,useChat}))),/输入检查 · 1 次/);
 b.outcome={kind:'error',text:'暂时无法检查'};assert.match(JSON.stringify(expand(render({node:a,useChat}))),/暂时无法检查/);
 const pending=record('d');pending.outcome=null;views.splice(2,0,{key:'d',kind:'command',data:pending});snapshot.order=views.map(v=>v.key);assert.match(JSON.stringify(expand(render({node:a,useChat}))),/输入检查 · 3 次/);
});
test('old result, empty review and running status remain accessible',()=>{const render=setup();for(const [node,expected] of [[record('a'),/无需修改/],[record('b','旧版文本结果'),/旧版文本结果/],[{commandId:'c',outcome:null},/检查中/]])assert.match(JSON.stringify(expand(render({node}))),expected);});
