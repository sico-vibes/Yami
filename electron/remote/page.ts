// The phone page for Yami Remote: one self-contained document with no
// external files. Colours copy Nightglow's tokens (src/styles/tokens.css),
// since the phone cannot load the app's stylesheets. All text from Yami is
// set with textContent, never as HTML.

export const remotePage = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0b0a22"><title>Yami Remote</title>
<style>
:root{--ink:#0b0a22;--surface:rgba(255,255,255,.05);--line:rgba(255,255,255,.09);--text:#f4f1ff;--soft:#c9c2ee;--muted:#8f88b8;--glow:#b9a7ff;--on-glow:#14102e;--mint:#8ff0c8;--rose:#ff9ab7}
*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:20px 16px 40px;background:radial-gradient(120% 60% at 50% 0,#241b5c 0,var(--ink) 60%);color:var(--text);font:15px/1.45 system-ui,"Segoe UI",sans-serif}
h1{margin:0 0 2px;font-weight:300;font-size:30px}p.sub{margin:0 0 18px;color:var(--muted);font-size:13px}
h2{margin:22px 0 8px;color:var(--glow);font-size:11px;letter-spacing:.12em;text-transform:uppercase}
.card{padding:14px 16px;margin-bottom:10px;border-radius:18px;background:var(--surface);border:1px solid var(--line)}
.card b{display:block;font-weight:600}.card small{color:var(--muted)}.detail{margin:6px 0 10px;color:var(--soft);font-size:13px;white-space:pre-wrap;word-break:break-word;max-height:9em;overflow:auto}
.row{display:flex;gap:8px}button{flex:1;min-height:44px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--text);font:inherit;font-weight:500}
button.lit{background:linear-gradient(135deg,#c9b8ff,#8fb6ff);color:var(--on-glow);border-color:transparent}button.deny{color:var(--rose)}
textarea{width:100%;min-height:88px;margin-bottom:8px;padding:12px;border-radius:14px;border:1px solid var(--line);background:rgba(0,0,0,.25);color:var(--text);font:inherit}
.shot{display:block;width:100%;border-radius:12px;border:1px solid var(--line);touch-action:manipulation;background:#000}.keys{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.keys button{flex:1 0 22%;min-height:38px;font-size:13px}button.on{border-color:var(--glow);color:var(--glow)}input.typ{flex:3;min-height:44px;padding:0 12px;border-radius:999px;border:1px solid var(--line);background:rgba(0,0,0,.25);color:var(--text);font:inherit}
.empty{color:var(--muted);font-size:13px}.err{color:var(--rose);font-size:13px}.chip{display:inline-block;padding:2px 9px;border-radius:999px;background:var(--surface);border:1px solid var(--line);font-size:11px;color:var(--mint)}
</style></head><body>
<h1>Yami</h1><p class="sub" id="sub">Connecting…</p>
<section id="screen"></section><section id="approvals"></section><section id="agents"></section><section id="media"></section><section id="clip"></section>
<script>
(function(){
var key="yami-remote-token",hash=new URLSearchParams(location.hash.slice(1)).get("k");
if(hash){try{localStorage.setItem(key,hash)}catch(e){}history.replaceState(null,"",location.pathname)}
var token="";try{token=localStorage.getItem(key)||""}catch(e){}
function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
function api(path,body){return fetch(path,{method:body?"POST":"GET",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||"Failed");return j})})}
function section(id,title){var s=document.getElementById(id);s.textContent="";if(title)s.appendChild(el("h2","",title));return s}
function render(st){
document.getElementById("sub").textContent=st.pc?"Connected to "+st.pc:"Connected";
var changed=JSON.stringify(st.allow)!==JSON.stringify(lastAllow);lastAllow=st.allow;if(changed||!document.getElementById("screen").firstChild)screenView(st.allow);
var a=section("approvals",st.allow.approvals&&st.requests.length?"Waiting for you":"");
if(st.allow.approvals)st.requests.forEach(function(r){var c=el("div","card");c.appendChild(el("b","",r.agent+" asks"));c.appendChild(el("small","",r.title));if(r.detail)c.appendChild(el("div","detail",r.detail));
var row=el("div","row"),no=el("button","deny","Deny"),yes=el("button","lit","Allow once");no.onclick=function(){act("/api/approve",{id:r.id,decision:"deny"})};yes.onclick=function(){act("/api/approve",{id:r.id,decision:"allow"})};row.appendChild(no);row.appendChild(yes);c.appendChild(row);a.appendChild(c)});
var g=section("agents","Agents");if(!st.agents.length)g.appendChild(el("p","empty","No agent is working."));
st.agents.forEach(function(s){var c=el("div","card");c.appendChild(el("b","",s.agent+" · "+s.project));var chip=el("span","chip",s.phase);c.appendChild(chip);if(s.detail)c.appendChild(el("div","detail",s.detail));g.appendChild(c)});
if(st.allow.media){var m=section("media","Now playing"),c=el("div","card");
if(st.media&&st.media.active){c.appendChild(el("b","",st.media.title||"Playing"));c.appendChild(el("small","",st.media.artist||""))}else c.appendChild(el("p","empty","Nothing is playing."));
var row=el("div","row");[["previous","Back"],["toggle",st.media&&st.media.playing?"Pause":"Play"],["next","Next"]].forEach(function(b){var btn=el("button",b[0]==="toggle"?"lit":"",b[1]);btn.onclick=function(){act("/api/media",{action:b[0]})};row.appendChild(btn)});c.appendChild(row);m.appendChild(c)}
if(st.allow.clipboard&&!document.getElementById("cliptext")){var k=section("clip","Send to the PC's clipboard"),t=el("textarea");t.id="cliptext";t.placeholder="Text to paste on the PC";var send=el("button","lit","Send"),sendRow=el("div","row");send.onclick=function(){act("/api/clipboard",{text:t.value}).then(function(){t.value=""})};sendRow.appendChild(send);k.appendChild(t);k.appendChild(sendRow)}
}
var watching=false,shotTimer=0,shotUrl="",rightClick=false,lastAllow={};
function frame(img){fetch("/api/screen",{headers:{"Authorization":"Bearer "+token}}).then(function(r){if(!r.ok)throw new Error("Screen view is off.");return r.blob()}).then(function(b){if(shotUrl)URL.revokeObjectURL(shotUrl);shotUrl=URL.createObjectURL(b);img.src=shotUrl}).catch(function(e){watching=false;fail(e)}).then(function(){if(watching&&document.visibilityState==="visible")shotTimer=setTimeout(function(){frame(img)},1000)})}
function screenView(allow){var s=section("screen",allow.screen?"Screen":"");if(!allow.screen){watching=false;return}
var c=el("div","card"),toggle=el("button",watching?"":"lit",watching?"Stop viewing":"Show the screen");toggle.onclick=function(){watching=!watching;clearTimeout(shotTimer);screenView(lastAllow)};c.appendChild(toggle);
if(watching){var img=el("img","shot");img.alt="The PC's screen";c.appendChild(img);frame(img);
if(allow.control){img.onclick=function(ev){var r=img.getBoundingClientRect();api("/api/input",{kind:"click",x:(ev.clientX-r.left)/r.width,y:(ev.clientY-r.top)/r.height,button:rightClick?"right":"left"}).catch(fail)};
var keys=el("div","keys"),rc=el("button",rightClick?"on":"","Right-click");rc.onclick=function(){rightClick=!rightClick;rc.className=rightClick?"on":""};keys.appendChild(rc);
[["scroll",-3,"Scroll ↓"],["scroll",3,"Scroll ↑"]].forEach(function(b){var btn=el("button","",b[2]);btn.onclick=function(){api("/api/input",{kind:"scroll",notches:b[1]}).catch(fail)};keys.appendChild(btn)});
[["escape","Esc"],["tab","Tab"],["backspace","⌫"],["enter","Enter"],["left","←"],["up","↑"],["down","↓"],["right","→"]].forEach(function(k){var btn=el("button","",k[1]);btn.onclick=function(){api("/api/input",{kind:"key",key:k[0]}).catch(fail)};keys.appendChild(btn)});
c.appendChild(keys);var row=el("div","row"),t=el("input","typ"),go=el("button","lit","Type");row.style.marginTop="8px";t.placeholder="Text to type on the PC";go.onclick=function(){if(t.value)api("/api/input",{kind:"type",text:t.value}).then(function(){t.value=""},fail)};row.appendChild(t);row.appendChild(go);c.appendChild(row)}
else c.appendChild(el("p","empty","Viewing only. Turn on Control in Yami to tap and type."))}
s.appendChild(c)}
function fail(e){document.getElementById("sub").textContent=e.message}
function act(path,body){return api(path,body).then(load,fail)}
function load(){if(!token){fail(new Error("Scan the pairing code in Yami › Settings › Phone."));return}return api("/api/state").then(render,fail)}
load();setInterval(function(){if(document.visibilityState==="visible")load()},4000);
})();
</script></body></html>`;
