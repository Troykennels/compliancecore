import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
function setup() {
  const handlers={}, shown=[], opened=[];
  const self={ location:{origin:'https://app.example'}, registration:{showNotification:async(title,options)=>shown.push({title,options})}, clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)},addEventListener:(name,cb)=>{handlers[name]=cb} };
  vm.runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{self,URL,console});
  return {handlers,shown,opened};
}
test('background push displays a non-silent notification with all app tabs closed',async()=>{
  const {handlers,shown}=setup();let pending;
  handlers.push({data:{json:()=>({title:'Update',body:'New message',url:'/notifications',tag:'note-1'})},waitUntil:p=>{pending=p}});
  await pending; assert.equal(shown[0].title,'Update');assert.equal(shown[0].options.silent,false);assert.match(shown[0].options.data.url,/^https:\/\/app.example\//);
});
test('bad push JSON still shows a visible alert',async()=>{
  const {handlers,shown}=setup();let pending;
  handlers.push({data:{json:()=>{throw new Error('bad JSON')}},waitUntil:p=>{pending=p}});
  await pending; assert.equal(shown.length,1);
});
test('notification click cannot open another origin',async()=>{
  const {handlers,opened}=setup();let pending;
  handlers.notificationclick({notification:{close(){},data:{url:'https://evil.example'}},waitUntil:p=>{pending=p}});
  await pending; assert.equal(opened.length,0);
});
test('click opens the intended app page when there are no tabs',async()=>{
  const {handlers,opened}=setup();let pending;
  handlers.notificationclick({notification:{close(){},data:{url:'/notifications'}},waitUntil:p=>{pending=p}});
  await pending;assert.equal(opened[0],'https://app.example/notifications');
});
