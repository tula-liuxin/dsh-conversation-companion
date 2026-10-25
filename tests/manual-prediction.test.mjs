import {test} from 'node:test';import assert from 'node:assert/strict';import {selectPredictionSource} from '../index.js';
const user=(seq,source='user')=>({seq,type:'user/message',data:{source:{kind:source},content:[{type:'text',text:'帮我修复错误'}]}});
const reply=(seq,turn,text)=>({seq,type:'assistant/message',data:{turn,message:{content:[{type:'text',text}]}}});
const start=(seq,turn)=>({seq,type:'turn/start',data:{turn}});
const end=(seq,turn,kind='completed')=>({seq,type:'turn/end',data:{turn,reason:{kind}}});
test('manual prediction accepts stopped tool-only turns without inventing a reply',()=>{
 const log=[start(1,1),user(2),user(3,'plugin'),reply(4,1,''),end(5,1,'aborted')];
 const s=selectPredictionSource({log});assert.equal(s.source.seq,2);assert.equal(s.userOnly,true);assert.equal(s.stopped,true);assert.equal(s.turn,1);
});
test('prediction source is current and refuses empty or active conversations',()=>{
 assert.match(selectPredictionSource({log:[]}).error,/先发送/);
 const log=[start(1,1),user(2),reply(3,1,'答复'),end(4,1)];
 assert.equal(selectPredictionSource({log}).source.seq,3);
 log.push(start(5,2));assert.match(selectPredictionSource({log}).error,/等待/);
 log.push(user(6),end(7,2,'aborted'));assert.equal(selectPredictionSource({log}).source.seq,6);assert.equal(selectPredictionSource({log}).userOnly,true);
 log.push(user(8));assert.match(selectPredictionSource({log}).error,/等待/);
 assert.match(selectPredictionSource({log:[user(1,'plugin'),end(2,1)]}).error,/先发送/);
});

test('running prediction is explicit and anchored to the latest user turn',()=>{
 const log=[start(1,1),user(2)];
 assert.ok(selectPredictionSource({log}).error);
 const selected=selectPredictionSource({log},true);assert.equal(selected.duringTurn,true);assert.equal(selected.source.seq,2);assert.equal(selected.startSeq,1);
 log.push(reply(3,1,'目前的初步分析'));
 const next=selectPredictionSource({log},true);assert.equal(next.source.seq,2);assert.equal(next.userOnly,false);
});
