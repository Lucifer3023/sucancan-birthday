/* Reuses the user's original birthday fireworks, source commit af202acb3252689b780a392ffc205abcb6238581.
   Same shapes and physics, with targets lifted 12vh, 35% light intensity, 2.6x original spark size and five extra seconds before the finale. */
(() => {
  'use strict';
  function create(T,options={}){
    const group=new T.Group();group.name='Original birthday fireworks';group.visible=false;
    const canvas=document.createElement('canvas');canvas.className='birthday-fireworks-canvas';canvas.hidden=true;canvas.setAttribute('aria-hidden','true');
    canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;opacity:.35';
    document.getElementById('universe').append(canvas);
    const context=canvas.getContext('2d',{alpha:true}),reducedMotion={matches:!!options.reducedMotion};
    const colors={gold:43,heart:331,neon:278,peony:317};
    const FINALE_COOLDOWN=6500,FINALE_START=23000;
    let active=false,width=0,height=0,clock=0,openedAt=0,nextLaunch=0,finaleAt=-Infinity,automaticFinale=false;
    let rockets=[],particles=[],flashes=[],scheduled=[],glowSprites;
    const stars=[],constellation=[];
    const performance={now:()=>clock};
    const random=(min,max)=>min+Math.random()*(max-min),clamp=(v,min,max)=>Math.max(min,Math.min(max,v)),mobile=()=>width<600;
    function ensureAnimation(){} // The existing scene's animation loop drives this layer.
  function createGlowSprites() {
    glowSprites = {};
    for (const [name, hue] of Object.entries(colors)) {
      const sprite = document.createElement('canvas');
      sprite.width = sprite.height = 40;
      const ctx = sprite.getContext('2d');
      const glow = ctx.createRadialGradient(20, 20, 0, 20, 20, 20);
      glow.addColorStop(0, `hsla(${hue},100%,96%,1)`);
      glow.addColorStop(.13, `hsla(${hue},100%,85%,.9)`);
      glow.addColorStop(.3, `hsla(${hue},100%,66%,.35)`);
      glow.addColorStop(1, `hsla(${hue},100%,58%,0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 40, 40);
      glowSprites[name] = sprite;
    }
  }
  function launch(x, y, manual = false, options = {}) {
    if (!active || !context) return;
    x = clamp(x, 12, width - 12);
    y = clamp(y - height * .12, 35, height * .8);
    const type = options.type || ['gold', 'heart', 'neon', 'peony'][Math.floor(Math.random() * 4)];
    if (reducedMotion.matches) {
      if (!manual) return;
      burst(x, y, true, type, .6);
    } else {
      if (rockets.length >= (mobile() ? 9 : 13)) return;
      rockets.push({
        startX: options.startX === undefined ? clamp(x + random(-width * .15, width * .15), 0, width) : options.startX * width,
        startY: height + 10,
        endX: x,
        endY: y,
        age: 0,
        duration: options.duration || random(.62, .94),
        type,
        hue: colors[type],
        scale: options.scale || 1,
        trail: []
      });
    }
    ensureAnimation();
  }

  function addParticle(x, y, vx, vy, type, options = {}) {
    const maxParticles = mobile() ? 850 : 1650;
    if (particles.length >= maxParticles) return;
    particles.push({
      x, y, vx, vy, type,
      age: 0,
      life: options.gentle ? random(.45, .7) : type === 'gold' ? random(2.2, 3.4) : random(1.6, 2.55),
      hue: (colors[type] + random(-10, 10) + 360) % 360,
      radius: options.gentle ? 1.1 : random(1.2, 2.25) * 2.6,
      lightness: random(72, 89),
      sparkle: Math.random() > .55,
      gentle: !!options.gentle,
      gravity: options.gentle ? 10 : type === 'gold' ? 88 : 48,
      drag: type === 'gold' ? .991 : .982,
      trail: []
    });
  }

  function burst(x, y, gentle = false, type = 'heart', scale = 1) {
    const count = gentle ? 18 : Math.round((mobile() ? 88 : 140) * Math.min(scale, 1.25));
    const size = gentle ? 25 : Math.min(width * .26, 225) * scale;
    if (!gentle) {
      flashes.push({ x, y, age: 0, life: .45, hue: colors[type], size: size * 1.2 });
      if (flashes.length > 8) flashes.shift();
    }
    for (let i = 0; i < count; i++) {
      const angle = i / count * Math.PI * 2;
      let vx, vy;
      if (type === 'heart' && !gentle) {
        const heartScale = size / 12;
        const spread = i % 3 === 0 ? .64 : 1;
        vx = 16 * Math.pow(Math.sin(angle), 3) * heartScale * spread;
        vy = -(13 * Math.cos(angle) - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle)) * heartScale * spread;
      } else {
        const spread = type === 'neon' ? (i % 3 === 0 ? .5 : i % 3 === 1 ? .77 : 1) : type === 'gold' ? random(.75, 1.12) : Math.sqrt(Math.random());
        const velocity = size * random(1.15, 1.6) * spread;
        vx = Math.cos(angle) * velocity;
        vy = Math.sin(angle) * velocity;
        if (type === 'gold') vy -= size * .13;
      }
      addParticle(x, y, vx, vy, type, { gentle });
    }
    // A white-gold inner flower makes the purple and pink shells feel layered.
    if (!gentle && type !== 'gold') {
      const innerCount = mobile() ? 18 : 30;
      for (let i = 0; i < innerCount; i++) {
        const angle = i / innerCount * Math.PI * 2;
        addParticle(x, y, Math.cos(angle) * size * .38, Math.sin(angle) * size * .38, 'gold');
      }
    }
  }

  function scheduleOpening() {
    scheduled = [
      { at: openedAt + 40, x: .24, y: .56, type: 'gold', scale: 1.1, startX: .04 },
      { at: openedAt + 220, x: .76, y: .5, type: 'neon', scale: 1.05, startX: .96 },
      { at: openedAt + 700, x: .5, y: .42, type: 'heart', scale: 1.2, startX: .5 },
      { at: openedAt + 1250, x: .19, y: .41, type: 'peony', scale: .9, startX: .02 },
      { at: openedAt + 1450, x: .81, y: .43, type: 'gold', scale: 1, startX: .98 },
      { at: openedAt + 2000, x: .49, y: .54, type: 'neon', scale: 1.3, startX: .5 }
    ];
  }
    function startFinale(){
      if(!active||clock-finaleAt<FINALE_COOLDOWN)return;
      const now=clock;finaleAt=now;
      if(reducedMotion.matches)return;
    const rounds = [
      [.05, .18, .5, 'gold', 1.15], [.13, .82, .5, 'gold', 1.15],
      [.43, .33, .39, 'neon', 1.18], [.51, .67, .39, 'neon', 1.18],
      [.88, .5, .43, 'heart', 1.4],
      [1.28, .13, .57, 'peony', 1.05], [1.36, .87, .57, 'peony', 1.05],
      [1.85, .3, .47, 'gold', 1.25], [1.93, .7, .47, 'gold', 1.25],
      [2.45, .5, .39, 'heart', 1.5]
    ];
    rounds.forEach(([delay, x, y, type, scale]) => scheduled.push({ at: now + delay * 1000, x, y, type, scale, startX: x < .5 ? .07 : x > .5 ? .93 : .5 }));
    scheduled.sort((a, b) => a.at - b.at);
    }
  function draw(now) {
    if (!context || !active) return;
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = 1;
    for (const star of stars) {
      const twinkle = reducedMotion.matches ? 1 : .7 + .3 * Math.sin(now / 1700 + star.phase);
      context.fillStyle = `rgba(255,228,246,${star.opacity * twinkle})`;
      context.beginPath();
      context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalCompositeOperation = 'lighter';
    const age = now - openedAt;
    const reveal = reducedMotion.matches ? 1 : clamp(age / 1600, 0, 1);
    let previous;
    for (const point of constellation) {
      const shimmer = reducedMotion.matches ? 1 : .78 + .22 * Math.sin(now / 1100 + point.phase);
      const opacity = reveal * shimmer;
      if (previous && !point.first) {
        context.strokeStyle = `rgba(255,177,222,${opacity * .24})`;
        context.lineWidth = .8;
        context.beginPath();
        context.moveTo(previous.x, previous.y);
        context.lineTo(point.x, point.y);
        context.stroke();
      }
      context.globalAlpha = opacity * .82;
      const glowSize = point.radius * 10;
      context.drawImage(glowSprites[point.digit ? 'heart' : 'gold'], point.x - glowSize / 2, point.y - glowSize / 2, glowSize, glowSize);
      context.fillStyle = '#fff3e4';
      context.beginPath();
      context.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
      context.fill();
      previous = point;
    }
    context.globalAlpha = 1;
    for (const flash of flashes) {
      const opacity = Math.pow(1 - flash.age / flash.life, 2) * .18;
      const glow = context.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, flash.size);
      glow.addColorStop(0, `hsla(${flash.hue},100%,85%,${opacity})`);
      glow.addColorStop(1, `hsla(${flash.hue},100%,55%,0)`);
      context.fillStyle = glow;
      context.fillRect(flash.x - flash.size, flash.y - flash.size, flash.size * 2, flash.size * 2);
    }
    for (const rocket of rockets) {
      if (rocket.trail.length < 2) continue;
      for (let i = 1; i < rocket.trail.length; i++) {
        const point = rocket.trail[i];
        const before = rocket.trail[i - 1];
        context.strokeStyle = `hsla(${rocket.hue},100%,83%,${i / rocket.trail.length * .9})`;
        context.lineWidth = i / rocket.trail.length * 2.5;
        context.beginPath();
        context.moveTo(before.x, before.y);
        context.lineTo(point.x, point.y);
        context.stroke();
      }
      const head = rocket.trail[rocket.trail.length - 1];
      context.drawImage(glowSprites[rocket.type], head.x - 12, head.y - 12, 24, 24);
    }
    for (const particle of particles) {
      let opacity = Math.pow(1 - particle.age / particle.life, .58);
      if (particle.sparkle && particle.age > particle.life * .55) opacity *= .5 + .5 * Math.abs(Math.sin(particle.age * 19));
      if (particle.trail.length > 1 && !particle.gentle) {
        context.strokeStyle = `hsla(${particle.hue},100%,${particle.lightness}%,${opacity * .65})`;
        context.lineWidth = particle.radius * .65;
        context.beginPath();
        particle.trail.forEach((point, i) => {
          if (i === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        });
        context.stroke();
      }
      const halo = particle.radius * (particle.gentle ? 5 : 8);
      context.globalAlpha = opacity;
      context.drawImage(glowSprites[particle.type], particle.x - halo / 2, particle.y - halo / 2, halo, halo);
      context.fillStyle = `hsla(${particle.hue},70%,94%,${opacity})`;
      context.beginPath();
      context.arc(particle.x, particle.y, Math.max(.3, particle.radius * .57), 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
  }
    function resize(){
      if(!active)return;
      const oldWidth=width||1,oldHeight=height||1;
      width=window.innerWidth;height=window.innerHeight;
      const ratio=Math.min(window.devicePixelRatio||1,2);
      canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);context.setTransform(ratio,0,0,ratio,0,0);
      for(const rocket of rockets){rocket.startX*=width/oldWidth;rocket.endX*=width/oldWidth;rocket.startY*=height/oldHeight;rocket.endY*=height/oldHeight;rocket.trail=[];}
      particles=[];flashes=[];draw(clock);
    }
    createGlowSprites();
    return {group,materials:[],
      start(){
        active=true;group.visible=true;canvas.hidden=false;clock=0;openedAt=0;nextLaunch=3000;finaleAt=-Infinity;automaticFinale=false;
        rockets=[];particles=[];flashes=[];scheduled=[];resize();if(!reducedMotion.matches)scheduleOpening();
        group.userData.active=true;group.userData.rockets=0;group.userData.particles=0;group.userData.scheduled=scheduled.length;
      },
      update(time,frameDelta=0){
        if(!active)return;
        const step=Math.max(0,Math.min(.1,frameDelta));clock+=step*1000;
        const now=clock,elapsed=now-openedAt,deltaSeconds=Math.min(step,.033);
        if(!reducedMotion.matches){
          while(scheduled.length&&scheduled[0].at<=now){const event=scheduled.shift();launch(width*event.x,height*event.y,false,event);}
          if(elapsed>2800&&elapsed<FINALE_START&&now>=nextLaunch&&now-finaleAt>3500){launch(random(width*.12,width*.88),random(height*.38,height*.66));nextLaunch=now+random(580,860);}
          if(elapsed>=FINALE_START&&!automaticFinale){automaticFinale=true;startFinale();}
        }
        const delta=deltaSeconds;
    rockets = rockets.filter(rocket => {
      rocket.age += delta;
      if (rocket.age >= rocket.duration) {
        burst(rocket.endX, rocket.endY, false, rocket.type, rocket.scale);
        return false;
      }
      const progress = rocket.age / rocket.duration;
      const eased = 1 - Math.pow(1 - progress, 1.65);
      rocket.trail.push({ x: rocket.startX + (rocket.endX - rocket.startX) * eased, y: rocket.startY + (rocket.endY - rocket.startY) * eased });
      if (rocket.trail.length > 17) rocket.trail.shift();
      return true;
    });
    particles = particles.filter(particle => {
      particle.age += delta;
      if (particle.age >= particle.life) return false;
      const drag = Math.pow(particle.drag, delta * 60);
      particle.vx *= drag;
      particle.vy *= drag;
      particle.vy += particle.gravity * delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.trail.push({ x: particle.x, y: particle.y });
      if (particle.trail.length > (particle.type === 'gold' ? 10 : 5)) particle.trail.shift();
      return true;
    });
    flashes = flashes.filter(flash => { flash.age += delta; return flash.age < flash.life; });
    draw(now);
        group.userData.rockets=rockets.length;group.userData.particles=particles.length;group.userData.scheduled=scheduled.length;
      },
      encore(x,y){if(active)launch(Number.isFinite(x)?x:random(width*.2,width*.8),Number.isFinite(y)?y:random(height*.4,height*.65),true);},
      stop(){active=false;group.visible=false;canvas.hidden=true;rockets=[];particles=[];flashes=[];scheduled=[];context.clearRect(0,0,width,height);group.userData.active=false;group.userData.rockets=group.userData.particles=group.userData.scheduled=0;},
      resize,
      dispose(){active=false;group.visible=false;rockets=[];particles=[];flashes=[];scheduled=[];group.userData.active=false;group.userData.rockets=group.userData.particles=group.userData.scheduled=0;canvas.remove();group.clear();}
    };
  }
  window.CelebrationFireworks=Object.freeze({create,source:'xiaosu-birthday-nov01-pink',sourceCommit:'af202acb3252689b780a392ffc205abcb6238581'});
})();
