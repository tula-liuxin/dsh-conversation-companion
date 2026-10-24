import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldPrediction } from '../index.js';
test('history survives pending, failure and replay and resets on a new reply', () => {
 const event = data => ({type:'plugin:prompt-copilot/turn',data});
 const first = {status:'ready',sourceSeq:4,at:10,next:['old'],titles:['old'],summary:'summary'};
 const initial = foldPrediction(null,event(first));
 let state = foldPrediction(initial,event({status:'pending',sourceSeq:4}));
 assert.deepEqual(state.next,['old']);assert.equal(state.batches.length,1);
 state = foldPrediction(state,event({status:'error',sourceSeq:4,error:'offline'}));
 assert.deepEqual(state.batches,initial.batches);
 state = foldPrediction(state,event({...first,at:20,next:['new']}));
 assert.equal(state.batches.length,2);assert.deepEqual(state.batches[0].next,['old']);
 assert.equal(foldPrediction(state,event({...first,at:20})).batches.length,2);
 assert.equal(initial.batches.length,1);
 assert.equal(foldPrediction(state,{type:'turn/start'}),null);
 assert.equal(foldPrediction(state,{type:'assistant/message'}),null);
 assert.equal(foldPrediction(state,event({...first,sourceSeq:9})).batches.length,1);
});

test('legacy missing titles and pending state are lossless JSON', () => {
 const event = data => ({type:'plugin:prompt-copilot/turn',data});
 const legacy = {status:'ready',sourceSeq:1,at:1,next:['legacy'],summary:'summary'};
 let state = foldPrediction(null,event(legacy));
 const check = () => assert.deepEqual(JSON.parse(JSON.stringify(state)),state);
 check();assert.deepEqual(state.batches[0].titles,[]);
 state=foldPrediction(state,event({status:'pending',sourceSeq:1}));check();assert.equal(Object.hasOwn(state,'error'),false);
 state=foldPrediction(state,event({status:'error',sourceSeq:1,error:'offline'}));check();
 state=foldPrediction(state,event({status:'pending',sourceSeq:1}));check();assert.equal(Object.hasOwn(state,'error'),false);
 state=foldPrediction(state,event({...legacy,at:2,titles:['new']}));check();assert.equal(state.batches.length,2);
});
