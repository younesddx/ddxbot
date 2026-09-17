/* ===== DDX AUTO BOT — عدّل التوكن فقط ===== */
const TOKEN = process.env.TOKEN;
const OWNER = 5438941058;
const CHANNEL = -1003814901507;
const REDOT = '1934015858';
const W = {
  TRC20: 'THj7C4yeXLZaAAjdrVp6s2kjp2dDanSTpe',
  BEP20: '0x6c8d2e73902f6fd139e1bf25c587999dd50619c5',
  SOL:   'EvRATfR49Min8eNWktgHR3RCeeoi3QZUMSv9BG2CPUkv'
};
const P = {
  p1:['Cozy Kitchen Mega Bundle',15], p2:['Summer 3D Splash Pack',12],
  p3:['Kawaii Bakery Pack',10],      p4:['Weird Monster Doodles',10],
  p5:['Retro Camera Pack',8],        p6:['Camping Food Pack',10],
  p7:['Food Icons Collection',8],    p8:['Logo Starter Kit',12],
  p9:['Sticker Sheet Vol.1',9],      p10:['EXCLUSIVE Kitchen Scene',75],
  p11:['FREE Watermelon SVG',0],
  p12:['Test Design Pack',1]
};
const BSC_USDT='0x55d398326f99059fF775485246999027B3197955';
const SOL_USDT='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const TOPIC='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const API='https://api.telegram.org/bot'+TOKEN+'/';
let ORDERS={}, FILES={}, offset=0;

async function tg(m,d){const r=await fetch(API+m,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});return r.json();}
const send=(c,t,kb)=>tg('sendMessage',{chat_id:c,text:t,parse_mode:'HTML',reply_markup:kb?{inline_keyboard:kb}:undefined});
const jget=async(u,o)=>{const r=await fetch(u,o);return r.json();};
const amt=o=>o.total+o.cents/100;

async function createOrder(u,codes){
  const items=codes.filter(c=>P[c]);
  if(!items.length)return send(u.id,'❌ Unknown products.');
  const total=items.reduce((s,c)=>s+P[c][1],0);
  const id='o'+Date.now().toString(36);
  ORDERS[id]={id,codes:items,total,cents:total>0?(10+(Date.now()%89)):0,status:total>0?'choosing':'paid',
    customer:{id:u.id,name:u.first_name||'',username:u.username||''},created:Math.floor(Date.now()/1000),net:null};
  if(total===0)return deliver(ORDERS[id]);
  send(OWNER,`🛒 <b>NEW ORDER</b> ${id}\n${items.map(c=>'• '+P[c][0]+' $'+P[c][1]).join('\n')}\nTOTAL: $${total}\n👤 ${u.first_name} @${u.username||'-'}\n💰 سيدفع: $${amt(ORDERS[id]).toFixed(2)}`);
  send(u.id,`🛍️ <b>Order ${id}</b>\nTotal: <b>$${amt(ORDERS[id]).toFixed(2)}</b> USDT\n\nChoose payment method:`,
    [[{text:'💠 USDT TRC20',callback_data:'pay:TRC20:'+id},{text:'💠 USDT BEP20',callback_data:'pay:BEP20:'+id}],
     [{text:'💠 USDT SOL',callback_data:'pay:SOL:'+id},{text:'🔴 RedotPay',callback_data:'pay:REDOT:'+id}]]);
}

async function deliver(o){
  const missing=[];
  for(const c of o.codes){
    const mid=FILES[c];
    if(!mid){missing.push(c);continue;}
    await tg('copyMessage',{chat_id:o.customer.id,from_chat_id:CHANNEL,message_id:mid});
  }
  o.status='delivered';
  send(o.customer.id, missing.length?'✅ تم تسليم جزء من طلبك، والباقي يصلك خلال دقائق.':'🎉 <b>Thank you for your purchase!</b>\nFiles attached. Enjoy! ♥ — DDX');
  send(OWNER,`📦 Delivered ${o.id} to @${o.customer.username||o.customer.id}${missing.length?'\n⚠️ missing: '+missing.join(','):''}`);
}

async function checkTRC20(a,v,af){
  const d=await jget(`https://api.trongrid.io/v1/accounts/${a}/transactions/trc20?only_to=true&limit=20`);
  for(const t of (d.data||[]))if(t.token_info&&/usdt/i.test(t.token_info.symbol||'')&&(+t.value/1e6)===v&&(t.block_timestamp/1000)>af)return t.transaction_id;
  return null;
}
async function checkBEP20(a,v,af){
  const rpc=b=>jget('https://bsc-dataseed.binance.org/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
  const bn=await rpc({jsonrpc:'2.0',id:1,method:'eth_blockNumber',params:[]});
  const lat=parseInt(bn.result,16);
  const pad='0x'+'0'.repeat(24)+a.slice(2).toLowerCase();
  const lg=await rpc({jsonrpc:'2.0',id:2,method:'eth_getLogs',params:[{fromBlock:'0x'+(lat-5000).toString(16),toBlock:'latest',address:BSC_USDT,topics:[TOPIC,null,pad]}]});
  for(const l of (lg.result||[]))if(parseInt(l.data,16)/1e18===v)return l.transactionHash;
  return null;
}
async function checkSOL(a,v,af){
  const rpc=(m,p)=>jget('https://api.mainnet-beta.solana.com',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:m,params:p})});
  const sg=await rpc('getSignaturesForAddress',[a,{limit:10}]);
  for(const s of (sg.result||[]))if(s.blockTime&&s.blockTime>af){
    const tx=await rpc('getParsedTransaction',[s.signature,{encoding:'jsonParsed',maxSupportedTransactionVersion:0}]);
    const m=tx.result&&tx.result.meta;
    if(m){for(const b of (m.postTokenBalances||[]))if(b.owner===a&&b.mint===SOL_USDT){
      const p0=(m.preTokenBalances||[]).find(x=>x.accountIndex===b.accountIndex);
      const df=(+b.uiTokenAmount.uiAmount)-(p0?+p0.uiTokenAmount.uiAmount:0);
      if(Math.abs(df-v)<0.000001)return s.signature;
    }}
  }
  return null;
}
async function verify(o){
  const v=amt(o),af=o.created-300;
  if(o.net==='TRC20')return checkTRC20(W.TRC20,v,af);
  if(o.net==='BEP20')return checkBEP20(W.BEP20,v,af);
  if(o.net==='SOL')return checkSOL(W.SOL,v,af);
  return null;
}
async function tick(){
  for(const id in ORDERS){const o=ORDERS[id];
    if(o.status==='watching'&&(Date.now()/1000-o.created)<5400){
      const tx=await verify(o);
      if(tx){o.status='paid';send(OWNER,`💰 <b>PAID</b> ${id} — $${amt(o).toFixed(2)} via ${o.net}\n${tx}`);await deliver(o);}
    }}
}

async function handle(u){
  if(u.channel_post){const cp=u.channel_post;
    if(cp.document&&cp.caption){const code=cp.caption.trim().toLowerCase();
      if(P[code]){FILES[code]=cp.message_id;send(OWNER,`📦 <b>Linked</b>: ${code} → message ${cp.message_id} ✅`);}}
    return;}
  if(u.callback_query){const q=u.callback_query,d=q.data||'',oid=d.split(':')[2]||'',o=ORDERS[oid];
    await tg('answerCallbackQuery',{callback_query_id:q.id});
    if(!o)return;
    if(d.startsWith('pay:REDOT:')){o.status='redotpay';
      send(q.from.id,`🔴 <b>RedotPay</b>\nID: <code>${REDOT}</code>\nAmount: $${amt(o).toFixed(2)}\n\nAfter paying, send screenshot to @younesddx`);
      send(OWNER,`🔴 RedotPay order ${oid} — @${o.customer.username||o.customer.id}\n$${amt(o).toFixed(2)}`,[[{text:'✅ تسليم الملفات',callback_data:'deliver:'+oid}]]);}
    else if(d.startsWith('pay:')){o.net=d.split(':')[1];o.status='watching';
      send(q.from.id,`💠 <b>${o.net}</b>\nAddress:\n<code>${W[o.net]}</code>\n\nAmount exactly: <b>$${amt(o).toFixed(2)}</b> USDT\n\n⏳ سيتم التحقق تلقائياً والتسليم فور وصول الدفع.`);}
    else if(d.startsWith('paid:')){const tx=await verify(o);
      send(q.from.id,tx?'✅ تم رصد الدفع! جارٍ التسليم...':'⏳ لم أرصد الدفع بعد — أتحقق تلقائياً كل دقيقة.');
      if(tx){o.status='paid';send(OWNER,`💰 PAID ${oid} via ${o.net}`);await deliver(o);}}
    else if(d.startsWith('deliver:')&&q.from.id===OWNER){await deliver(o);}
    return;}
  if(!u.message)return;
  const t=(u.message.text||'').trim();
  if(t.startsWith('/start ord_'))await createOrder(u.message.from,t.slice(11).split('-'));
  else if(t.startsWith('/bind')){const[,c,m]=t.split(' ');if(P[c]&&m){FILES[c]=+m;send(u.message.chat.id,`✅ Linked ${c} → ${m}`);}}
  else if(t.startsWith('/test')){const c=t.split(' ')[1]||'p1';
    if(FILES[c]){await tg('copyMessage',{chat_id:u.message.chat.id,from_chat_id:CHANNEL,message_id:FILES[c]});send(u.message.chat.id,'✅ Delivery test OK');}
    else send(u.message.chat.id,'❌ No file linked for '+c);}
  else if(t==='/orders'){const l=Object.values(ORDERS).slice(-8).map(o=>`${o.id} | $${amt(o).toFixed(2)} | ${o.status} | @${o.customer.username||'-'}`).join('\n');
    send(u.message.chat.id,'📊 Last orders:\n'+(l||'none'));}
  else send(u.message.chat.id,'🛍️ DDX Store — press the menu button below to shop!');
}

/* ===== المحرك ===== */
const http=require('http');
http.createServer((req,res)=>{
  if(req.url==='/tick'){tick().then(()=>res.end('ok'));}
  else res.end('DDX bot alive ✅');
}).listen(process.env.PORT||10000);

(async()=>{
  await tg('deleteWebhook',{});
  while(true){
    try{
      const d=await jget(API+'getUpdates?timeout=25&offset='+offset);
      for(const u of (d.result||[])){offset=u.update_id+1;handle(u).catch(e=>console.log('h:',e.message));}
    }catch(e){console.log('poll:',e.message);await new Promise(r=>setTimeout(r,3000));}
  }
})();
setInterval(()=>{tick().catch(()=>{});},60000);
setInterval(()=>{const u=process.env.RENDER_EXTERNAL_URL;if(u)fetch(u+'/keepalive').catch(()=>{});},600000);
console.log('DDX bot started 🚀');
