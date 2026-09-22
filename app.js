const WORDS={
Tecnologia:[["JAVASCRIPT","Linguagem muito usada no desenvolvimento web."],["COMPUTADOR","Máquina usada para processar dados."],["TECLADO","Dispositivo usado para digitar."],["INTERNET","Rede mundial de computadores."],["SERVIDOR","Computador que fornece serviços."],["PIXEL","Unidade básica de uma imagem digital."],["ALGORITMO","Sequência de instruções para resolver um problema."]],
Games:[["PLAYER","Pessoa que joga."],["ARCADE","Máquina clássica de jogos."],["BOSS","Inimigo poderoso de um jogo."],["QUEST","Missão ou tarefa."],["RANKING","Classificação de jogadores."],["LEVEL","Nível de progressão."],["CONTROLLER","Dispositivo usado para controlar um jogo."]],
Animais:[["CACHORRO","Melhor amigo do homem."],["GATO","Felino doméstico."],["COELHO","Animal de orelhas longas."],["PANDA","Animal conhecido por comer bambu."],["GIRAFA","Animal de pescoço comprido."],["TUBARAO","Grande predador marinho."]],
Filmes:[["CINEMA","Lugar onde filmes são exibidos."],["ROTEIRO","Texto que orienta uma produção."],["DIRETOR","Profissional responsável pela direção."],["HEROI","Personagem que enfrenta desafios."],["VILAO","Antagonista de uma história."]]
};
const KEY="hangmanProSave";
let save=JSON.parse(localStorage.getItem(KEY)||"null")||{coins:100,xp:0,wins:0,streak:0,items:[]};
let game={category:"Tecnologia",difficulty:"easy",word:"",hint:"",guessed:new Set(),errors:0,max:8};
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];

function persist(){localStorage.setItem(KEY,JSON.stringify(save));hud()}
function hud(){
 $("#coins").textContent=save.coins;$("#xp").textContent=save.xp;$("#level").textContent=Math.floor(save.xp/100)+1;$("#streak").textContent=save.streak;
 $("#myRank").textContent=save.xp+" XP";$("#pLevel").textContent=Math.floor(save.xp/100)+1;$("#pXp").textContent=save.xp;$("#pCoins").textContent=save.coins;$("#pWins").textContent=save.wins;
 $("#m1").textContent=Math.min(1,save.wins)+"/1";$("#m2").textContent=Math.min(3,save.wins)+"/3";$("#m3").textContent=Math.min(500,save.xp)+"/500";$("#m4").textContent=Math.min(1,save.items.length)+"/1";
 $("#m1bar").style.width=(save.wins?100:0)+"%";$("#m2bar").style.width=Math.min(100,save.wins/3*100)+"%";$("#m3bar").style.width=Math.min(100,save.xp/500*100)+"%";$("#m4bar").style.width=(save.items.length?100:0)+"%";
}
function show(id){$$(".screen").forEach(x=>x.classList.remove("active"));$("#"+id).classList.add("active");scrollTo(0,0)}
function toast(t){let x=$("#toast");x.textContent=t;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),1800)}
function categories(){
 let e=$("#categories");e.innerHTML="";
 Object.keys(WORDS).forEach(c=>{let b=document.createElement("button");b.className="choice"+(game.category===c?" selected":"");b.innerHTML=c+"<small>"+WORDS[c].length+" palavras</small>";b.onclick=()=>{game.category=c;categories()};e.append(b)})
}
function startGame(){
 let item=WORDS[game.category][Math.floor(Math.random()*WORDS[game.category].length)];
 game.word=item[0];game.hint=item[1];game.guessed=new Set();game.errors=0;game.max={easy:8,normal:6,hard:5}[game.difficulty];
 $("#categoryLabel").textContent=game.category;$("#wordLength").textContent=game.word.length+" LETRAS";$("#hint").textContent="💡 "+game.hint;renderGame();show("game");
}
function renderGame(){
 $("#word").innerHTML=[...game.word].map(l=>`<span>${game.guessed.has(l)?l:"_"}</span>`).join("");
 $("#errors").textContent=game.errors;$("#maxErrors").textContent=game.max;
 let parts=["head","body","arm l","arm r","leg l","leg r"];
 parts.forEach((p,i)=>{let el=document.querySelector(".gallows ."+p.replace(" ","."));if(el)el.style.display=game.errors>i?"block":"none"});
 $("#gameStatus").textContent=game.errors===0?"SISTEMA ONLINE":game.errors<game.max/2?"ANÁLISE EM ANDAMENTO":"ALERTA: POUCAS TENTATIVAS";
 let kb=$("#keyboard");kb.innerHTML="";
 "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach(l=>{let b=document.createElement("button");b.className="key";b.textContent=l;b.disabled=game.guessed.has(l);if(game.guessed.has(l))b.classList.add(game.word.includes(l)?"good":"bad");b.onclick=()=>guess(l);kb.append(b)})
}
function guess(l){
 if(game.guessed.has(l))return;game.guessed.add(l);if(!game.word.includes(l)){game.errors++;toast("❌ Letra incorreta")}else toast("✓ Letra encontrada");
 renderGame();
 if([...game.word].every(l=>game.guessed.has(l)))finish(true);
 else if(game.errors>=game.max)finish(false);
}
function finish(win){
 let xp=win?60+Math.max(0,game.max-game.errors)*5:10;
 let coins=win?30+Math.max(0,game.max-game.errors)*3:5;
 if(win){save.wins++;save.streak++;$("#resultIcon").textContent="🏆";$("#resultEyebrow").textContent="DESAFIO CONCLUÍDO";$("#resultTitle").textContent="Você venceu!";$("#resultText").textContent=`A palavra era ${game.word}. Excelente!`;}
 else{save.streak=0;$("#resultIcon").textContent="💀";$("#resultEyebrow").textContent="FIM DE JOGO";$("#resultTitle").textContent="Quase lá!";$("#resultText").textContent=`A palavra era ${game.word}. Tente novamente.`;}
 save.xp+=xp;save.coins+=coins;$("#rewardXp").textContent=xp;$("#rewardCoins").textContent=coins;persist();show("result");
}
$("#startGame").onclick=startGame;$("#again").onclick=startGame;
$$("[data-screen]").forEach(b=>b.onclick=()=>show(b.dataset.screen));
$$(".difficulty").forEach(b=>b.onclick=()=>{$$(".difficulty").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");game.difficulty=b.dataset.diff});
$("#hintButton").onclick=()=>{if(save.coins<25){toast("🪙 Coins insuficientes");return}save.coins-=25;$("#hint").textContent="💡 "+game.hint;persist();toast("Dica desbloqueada!")};
$$(".buy").forEach(b=>b.onclick=()=>{let c=+b.dataset.cost;if(save.coins<c){toast("🪙 Coins insuficientes");return}if(save.items.includes(b.dataset.item)){toast("Você já possui este item");return}save.coins-=c;save.items.push(b.dataset.item);persist();toast("✓ Item adquirido!")});
$("#reset").onclick=()=>{if(confirm("Resetar todo o progresso local?")){localStorage.removeItem(KEY);location.reload()}};
categories();hud();
