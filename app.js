const WORDS={
  Tecnologia:[["JAVASCRIPT","Linguagem muito usada no desenvolvimento web."],["COMPUTADOR","Máquina usada para processar dados."],["TECLADO","Dispositivo usado para digitar."],["INTERNET","Rede mundial de computadores."],["SERVIDOR","Computador que fornece serviços."],["PIXEL","Unidade básica de uma imagem digital."],["ALGORITMO","Sequência de instruções para resolver um problema."]],
  Games:[["PLAYER","Pessoa que joga."],["ARCADE","Máquina clássica de jogos."],["BOSS","Inimigo poderoso de um jogo."],["QUEST","Missão ou tarefa."],["RANKING","Classificação de jogadores."],["LEVEL","Nível de progressão."],["CONTROLLER","Dispositivo usado para controlar um jogo."]],
  Animais:[["CACHORRO","Melhor amigo do homem."],["GATO","Felino doméstico."],["COELHO","Animal de orelhas longas."],["PANDA","Animal conhecido por comer bambu."],["GIRAFA","Animal de pescoço comprido."],["TUBARAO","Grande predador marinho."]],
  Filmes:[["CINEMA","Lugar onde filmes são exibidos."],["ROTEIRO","Texto que orienta uma produção."],["DIRETOR","Profissional responsável pela direção."],["HEROI","Personagem que enfrenta desafios."],["VILAO","Antagonista de uma história."]]
};

const KEY="hangmanProSave";
const ACHIEVEMENTS=[
  {id:"first_win",icon:"🎯",title:"Primeira Vitória",desc:"Vença sua primeira partida.",rewardXp:100,rewardCoins:50,ok:()=>save.wins>=1},
  {id:"streak3",icon:"🔥",title:"Em Chamas",desc:"Alcance uma sequência de 3 vitórias.",rewardXp:150,rewardCoins:75,ok:()=>save.streak>=3},
  {id:"xp500",icon:"⭐",title:"Veterano",desc:"Alcance 500 XP.",rewardXp:200,rewardCoins:100,ok:()=>save.xp>=500},
  {id:"collector",icon:"💎",title:"Colecionador",desc:"Possua 5 itens na coleção.",rewardXp:200,rewardCoins:100,ok:()=>save.items.length>=5},
  {id:"legend",icon:"👑",title:"Lenda da Forge",desc:"Possua um item lendário.",rewardXp:300,rewardCoins:150,ok:()=>save.items.includes("Avatar Forge Wolf")}
];

const DEFAULT_SAVE={
  coins:100,xp:0,wins:0,streak:0,items:[],
  theme:"Neon Blue",skin:"Gallows Neon",background:"Padrão",
  avatar:"Padrão",effect:"Padrão",unlockedAchievements:[]
};
let save=JSON.parse(localStorage.getItem(KEY)||"null")||structuredClone(DEFAULT_SAVE);
let game={category:"Tecnologia",difficulty:"easy",word:"",hint:"",guessed:new Set(),errors:0,max:8};

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

function normalizeSave(){
  save={...DEFAULT_SAVE,...save};
  if(!Array.isArray(save.items))save.items=[];
  if(!Array.isArray(save.unlockedAchievements))save.unlockedAchievements=[];
}
function persist(){
  normalizeSave();
  localStorage.setItem(KEY,JSON.stringify(save));
  hud();
}
function hud(){
  $("#coins").textContent=save.coins;
  $("#xp").textContent=save.xp;
  $("#level").textContent=Math.floor(save.xp/100)+1;
  $("#streak").textContent=save.streak;
  $("#myRank").textContent=save.xp+" XP";
  $("#pLevel").textContent=Math.floor(save.xp/100)+1;
  $("#pXp").textContent=save.xp;
  $("#pCoins").textContent=save.coins;
  $("#pWins").textContent=save.wins;
  $("#m1").textContent=Math.min(1,save.wins)+"/1";
  $("#m2").textContent=Math.min(3,save.wins)+"/3";
  $("#m3").textContent=Math.min(500,save.xp)+"/500";
  $("#m4").textContent=Math.min(1,save.items.length)+"/1";
  $("#m1bar").style.width=(save.wins?100:0)+"%";
  $("#m2bar").style.width=Math.min(100,save.wins/3*100)+"%";
  $("#m3bar").style.width=Math.min(100,save.xp/500*100)+"%";
  $("#m4bar").style.width=(save.items.length?100:0)+"%";
}
function show(id){
  $$(".screen").forEach(x=>x.classList.remove("active"));
  $("#"+id).classList.add("active");
  scrollTo(0,0);
}
function toast(t){
  const x=$("#toast");
  x.textContent=t;
  x.classList.add("show");
  setTimeout(()=>x.classList.remove("show"),1800);
}
function categories(){
  const e=$("#categories");
  e.innerHTML="";
  Object.keys(WORDS).forEach(c=>{
    const b=document.createElement("button");
    b.className="choice"+(game.category===c?" selected":"");
    b.innerHTML=c+"<small>"+WORDS[c].length+" palavras</small>";
    b.onclick=()=>{game.category=c;categories()};
    e.appendChild(b);
  });
}


function renderInventory(){
  const el=$("#inventoryList");
  if(!el)return;
  el.innerHTML="";
  if(!save.items.length){
    el.innerHTML='<span class="inventory-chip">Nenhum item comprado ainda</span>';
    return;
  }
  save.items.forEach(item=>{
    const chip=document.createElement("span");
    chip.className="inventory-chip"+(isEquipped(item)?" equipped":"");
    chip.textContent=(isEquipped(item)?"✓ ":"")+item;
    el.appendChild(chip);
  });
}
function renderAchievements(){
  const el=$("#achievementList");
  if(!el)return;
  el.innerHTML="";
  ACHIEVEMENTS.forEach(a=>{
    const unlocked=save.unlockedAchievements.includes(a.id)||a.ok();
    const d=document.createElement("article");
    d.className="achievement"+(unlocked?" unlocked":"");
    d.innerHTML=`<div class="a-icon">${a.icon}</div><div class="reward">+${a.rewardXp} XP · +${a.rewardCoins} 🪙</div><h3>${unlocked?"✓ ":""}${a.title}</h3><small>${a.desc}</small>`;
    el.appendChild(d);
  });
}
function checkAchievements(){
  normalizeSave();
  let changed=false;
  ACHIEVEMENTS.forEach(a=>{
    if(!save.unlockedAchievements.includes(a.id)&&a.ok()){
      save.unlockedAchievements.push(a.id);
      save.xp+=a.rewardXp;
      save.coins+=a.rewardCoins;
      changed=true;
      toast("🏅 Conquista: "+a.title+"!");
    }
  });
  if(changed){
    localStorage.setItem(KEY,JSON.stringify(save));
    hud();
  }
  renderAchievements();
}
function rarity(item){
  if(item==="Neon Blue")return"COMUM";
  if(["Cyber Purple","Gallows Neon","Background Space"].includes(item))return"RARO";
  if(["Forge Gold","Gallows Cyber","Background Matrix","Victory Burst"].includes(item))return"ÉPICO";
  if(item==="Avatar Forge Wolf")return"LENDÁRIO";
  return"COMUM";
}
function previewItem(item){
  const b=$$('.buy').find(x=>x.dataset.item===item);
  if(!b)return;
  const owned=save.items.includes(item);
  $("#previewTitle").textContent=item;
  $("#previewRarity").textContent=rarity(item);
  $("#previewRarity").className="rarity "+({COMUM:"common",RARO:"rare",ÉPICO:"epic",LENDÁRIO:"legendary"}[rarity(item)]||"common");
  $("#previewText").textContent=owned?"Você já possui este item. Você pode equipá-lo sem pagar novamente.":"Veja o efeito e compre para adicioná-lo ao inventário.";
  const v=$("#previewVisual");
  const icons={"Neon Blue":"⚡","Cyber Purple":"✦","Forge Gold":"★","Gallows Neon":"🪢","Gallows Cyber":"⚡","Background Space":"🌌","Background Matrix":"▦","Avatar Forge Wolf":"🐺","Victory Burst":"✦"};
  v.textContent=icons[item]||"★";
  $("#previewBuy").textContent=owned?"JÁ POSSUI":"🪙 "+b.dataset.cost;
  $("#previewBuy").disabled=owned;
  $("#previewEquip").disabled=!owned;
  $("#previewBuy").onclick=()=>{if(!owned)buyOrEquip(b);closePreview()};
  $("#previewEquip").onclick=()=>{if(owned){equip(item);closePreview()}};
  $("#previewModal").classList.remove("hidden");
}
function closePreview(){$("#previewModal").classList.add("hidden")}

/* ===== COSMETICS ===== */
function cosmeticType(item){
  if(["Neon Blue","Cyber Purple","Forge Gold"].includes(item))return"theme";
  if(item.startsWith("Gallows "))return"skin";
  if(item.startsWith("Background "))return"background";
  if(item.startsWith("Avatar "))return"avatar";
  if(item.startsWith("Victory "))return"effect";
  return null;
}
function themeClass(theme){
  if(theme==="Cyber Purple")return"theme-purple";
  if(theme==="Forge Gold")return"theme-gold";
  return"";
}
function clearCosmetics(){
  document.body.classList.remove("theme-purple","theme-gold","skin-neon","skin-cyber","cosmetic-space","cosmetic-matrix","avatar-wolf");
}
function isEquipped(item){
  const type=cosmeticType(item);
  return (type==="theme"&&save.theme===item)||
         (type==="skin"&&save.skin===item)||
         (type==="background"&&save.background===item)||
         (type==="avatar"&&save.avatar===item)||
         (type==="effect"&&save.effect===item);
}
function applyCosmetics(announce=false){
  normalizeSave();
  clearCosmetics();

  const tc=themeClass(save.theme);
  if(tc)document.body.classList.add(tc);
  if(save.skin==="Gallows Neon")document.body.classList.add("skin-neon");
  if(save.skin==="Gallows Cyber")document.body.classList.add("skin-cyber");
  if(save.background==="Background Space")document.body.classList.add("cosmetic-space");
  if(save.background==="Background Matrix")document.body.classList.add("cosmetic-matrix");
  if(save.avatar==="Avatar Forge Wolf")document.body.classList.add("avatar-wolf");

  $$(".shop article").forEach(card=>{
    const b=card.querySelector(".buy");
    if(!b)return;
    const item=b.dataset.item;
    const owned=save.items.includes(item);
    const equipped=isEquipped(item);
    card.classList.toggle("equipped",equipped);
    card.classList.toggle("owned",owned);
    if(equipped){
      b.textContent="✓ EQUIPADO";
      b.classList.add("equipped");
    }else if(owned){
      b.textContent="EQUIPAR";
      b.classList.remove("equipped");
    }else{
      b.textContent="🪙 "+b.dataset.cost;
      b.classList.remove("equipped");
    }
  });

  $("#equippedTheme").textContent=save.theme;
  $("#equippedSkin").textContent=save.skin;
  $("#equippedBg").textContent=save.background;
  $("#equippedAvatar").textContent=save.avatar;
  $("#equippedEffect").textContent=save.effect;

  localStorage.setItem(KEY,JSON.stringify(save));
  hud();
  renderInventory();
  renderAchievements();
  if(announce)toast("✓ Personalização aplicada!");
}
function equip(item){
  const type=cosmeticType(item);
  if(type==="theme")save.theme=item;
  if(type==="skin")save.skin=item;
  if(type==="background")save.background=item;
  if(type==="avatar")save.avatar=item;
  if(type==="effect")save.effect=item;
  applyCosmetics(true);
}
function buyOrEquip(button){
  normalizeSave();
  const item=button.dataset.item;
  const cost=Number(button.dataset.cost);

  if(save.items.includes(item)){
    equip(item);
    return;
  }
  if(save.coins<cost){
    toast("🪙 Coins insuficientes");
    return;
  }

  save.coins-=cost;
  save.items.push(item);

  const type=cosmeticType(item);
  if(type==="theme")save.theme=item;
  if(type==="skin")save.skin=item;
  if(type==="background")save.background=item;
  if(type==="avatar")save.avatar=item;
  if(type==="effect")save.effect=item;

  applyCosmetics(false);
  toast("✓ "+item+" comprado e equipado!");
}

/* ===== GAME ===== */
function startGame(){
  const item=WORDS[game.category][Math.floor(Math.random()*WORDS[game.category].length)];
  game.word=item[0];
  game.hint=item[1];
  game.guessed=new Set();
  game.errors=0;
  game.max={easy:8,normal:6,hard:5}[game.difficulty];

  $("#categoryLabel").textContent=game.category;
  $("#wordLength").textContent=game.word.length+" LETRAS";
  $("#hint").textContent="💡 "+game.hint;
  renderGame();
  show("game");
}
function renderGame(){
  $("#word").innerHTML=[...game.word].map(l=>`<span>${game.guessed.has(l)?l:"_"}</span>`).join("");
  $("#errors").textContent=game.errors;
  $("#maxErrors").textContent=game.max;

  const parts=["head","body","arm.l","arm.r","leg.l","leg.r"];
  parts.forEach((name,i)=>{
    const el=document.querySelector(".gallows ."+name.replace("."," ."));
    if(el)el.style.display=game.errors>i?"block":"none";
  });

  $("#gameStatus").textContent=
    game.errors===0?"SISTEMA ONLINE":
    game.errors<game.max/2?"ANÁLISE EM ANDAMENTO":
    "ALERTA: POUCAS TENTATIVAS";

  const kb=$("#keyboard");
  kb.innerHTML="";
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach(l=>{
    const b=document.createElement("button");
    b.className="key";
    b.textContent=l;
    b.disabled=game.guessed.has(l);
    if(game.guessed.has(l))b.classList.add(game.word.includes(l)?"good":"bad");
    b.onclick=()=>guess(l);
    kb.appendChild(b);
  });
}
function guess(l){
  if(game.guessed.has(l))return;
  game.guessed.add(l);
  if(!game.word.includes(l))game.errors++;
  else toast("✓ Letra encontrada!");
  renderGame();

  if([...game.word].every(l=>game.guessed.has(l)))finish(true);
  else if(game.errors>=game.max)finish(false);
}
function finish(win){
  const xp=win?60+Math.max(0,game.max-game.errors)*5:10;
  const coins=win?30+Math.max(0,game.max-game.errors)*3:5;

  if(win){
    save.wins++;
    save.streak++;
    $("#resultIcon").textContent="🏆";
    $("#resultEyebrow").textContent="DESAFIO CONCLUÍDO";
    $("#resultTitle").textContent="Você venceu!";
    $("#resultText").textContent=`A palavra era ${game.word}. Excelente!`;
  }else{
    save.streak=0;
    $("#resultIcon").textContent="💀";
    $("#resultEyebrow").textContent="FIM DE JOGO";
    $("#resultTitle").textContent="Quase lá!";
    $("#resultText").textContent=`A palavra era ${game.word}. Tente novamente.`;
  }

  save.xp+=xp;
  save.coins+=coins;
  $("#rewardXp").textContent=xp;
  $("#rewardCoins").textContent=coins;
  persist();
  checkAchievements();
  show("result");

  if(win&&save.effect==="Victory Burst")playVictoryBurst();
}
function playVictoryBurst(){
  const layer=document.createElement("div");
  layer.className="victory-burst";
  for(let i=0;i<18;i++){
    const p=document.createElement("i");
    p.style.setProperty("--a",(i*20)+"deg");
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  setTimeout(()=>layer.remove(),1000);
}

/* ===== EVENTS ===== */
$("#startGame").onclick=startGame;
$("#again").onclick=startGame;

$$("[data-screen]").forEach(b=>{
  b.onclick=()=>show(b.dataset.screen);
});

$$(".difficulty").forEach(b=>{
  b.onclick=()=>{
    $$(".difficulty").forEach(x=>x.classList.remove("selected"));
    b.classList.add("selected");
    game.difficulty=b.dataset.diff;
  };
});

$$(".buy").forEach(b=>b.onclick=()=>buyOrEquip(b));
$$(".preview").forEach(b=>b.onclick=()=>previewItem(b.dataset.preview));
$("#closePreview").onclick=closePreview;
$("#previewModal").onclick=e=>{if(e.target.id==="previewModal")closePreview()};

$("#hintButton").onclick=()=>{
  if(save.coins<25){
    toast("🪙 Coins insuficientes");
    return;
  }
  save.coins-=25;
  $("#hint").textContent="💡 "+game.hint;
  persist();
  toast("✓ Dica desbloqueada!");
};

$("#reset").onclick=()=>{
  if(confirm("Resetar todo o progresso local?")){
    localStorage.removeItem(KEY);
    location.reload();
  }
};

normalizeSave();
categories();
applyCosmetics(false);
renderInventory();
renderAchievements();
checkAchievements();
hud();
