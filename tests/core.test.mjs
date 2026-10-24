import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, titleUnits, validateConfig, complete } from '../index.js';
test('short useful candidates and boundaries',()=>{
 const item={title:'继续解释',prompt:'字'.repeat(149)};
 assert.ok(normalize({summary:'摘要',next:[item]}));
 assert.equal(normalize({summary:'摘要',next:[{...item,prompt:'字'.repeat(150)}]}),null);
 assert.equal(normalize({summary:'摘要',next:[{...item,title:'字'.repeat(15)}]}),null);
 assert.equal(normalize({summary:'摘要',next:[item,item]}).next.length,1);
 assert.equal(titleUnits('请解释 AI memory').length,5);
});
test('safe defaults and config validation',()=>{
 assert.equal(validateConfig().logSent,false);
 for(const value of [0,4,NaN,'3'])assert.throws(()=>validateConfig({count:value}));
 assert.throws(()=>validateConfig({provider:''}));
});
test('timeout and cancellation even with stalled provider',async()=>{
 const ctx={llm:{async *stream(){await new Promise(()=>{});}}};
 await assert.rejects(complete(ctx,{timeoutMs:20},'test',new AbortController().signal),/超时/);
 const abort=new AbortController();const pending=complete(ctx,{timeoutMs:1000},'test',abort.signal);abort.abort();
 await assert.rejects(pending,/cancelled/);
});
