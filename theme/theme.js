(function(){var d=document,r=d.documentElement,mq=window.matchMedia,R=Math.random;
try{var t=localStorage.getItem('cosmos-theme');if(t&&t!=='dark')r.setAttribute('data-theme',t)}catch(e){}
var ICON={dark:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.4"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M19.4 4.6l-2.1 2.1M6.7 17.3l-2.1 2.1"/></svg>',light:'<svg viewBox="0 0 24 24"><path d="M20.5 14.8A8.2 8.2 0 1 1 9.2 3.5a7.3 7.3 0 0 0 11.3 11.3z"/></svg>',etruscan:'<svg viewBox="0 0 24 24"><path d="M9 3h6M10 3c0 2-2 2.6-2 5s2 3 2 7c0 2-1 3-2 4h8c-1-1-2-2-2-4 0-4 2-4.6 2-7s-2-3-2-5"/></svg>',aegean:'<svg viewBox="0 0 24 24"><path d="M2 8.5c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 14.5c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>'};
var ORDER=['dark','light','etruscan','aegean'];
function cur(){return r.getAttribute('data-theme')||'dark'}
function start(){var b=d.body;b.classList.add('themed');
  var pf=d.createElement('div');pf.className='pageframe';pf.setAttribute('aria-hidden','true');pf.innerHTML='<i class="frame-t"></i><i class="frame-b"></i><i class="frame-l"></i><i class="frame-r"></i>';b.appendChild(pf);
  var tg=d.createElement('button');tg.className='toggle';tg.type='button';tg.setAttribute('aria-label','Switch theme');b.appendChild(tg);
  function icon(){tg.innerHTML=ICON[cur()]||ICON.dark}
  tg.addEventListener('click',function(){var t=ORDER[(ORDER.indexOf(cur())+1)%ORDER.length];if(t==='dark')r.removeAttribute('data-theme');else r.setAttribute('data-theme',t);try{localStorage.setItem('cosmos-theme',t)}catch(e){}icon()});
  icon();
  function atBottom(){b.classList.toggle('at-bottom',(innerHeight+scrollY)>=(r.scrollHeight-40))}
  addEventListener('scroll',atBottom,{passive:true});addEventListener('resize',atBottom);atBottom();
  if(mq&&mq('(hover:hover) and (pointer:fine)').matches){
    var cel=d.createElement('div');cel.className='cursor';var halo=d.createElement('div');halo.className='cursor-halo';b.appendChild(halo);b.appendChild(cel);b.classList.add('has-cursor');
    var x=innerWidth/2,y=innerHeight/2,hx=x,hy=y;
    d.addEventListener('mousemove',function(e){x=e.clientX;y=e.clientY;cel.style.transform='translate('+x+'px,'+y+'px)'},{passive:true});
    (function lp(){hx+=(x-hx)*.15;hy+=(y-hy)*.15;halo.style.transform='translate('+hx+'px,'+hy+'px)';requestAnimationFrame(lp)})();
    addEventListener('mouseout',function(e){if(!e.relatedTarget){cel.style.opacity=0;halo.style.opacity=0}});addEventListener('mouseover',function(){cel.style.opacity=1;halo.style.opacity=1});
  }
  if(!(mq&&mq('(prefers-reduced-motion:reduce)').matches)){
    var cv=d.createElement('canvas');cv.id='ambient';b.insertBefore(cv,b.firstChild);var g=cv.getContext('2d'),W,H,DPR=Math.min(devicePixelRatio||1,2);
    function sz(){W=cv.width=innerWidth*DPR;H=cv.height=innerHeight*DPR;cv.style.width=innerWidth+'px';cv.style.height=innerHeight+'px'}sz();addEventListener('resize',sz);
    var em=[];for(var i=0;i<28;i++)em.push({x:R()*W,y:R()*H,r:(1+R()*2)*DPR,v:(.15+R()*.5)*DPR,a:.14+R()*.5,ph:R()*6});
    function eco(){var t=cur();return t==='light'?'70,52,28':t==='etruscan'?'28,18,6':'232,150,66'}
    var spr=d.createElement('canvas'),SS=Math.round(28*DPR);spr.width=spr.height=SS;var sg=spr.getContext('2d'),lc='';
    function sprite(c){if(c===lc)return;lc=c;sg.clearRect(0,0,SS,SS);var gr=sg.createRadialGradient(SS/2,SS/2,0,SS/2,SS/2,SS/2);gr.addColorStop(0,'rgba('+c+',1)');gr.addColorStop(.4,'rgba('+c+',.5)');gr.addColorStop(1,'rgba('+c+',0)');sg.fillStyle=gr;sg.beginPath();sg.arc(SS/2,SS/2,SS/2,0,7);sg.fill()}
    var bolt=null,bt=0,nx=200+R()*300;
    function mk(){var bx=W*(.2+R()*.6),by=0,p=[{x:bx,y:by}];while(by<H){by+=H/13*(.6+R()*.8);bx+=(R()-.5)*90*DPR;p.push({x:bx,y:by})}return p}
    function fr(){g.clearRect(0,0,W,H);sprite(eco());for(var i=0;i<em.length;i++){var e=em[i];e.y-=e.v;e.x+=Math.sin(e.y*.01+e.ph)*.3*DPR;if(e.y<-10){e.x=R()*W;e.y=H+10}var s=e.r*5;g.globalAlpha=e.a;g.drawImage(spr,e.x-s/2,e.y-s/2,s,s)}g.globalAlpha=1;
      if(--nx<=0&&!bolt){bolt=mk();bt=1;nx=320+R()*460}
      if(bolt){g.fillStyle='rgba(255,244,214,'+(bt*.05)+')';g.fillRect(0,0,W,H);g.strokeStyle='rgba(255,240,205,'+bt+')';g.lineWidth=2*DPR;g.shadowBlur=18*DPR;g.shadowColor='rgba(232,190,120,'+bt+')';g.beginPath();g.moveTo(bolt[0].x,bolt[0].y);for(var j=1;j<bolt.length;j++)g.lineTo(bolt[j].x,bolt[j].y);g.stroke();g.shadowBlur=0;bt-=.055;if(bt<=0)bolt=null}
      requestAnimationFrame(fr)}fr();
  }
  var fc=d.createElement('canvas');fc.width=fc.height=64;var f=fc.getContext('2d');var lk=d.querySelector('link[rel~=icon]');if(!lk){lk=d.createElement('link');lk.rel='icon';d.head.appendChild(lk)}
  var ii=0;function draw(){ii+=.09;var p=(Math.sin(ii)+1)/2;f.clearRect(0,0,64,64);f.fillStyle='#0e0f12';f.fillRect(0,0,64,64);f.beginPath();f.moveTo(40,7);f.lineTo(19,36);f.lineTo(30,36);f.lineTo(25,58);f.lineTo(48,26);f.lineTo(35,26);f.closePath();f.shadowBlur=5+p*13;f.shadowColor='rgba(232,150,66,'+(.5+p*.5)+')';f.fillStyle='rgb(238,'+(150+Math.round(p*45))+','+(70+Math.round(p*45))+')';f.fill();f.shadowBlur=0;try{lk.type='image/png';lk.href=fc.toDataURL('image/png')}catch(e){}}
  draw();setInterval(draw,160);
}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',start);else start();
})();