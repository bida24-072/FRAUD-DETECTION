/* ═══════════════════════════════════════════════════════════
   FLOW SENTINEL — application core
   Shared between every page. Handles auth, data, scoring,
   and page mounting.
═══════════════════════════════════════════════════════════ */

/* ── CONSTANTS ── */
const FEATURES = [
  {key:'amountZ',          label:'Amount vs. average',  weight:0.35, icon:'fa-money-bill'},
  {key:'velocity1h',       label:'Velocity (1h)',        weight:0.28, icon:'fa-bolt'},
  {key:'velocity24h',      label:'Velocity (24h)',       weight:0.12, icon:'fa-clock'},
  {key:'geoJump',          label:'Geographic jump',      weight:0.22, icon:'fa-location-dot'},
  {key:'newDevice',        label:'New device',           weight:0.30, icon:'fa-mobile'},
  {key:'oddHour',          label:'Unusual hour',         weight:0.10, icon:'fa-moon'},
  {key:'highRiskMerchant', label:'High-risk merchant',   weight:0.18, icon:'fa-store'},
  {key:'cnp',              label:'Card-not-present',     weight:0.12, icon:'fa-globe'},
  {key:'tenureRisk',       label:'New customer risk',    weight:0.15, icon:'fa-user-plus'},
  {key:'recentFailed',     label:'Recent failed attempts',weight:0.20,icon:'fa-triangle-exclamation'}
];
const HIGH_RISK = ['Gambling','Crypto','Wire Transfer','Forex'];
const CATEGORIES = ['Groceries','Fuel','Restaurant','Retail','Utilities','Travel','Online','Pharmacy','Entertainment','Gambling','Crypto','Wire Transfer'];
const CITIES = ['Gaborone','Francistown','Maun','Molepolole','Serowe'];
const FOREIGN = ['Lagos','Johannesburg','Nairobi','London','New York'];
const STORE_KEY = 'flow_sentinel_v1';
const AUTH_KEY = 'flow_sentinel_auth';

/* ── UTILS ── */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const pick = a => a[Math.floor(Math.random()*a.length)];
const rnd = (a,b) => a + Math.random()*(b-a);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const fmtMoney = n => 'P ' + Number(n||0).toLocaleString('en-BW',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtPct = n => (n*100).toFixed(1)+'%';
const timeStr = ts => new Date(ts).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function toast(msg,type='info'){
  const el=document.createElement('div');
  el.className='toast '+type;
  el.textContent=msg;
  document.getElementById('toast').appendChild(el);
  setTimeout(()=>{el.style.opacity='0';el.style.transition='.3s';setTimeout(()=>el.remove(),300)},2600);
}

/* ── AUTH ── */
const Auth = {
  login(email,pass){
    if(!email || !pass || pass.length<4) return false;
    sessionStorage.setItem(AUTH_KEY, JSON.stringify({email,at:Date.now()}));
    return true;
  },
  user(){
    try{ return JSON.parse(sessionStorage.getItem(AUTH_KEY)); }
    catch(e){ return null; }
  },
  logout(){
    sessionStorage.removeItem(AUTH_KEY);
    window.location.href='index.html';
  },
  guard(){
    if(!this.user()){ window.location.href='index.html'; return false; }
    return true;
  }
};

/* ── DATA GENERATION ── */
function createCustomers(){
  const names=['Thabo M.','Neo K.','Lesego S.','Kabelo T.','Dineo M.','Mpho B.','Boitumelo R.','Tumelo M.','Kefilwe N.','Aobakwe P.'];
  return names.map((name,i)=>({
    id:'C'+String(i+1).padStart(3,'0'),
    name,
    avgAmount:rnd(150,1800),
    tenureDays:Math.floor(rnd(20,2400)),
    homeCity:pick(CITIES),
    lastDevice:'DEV-'+Math.floor(rnd(100,999)),
    recentFailed:0,
    history:[]
  }));
}
function seedHistory(customers){
  customers.forEach(c=>{
    const n=Math.floor(rnd(1,6));
    for(let i=0;i<n;i++){
      c.history.push({ts:Date.now()-rnd(0,20)*3600000,amount:c.avgAmount*rnd(0.4,1.4)});
    }
  });
}
function makeLegit(c){
  const r=Math.random();
  const device=r>0.92?'DEV-'+Math.floor(rnd(1000,9999)):c.lastDevice;
  const city=r>0.95?pick(FOREIGN):c.homeCity;
  const category=pick(CATEGORIES.filter(x=>!HIGH_RISK.includes(x)));
  return {
    id:'TX-'+Date.now().toString(36).slice(-6).toUpperCase(),
    ts:Date.now(),
    customerId:c.id,
    amount:Math.round(c.avgAmount*rnd(0.4,1.6)*100)/100,
    merchant:category, merchantCategory:category,
    city, deviceId:device,
    country:FOREIGN.includes(city)?pick(['NG','ZA','KE','GB','US']):'BW',
    channel:Math.random()>0.4?'card':'online',
    hour:new Date().getHours(),
    actualFraud:false
  };
}
function makeFraud(c,pattern){
  const base=makeLegit(c);
  base.actualFraud=true;
  if(pattern==='account_takeover'){
    base.deviceId='DEV-'+Math.floor(rnd(9000,9999));
    base.city=pick(FOREIGN);
    base.country=pick(['NG','RU','CN']);
    base.amount=Math.round(c.avgAmount*rnd(2.5,6)*100)/100;
    base.channel='online';
    base.hour=Math.floor(rnd(1,5));
  } else if(pattern==='cnp'){
    base.merchant=pick(HIGH_RISK);
    base.merchantCategory=base.merchant;
    base.amount=Math.round(c.avgAmount*rnd(1.8,4.5)*100)/100;
    base.channel='online';
    base.city=pick(FOREIGN);
    base.country=pick(['NG','RU','CN','US']);
  } else if(pattern==='card_testing'){
    base.amount=Math.round(rnd(5,60)*100)/100;
    base.channel='online';
    base.merchantCategory='Online';
    base.merchant='Online';
  } else {
    base.amount=Math.round(c.avgAmount*rnd(3,7)*100)/100;
    base.hour=Math.floor(rnd(0,5));
  }
  return base;
}

/* ── RULES ── */
function defaultRules(){
  return [
    {id:'R1',name:'Large amount on new device',description:'Amount > P5,000 and device not recognised',action:'review',active:true,
      condition:(tx,c,f)=>tx.amount>5000 && f.newDevice===1},
    {id:'R2',name:'Velocity burst',description:'4+ transactions in the last hour',action:'review',active:true,
      condition:(tx,c,f)=>f.velocity1h>=0.95},
    {id:'R3',name:'Restricted jurisdiction',description:'IP from a sanctioned or restricted country',action:'block',active:true,
      condition:(tx,c,f)=>['RU','KP','NG'].includes(tx.country)},
    {id:'R4',name:'Card testing pattern',description:'Many small online transactions in 24h',action:'review',active:true,
      condition:(tx,c,f)=>f.velocity24h>0.6 && tx.amount<60},
    {id:'R5',name:'10x average amount',description:'Amount is more than 10x customer average',action:'review',active:false,
      condition:(tx,c,f)=>f.amountZ>0.9}
  ];
}

/* ── SCORING ENGINE ── */
function computeFeatures(tx,c){
  const recent1h=c.history.filter(h=>(tx.ts-h.ts)<3600000).length;
  const recent24h=c.history.filter(h=>(tx.ts-h.ts)<86400000).length;
  const ratio=tx.amount/Math.max(1,c.avgAmount);
  return {
    amountZ:clamp((ratio-1)/4,0,1),
    velocity1h:clamp(recent1h/4,0,1),
    velocity24h:clamp(recent24h/12,0,1),
    geoJump:tx.city!==c.homeCity?1:0,
    newDevice:tx.deviceId!==c.lastDevice?1:0,
    oddHour:(tx.hour<6||tx.hour>22)?1:0,
    highRiskMerchant:HIGH_RISK.includes(tx.merchantCategory)?1:0,
    cnp:tx.channel==='online'?1:0,
    tenureRisk:1-clamp(c.tenureDays/720,0,1),
    recentFailed:clamp(c.recentFailed/3,0,1)
  };
}
function scoreTransaction(tx,c,rules,settings){
  const features=computeFeatures(tx,c);
  const contributions={};
  let rawScore=0;
  FEATURES.forEach(f=>{
    const v=features[f.key]||0;
    const contrib=v*f.weight;
    contributions[f.key]={value:v,weight:f.weight,contribution:contrib};
    rawScore+=contrib;
  });
  const probability=1/(1+Math.exp(-2.94*(rawScore-1)));
  let decision='approve';
  if(probability>=settings.declineThreshold) decision='decline';
  else if(probability>=settings.reviewThreshold) decision='review';

  const triggered=[];
  rules.filter(r=>r.active).forEach(rule=>{
    try{
      if(rule.condition(tx,c,features,probability)){
        triggered.push(rule.id);
        if(rule.action==='block') decision='decline';
        else if(rule.action==='review' && decision==='approve') decision='review';
      }
    }catch(e){}
  });
  return {features,contributions,rawScore,probability,decision,triggeredRules:triggered};
}

/* ── STATE ── */
const State = {
  customers:[], transactions:[], rules:[], ruleStats:{},
  selectedTx:null, running:false, timer:null, view:'dashboard',
  settings:{fraudRate:0.06,speed:1600,reviewThreshold:0.30,declineThreshold:0.70},
  metrics:{total:0,approved:0,reviewed:0,declined:0,confirmedFraud:0,falsePositive:0,truePositive:0,trueNegative:0,falseNegative:0},

  load(){
    const raw = localStorage.getItem(STORE_KEY);
    if(raw){
      try{
        const d=JSON.parse(raw);
        Object.assign(this,d);
        this.selectedTx=null; this.running=false; this.timer=null;
        return;
      }catch(e){}
    }
    this.customers=createCustomers();
    seedHistory(this.customers);
    this.rules=defaultRules();
    this.rules.forEach(r=>this.ruleStats[r.id]={fired:0,fraud:0});
    this.transactions=[]; this.metrics={total:0,approved:0,reviewed:0,declined:0,confirmedFraud:0,falsePositive:0,truePositive:0,trueNegative:0,falseNegative:0};
    this.save();
  },

  save(){
    const d={
      customers:this.customers, transactions:this.transactions.slice(0,200),
      rules:this.rules, ruleStats:this.ruleStats, metrics:this.metrics, settings:this.settings
    };
    localStorage.setItem(STORE_KEY,JSON.stringify(d));
  },

  reset(){
    localStorage.removeItem(STORE_KEY);
    this.load();
  }
};

/* ── LIVE TICK ── */
function tick(){
  const c = pick(State.customers);
  const isFraud = Math.random() < State.settings.fraudRate;
  const tx = isFraud
    ? makeFraud(c, pick(['account_takeover','cnp','card_testing','amount_spike']))
    : makeLegit(c);
  const result = scoreTransaction(tx, c, State.rules, State.settings);
  const record = {...tx, ...result, customer:c, reviewed:false};
  State.transactions.unshift(record);
  if(State.transactions.length>200) State.transactions.pop();

  // Update history
  c.history.unshift({ts:tx.ts, amount:tx.amount});
  if(c.history.length>30) c.history.pop();
  if(tx.deviceId!==c.lastDevice && Math.random()>0.5) c.lastDevice=tx.deviceId;

  // Metrics
  const m=State.metrics; m.total++;
  if(result.decision==='approve') m.approved++;
  else if(result.decision==='review') m.reviewed++;
  else m.declined++;

  const flagged = result.decision !== 'approve';
  if(tx.actualFraud && flagged) m.truePositive++;
  else if(tx.actualFraud && !flagged) m.falseNegative++;
  else if(!tx.actualFraud && flagged) m.falsePositive++;
  else m.trueNegative++;

  result.triggeredRules.forEach(id=>{
    if(!State.ruleStats[id]) State.ruleStats[id]={fired:0,fraud:0};
    State.ruleStats[id].fired++;
    if(tx.actualFraud) State.ruleStats[id].fraud++;
  });

  State.save();
  return record;
}

function startFeed(){ if(State.running) return; State.running=true; State.timer=setInterval(()=>{ tick(); if(window.App) App.onTick(); }, State.settings.speed); }
function stopFeed(){ State.running=false; clearInterval(State.timer); State.timer=null; }

/* ── SHELL ── */
function shellHTML(active, content){
  const user=Auth.user();
  const fu=State.transactions.filter(t=>t.decision!=='approve'&&!t.reviewed).length;
  const navItem=(id,icon,label,count)=>`
    <a class="side-link ${active===id?'active':''}" href="${id}.html">
      <i class="fas ${icon}"></i>${label}
      ${count?`<span class="cnt">${count}</span>`:''}
    </a>`;
  return `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark"><i class="fas fa-shield-halved"></i></div>
          <div><h1>Flow Sentinel</h1><small>Fraud & Risk OS</small></div>
        </div>
        <nav class="side-nav">
          ${navItem('dashboard','fa-bolt','Live Feed')}
          ${navItem('alerts','fa-bell','Alerts',fu)}
          ${navItem('rules','fa-gavel','Rules')}
          ${navItem('model','fa-brain','Model')}
          ${navItem('analytics','fa-chart-pie','Analytics')}
        </nav>
        <div class="side-foot">
          <div><span class="live-dot"></span>${State.running?'Live':'Paused'} · ${State.metrics.total} scored</div>
          <button onclick="Auth.logout()">Sign out <i class="fas fa-right-from-bracket"></i></button>
        </div>
      </aside>
      <main class="main">
        <div class="topbar">
          <h2>${titleFor(active)}</h2>
          <span class="status ${State.running?'live':'paused'}">
            <span class="dot"></span>${State.running?'LIVE':'PAUSED'}
          </span>
          <div class="spacer"></div>
          <button class="btn btn-ghost btn-sm" onclick="App.toggleFeed()">
            <i class="fas ${State.running?'fa-pause':'fa-play'}"></i>${State.running?'Pause':'Start'}
          </button>
          <button class="btn btn-ghost btn-sm" onclick="App.burst()">
            <i class="fas fa-bolt"></i> Burst 5
          </button>
        </div>
        <div class="content">${content}</div>
      </main>
    </div>`;
}

function titleFor(v){
  return {dashboard:'Live Transaction Feed',alerts:'Alert Queue',rules:'Rules Engine',
    model:'Model Performance',analytics:'Analytics & Insights'}[v]||v;
}

/* ── APP ── */
const App = {
  mount(view){
    if(!Auth.guard()) return;
    State.load();
    State.view = view;
    this.render();
    startFeed();
    setInterval(()=>{ State.save(); }, 8000);
  },

  render(){
    const v = State.view;
    const content = this['view_'+v] ? this['view_'+v]() : '';
    document.getElementById('app').innerHTML = shellHTML(v, content);
    this.bind();
  },

  onTick(){
    State.save();
    if(State.view==='dashboard') this.refreshDashboard();
    else this.render();
  },

  bind(){
    document.querySelectorAll('[data-tx]').forEach(el=>{
      el.addEventListener('click',()=>{ State.selectedTx=el.getAttribute('data-tx'); this.render(); });
    });
    document.querySelectorAll('[data-rule]').forEach(el=>{
      el.addEventListener('click',()=>{
        const r=State.rules.find(x=>x.id===el.getAttribute('data-rule'));
        if(r){ r.active=!r.active; State.save(); this.render(); }
      });
    });
    const rt=document.getElementById('reviewThresh');
    if(rt) rt.addEventListener('input',()=>{
      State.settings.reviewThreshold=+rt.value;
      document.getElementById('reviewVal').textContent=(+rt.value*100).toFixed(0)+'%';
      State.save();
    });
    const dt=document.getElementById('declineThresh');
    if(dt) dt.addEventListener('input',()=>{
      State.settings.declineThreshold=+dt.value;
      document.getElementById('declineVal').textContent=(+dt.value*100).toFixed(0)+'%';
      State.save();
    });
  },

  toggleFeed(){ State.running?stopFeed():startFeed(); this.render(); },

  burst(){
    for(let i=0;i<5;i++) setTimeout(()=>{ tick(); this.onTick(); }, i*120);
    toast('Burst of 5 transactions','info');
  },

  reviewTx(id,outcome){
    const tx=State.transactions.find(t=>t.id===id);
    if(!tx) return;
    tx.reviewed=true; tx.reviewOutcome=outcome;
    if(outcome==='confirm') State.metrics.confirmedFraud++;
    State.save();
    toast(`Transaction ${outcome==='confirm'?'confirmed as fraud':outcome==='approve'?'approved':'marked for review'}`,
      outcome==='confirm'?'red':'green');
    this.render();
  },

  /* ══════════ VIEWS ══════════ */
  view_dashboard(){
    const m=State.metrics;
    const precision=m.truePositive/(m.truePositive+m.falsePositive||1);
    const recall=m.truePositive/(m.truePositive+m.falseNegative||1);
    return `
      <div class="metrics">
        <div class="metric blue"><div class="label">Total</div><div class="value">${m.total}</div><div class="sub">${State.running?'live':'paused'}</div></div>
        <div class="metric green"><div class="label">Approved</div><div class="value">${m.approved}</div><div class="sub">${fmtPct(m.total?m.approved/m.total:0)}</div></div>
        <div class="metric amber"><div class="label">In review</div><div class="value">${m.reviewed}</div><div class="sub">${fmtPct(m.total?m.reviewed/m.total:0)}</div></div>
        <div class="metric red"><div class="label">Declined</div><div class="value">${m.declined}</div><div class="sub">${fmtPct(m.total?m.declined/m.total:0)}</div></div>
        <div class="metric"><div class="label">Fraud caught</div><div class="value">${m.truePositive}</div><div class="sub">Recall ${fmtPct(recall)}</div></div>
        <div class="metric"><div class="label">Precision</div><div class="value">${fmtPct(precision)}</div><div class="sub">${m.falsePositive} FPs</div></div>
      </div>
      <div class="split">
        <div class="panel">
          <div class="panel-head"><h3>Transaction feed</h3><div class="spacer"></div>
            <span style="font-size:.74rem;color:var(--muted)">click any row to explain</span></div>
          <div class="panel-body"><div class="feed" id="feed">${this.feedHTML()}</div></div>
        </div>
        <div class="panel" id="detailPanel">${this.detailHTML()}</div>
      </div>`;
  },

  refreshDashboard(){
    const feed=document.getElementById('feed');
    if(feed) feed.innerHTML=this.feedHTML();
    const m=State.metrics;
    document.querySelectorAll('.metrics .metric .value').forEach((el,i)=>{
      const vals=[m.total,m.approved,m.reviewed,m.declined,m.truePositive,
        (m.truePositive/(m.truePositive+m.falsePositive||1)*100).toFixed(1)+'%'];
      if(vals[i]!==undefined) el.textContent=vals[i];
    });
    const dp=document.getElementById('detailPanel');
    if(dp && State.selectedTx) dp.innerHTML=this.detailHTML();
  },

  feedHTML(){
    if(!State.transactions.length) return '<div class="empty"><i class="fas fa-satellite-dish"></i><p>Waiting for first transaction…</p></div>';
    return State.transactions.slice(0,40).map(t=>`
      <div class="tx-row ${State.selectedTx===t.id?'selected':''}" data-tx="${t.id}">
        <div class="time">${timeStr(t.ts)}</div>
        <div class="who">${esc(t.customer.name)}<div class="merchant">${esc(t.merchant)} · ${esc(t.city)}</div></div>
        <div class="amt">${fmtMoney(t.amount)}</div>
        <div class="score" style="color:${this.scoreColor(t.probability)}">${(t.probability*100).toFixed(0)}%</div>
        <div class="dec"><span class="badge ${t.decision}">${t.decision}</span></div>
      </div>`).join('');
  },

  scoreColor(p){ return p>=0.7?'var(--red)':p>=0.3?'var(--amber)':'var(--green)'; },

  detailHTML(){
    const tx=State.transactions.find(t=>t.id===State.selectedTx);
    if(!tx) return `<div class="detail-empty"><i class="fas fa-hand-pointer"></i>Select a transaction to see the full decision breakdown</div>`;
    const sorted=FEATURES.map(f=>({...f,contrib:tx.contributions[f.key]?.contribution||0}))
      .sort((a,b)=>b.contrib-a.contrib);
    const maxC=sorted[0]?.contrib||1;
    return `
      <div class="detail-head">
        <div><div class="amount">${fmtMoney(tx.amount)}</div>
          <div class="who">${esc(tx.customer.name)} · ${esc(tx.merchant)}</div></div>
        <div class="decision">
          <div class="score-big" style="color:${this.scoreColor(tx.probability)}">${(tx.probability*100).toFixed(0)}%</div>
          <div class="score-lbl">Risk score</div>
          <span class="badge ${tx.decision}" style="margin-top:6px">${tx.decision}</span>
        </div>
      </div>
      <div class="detail-section">
        <h4>Transaction details</h4>
        <div class="tx-meta">
          <div><span class="k">Time</span><span class="v">${timeStr(tx.ts)}</span></div>
          <div><span class="k">Channel</span><span class="v">${tx.channel}</span></div>
          <div><span class="k">City</span><span class="v">${esc(tx.city)}</span></div>
          <div><span class="k">Country</span><span class="v">${tx.country}</span></div>
          <div><span class="k">Device</span><span class="v">${tx.deviceId}</span></div>
          <div><span class="k">Category</span><span class="v">${esc(tx.merchantCategory)}</span></div>
        </div>
      </div>
      <div class="detail-section">
        <h4>Why this decision — top contributors</h4>
        ${sorted.map(f=>`
          <div class="feat-row">
            <div class="name"><i class="fas ${f.icon}"></i>${f.label}</div>
            <div class="bar-wrap"><div class="bar" style="width:${(f.contrib/maxC*100).toFixed(0)}%"></div></div>
            <div class="val">${f.contrib.toFixed(3)}</div>
          </div>`).join('')}
      </div>
      ${tx.triggeredRules.length?`
      <div class="detail-section">
        <h4>Rules triggered</h4>
        <div>${tx.triggeredRules.map(id=>{
          const r=State.rules.find(x=>x.id===id);
          return r?`<span class="rule-pill"><i class="fas fa-gavel"></i>${esc(r.name)}</span>`:'';
        }).join('')}</div>
      </div>`:''}
      ${tx.decision!=='approve'&&!tx.reviewed?`
      <div class="detail-section">
        <h4>Analyst action</h4>
        <div class="actions">
          <button class="btn btn-green btn-sm" onclick="App.reviewTx('${tx.id}','approve')"><i class="fas fa-check"></i> Approve</button>
          <button class="btn btn-amber btn-sm" onclick="App.reviewTx('${tx.id}','review')"><i class="fas fa-eye"></i> Review</button>
          <button class="btn btn-red btn-sm" onclick="App.reviewTx('${tx.id}','confirm')"><i class="fas fa-ban"></i> Confirm fraud</button>
        </div>
      </div>`:tx.reviewed?`<div class="detail-section"><h4>Review outcome</h4><p style="font-size:.82rem;color:var(--muted)">Marked as <b style="color:var(--text)">${tx.reviewOutcome}</b></p></div>`:''}`;
  },

  view_alerts(){
    const alerts=State.transactions.filter(t=>t.decision!=='approve'&&!t.reviewed);
    return `
      <div class="panel">
        <div class="panel-head"><h3>Alert queue (${alerts.length})</h3><div class="spacer"></div>
          <span style="font-size:.74rem;color:var(--muted)">Review flagged transactions</span></div>
        <div class="panel-body">
          ${alerts.length?alerts.map(t=>{
            const sorted=FEATURES.map(f=>({...f,contrib:t.contributions[f.key]?.contribution||0})).sort((a,b)=>b.contrib-a.contrib);
            const top=sorted.slice(0,2);
            return `
              <div class="alert-row">
                <div class="score-ring" style="background:conic-gradient(${this.scoreColor(t.probability)} ${(t.probability*100)}%,var(--surface-3) 0)">
                  <span style="color:${this.scoreColor(t.probability)}">${(t.probability*100).toFixed(0)}%</span>
                </div>
                <div class="info">
                  <div class="title">${esc(t.customer.name)} — ${esc(t.merchant)}</div>
                  <div class="sub">Top drivers: ${top.map(x=>x.label).join(' · ')}</div>
                </div>
                <div class="meta">
                  <div class="amt">${fmtMoney(t.amount)}</div>
                  <div>${timeStr(t.ts)}</div>
                </div>
                <div style="display:flex;gap:6px">
                  <button class="btn btn-green btn-sm" onclick="App.reviewTx('${t.id}','approve')"><i class="fas fa-check"></i></button>
                  <button class="btn btn-red btn-sm" onclick="App.reviewTx('${t.id}','confirm')"><i class="fas fa-ban"></i></button>
                </div>
              </div>`;
          }).join(''):'<div class="empty"><i class="fas fa-check-circle" style="color:var(--green)"></i><p>All clear — no alerts waiting</p></div>'}
        </div>
      </div>`;
  },

  view_rules(){
    return `
      <div class="panel" style="margin-bottom:16px">
        <div class="panel-head"><h3>Active rules</h3><div class="spacer"></div>
          <span style="font-size:.74rem;color:var(--muted)">Rules run on every transaction</span></div>
        <div class="panel-body">
          ${State.rules.map(r=>{
            const st=State.ruleStats[r.id]||{fired:0,fraud:0};
            const acc=st.fired?st.fraud/st.fired:0;
            return `
              <div class="rule-card">
                <div class="toggle ${r.active?'on':''}" data-rule="${r.id}"></div>
                <div class="rule-info"><h4>${esc(r.name)}</h4><p>${esc(r.description)}</p></div>
                <div class="stat"><div class="num">${st.fired}</div><div class="lbl">fired</div></div>
                <div class="stat"><div class="num" style="color:${acc>=0.5?'var(--green)':'var(--amber)'}">${st.fired?fmtPct(acc):'—'}</div><div class="lbl">fraud rate</div></div>
                <span class="action-tag ${r.action}">${r.action}</span>
              </div>`;
          }).join('')}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Decision thresholds</h3><div class="spacer"></div>
          <span style="font-size:.74rem;color:var(--muted)">Tune the model's sensitivity</span></div>
        <div class="threshold-bar">
          <label>Review at</label>
          <input type="range" min="0.1" max="0.6" step="0.01" value="${State.settings.reviewThreshold}" id="reviewThresh">
          <span class="val" id="reviewVal">${(State.settings.reviewThreshold*100).toFixed(0)}%</span>
          <label>Decline at</label>
          <input type="range" min="0.4" max="0.95" step="0.01" value="${State.settings.declineThreshold}" id="declineThresh">
          <span class="val" id="declineVal">${(State.settings.declineThreshold*100).toFixed(0)}%</span>
        </div>
      </div>`;
  },

  view_model(){
    const m=State.metrics;
    const total=m.truePositive+m.trueNegative+m.falsePositive+m.falseNegative;
    const precision=m.truePositive/(m.truePositive+m.falsePositive||1);
    const recall=m.truePositive/(m.truePositive+m.falseNegative||1);
    const f1=(precision+recall)?2*precision*recall/(precision+recall):0;
    const fpr=m.falsePositive/(m.falsePositive+m.trueNegative||1);
    const maxW=Math.max(...FEATURES.map(f=>f.weight));
    return `
      <div class="model-grid">
        <div class="panel">
          <div class="panel-head"><h3>Feature importance</h3><div class="spacer"></div>
            <span style="font-size:.74rem;color:var(--muted)">weights from trained model</span></div>
          <div class="feature-importance">
            ${[...FEATURES].sort((a,b)=>b.weight-a.weight).map(f=>`
              <div class="fi-row">
                <div class="name"><i class="fas ${f.icon}"></i>${f.label}</div>
                <div class="bar-wrap"><div class="bar" style="width:${(f.weight/maxW*100).toFixed(0)}%"></div></div>
                <div class="pct">${f.weight.toFixed(2)}</div>
              </div>`).join('')}
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Live performance</h3><div class="spacer"></div>
            <span style="font-size:.74rem;color:var(--muted)">${total} evaluated</span></div>
          <div class="perf-grid">
            <div class="perf"><div class="lbl">Precision</div><div class="val" style="color:var(--blue)">${fmtPct(precision)}</div><div class="sub">of flags were real fraud</div></div>
            <div class="perf"><div class="lbl">Recall</div><div class="val" style="color:var(--green)">${fmtPct(recall)}</div><div class="sub">of fraud was caught</div></div>
            <div class="perf"><div class="lbl">F1 score</div><div class="val" style="color:var(--purple)">${f1.toFixed(2)}</div><div class="sub">precision/recall balance</div></div>
            <div class="perf"><div class="lbl">False positive rate</div><div class="val" style="color:${fpr>0.1?'var(--red)':'var(--amber)'}">${fmtPct(fpr)}</div><div class="sub">legit flagged wrongly</div></div>
          </div>
          <div style="padding:0 20px 20px">
            <div class="confusion">
              <div class="hd"></div><div class="hd">Pred. fraud</div><div class="hd">Pred. legit</div>
              <div class="hd" style="text-align:left">Actual fraud</div>
              <div class="cell green">${m.truePositive}</div><div class="cell red">${m.falseNegative}</div>
              <div class="hd" style="text-align:left">Actual legit</div>
              <div class="cell amber">${m.falsePositive}</div><div class="cell green">${m.trueNegative}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="panel" style="margin-top:16px">
        <div class="panel-head"><h3>Model summary</h3></div>
        <div style="padding:18px 20px;font-size:.86rem;line-height:1.65;color:var(--muted)">
          <p><b style="color:var(--text)">Type:</b> Weighted feature model with sigmoid activation — logistic-style scoring, linear and fully interpretable.</p>
          <p style="margin-top:6px"><b style="color:var(--text)">Inputs:</b> 10 features spanning amount, velocity, device, geography, channel, tenure.</p>
          <p style="margin-top:6px"><b style="color:var(--text)">Explainability:</b> Every decision includes per-feature contributions, so analysts see exactly which factors pushed the score.</p>
          <p style="margin-top:6px"><b style="color:var(--text)">Feedback loop:</b> Analyst reviews update the confusion matrix in real time.</p>
        </div>
      </div>`;
  },

  view_analytics(){
    const frauds=State.transactions.filter(t=>t.actualFraud);
    const byHour={}; frauds.forEach(t=>{const h=t.hour; byHour[h]=(byHour[h]||0)+1});
    const maxHour=Math.max(...Object.values(byHour),1);
    const byMerchant={}; frauds.forEach(t=>{byMerchant[t.merchantCategory]=(byMerchant[t.merchantCategory]||0)+1});
    const merchantRows=Object.entries(byMerchant).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const maxMerchant=Math.max(...merchantRows.map(r=>r[1]),1);
    const avgFraud=frauds.length?frauds.reduce((s,t)=>s+t.amount,0)/frauds.length:0;
    const legit=State.transactions.filter(t=>!t.actualFraud);
    const avgLegit=legit.length?legit.reduce((s,t)=>s+t.amount,0)/legit.length:0;
    const insights=[];
    if(avgFraud>0) insights.push({icon:'fa-money-bill-trend-up',title:`Fraud txns average ${fmtMoney(avgFraud)}`,
      desc:`${(avgFraud/Math.max(1,avgLegit)).toFixed(1)}× the average legit transaction of ${fmtMoney(avgLegit)}.`});
    if(merchantRows.length) insights.push({icon:'fa-store',title:`${merchantRows[0][0]} is your highest-risk category`,
      desc:`${merchantRows[0][1]} fraud cases — ${((merchantRows[0][1]/Math.max(1,frauds.length))*100).toFixed(0)}% of all fraud.`});
    const odd=frauds.filter(f=>f.hour<6||f.hour>22).length;
    if(frauds.length) insights.push({icon:'fa-moon',title:`${((odd/Math.max(1,frauds.length))*100).toFixed(0)}% of fraud happens at night`,
      desc:'Between 22:00 and 06:00. Consider tightening thresholds for off-hours.'});
    const newDev=frauds.filter(f=>f.newDevice===1).length;
    if(frauds.length) insights.push({icon:'fa-mobile',title:`${newDev} of ${frauds.length} frauds used a new device`,
      desc:'Device fingerprinting is a strong signal — consider a hard rule on unknown devices over P3,000.'});
    if(!insights.length) insights.push({icon:'fa-chart-line',title:'Not enough data yet',desc:'Let the feed run to generate insights.'});
    return `
      <div class="analytics-grid">
        <div class="panel">
          <div class="panel-head"><h3>Fraud by hour of day</h3></div>
          <div class="bar-chart">
            ${Array.from({length:24},(_,i)=>{
              const v=byHour[i]||0; const h=Math.max(2,(v/maxHour)*100);
              return `<div class="chart-row">
                <div class="lbl">${String(i).padStart(2,'0')}:00</div>
                <div class="bar-wrap"><div class="bar" style="width:${h}%">${v||''}</div></div>
                <div class="num">${v}</div>
              </div>`;
            }).join('')}
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Fraud by merchant category</h3></div>
          <div class="bar-chart">
            ${merchantRows.map(([m,v])=>`
              <div class="chart-row">
                <div class="lbl">${esc(m)}</div>
                <div class="bar-wrap"><div class="bar" style="width:${(v/maxMerchant*100).toFixed(0)}%">${v}</div></div>
                <div class="num">${v}</div>
              </div>`).join('')||'<div class="empty"><p>No fraud observed yet</p></div>'}
          </div>
        </div>
      </div>
      <div class="panel" style="margin-top:16px">
        <div class="panel-head"><h3>Auto-generated insights</h3><div class="spacer"></div>
          <span style="font-size:.74rem;color:var(--muted)">from live transaction data</span></div>
        <div class="insights">
          ${insights.map(i=>`
            <div class="insight-item">
              <div class="ico"><i class="fas ${i.icon}"></i></div>
              <div class="body"><div class="title">${esc(i.title)}</div><div class="desc">${esc(i.desc)}</div></div>
            </div>`).join('')}
        </div>
      </div>`;
  }
};

window.App = App;
window.Auth = Auth;
window.State = State;
