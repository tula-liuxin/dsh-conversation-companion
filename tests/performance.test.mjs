import {test} from 'node:test';import assert from 'node:assert/strict';
import {createReviewWorker,validateConfig,streamedCandidates,complete,foldPrediction} from '../index.js';
const settings=validateConfig();
test('exact review requests share work and reuse results, context/mode/expiry stay isolated',async()=>{
 let calls=0,time=0,release;const gate=new Promise(r=>release=r);
 const ctx={llm:{async *stream(){calls++;await gate;yield {type:'text-delta',text:'{"edits":[]}'}}}};
 const worker=createReviewWorker(ctx,settings,()=>time);const session={id:'one',log:[]};const signal=new AbortController().signal;
 const a=worker.run(session,'草稿','basic',signal),b=worker.run(session,'草稿','basic',signal);assert.equal(calls,1);assert.equal(a,b);release();assert.deepEqual(await a,await b);
 await worker.run(session,'草稿','basic',signal);assert.equal(calls,1);
 await worker.run(session,'草稿','deep',signal);assert.equal(calls,2);
 session.log.push({type:'assistant/message',data:{message:{content:[{type:'text',text:'新的上下文'}]}}});
 await worker.run(session,'草稿','deep',signal);assert.equal(calls,3);
 await worker.run(session,'改过的草稿','basic',signal);assert.equal(calls,4);
 time=60001;await worker.run(session,'草稿','basic',signal);assert.equal(calls,5);worker.dispose();
});
test('failed reviews are not cached; newer drafts cancel superseded requests',async()=>{
 let calls=0;const ctx={llm:{async *stream({signal}){calls++;if(calls===1)throw Error('offline');if(calls===2)await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))));yield {type:'text-delta',text:'{"edits":[]}'}}}};
 const worker=createReviewWorker(ctx,settings);const session={id:'one',log:[]};const signal=new AbortController().signal;
 await assert.rejects(worker.run(session,'旧','basic',signal),/offline/);
 const a=worker.run(session,'旧','basic',signal);const rejected=assert.rejects(a,/cancelled|aborted/);
 await worker.run(session,'新','basic',signal);await rejected;assert.equal(calls,3);worker.dispose();
});
test('only complete validated candidate arrays appear, before summary finishes',async()=>{
 const candidates=[{title:'解释例子',prompt:'解释一下带有 ] 和 " 引号的例子。'},{title:'下一步怎么做',prompt:'下一步做什么？'}];
 const prefix='{"next":'+JSON.stringify(candidates);
 for(let i=0;i<prefix.length;i++)assert.equal(streamedCandidates(prefix.slice(0,i)),null);
 assert.equal(streamedCandidates(prefix).next.length,2);
 assert.equal(streamedCandidates('{"next":[{"title":"第一步该","prompt":"做什么？"}]'),null);
 let release,settled=false;const gate=new Promise(r=>release=r);let early;
 const ctx={llm:{async *stream(){yield {type:'text-delta',text:prefix};await gate;yield {type:'text-delta',text:',"summary":"完整摘要"}'}}}};
 const done=complete(ctx,settings,'context',new AbortController().signal,undefined,text=>{early??=streamedCandidates(text)}).then(x=>{settled=true;return x});
 await new Promise(r=>setImmediate(r));assert.ok(early);assert.equal(settled,false);release();assert.equal(JSON.parse(await done).summary,'完整摘要');
});
test('summary completion updates one history batch and clears its pending state',()=>{
 const event=data=>({type:'plugin:prompt-copilot/turn',data});const first={status:'ready',sourceSeq:9,at:10,next:['候选'],titles:['下一步'],summary:'',summaryPending:true};
 let state=foldPrediction(null,event(first));assert.equal(state.batches.length,1);assert.equal(state.batches[0].summaryPending,true);
 const {summaryPending,...final}=first;state=foldPrediction(state,event({...final,summary:'完整摘要'}));
 assert.equal(state.batches.length,1);assert.equal(state.batches[0].summary,'完整摘要');assert.equal(state.batches[0].summaryPending,undefined);assert.deepEqual(JSON.parse(JSON.stringify(state)),state);
});

test('progressive candidates preserve the exact final output across every chunk boundary',()=>{
 const items=[{title:'解释例子',prompt:'解释这个 " } ] \\ 例子。'},{title:'下一步怎么做',prompt:'下一步做什么？'},{title:'比较方案',prompt:'比较一下这两个方案。'}];
 const object=JSON.stringify(items[0]),prefix='{"next":['+object;
 for(let i=0;i<prefix.length;i++)assert.equal(streamedCandidates(prefix.slice(0,i),3,true),null);
 const one=streamedCandidates(prefix,3,true);assert.deepEqual(one.next,[items[0].prompt]);assert.equal(one.candidatesPending,true);
 assert.equal(streamedCandidates('{"next":[{"title":"第一步该","prompt":"做什么？"}',3,true),null);
 const raw='{"next":'+JSON.stringify(items)+',"summary":"完整摘要"}';
 let maxCount=0;for(let i=0;i<=raw.length;i++){
  const value=streamedCandidates(raw.slice(0,i),3,true);if(!value)continue;
  assert.ok(value.next.length>=maxCount);maxCount=value.next.length;
  assert.deepEqual(value.next,items.slice(0,maxCount).map(x=>x.prompt));assert.deepEqual(value.titles,items.slice(0,maxCount).map(x=>x.title));
 }
 assert.equal(maxCount,3);assert.equal(streamedCandidates(raw,3,true).candidatesPending,undefined);
 const duplicates='{"next":'+JSON.stringify([items[0],items[0],items[1]]);
 assert.deepEqual(streamedCandidates(duplicates,3,true).next,[items[0].prompt,items[1].prompt]);
 assert.deepEqual(streamedCandidates(raw,1,true).next,[items[0].prompt]);
});

test('incremental candidates stay in one batch; errors clear every pending flag',()=>{
 const event=data=>({type:'plugin:prompt-copilot/turn',data});
 const first={status:'ready',sourceSeq:9,at:10,next:['候选一'],titles:['先做什么'],summary:'',summaryPending:true,candidatesPending:true};
 let state=foldPrediction(null,event(first));
 state=foldPrediction(state,event({...first,next:['候选一','候选二'],titles:['先做什么','怎么验证']}));
 assert.equal(state.batches.length,1);assert.equal(state.batches[0].next.length,2);
 const failed=foldPrediction(state,event({status:'error',sourceSeq:9,error:'interrupted'}));
 assert.equal(failed.candidatesPending,false);assert.equal(failed.summaryPending,false);assert.equal(failed.batches[0].candidatesPending,false);assert.deepEqual(failed.next,state.next);
 const {candidatesPending,summaryPending,...final}=first;
 state=foldPrediction(state,event({...final,next:state.next,titles:state.titles,summary:'完成'}));
 assert.equal(state.batches.length,1);assert.equal(state.batches[0].candidatesPending,undefined);assert.equal(state.summaryPending,undefined);
 assert.deepEqual(JSON.parse(JSON.stringify(state)),state);
});

test('a stalled stream cannot publish late chunks after timeout',async()=>{
 let release,seen=0;const gate=new Promise(r=>release=r);
 const ctx={llm:{async *stream(){await gate;yield {type:'text-delta',text:'late'}}}};
 await assert.rejects(complete(ctx,{...settings,timeoutMs:10},'x',new AbortController().signal,undefined,()=>seen++),/超时/);
 release();await new Promise(r=>setImmediate(r));assert.equal(seen,0);
});
