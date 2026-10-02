(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas?.getContext("2d", { alpha: false });
  if(!canvas || !ctx) throw new Error("CANVAS_2D_INDISPONIVEL");
  ctx.imageSmoothingEnabled = false;
  const W = canvas.width, H = canvas.height, ASSET = "assets/";
  const keys = new Set();

  const $ = id => document.getElementById(id);
  const menu = $("menu"), gameScreen = $("game-screen"), menuButton = $("menu-button");
  const pauseBox = $("pause-box"), messageBox = $("message-box"), messageTitle = $("message-title"), messageText = $("message-text"), messageButton = $("message-button");
  const levelBox = $("level-box"), itemChoices = $("item-choices"), slotCount = $("slot-count");
  const hpFill = $("hp-fill"), hpText = $("hp-text"), scoreEl = $("score"), livesEl = $("lives"), timerEl = $("timer"), modeLabel = $("mode-label"), stageLabel = $("stage-label");
  const levelText = $("level-text"), xpText = $("xp-text"), xpFill = $("xp-fill"), slotsEl = $("slots"), relicSlotsEl = $("relic-slots"), skillFill = $("skill-fill"), skillText = $("skill-text");

  const playerFrames = { south: [], east: [], north: [], west: [] };
  const eyeFrames = { south: [], east: [], north: [], west: [] };
  const marioSprite = new Image(); marioSprite.src = ASSET + "sprites.png";
  const load = src => { const i = new Image(); i.src = ASSET + src; return i; };
  for (const dir of Object.keys(playerFrames)) {
    for (let i=0;i<4;i++) playerFrames[dir].push(load(`player_${dir}_${i}.png`));
    for (let i=0;i<4;i++) eyeFrames[dir].push(load(`eye_${dir}_${i}.png`));
  }
  const weaponIcons = Array.from({length:20},(_,i)=>load(`weapon_${String(i+1).padStart(2,"0")}.png`));
  const relicIcons = Array.from({length:20},(_,i)=>load(`relics/relic_${String(i+1).padStart(2,"0")}.png`));
  const bossChest = load("boss_chest.png");
  const bossChestOpen = load("boss_chest_open.png");
  const dropChest = load("chest_drop.png");

  const WEAPONS = [
    ["SWORD OF VALOR",.70,1,0,32,0,"melee","sword"],
    ["DWARF AXE",.70,1,.03,46,420,"melee","axe"],
    ["HUNTSMAN SPEAR",.70,2,.02,42,650,"pierce","spear"],
    ["ROGUE BLADE",.70,2,.10,24,700,"pierce","dagger"],
    ["INFERNO CLAYMORE",1.05,1,0,60,0,"fire","fireArc"],
    ["OAK BOW",.70,1,.02,24,650,"pierce","bow"],
    ["CROSSBOW",.70,1,0,40,820,"pierce","crossbow"],
    ["PISTOLA",.70,1,0,35,760,"bullet","pistol"],
    ["BLUNDERBUSS",.95,5,.28,17,500,"spread","shotgun"],
    ["SORCERER STAFF",.70,2,.12,25,560,"magic","staff"],
    ["PLASMA SABRE",.70,2,.07,30,0,"energy","plasmaSlash"],
    ["ASTRO RIFLE",.70,3,.08,12,820,"bullet","rifle"],
    ["TITAN HAMMER",1.25,1,0,75,0,"heavy","hammer"],
    ["SPIKED FLAIL",.70,3,.18,23,540,"spread","flail"],
    ["QUANTUM CARBINE",.70,2,.10,18,900,"energy","quantum"],
    ["HEAVY BLASTER",.85,2,.06,38,650,"energy","blaster"],
    ["LIGHTNING WHIP",.70,4,.16,15,0,"magic","lightning"],
    ["SHADOW SCYTHE",.70,3,.13,28,620,"shadow","scythe"],
    ["NEUTRON SNIPER",1.35,1,0,105,1100,"sniper","sniper"],
    ["PLASMA MORTAR",1.50,1,0,90,390,"mortar","mortar"]
  ].map((w,i)=>({name:w[0],cooldown:w[1],shots:w[2],spread:w[3],damage:w[4],speed:w[5],type:w[6],attack:w[7],icon:i}));

  const MODES = {
    tournament:{label:"TORNEIO",lives:3,time:null,maxWave:20},
    survival:{label:"SOBREVIVÊNCIA",lives:3,time:null,maxWave:Infinity},
    time:{label:"CONTRA O TEMPO",lives:3,time:90,maxWave:Infinity}
  };

  const rand=(a,b)=>Math.random()*(b-a)+a, clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const direction=(x,y)=>Math.abs(x)>Math.abs(y)?(x>0?"east":"west"):(y>0?"south":"north");
  const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
  let game=null, mode=null, raf=0, last=0, audio=null, audioVoice=null, lastBeepTime=-Infinity, hudClock=0;
  const DIAG={startedAt:performance.now(),frames:0,slowFrames:0,maxFrameMs:0,lastFrameMs:0,updateMs:0,drawMs:0,maxUpdateMs:0,maxDrawMs:0,lastError:null,errorCount:0,startupStage:"script-loaded",startupMs:0};
  function diagError(where,err){DIAG.lastError={where,message:String(err?.message||err),stack:String(err?.stack||"")};DIAG.errorCount++;console.error("[TA DEBUG]",where,err);}
  function diagMark(stage){DIAG.startupStage=stage;DIAG.startupMs=performance.now()-DIAG.startedAt;}
  window.addEventListener("error",e=>diagError("window.error",e.error||e.message));
  window.addEventListener("unhandledrejection",e=>diagError("unhandledrejection",e.reason));
  diagMark("DOM and canvas ready");
  const LIMITS={enemies:50,projectiles:100,enemyShots:60,particles:250,xpOrbs:120,healOrbs:100};

  function startAudio(){
    if(!audio){const AC=window.AudioContext||window.webkitAudioContext;if(AC){audio=new AC();
      audioVoice={o:audio.createOscillator(),g:audio.createGain()};
      audioVoice.o.connect(audioVoice.g);audioVoice.g.connect(audio.destination);
      audioVoice.g.gain.value=0;audioVoice.o.start();
    }}
    if(audio?.state==="suspended")audio.resume();
  }
  function beep(freq=440,duration=.06,type="square",volume=.025){
    startAudio();if(!audioVoice||!audio)return;
    // Uma única voz de áudio reutilizada. Antes, milhões de OscillatorNode/GainNode
    // eram criados ao longo de partidas longas e pressionavam o garbage collector.
    const now=audio.currentTime;
    if(now-lastBeepTime<.045)return;
    lastBeepTime=now;
    const {o,g}=audioVoice;o.type=type;o.frequency.cancelScheduledValues(now);o.frequency.setValueAtTime(freq,now);
    g.gain.cancelScheduledValues(now);g.gain.setValueAtTime(Math.max(.0001,volume),now);g.gain.exponentialRampToValueAtTime(.0001,now+Math.min(duration,.12));
  }
  function winSound(){beep(523,.08);setTimeout(()=>beep(659,.08),90);setTimeout(()=>beep(784,.14),180)}

  function resetGame(selectedMode){
    try{
    diagMark("resetGame started");
    mode=selectedMode;const cfg=MODES[mode];
    game={running:true,paused:false,stage:1,score:0,lives:cfg.lives,baseLives:cfg.lives,timeLeft:cfg.time,nextWave:0,waveClock:0,spawnClock:.4,bossSpawned:false,level:1,xp:0,xpNeed:8,particles:[],projectiles:[],enemyShots:[],enemies:[],xpOrbs:[],healOrbs:[],chest:null,chestChoices:[],choicePending:false,
      player:{x:W/2,y:H/2,r:10,hp:100,maxHp:100,baseMaxHp:100,speed:220,dirX:0,dirY:-1,anim:0,moving:false,invuln:0,skillCooldown:0,slots:[{weapon:7,level:1,cooldown:0}],relics:[],relicMaxSlots:5,damageMult:1,weaponCooldownMult:1,skillCooldownMult:1,moveMult:1,xpMult:1,magnet:70,rangeMult:1,critChance:0,damageReduction:0,enemySlow:1,healBonus:1,orbitRadius:20,regenOnKill:0,reflectChance:0,retaliate:false,deathGuard:0},
      // Estado visual que havia sido perdido na versão do baú. Sem ele o draw() parava com erro e escondia jogador/inimigos.
      mario:{x:W-92,y:118},orbitAngle:0,
      banner:1.3,bannerText:"ONDA 1"
    };
    buildSlots();spawnInitialWave();updateHud();menu.classList.add("hidden");gameScreen.classList.remove("hidden");messageBox.classList.add("hidden");pauseBox.classList.add("hidden");levelBox.classList.add("hidden");timerEl.classList.toggle("hidden",cfg.time===null);modeLabel.textContent=cfg.label;hudClock=0;last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);startAudio();beep(330,.08);diagMark("game started");
    }catch(err){diagError("resetGame",err);game=null;gameScreen.classList.add("hidden");menu.classList.remove("hidden");alert("ERRO AO INICIAR O JOGO\n\n"+String(err?.message||err));}
  }

  function spawnInitialWave(){
    for(let i=0;i<Math.min(3,2+game.stage);i++)spawnEnemy(false);
  }

  function enemyPowerMultiplier(){
    // A cada 10 ondas: +4% cumulativo em vida, dano e velocidade.
    return Math.pow(1.04, Math.floor((game.stage-1)/10));
  }

  function spawnEnemy(isBoss=false){
    if(isBoss && game.enemies.some(e=>e.boss))return;
    if(game.enemies.length>=LIMITS.enemies)return;
    let x=50,y=120;for(let tries=0;tries<30;tries++){
      const side=Math.floor(Math.random()*4);
      if(side===0){x=rand(45,W-45);y=rand(105,135)}
      if(side===1){x=rand(45,W-45);y=rand(H-70,H-40)}
      if(side===2){x=rand(35,90);y=rand(125,H-65)}
      if(side===3){x=rand(W-90,W-35);y=rand(125,H-65)}
      if(Math.hypot(x-W/2,y-H/2)>180)break;
    }
    if(isBoss){
      const scale=enemyPowerMultiplier();const bossTier=Math.max(1,Math.floor(game.stage/10));const bossHpMult=1+(bossTier-1)*0.75;const hp=(750+game.stage*45)*scale*bossHpMult;game.enemies.push({x,y,r:42,hp,maxHp:hp,baseSpeed:(28+game.stage*.5)*scale,speed:(28+game.stage*.5)*scale,damageMult:scale,anim:0,hitFlash:0,attackCooldown:1.2,boss:true,dir:"south",shootTimer:2,bossTier});return;
    }
    const scale=enemyPowerMultiplier();const hp=(34+game.stage*4)*scale;
    game.enemies.push({x,y,r:11,hp,maxHp:hp,baseSpeed:(48+game.stage*2.2+rand(-7,8))*scale,speed:0,damageMult:scale,anim:rand(0,3.99),hitFlash:0,attackCooldown:rand(.7,1.8),phase:rand(0,6.28),dir:"south",boss:false});
  }

  function beginWave(){
    game.stage++;game.waveClock=0;game.spawnClock=.3;game.bossSpawned=false;game.banner=1.3;game.bannerText=`ONDA ${game.stage}`;
    if(game.stage%10===0){spawnEnemy(true);game.bossSpawned=true;burst(W/2,H/2,"boss");beep(70,.25,"sawtooth",.04)}
    updateHud();
  }

  function addXP(amount){
    game.xp+=amount;
    while(game.xp>=game.xpNeed){game.xp-=game.xpNeed;game.level++;game.xpNeed=Math.floor(8+game.level*4);openLevelChoice();}
  }

  const RELICS = [
    {id:0,name:"DRAGON SKULL",desc:"+25% dano de todas as armas.",apply:p=>p.damageMult*=1.25},
    {id:1,name:"IRON CROWN",desc:"Armas começam a recarga 12% mais rápido.",apply:p=>p.weaponCooldownMult*=.88},
    {id:2,name:"ANCIENT TOME",desc:"+30% de XP recebido.",apply:p=>p.xpMult=(p.xpMult||1)*1.3},
    {id:3,name:"RUINED HOURGLASS",desc:"Olhos ficam 18% mais lentos.",apply:p=>p.enemySlow*=.82},
    {id:4,name:"VOID GAZE",desc:"+25% de alcance das armas.",apply:p=>p.rangeMult*=1.25},
    {id:5,name:"STAR COMPASS",desc:"Armas priorizam inimigos mais distantes e ganham +35% de alcance.",apply:p=>{p.rangeMult*=1.35;p.starCompass=true}},
    {id:6,name:"RAINBOW PRISM",desc:"+18% de chance de acerto crítico.",apply:p=>p.critChance+=.18},
    {id:7,name:"SPIRAL SHELL",desc:"Recebe 20% menos dano.",apply:p=>p.damageReduction=Math.min(.65,p.damageReduction+.20)},
    {id:8,name:"MANA SHARD",desc:"-20% no cooldown natural da skill.",apply:p=>p.skillCooldownMult*=.80},
    {id:9,name:"CHRONOS HEART",desc:"-18% no cooldown natural das armas.",apply:p=>p.weaponCooldownMult*=.82},
    {id:10,name:"RUNE TABLET",desc:"+15% dano e +15 de vida máxima.",apply:p=>{p.damageMult*=1.15;p.maxHp+=15;p.hp+=15}},
    {id:11,name:"ASTRAL ORRERY",desc:"Aumenta o raio das armas orbitais.",apply:p=>p.orbitRadius+=12},
    {id:12,name:"PHARELL HELM",desc:"Ganha +1 vida imediatamente.",apply:p=>{game.lives+=1}},
    {id:13,name:"MALACHITE SCARAB",desc:"Curas dos orbes amarelos são 60% maiores.",apply:p=>p.healBonus*=1.6},
    {id:14,name:"SINGULARITY ORB",desc:"Atrai XP e cura de muito mais longe.",apply:p=>p.magnet+=100},
    {id:15,name:"SOUL MIRROR",desc:"20% de chance de refletir projéteis.",apply:p=>p.reflectChance=Math.min(.8,p.reflectChance+.20)},
    {id:16,name:"SOUL MIRROR II",desc:"Ao sofrer dano, solta uma rajada automática.",apply:p=>p.retaliate=true},
    {id:17,name:"GANESHA IDOL",desc:"-30% dano recebido e uma proteção contra morte.",apply:p=>{p.damageReduction=Math.min(.75,p.damageReduction+.30);p.deathGuard=1}},
    {id:18,name:"VOID GAZE PRIME",desc:"+40% alcance e +20% dano.",apply:p=>{p.rangeMult*=1.4;p.damageMult*=1.2}},
    {id:19,name:"CHRONOS CORE",desc:"-25% cooldown das armas e -15% da skill.",apply:p=>{p.weaponCooldownMult*=.75;p.skillCooldownMult*=.85}}
  ];

  function rebuildRelicEffects(){
    const p=game.player;
    const hpRatio=p.maxHp>0?p.hp/p.maxHp:1;
    p.damageMult=1;p.weaponCooldownMult=1;p.skillCooldownMult=1;p.moveMult=1;
    p.magnet=70;p.rangeMult=1;p.critChance=0;p.damageReduction=0;p.enemySlow=1;p.healBonus=1;
    p.orbitRadius=20;p.reflectChance=0;p.retaliate=false;p.xpMult=1;
    let maxHp=100, hasDeathGuard=false;
    for(const owned of p.relics){
      const lv=Math.max(1,owned.level||1);
      switch(owned.relic){
        case 0:p.damageMult*=Math.pow(1.25,Math.min(lv,120));break;
        case 1:p.weaponCooldownMult*=Math.pow(.88,Math.min(lv,120));break;
        case 2:p.xpMult*=Math.pow(1.30,Math.min(lv,120));break;
        case 3:p.enemySlow*=Math.pow(.82,Math.min(lv,120));break;
        case 4:p.rangeMult*=Math.pow(1.25,Math.min(lv,120));break;
        case 5:p.rangeMult*=Math.pow(1.35,Math.min(lv,120));break;
        case 6:p.critChance=Math.min(.85,.18*lv);break;
        case 7:p.damageReduction=Math.min(.75,.20*lv);break;
        case 8:p.skillCooldownMult*=Math.pow(.80,Math.min(lv,120));break;
        case 9:p.weaponCooldownMult*=Math.pow(.82,Math.min(lv,120));break;
        case 10:p.damageMult*=Math.pow(1.15,Math.min(lv,120));maxHp+=15*lv;break;
        case 11:p.orbitRadius+=12*lv;break;
        case 12:break;
        case 13:p.healBonus*=Math.pow(1.60,Math.min(lv,120));break;
        case 14:p.magnet+=100*lv;break;
        case 15:p.reflectChance=Math.min(.8,.20*lv);break;
        case 16:p.retaliate=true;break;
        case 17:p.damageReduction=Math.min(.75,p.damageReduction+.30*lv);hasDeathGuard=true;break;
        case 18:p.rangeMult*=Math.pow(1.40,Math.min(lv,120));p.damageMult*=Math.pow(1.20,Math.min(lv,120));break;
        case 19:p.weaponCooldownMult*=Math.pow(.75,Math.min(lv,120));p.skillCooldownMult*=Math.pow(.85,Math.min(lv,120));break;
      }
    }
    p.maxHp=maxHp;p.hp=clamp(hpRatio*p.maxHp,0,p.maxHp);
    // Recalcular relíquias não pode restaurar vidas que o jogador já perdeu.
    game.lives=Math.max(0,game.lives);
    if(hasDeathGuard && p.deathGuard===0)p.deathGuard=1;
  }

  const itemPool=[
    ...Array.from({length:19},(_,i)=>i+1).map(weapon=>({kind:"weapon",weapon,name:WEAPONS[weapon].name,desc:"Nova arma orbital automática."})),
    ...RELICS.map((r)=>({kind:"relic",relic:r.id,name:r.name,desc:r.desc})),
    {kind:"upgrade",stat:"damageMult",amount:.18,name:"DANO +18%",desc:"Todas as armas causam mais dano."},
    {kind:"upgrade",stat:"moveMult",amount:.10,name:"VELOCIDADE +10%",desc:"Movimento mais rápido."},
    {kind:"heal",name:"RECUPERAÇÃO",desc:"Recupera 35 HP."}
  ];

  function randomChoices(){
    const owned=new Set(game.player.slots.map(s=>s.weapon));
    let pool=itemPool.filter(item=>{
      if(item.kind!=="weapon")return true;
      return owned.has(item.weapon)||game.player.slots.length<5;
    });
    const result=[];
    while(result.length<3&&pool.length){const i=Math.floor(Math.random()*pool.length);result.push(pool.splice(i,1)[0]);}
    return result;
  }

  function randomChestWeapons(){
    const pool=game.player.slots.map((slot,index)=>({
      kind:"weapon", weapon:slot.weapon, slotIndex:index, level:slot.level,
      name:WEAPONS[slot.weapon].name,
      desc:"Evoluir esta arma em +1 nível. Sem limite de nível."
    }));
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    return pool;
  }

  function openLevelChoice(){
    if(!game.running)return;
    game.choicePending=true;game.paused=true;
    const choices=randomChoices();game.currentChoices=choices;itemChoices.innerHTML="";
    slotCount.textContent=`${game.player.slots.length}/5 • R ${game.player.relics.length}/${game.player.relicMaxSlots}`;
    choices.forEach((item,i)=>{
      const b=document.createElement("button");b.className="item-choice";b.dataset.choice=i+1;
      const icon=item.kind==="weapon"?weaponIcons[item.weapon].src:item.kind==="relic"?relicIcons[item.relic].src:weaponIcons[19].src;
      b.innerHTML=`<span class="choice-key">${i+1}</span><img src="${icon}" alt=""><span class="choice-name">${item.name}</span><span class="choice-desc">${item.desc}</span>`;
      b.addEventListener("click",()=>chooseItem(i));itemChoices.appendChild(b);
    });
    levelBox.classList.remove("hidden");beep(660,.08);setTimeout(()=>beep(880,.12),90);updateHud();
  }

  function openChestReward(x,y,isBoss=true){
    if(!game.running||game.choicePending)return;
    game.chest={x,y,open:false,isBoss};
    game.chestChoices=randomChestWeapons();
    game.choicePending=true;game.paused=true;
    const box=document.getElementById("chest-box"), choices=document.getElementById("chest-choices");
    const title=document.getElementById("chest-title");
    const subtitle=document.getElementById("chest-subtitle");
    choices.innerHTML="";
    title.textContent=isBoss?"BAÚ DO BOSS!":"BAÚ ENCONTRADO!";
    subtitle.textContent=game.chestChoices.length?"ESCOLHA QUAL ARMA VOCÊ QUER EVOLUIR":"NENHUMA ARMA EQUIPADA";
    document.getElementById("chest-slots").textContent=`ARMAS EQUIPADAS ${game.player.slots.length}/5`;
    game.chestChoices.forEach((item,i)=>{
      const b=document.createElement("button");b.className="item-choice chest-choice";b.dataset.choice=i+1;
      b.innerHTML=`<span class="choice-key">${i+1}</span><img src="${weaponIcons[item.weapon].src}" alt=""><span class="choice-name">${item.name}</span><span class="choice-desc">${item.desc}</span><span class="choice-level">LV${item.level} → LV${item.level+1}</span>`;
      b.addEventListener("click",()=>chooseChestReward(i));choices.appendChild(b);
    });
    if(!game.chestChoices.length){
      const b=document.createElement("button");b.className="item-choice chest-choice";
      b.innerHTML=`<span class="choice-name">NENHUMA ARMA DISPONÍVEL</span><span class="choice-desc">Equipe uma arma para poder evoluí-la.</span>`;
      b.addEventListener("click",()=>closeEmptyChest());choices.appendChild(b);
    }
    box.classList.remove("hidden");beep(440,.1);setTimeout(()=>beep(660,.1),100);updateHud();
  }

  function closeEmptyChest(){
    if(!game?.choicePending)return;
    if(game.chest)game.chest.open=true;
    game.choicePending=false;game.paused=false;
    document.getElementById("chest-box").classList.add("hidden");
    last=performance.now();updateHud();
  }

  function chooseChestReward(index){
    if(!game?.choicePending)return;
    const item=game.chestChoices[index];if(!item)return;
    const slot=game.player.slots[item.slotIndex];
    if(slot)slot.level++;
    if(game.chest)game.chest.open=true;
    game.choicePending=false;game.paused=false;
    document.getElementById("chest-box").classList.add("hidden");
    buildSlots();beep(820,.08);setTimeout(()=>beep(1100,.12),90);last=performance.now();updateHud();
  }

  function chooseItem(index){
    if(!game?.choicePending)return;const item=game.currentChoices[index];if(!item)return;const p=game.player;
    if(item.kind==="weapon"){
      const existing=p.slots.find(s=>s.weapon===item.weapon);
      if(existing){existing.level++;}
      else if(p.slots.length<5)p.slots.push({weapon:item.weapon,level:1,cooldown:0});
    } else if(item.kind==="relic"){
      const existing=p.relics.find(r=>r.relic===item.relic);
      if(existing)existing.level++;
      else if(p.relics.length<p.relicMaxSlots)p.relics.push({relic:item.relic,level:1});
      else {p.relicMaxSlots++;p.relics.push({relic:item.relic,level:1});}
      if(item.relic===12)game.lives++;
      rebuildRelicEffects();
    } else if(item.kind==="upgrade")p[item.stat]+=item.amount;
    else if(item.kind==="heal")p.hp=clamp(p.hp+35,0,p.maxHp);
    game.choicePending=false;game.paused=false;levelBox.classList.add("hidden");buildSlots();beep(740,.07);last=performance.now();updateHud();
  }

  function buildSlots(){
    if(!game)return;
    slotsEl.innerHTML="";
    for(let i=0;i<5;i++){
      const s=game.player.slots[i],d=document.createElement("div");d.className="slot"+(s?"":" empty");
      d.innerHTML=`<span class="slot-num">${i+1}</span>${s?`<img src="${weaponIcons[s.weapon].src}" alt="${WEAPONS[s.weapon].name}"><span class="slot-lvl">LV${s.level}</span>`:""}`;slotsEl.appendChild(d);
    }
    relicSlotsEl.innerHTML="";
    relicSlotsEl.style.gridTemplateColumns=`repeat(${Math.min(8,Math.max(5,game.player.relicMaxSlots))},1fr)`;
    for(let i=0;i<game.player.relicMaxSlots;i++){
      const r=game.player.relics[i],d=document.createElement("div");d.className="slot relic-slot"+(r?"":" empty");
      d.innerHTML=`<span class="slot-num">R${i+1}</span>${r?`<img src="${relicIcons[r.relic].src}" alt="${RELICS[r.relic].name}"><span class="slot-lvl">LV${r.level}</span>`:""}`;relicSlotsEl.appendChild(d);
    }
  }

  function nearestEnemy(x,y){
    let best=null,bestD=game.player.starCompass?0:Infinity;
    const maxRange=430*game.player.rangeMult;
    for(const e of game.enemies){
      const d=Math.hypot(e.x-x,e.y-y);
      if(d>maxRange)continue;
      if(game.player.starCompass ? d>bestD : d<bestD){bestD=d;best=e;}
    }
    return best;
  }
  function spawnProjectile(x,y,ang,speed,damage,opts={}){
    if(game.projectiles.length>=LIMITS.projectiles)return;
    game.projectiles.push({x,y,vx:Math.cos(ang)*speed,vy:Math.sin(ang)*speed,life:opts.life||1.15,r:opts.r||4,damage,color:opts.color||"#ffd84d",pierce:!!opts.pierce,explode:!!opts.explode,explosionRadius:opts.explosionRadius||0,explosionDamage:opts.explosionDamage||0});
  }

  function weaponDamage(slot,w,mult=1){
    const p=game.player;
    const safeLevel=Math.min(Math.max(1,slot.level||1),900);
    const levelMult=Math.pow(1.28,safeLevel-1);
    return w.damage*p.damageMult*levelMult*mult;
  }

  function autoWeapons(dt){
    const p=game.player;
    for(let i=0;i<p.slots.length;i++){
      const slot=p.slots[i],w=WEAPONS[slot.weapon];
      slot.cooldown-=dt;if(slot.cooldown>0)continue;
      const orbit=p.orbitRadius+i*4;
      const a=game.orbitAngle+i*(Math.PI*2/p.slots.length);
      const wx=p.x+Math.cos(a)*orbit,wy=p.y+Math.sin(a)*orbit;
      const target=nearestEnemy(wx,wy);if(!target)continue;
      const base=Math.atan2(target.y-wy,target.x-wx);
      const levelCooldownMult=1/Math.max(1,1+(slot.level-1)*.05);
      slot.cooldown=Math.max(.08,w.cooldown*p.weaponCooldownMult*levelCooldownMult);
      const crit=()=>Math.random()<p.critChance;
      const dmg=()=>weaponDamage(slot,w,crit()?2:1);
      const color=w.type==="magic"?"#c26cff":w.type==="energy"?"#35e7ff":w.type==="fire"?"#ff6b35":w.type==="shadow"?"#9d6cff":"#ffd84d";

      switch(w.attack){
        case "axe":
          for(let j=0;j<2;j++)spawnProjectile(wx,wy,base+(j?.13:-.13),w.speed,dmg(),{color:"#bfc7d8",r:7,life:1.05,pierce:true});
          break;
        case "spear":
          for(let j=0;j<2;j++)spawnProjectile(wx,wy,base+(j-.5)*.035,w.speed,dmg(),{color:"#b8d8df",r:4,life:1.4,pierce:true});
          break;
        case "dagger":
          for(let j=0;j<2;j++)spawnProjectile(wx,wy,base+(j-.5)*.22,w.speed,dmg(),{color:"#e8f1ff",r:3,pierce:true});
          break;
        case "fireArc":
          for(let j=0;j<5;j++){
            const aa=base+(j-2)*.11;spawnProjectile(wx,wy,aa,500,dmg()*.75,{color:"#ff6b35",r:7,life:.55,pierce:true});
          }
          break;
        case "bow":
          spawnProjectile(wx,wy,base,w.speed,dmg(),{color:"#d7b36a",r:3,life:1.5,pierce:true});break;
        case "crossbow":
          spawnProjectile(wx,wy,base,w.speed,dmg()*1.2,{color:"#e7e1d4",r:4,life:1.4,pierce:true});break;
        case "pistol":
          spawnProjectile(wx,wy,base,w.speed,dmg(),{color:"#f6f6ff",r:3,life:1.1});break;
        case "shotgun":
          for(let j=0;j<5;j++)spawnProjectile(wx,wy,base+(j-2)*.16,w.speed,dmg()*.72,{color:"#ffb347",r:3,life:.9});break;
        case "staff":
          for(let j=0;j<2;j++)spawnProjectile(wx,wy,base+(j-.5)*.18,560,dmg(),{color:"#c26cff",r:5,life:1.2});break;
        case "plasmaSlash":
          for(let j=0;j<3;j++){const e=game.enemies.find(en=>Math.hypot(en.x-wx,en.y-wy)<85);if(e)hurtEnemy(e,dmg()*.85);}
          burst(wx,wy,"weapon");break;
        case "rifle":
          for(let j=0;j<3;j++)spawnProjectile(wx,wy,base+(j-1)*.06,w.speed,dmg(),{color:"#35e7ff",r:3,life:1.2});break;
        case "hammer":
          for(const e of game.enemies)if(Math.hypot(e.x-wx,e.y-wy)<105)hurtEnemy(e,dmg());
          burst(wx,wy,"weapon");break;
        case "flail":
          for(let j=0;j<3;j++)spawnProjectile(wx,wy,base+(j-1)*.2,w.speed,dmg()*.8,{color:"#d0d4db",r:6,life:1.0,pierce:true});break;
        case "quantum":
          for(let j=0;j<2;j++)spawnProjectile(wx,wy,base+(j-.5)*.09,w.speed,dmg(),{color:"#35e7ff",r:4,life:.95,pierce:true});break;
        case "blaster":
          for(let j=0;j<2;j++)spawnProjectile(wx,wy,base+(j-.5)*.08,w.speed,dmg()*1.1,{color:"#7fffd4",r:5,life:1.2,pierce:true});break;
        case "lightning":
          {let hits=0;const sorted=[...game.enemies].sort((a,b)=>Math.hypot(a.x-wx,a.y-wy)-Math.hypot(b.x-wx,b.y-wy));for(const e of sorted){if(Math.hypot(e.x-wx,e.y-wy)<260*p.rangeMult){hurtEnemy(e,dmg()*.7);hits++;if(hits>=4)break;}}burst(wx,wy,"skill");}
          break;
        case "scythe":
          for(let j=0;j<3;j++)spawnProjectile(wx,wy,base+(j-1)*.16,620,dmg(),{color:"#9d6cff",r:7,life:1.25,pierce:true});break;
        case "sniper":
          spawnProjectile(wx,wy,base,w.speed,dmg(),{color:"#ffffff",r:4,life:1.7,pierce:true});break;
        case "mortar":
          spawnProjectile(wx,wy,base,w.speed,dmg(),{color:"#ff8a4c",r:8,life:1.5,explode:true,explosionRadius:58,explosionDamage:dmg()*.75});break;
      }
      for(let k=0;k<3&&game.particles.length<LIMITS.particles;k++)game.particles.push({x:wx,y:wy,vx:rand(-20,20),vy:rand(-20,20),life:.16,maxLife:.16,size:rand(2,4),type:"weapon"});
      beep(w.shots>=4?135:w.shots>=2?190:260,.018,"square",.009);
    }
  }

  // SKILL AUTOMÁTICA é independente das armas equipadas.
  // Ela nunca chama autoWeapons() e nunca usa o tipo/quantidade de tiros de uma arma.
  function autoSkill(){
    if(!game?.running||game.paused||game.player.skillCooldown>0)return;
    const p=game.player,target=nearestEnemy(p.x,p.y);
    if(!target)return;
    p.skillCooldown=7*p.skillCooldownMult;
    const base=Math.atan2(target.y-p.y,target.x-p.x);
    const damage=(45+game.stage*4)*p.damageMult;
    game.projectiles.push({
      x:p.x+Math.cos(base)*22, y:p.y+Math.sin(base)*22,
      vx:Math.cos(base)*480, vy:Math.sin(base)*480,
      life:1.6, r:12, damage, color:"#ff3d71", pierce:true, skill:true
    });
    burst(p.x,p.y,"skill");beep(90,.15,"sawtooth",.04);
  }

  function useSkill(){ autoSkill(); }

  function hurtEnemy(e,amount){
    if(e.hp<=0)return;e.hp-=amount;e.hitFlash=.08;game.score+=5;burst(e.x,e.y,"hit");
    if(e.hp<=0){
      game.score+=e.boss?3000:180+game.stage*12;
      const xpAmount=(e.boss?12:1);
      if(game.xpOrbs.length<LIMITS.xpOrbs)game.xpOrbs.push({x:e.x,y:e.y,r:e.boss?7:4,value:xpAmount,vx:rand(-25,25),vy:rand(-25,25),life:20});
      if(e.boss){
        for(let i=0;i<5&&game.healOrbs.length<LIMITS.healOrbs;i++)game.healOrbs.push({x:e.x+rand(-18,18),y:e.y+rand(-18,18),r:6,value:12,vx:rand(-35,35),vy:rand(-35,35),life:20});
        burst(e.x,e.y,"boss");
        game.chest={x:e.x,y:e.y,open:false,isBoss:true};
        openChestReward(e.x,e.y,true);
      } else {
        if(game.healOrbs.length<LIMITS.healOrbs)game.healOrbs.push({x:e.x,y:e.y,r:4,value:5,vx:rand(-25,25),vy:rand(-25,25),life:20});
        burst(e.x,e.y,"defeat");
        // 10% de chance de um inimigo comum deixar um baú.
        if((!game.chest || game.chest.open) && Math.random()<0.10){
          openChestReward(e.x,e.y,false);
          burst(e.x,e.y,"boss");
          beep(520,.12,"square",.035);
        }
      }
      beep(e.boss?70:130+game.stage*4,.08);
    }
  }
  function damagePlayer(amount){
    if(!game?.running)return;
    const p=game.player;
    // I-frame obrigatório: qualquer dano recebido durante a proteção é ignorado.
    if(p.invuln>0)return;
    if(!Number.isFinite(amount)||amount<=0)return;
    if(p.reflectChance>0&&Math.random()<p.reflectChance){for(let i=0;i<8;i++){const a=i*Math.PI/4;spawnProjectile(p.x,p.y,a,300,20*p.damageMult,{life:1,r:4,color:"#b36cff",pierce:true});}burst(p.x,p.y,"skill");}
    amount*=1-p.damageReduction;p.hp-=amount;p.invuln=.55;burst(p.x,p.y,"damage");beep(100,.07);
    if(p.retaliate){for(let i=0;i<5;i++){const a=Math.random()*Math.PI*2;spawnProjectile(p.x,p.y,a,360,14*p.damageMult,{life:.8,r:3,color:"#b36cff"});}}
    if(p.hp<=0){
      if(p.deathGuard>0){p.deathGuard=0;p.hp=1;p.invuln=2;burst(p.x,p.y,"boss");return;}
      game.lives--;if(game.lives<=0){p.hp=0;endGame(false)}else{p.hp=p.maxHp;p.x=W/2;p.y=H/2;p.invuln=2;beep(180,.12)}
    }
  }
  function separate(a,b,minDist){const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||.001;if(d<minDist){const push=(minDist-d)/2,nx=dx/d,ny=dy/d;a.x-=nx*push;a.y-=ny*push;b.x+=nx*push;b.y+=ny*push;}}
  function circleHit(a,b){return Math.hypot(a.x-b.x,a.y-b.y)<a.r+b.r}
  function burst(x,y,type){const amount=type==="boss"?45:type==="defeat"?15:type==="skill"?30:6;for(let i=0;i<amount&&game.particles.length<LIMITS.particles;i++){const a=rand(0,Math.PI*2),sp=rand(30,type==="boss"?230:150);game.particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:rand(.16,.55),maxLife:.55,size:rand(2,6),type});}}

  function update(dt){
    if(!game?.running||game.paused)return;
    const p=game.player;p.invuln=Math.max(0,p.invuln-dt);p.skillCooldown=Math.max(0,p.skillCooldown-dt);p.anim+=dt*(p.moving?8:0);game.orbitAngle+=dt*2.2;
    let dx=0,dy=0;if(keys.has("w"))dy--;if(keys.has("s"))dy++;if(keys.has("a"))dx--;if(keys.has("d"))dx++;p.moving=!!(dx||dy);if(p.moving){const l=Math.hypot(dx,dy);dx/=l;dy/=l;p.dirX=dx;p.dirY=dy;p.x+=dx*p.speed*p.moveMult*dt;p.y+=dy*p.speed*p.moveMult*dt;}p.x=clamp(p.x,30,W-30);p.y=clamp(p.y,112,H-30);

    autoWeapons(dt);
    autoSkill();
    game.waveClock+=dt;game.spawnClock-=dt;
    // A cada onda, a velocidade de surgimento aumenta em 30%.
    // O limite evita que dezenas de inimigos sejam criados no mesmo instante em ondas altas.
    const spawnInterval=Math.max(.16,1.05/Math.pow(1.30,game.stage-1));
    if(game.spawnClock<=0){spawnEnemy(false);game.spawnClock=spawnInterval*rand(.72,1.12);}
    if(game.waveClock>=18){
      if(mode==="tournament"&&game.stage>=MODES[mode].maxWave){endGame(true);return;}
      beginWave();
    }

    for(const o of game.xpOrbs){o.life-=dt;o.vx*=Math.pow(.08,dt);o.vy*=Math.pow(.08,dt);o.x+=o.vx*dt;o.y+=o.vy*dt;const d=Math.hypot(p.x-o.x,p.y-o.y);if(d<p.magnet){const nx=(p.x-o.x)/(d||1),ny=(p.y-o.y)/(d||1);const pull=320+Math.max(0,p.magnet-d)*3;o.vx+=nx*pull*dt;o.vy+=ny*pull*dt;}if(d<p.r+o.r+6){addXP(o.value);o.life=0;beep(520,.018,"square",.006);}}
    for(const o of game.healOrbs){o.life-=dt;o.vx*=Math.pow(.08,dt);o.vy*=Math.pow(.08,dt);o.x+=o.vx*dt;o.y+=o.vy*dt;const d=Math.hypot(p.x-o.x,p.y-o.y);if(d<p.magnet){const nx=(p.x-o.x)/(d||1),ny=(p.y-o.y)/(d||1);const pull=300+Math.max(0,p.magnet-d)*2;o.vx+=nx*pull*dt;o.vy+=ny*pull*dt;}if(d<p.r+o.r+6){p.hp=clamp(p.hp+o.value*p.healBonus,0,p.maxHp);o.life=0;burst(o.x,o.y,"heal");beep(700,.025,"square",.007);}}
    game.xpOrbs=game.xpOrbs.filter(o=>o.life>0);game.healOrbs=game.healOrbs.filter(o=>o.life>0);

    for(const e of game.enemies){
      e.speed=e.baseSpeed*(p.enemySlow||1);
      e.hitFlash=Math.max(0,e.hitFlash-dt);e.anim+=dt*5;e.attackCooldown-=dt;
      const vx=p.x-e.x,vy=p.y-e.y,d=Math.hypot(vx,vy)||1;e.dir=direction(vx,vy);
      if(d>(e.boss?120:70)){e.speed=e.baseSpeed*(game.player.enemySlow||1);e.x+=vx/d*e.speed*dt;e.y+=vy/d*e.speed*dt;}
      if(e.boss){e.shootTimer-=dt;if(e.shootTimer<=0){for(let i=0;i<6;i++){if(game.enemyShots.length>=LIMITS.enemyShots)break;const a=Math.atan2(vy,vx)+(i-2.5)*.18;game.enemyShots.push({x:e.x,y:e.y,vx:Math.cos(a)*185,vy:Math.sin(a)*185,life:3,r:6,damage:(10+Math.floor(game.stage/3))*e.damageMult})}e.shootTimer=1.7;beep(80,.04,"sawtooth",.015)}}
      else if(d<390&&e.attackCooldown<=0){const a=Math.atan2(vy,vx);if(game.enemyShots.length<LIMITS.enemyShots)game.enemyShots.push({x:e.x,y:e.y,vx:Math.cos(a)*230,vy:Math.sin(a)*230,life:2,r:5,damage:(5+Math.floor(game.stage/3))*e.damageMult});e.attackCooldown=1.2+Math.random()*1.4;}
      if(d<(e.boss?58:25))damagePlayer((e.boss?15:5)*e.damageMult);
      e.x=clamp(e.x,25,W-25);e.y=clamp(e.y,105,H-25);
    }
    // Não fazemos separação inimigo-contra-inimigo: o limite de inimigos e o
    // movimento por direção já evitam o acúmulo e eliminam o custo O(n²).
    for(const e of game.enemies)if(circleHit(p,e))separate(p,e,e.boss?58:27);

    for(const s of game.projectiles){s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;for(const e of game.enemies)if(s.life>0&&e.hp>0&&circleHit(s,e)){
        hurtEnemy(e,s.damage);
        if(s.explode){for(const near of game.enemies){if(near.hp>0&&Math.hypot(near.x-s.x,near.y-s.y)<s.explosionRadius)hurtEnemy(near,s.explosionDamage);}}
        if(!s.pierce)s.life=0;
      }}
    // Colisão dos tiros inimigos: no máximo UM impacto por frame.
    // Depois de um acerto, todos os tiros que já estão sobre o jogador
    // são removidos deste frame. Isso evita uma cadeia de callbacks/dano
    // quando vários projéteis chegam juntos.
    let playerHitThisFrame=false;
    for(const s of game.enemyShots){
      s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;
      if(s.life>0 && circleHit(s,p)){
        s.life=0;
        if(!playerHitThisFrame && p.invuln<=0){
          playerHitThisFrame=true;
          damagePlayer(s.damage);
        }
      }
    }
    if(playerHitThisFrame){
      for(const s of game.enemyShots){
        if(s.life>0 && circleHit(s,p)) s.life=0;
      }
    }
    game.projectiles=game.projectiles.filter(s=>s.life>0&&s.x>-40&&s.x<W+40&&s.y>80&&s.y<H+40);game.enemyShots=game.enemyShots.filter(s=>s.life>0&&s.x>-30&&s.x<W+30&&s.y>80&&s.y<H+30);game.enemies=game.enemies.filter(e=>e.hp>0);
    for(const q of game.particles){q.x+=q.vx*dt;q.y+=q.vy*dt;q.life-=dt;q.vx*=Math.pow(.04,dt);q.vy*=Math.pow(.04,dt)}game.particles=game.particles.filter(q=>q.life>0);game.banner=Math.max(0,game.banner-dt);
    if(MODES[mode].time!==null){game.timeLeft-=dt;if(game.timeLeft<=0){game.timeLeft=0;endGame(true);return}}
    hudClock-=dt;if(hudClock<=0){hudClock=.20;updateHud();}
  }

  function updateHud(){
    if(!game)return;const p=game.player;hpFill.style.width=`${clamp(p.hp/p.maxHp,0,1)*100}%`;hpText.textContent=`${Math.max(0,Math.ceil(p.hp))}/${p.maxHp}`;scoreEl.textContent=String(game.score).padStart(6,"0");livesEl.textContent="♥ ".repeat(game.lives).trim()||"—";stageLabel.textContent=mode==="tournament"?`ONDA ${game.stage}/${MODES[mode].maxWave}`:`ONDA ${game.stage}`;if(MODES[mode].time!==null)timerEl.textContent=Math.ceil(game.timeLeft);levelText.textContent=game.level;xpText.textContent=`${game.xp}/${game.xpNeed}`;xpFill.style.width=`${game.xp/game.xpNeed*100}%`;const sk=clamp(1-p.skillCooldown/(7*p.skillCooldownMult),0,1);skillFill.style.width=`${sk*100}%`;skillText.textContent=p.skillCooldown>0?`SKILL ${p.skillCooldown.toFixed(1)}s`:`SKILL AUTOMÁTICA`;}

  function draw(){
    ctx.fillStyle="#070914";ctx.fillRect(0,0,W,H);ctx.fillStyle="#0d1120";ctx.fillRect(0,80,W,H-80);ctx.strokeStyle="#171c31";ctx.lineWidth=1;for(let x=0;x<=W;x+=32){ctx.beginPath();ctx.moveTo(x,80);ctx.lineTo(x,H);ctx.stroke()}for(let y=80;y<=H;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
    ctx.strokeStyle="#35e7ff";ctx.lineWidth=4;ctx.strokeRect(16,95,W-32,H-111);ctx.fillStyle="#0a0d19";ctx.fillRect(0,0,W,80);ctx.fillStyle="#ffd84d";ctx.fillRect(0,76,W,4);
    ctx.fillStyle="#ff3d71";for(const x of [20,W-28]){ctx.fillRect(x,105,8,8);ctx.fillRect(x,H-30,8,8)}
    for(const o of game.xpOrbs)drawOrb(o,"xp");for(const o of game.healOrbs)drawOrb(o,"heal");if(game.chest)drawChest(game.chest);for(const q of game.particles)drawParticle(q);for(const s of game.enemyShots)drawEnemyShot(s);for(const s of game.projectiles)drawProjectile(s);drawMario(game.mario);drawOrbitWeapons(game.player);for(const e of game.enemies)drawEnemy(e);drawPlayer(game.player);
    ctx.textAlign="center";ctx.font="12px 'Press Start 2P',monospace";ctx.fillStyle="#f4f1de";ctx.fillText("TORNEIO DE ALUNOS",W/2,30);ctx.font="8px 'Press Start 2P',monospace";ctx.fillStyle="#888c9b";ctx.fillText("ARMAS ORBITAIS • OLHOS INVASORES • LEVEL UP",W/2,52);
    if(game.banner>0){ctx.globalAlpha=Math.min(1,game.banner*2);ctx.fillStyle="#000";ctx.fillRect(W/2-180,H/2-38,360,76);ctx.strokeStyle=game.stage%10===0?"#ff3d71":"#ffd84d";ctx.lineWidth=4;ctx.strokeRect(W/2-180,H/2-38,360,76);ctx.fillStyle=game.stage%10===0?"#ff3d71":"#ffd84d";ctx.font="16px 'Press Start 2P',monospace";ctx.fillText(game.bannerText,W/2,H/2+6);ctx.globalAlpha=1}
  }
  function drawChest(c){
    ctx.save();
    const img=c.isBoss?(c.open?bossChestOpen:bossChest):dropChest;
    const bob=Math.sin(performance.now()/180)*2;
    ctx.globalAlpha=c.open?.8:1;
    if(img.complete){
      const size=c.isBoss?56:72;
      ctx.drawImage(img,Math.round(c.x-size/2),Math.round(c.y-size*.44+bob),size,size*.546);
    }
    if(!c.open){
      ctx.fillStyle="#ffd84d";ctx.font="7px 'Press Start 2P',monospace";ctx.textAlign="center";
      ctx.fillText(c.isBoss?"BAÚ DO BOSS":"BAÚ",c.x,c.y-(c.isBoss?34:42)+bob);
    }
    ctx.restore();
  }
  function drawPlayer(p){const dir=direction(p.dirX,p.dirY),frame=p.moving?Math.floor(p.anim)%4:0,img=playerFrames[dir][frame];ctx.save();if(p.invuln>0&&Math.floor(p.invuln*18)%2===0)ctx.globalAlpha=.5;ctx.fillStyle="#03040a";ctx.fillRect(Math.round(p.x-11),Math.round(p.y+12),22,4);if(img.complete)ctx.drawImage(img,Math.round(p.x-15),Math.round(p.y-22),30,34);ctx.restore()}
  function drawEnemy(e){ctx.save();if(e.hitFlash>0)ctx.globalAlpha=.55;const size=e.boss?132:22;const frame=Math.floor(e.anim)%4;const img=eyeFrames[e.dir][frame];ctx.fillStyle="#03040a";ctx.fillRect(Math.round(e.x-size*.35),Math.round(e.y+size*.34),Math.round(size*.7),4);if(img.complete)ctx.drawImage(img,Math.round(e.x-size/2),Math.round(e.y-size*.57),size,size);if(e.boss){ctx.fillStyle="#05060a";ctx.fillRect(e.x-70,e.y-78,140,7);ctx.fillStyle="#ff3d71";ctx.fillRect(e.x-70,e.y-78,140*clamp(e.hp/e.maxHp,0,1),7);ctx.fillStyle="#ffd84d";ctx.font="8px 'Press Start 2P',monospace";ctx.textAlign="center";ctx.fillText("OLHO GIGANTE",e.x,e.y-88)}else{ctx.fillStyle="#05060a";ctx.fillRect(e.x-17,e.y-21,34,3);ctx.fillStyle="#ff3d71";ctx.fillRect(e.x-17,e.y-21,34*clamp(e.hp/e.maxHp,0,1),3)}ctx.restore()}
  function drawMario(n){ctx.save();ctx.fillStyle="#03040a";ctx.fillRect(n.x-13,n.y+13,26,4);if(marioSprite.complete)ctx.drawImage(marioSprite,0,0,37,34,n.x-22,n.y-25,44,40);ctx.fillStyle="#ffd84d";ctx.font="6px 'Press Start 2P',monospace";ctx.textAlign="center";ctx.fillText("NPC",n.x,n.y-30);ctx.restore()}
  function drawOrbitWeapons(p){for(let i=0;i<p.slots.length;i++){const s=p.slots[i],a=game.orbitAngle+i*(Math.PI*2/p.slots.length),r=p.orbitRadius+i*4,x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r,img=weaponIcons[s.weapon];ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.rotate(a+Math.PI/2);ctx.globalAlpha=.92;if(img.complete)ctx.drawImage(img,-11,-11,22,22);ctx.restore()}}
  function drawProjectile(s){
    if(s.skill){
      ctx.save();
      ctx.fillStyle="#ff3d71";
      ctx.fillRect(Math.round(s.x-s.r),Math.round(s.y-s.r),s.r*2,s.r*2);
      ctx.fillStyle="#ffd1df";
      ctx.fillRect(Math.round(s.x-3),Math.round(s.y-3),6,6);
      ctx.restore();
      return;
    }
    ctx.fillStyle=s.color;ctx.fillRect(Math.round(s.x-s.r),Math.round(s.y-s.r),s.r*2,s.r*2);
    ctx.fillStyle="#fff";ctx.fillRect(Math.round(s.x-1),Math.round(s.y-1),2,2);
  }
  function drawEnemyShot(s){ctx.fillStyle="#ff3d71";ctx.fillRect(Math.round(s.x-4),Math.round(s.y-4),8,8);ctx.fillStyle="#ffb0c4";ctx.fillRect(Math.round(s.x-1),Math.round(s.y-1),2,2)}
  function drawOrb(o,type){ctx.save();ctx.translate(Math.round(o.x),Math.round(o.y));ctx.fillStyle=type==="xp"?"#48e17b":"#ffd84d";ctx.fillRect(-o.r,-o.r,o.r*2,o.r*2);ctx.fillStyle="#fff";ctx.fillRect(-1,-1,2,2);ctx.fillStyle=type==="xp"?"#baffce":"#fff4a8";ctx.fillRect(-Math.max(1,o.r-2),-Math.max(1,o.r-2),2,2);ctx.restore()}
  function drawParticle(q){const a=clamp(q.life/q.maxLife,0,1);ctx.globalAlpha=a;ctx.fillStyle=q.type==="damage"?"#ff3d71":q.type==="boss"?"#ff3d71":q.type==="skill"?"#ff3d71":q.type==="weapon"?"#35e7ff":q.type==="heal"?"#ffd84d":"#ffd84d";const s=Math.max(2,q.size*a);ctx.fillRect(Math.round(q.x-s/2),Math.round(q.y-s/2),Math.round(s),Math.round(s));ctx.globalAlpha=1}

  function loop(now){
    const frameStart=performance.now();
    try{
      const dt=Math.min(.033,(now-last)/1000||0);last=now;
      const u0=performance.now();update(dt);DIAG.updateMs=performance.now()-u0;DIAG.maxUpdateMs=Math.max(DIAG.maxUpdateMs,DIAG.updateMs);
      const d0=performance.now();draw();DIAG.drawMs=performance.now()-d0;DIAG.maxDrawMs=Math.max(DIAG.maxDrawMs,DIAG.drawMs);
      const fm=performance.now()-frameStart;DIAG.lastFrameMs=fm;DIAG.maxFrameMs=Math.max(DIAG.maxFrameMs,fm);DIAG.frames++;if(fm>25)DIAG.slowFrames++;
      raf=requestAnimationFrame(loop);
    }catch(err){diagError("loop",err);if(game)game.running=false;}
  }
  function togglePause(){if(!game?.running||game.choicePending||!messageBox.classList.contains("hidden"))return;game.paused=!game.paused;pauseBox.classList.toggle("hidden",!game.paused);if(!game.paused)last=performance.now();beep(game.paused?220:520,.05)}
  function endGame(won){if(!game?.running)return;game.running=false;game.paused=false;pauseBox.classList.add("hidden");levelBox.classList.add("hidden");if(won){winSound();messageTitle.textContent="🏆 VITÓRIA!";messageText.textContent=`Você chegou ao fim. Score: ${game.score}`;messageButton.textContent="JOGAR NOVAMENTE"}else{beep(120,.2);messageTitle.textContent="GAME OVER";messageText.textContent=`As vidas acabaram. Score: ${game.score}`;messageButton.textContent="TENTAR NOVAMENTE"}messageBox.classList.remove("hidden")}

  document.querySelectorAll(".mode-btn").forEach(b=>b.addEventListener("click",()=>resetGame(b.dataset.mode)));
  messageButton.addEventListener("click",()=>resetGame(mode));
  menuButton.addEventListener("click",()=>{if(game)game.running=false;cancelAnimationFrame(raf);messageBox.classList.add("hidden");pauseBox.classList.add("hidden");levelBox.classList.add("hidden");gameScreen.classList.add("hidden");menu.classList.remove("hidden")});
  window.addEventListener("keydown",e=>{const k=e.key.toLowerCase();if(["w","a","s","d","p","1","2","3"].includes(k)||e.key===" ")e.preventDefault();if(k==="p"&&!e.repeat){togglePause();return}if(game?.choicePending&&/^[123]$/.test(k)&&!e.repeat){chooseItem(Number(k)-1);return}if(["w","a","s","d"].includes(k)){keys.add(k);startAudio()}});
  window.addEventListener("keyup",e=>{const k=e.key.toLowerCase();if(["w","a","s","d"].includes(k))keys.delete(k)});
  window.addEventListener("blur",()=>{keys.clear();if(game?.running&&!game.paused&&!game.choicePending)togglePause()});
  buildSlots();
  window.__TA_DEBUG = () => game;
  window.__TA_UPDATE = update;
  window.__TA_DIAG = () => ({...DIAG,now:performance.now(),game:game?{running:game.running,paused:game.paused,stage:game.stage,level:game.level,lives:game.lives,enemies:game.enemies.length,projectiles:game.projectiles.length,enemyShots:game.enemyShots.length,particles:game.particles.length,xpOrbs:game.xpOrbs.length,healOrbs:game.healOrbs.length,choicePending:game.choicePending,slots:game.player.slots.length,relics:game.player.relics.length}:null});
})();
