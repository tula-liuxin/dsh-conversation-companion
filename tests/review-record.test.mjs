import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('review history is collapsed, readable, and safely renders old and failed results',()=>{
 let plugin;const slots=new Map();
 const React={createElement:(type,props,...children)=>({type,props:props||{},children:children.flat()})};
 vm.runInNewContext(fs.readFileSync(new URL('../client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:x=>plugin=x.factory(()=>React)}}});
 plugin.apply({slots:{inject:(_n,f)=>f(),register:(o,c)=>slots.set(o.key||o.id,c)}});
 const render=slots.get('companion-review');assert.equal(typeof render,'function');
 const tree=render({node:{commandId:'one',outcome:{kind:'success',text:JSON.stringify({mode:'deep',edits:[{before:'<script>old</script>',after:'new',reason:'更清楚'}]})}}});
 assert.equal(tree.type,'details');assert.equal(tree.props.open,undefined);
 const text=JSON.stringify(tree);assert.match(text,/深度改写 · 1 处建议/);assert.match(text,/修改前/);assert.match(text,/建议改为/);assert.match(text,/更清楚/);assert.match(text,/不代表你已采用/);assert.ok(!text.includes('dangerouslySetInnerHTML'));
 assert.match(JSON.stringify(render({node:{outcome:{kind:'success',text:'{"edits":[]}'}}})),/无需修改/);
 assert.match(JSON.stringify(render({node:{outcome:{kind:'error',text:'暂时无法检查'}}})),/暂时无法检查/);
 assert.match(JSON.stringify(render({node:{outcome:null}})),/检查中/);
 assert.match(JSON.stringify(render({node:{outcome:{kind:'success',text:'旧版文本结果'}}})),/旧版文本结果/);
});
