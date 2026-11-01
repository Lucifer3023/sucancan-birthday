/* Three-tier stardust cake, ported from the user's Cosmic Atlas reference. */
(() => {
  'use strict';
  const vertex = `
    uniform float uProgress, uTime, uPixelRatio, uSizeScale, uReduced;
    attribute vec3 aStart, aColor;
    attribute float aSize, aBirth, aDuration, aPhase, aStill;
    varying vec3 vColor;
    varying float vAlpha, vSparkle, vGlimmer, vBody;
    float gatherEase(float t) {
      t = clamp(t, 0.0, 1.0);
      return t*t*t*(t*(t*6.0-15.0)+10.0);
    }
    void main() {
      // One shared clock: every tier, candle and numeral is already a star in
      // the opening cloud, and every one gathers along the same smooth curve.
      // aBirth/aDuration remain available as legacy geometry metadata only.
      float p = gatherEase((uProgress - 0.18) / 0.76);
      vec3 cloud = aStart;
      cloud.x += sin(uTime * 0.65 + aPhase * 17.0) * 0.020;
      cloud.y += cos(uTime * 0.50 + aPhase * 23.0) * 0.018;
      cloud.z += sin(uTime * 0.55 + aPhase * 13.0) * 0.018;
      vec3 pos = mix(cloud, position, p);
      float arc = sin(p * 3.1415926) * 0.15;
      pos += vec3(cos(aPhase * 19.0), 0.6 + sin(aPhase * 11.0) * 0.4,
        sin(aPhase * 17.0)) * arc;
      if (uReduced > 0.5) pos = position;
      float drift = (uReduced > 0.5 ? 1.0 : p) * (1.0 - aStill);
      pos.y += sin(uTime * 1.35 + aPhase * 42.0) * 0.0083333 * drift;
      pos.x += cos(uTime * 0.9 + aPhase * 19.0) * 0.0057692 * drift;
      pos.z += sin(uTime * 0.8 + aPhase * 27.0) * 0.0057692 * drift;
      vec4 mv = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mv;
      float pulse = 0.9 + 0.1 * sin(uTime * 2.0 + aPhase * 61.0);
      gl_PointSize = clamp(aSize * uSizeScale * uPixelRatio * (1.08 - p * 0.08) * pulse,
        0.5 * uPixelRatio, 7.0 * uPixelRatio);
      vColor = aColor;
      float appear = smoothstep(0.0, uReduced > 0.5 ? 0.32 : 0.10, uProgress);
      vAlpha = appear * mix(1.15, 1.0, p) * (0.6 + 0.4 * (0.5 + 0.5 * sin(uTime * 1.8 + aPhase * 34.0)));
      vSparkle = step(2.8, aSize);
      vBody = 1.0 - aStill;
      // A sparse set of stars catches the light at independent moments. The
      // candle heart and numerals keep their existing, separately tuned gain.
      float selected = step(0.948, fract(aPhase * 173.237)) * vBody;
      float glint = pow(max(0.0, sin(uTime * (0.65 + fract(aPhase * 41.83) * 0.40)
        + aPhase * 61.0)), 18.0);
      vGlimmer = selected * (uReduced > 0.5 ? 0.22 : glint);
    }`;
  const fragment = `
    uniform float uOpacity;
    varying vec3 vColor;
    varying float vAlpha, vSparkle, vGlimmer, vBody;
    void main() {
      vec2 p = gl_PointCoord - 0.5;
      float d = length(p);
      if (d > 0.5 || vAlpha < 0.001) discard;
      float soft = smoothstep(0.5, 0.0, d);
      float core = smoothstep(0.3, 0.0, d);
      float alpha = (pow(soft, 2.1) * 0.72 + core * 0.75) * vAlpha * uOpacity;
      // Pearl-like pinpoints get brighter at their centre, while the space
      // between grains stays dark. Fine four-point rays live inside the same
      // sprite footprint, rather than enlarging the whole cake or its bloom.
      vec2 q = p * 2.0;
      float rays = (exp(-abs(q.x) * 44.0 - abs(q.y) * 5.0)
        + exp(-abs(q.y) * 44.0 - abs(q.x) * 5.0)) * vGlimmer * 0.16;
      alpha += rays * vAlpha * uOpacity;
      vec3 color = vColor * (0.58 + core * (0.92 + 0.30 * vBody));
      color += vec3(1.0, 0.84, 0.7) * vSparkle * core * 0.34;
      color += vec3(1.0, 0.88, 0.96) * (vGlimmer * core * 0.65 + rays * 3.0);
      gl_FragColor = vec4(color, alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;

  function create(T, options = {}) {
    if (!T || !T.BufferGeometry) throw new Error('BirthdayCake requires THREE');
    const mobile = !!options.mobile, reduced = !!options.reducedMotion;
    const unit = 1 / 1.56, tau = Math.PI * 2, density = mobile ? .72 : 1;
    const count = n => Math.round(n * density);
    let seed = 20060320, time = 0, revealValue = 0;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
    const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
    const smooth = (a,b,v) => { const x = clamp((v-a)/(b-a),0,1); return x*x*(3-2*x); };
    const p = [], starts = [], colors = [], sizes = [], births = [], durations = [], phases = [], stills = [];
    const palette = {};
    Object.entries({petal:'#ff71a5',blush:'#ffabc4',milk:'#fff0e7',cream:'#ffd9bd',gold:'#ffc477',rose:'#c93869',wine:'#701a3c',berry:'#ff4f89'}).forEach(([name,hex]) => palette[name] = new T.Color(hex));
    const mix = (a,b,t) => a.clone().lerp(b,clamp(t,0,1));
    const add = (x,y,z,color,size,birth,duration=.14,start=null,still=0) => {
      p.push(x*unit,y*unit,z*unit); colors.push(color.r,color.g,color.b); sizes.push(size);
      births.push(birth); durations.push(duration); phases.push(random()); stills.push(still);
      if (start) starts.push(start[0]*unit,start[1]*unit,start[2]*unit);
      else {
        const a = random()*tau, r = 1.4+Math.sqrt(random())*3.25;
        starts.push(Math.cos(a)*r*unit,(-1.55+random()*1.65)*unit,Math.sin(a)*r*unit);
      }
    };
    const group = new T.Group(); group.name = 'BirthdayCake-22'; group.visible = false;
    const geometries = [], materials = [], textures = [], rims = [], flames = [];
    const tiers = [
      {radius:1.56,bottom:.17,height:.82,birth:.10,duration:.14},
      {radius:1.14,bottom:1.04,height:.70,birth:.32,duration:.12},
      {radius:.79,bottom:1.80,height:.62,birth:.52,duration:.10}
    ];
    const tierRanges = [];
    function makeTier(tier,index) {
      const {radius:R,bottom,height:H,birth:b,duration} = tier, top = bottom+H;
      const start = p.length/3, sideCount = [8200,6100,4300][index], topCount = [2800,2100,1600][index];
      const lowerColor = index===0?palette.rose:index===1?palette.petal:palette.blush;
      const upperColor = index===0?palette.petal:palette.blush;
      for (let j=0;j<count(sideCount);j++) {
        const a = random()*tau, t = random(), y=bottom+t*H;
        const r=R*(.985+Math.sin(a*17+y*12)*.007+(random()-.5)*.012);
        const c=mix(lowerColor,upperColor,t*.85+random()*.15);
        if(random()<.03)c.lerp(palette.gold,.7);
        const size=.75+random()*1.35+(random()<.025?1.8:0);
        add(Math.cos(a)*r,y,Math.sin(a)*r,c,size,b+t*.045+random()*.01,duration);
      }
      const topStart=p.length/3;
      for (let j=0;j<count(topCount);j++) {
        const a=random()*tau,r=Math.sqrt(random())*R,y=top+.012+random()*.028;
        const c=mix(upperColor,palette.milk,random()*.34); if(random()<.06)c.lerp(palette.gold,.55);
        add(Math.cos(a)*r,y,Math.sin(a)*r,c,.75+random()*1.4,b+.055+random()*.01,duration);
      }
      const frostingStart=p.length/3;
      for (let j=0;j<count(2400+index*100);j++) {
        const a=random()*tau,depth=.11+Math.pow(.5+.5*Math.sin(a*(index+4)+index*2.1),1.8)*.23+random()*.085;
        const t=random(),y=top+.012-t*depth,r=R*1.006+Math.sin(a*23)*.004+t*.008;
        const c=mix(palette.milk,palette.blush,random()*.42); if(random()<.035)c.lerp(palette.gold,.65);
        add(Math.cos(a)*r,y,Math.sin(a)*r,c,.7+random()*1.4,b+.075+random()*.005,duration);
      }
      const pearlCount=index===2?52:74;
      for(let j=0;j<pearlCount;j++) {
        const a=j/pearlCount*tau+random()*.02,r=R*1.015,y=index===1&&j%3===0?top-.18:bottom+.075;
        const c=random()<.3?palette.gold:mix(palette.milk,palette.blush,random()*.45);
        for(let k=0;k<count(17);k++) {
          const s=random()*tau,t=random()*tau,rr=.025+random()*.036;
          add(Math.cos(a)*r+Math.cos(s)*Math.cos(t)*rr,y+Math.sin(t)*rr,Math.sin(a)*r+Math.sin(s)*Math.cos(t)*rr,c,.8+random()*1.3,b+.075+random()*.005,duration);
        }
      }
      for(let j=0;j<(index===0?14:9);j++) {
        const a=random()*tau,r=R*(.99+random()*.006),y=bottom+H*(.22+random()*.55),c=random()<.5?palette.gold:palette.milk;
        for(let k=0;k<count(16);k++) {
          const t=k/8*tau,rr=k%8*.007;
          add(Math.cos(a)*r+Math.cos(t)*rr,y+Math.sin(t)*rr,Math.sin(a)*r+Math.sin(t)*rr,c,.7+random()*.7,b+.08,duration);
        }
      }
      tierRanges.push({start,topStart,frostingStart,end:p.length/3,birth:b,complete:b+.08+duration});
      for(const [y,opacity] of [[top+.018,.32],[bottom+.012,.16]]) {
        const geometry=new T.RingGeometry(R*.985*unit,R*1.018*unit,128);
        const material=new T.MeshBasicMaterial({color:0xffadc9,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,toneMapped:true});
        const ring=new T.Mesh(geometry,material);ring.rotation.x=-Math.PI/2;ring.position.y=y*unit;ring.renderOrder=9;
        group.add(ring);rims.push({ring,birth:b+.06,opacity});geometries.push(geometry);materials.push(material);
      }
    }
    // Gold and blush stardust settle first, before the three tiers gather upward.
    const baseRange={start:p.length/3};
    for(let j=0;j<count(2600);j++) {
      const a=random()*tau,r=1.7+random()*.55,c=random()<.4?palette.gold:palette.blush;
      add(Math.cos(a)*r,.02+random()*.035,Math.sin(a)*r,c,.7+random()*1.8,random()*.025,.07);
    }
    baseRange.end=p.length/3;
    tiers.forEach(makeTier);
    const top=2.42;
    for(let j=0;j<count(2200);j++) {
      const t=j/Math.max(1,count(2200)-1),a=t*Math.PI*13.5,r=.06+t*.61;
      add(Math.cos(a)*r,top+.04+Math.sin(t*Math.PI)*.03,Math.sin(a)*r,mix(palette.milk,palette.blush,t*.55),.8+random()*1.15,.60,.10);
    }
    for(let j=0;j<28;j++) {
      const a=random()*tau,index=j%3,r=[1.565,1.145,.795][index],y=index===0?.32+random()*.5:index===1?1.17+random()*.4:1.92+random()*.33;
      const c=random()<.5?palette.gold:palette.milk,x=Math.cos(a)*r,z=Math.sin(a)*r;
      for(let k=0;k<count(24);k++) {
        const t=k/24*tau,hx=16*Math.sin(t)**3,hy=13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t);
        add(x+hx*.0021,y+hy*.0021,z,c,.7+random()*.7,tiers[index].birth+.08,tiers[index].duration);
      }
    }
    // 22 separate thin candles fill the whole heart, including its interior.
    const rows=[[.90,[-.65,-.35,.35,.65]],[.55,[-.90,-.55,-.18,.18,.55,.90]],[.18,[-.76,-.38,0,.38,.76]],[-.25,[-.57,-.19,.19,.57]],[-.62,[-.30,.30]],[-.93,[0]]];
    const candlePositions=rows.flatMap(([z,xs])=>xs.map(x=>[x*.32,(top+.045)*unit,-z*.32]));
    const candleRanges=[];
    candlePositions.forEach(([x,y,z],index)=>{
      const start=p.length/3,h=.14,X=x/unit,Y=y/unit,Z=z/unit,H=h/unit,r=.011/unit;
      for(let j=0;j<count(150);j++) {
        const a=random()*tau,t=random(),stripe=Math.sin(a*1.5-t*18)>0;
        add(X+Math.cos(a)*r,Y+t*H,Z+Math.sin(a)*r,stripe?palette.milk:palette.blush,.75+random()*.65,.72+t*.04,.10,[X,-1.5+random()*1.6,Z],1);
      }
      const wickStart=p.length/3;
      for(let j=0;j<count(10);j++)add(X,Y+H+random()*.012/unit,Z,palette.wine,.65,.84,.035,[X,-1.4,Z],1);
      const flameStart=p.length/3;
      for(let j=0;j<count(28);j++) {
        const t=random(),a=random()*tau,radius=.009*Math.sin(t*Math.PI)*Math.sqrt(random())/unit;
        add(X+Math.cos(a)*radius,Y+H+.012/unit+t*.038/unit,Z+Math.sin(a)*radius,palette.gold,.85+random()*.65,.86,.04,[X,-1.4,Z],1);
      }
      candleRanges.push({index,start,wickStart,flameStart,end:p.length/3});
      flames.push({position:[x,y+h+.027,z],phase:index*1.7+.3});
    });
    // A restrained, readable pair of gold 2s floats above the candle heart.
    const numberRange={start:p.length/3};
    const bez=(t,a,b,c,d)=>(1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*d;
    for(let digit=0;digit<2;digit++)for(let j=0;j<count(850);j++) {
      const t=random();let x,y;
      if(t<.43){const u=t/.43;x=bez(u,.05,.05,.95,.94);y=bez(u,.73,1.12,1.12,.76);}
      else if(t<.77){const u=(t-.43)/.34;x=bez(u,.94,.93,.40,.08);y=bez(u,.76,.53,.29,.05);}
      else{const u=(t-.77)/.23;x=.08+.87*u;y=.05;}
      const a=random()*tau,r=.004*Math.sqrt(random());
      const X=(digit?.014:-.20)+x*.18+r*Math.cos(a),Y=1.85+y*.20+r*Math.sin(a),Z=-.03+(random()-.5)*.007;
      add(X/unit,Y/unit,Z/unit,random()<.35?palette.milk:palette.gold,.8+random()*.65,.90+random()*.025,.055,null,1);
    }
    numberRange.end=p.length/3;

    // These are total linear-light gains, applied once without changing any
    // positions, sizes or reveal timing. Wicks stay dark between bright flames.
    const brightness=new Float32Array(p.length/3).fill(1.30);
    for(const range of candleRanges) {
      brightness.fill(1.70,range.start,range.wickStart);
      brightness.fill(1.00,range.wickStart,range.flameStart);
      brightness.fill(2.00,range.flameStart,range.end);
    }
    brightness.fill(2.20,numberRange.start,numberRange.end);
    for(let i=0;i<brightness.length;i++) {
      const gain=brightness[i],offset=i*3;
      colors[offset]*=gain;colors[offset+1]*=gain;colors[offset+2]*=gain;
    }

    // A full-height, softly scattered ellipsoid replaces the old below-cake
    // launch positions. Its independent hash keeps all finished cake samples,
    // colours and candle positions exactly as they were.
    function cloudRandom(index) {
      let value=Math.imul(index^0x41b21,1597334677);
      value=Math.imul(value^(value>>>16),2246822507);
      return ((value^(value>>>13))>>>0)/4294967296;
    }
    for(let i=0;i<p.length/3;i++) {
      const v=cloudRandom(i*5+1)*2-1,angle=cloudRandom(i*5+2)*tau;
      const radius=Math.cbrt(cloudRandom(i*5+3)),horizontal=Math.sqrt(1-v*v);
      const wisp=cloudRandom(i*5+4)>.91?1.16:1;
      starts[i*3]=Math.cos(angle)*horizontal*radius*1.48*wisp;
      starts[i*3+1]=.96+v*radius*1.04*wisp;
      starts[i*3+2]=Math.sin(angle)*horizontal*radius*.82*wisp;
    }

    const geometry=new T.BufferGeometry();
    for(const [name,data,n]of[['position',p,3],['aStart',starts,3],['aColor',colors,3],['aSize',sizes,1],['aBirth',births,1],['aDuration',durations,1],['aPhase',phases,1],['aStill',stills,1]])geometry.setAttribute(name,new T.Float32BufferAttribute(data,n));
    geometry.computeBoundingSphere();geometries.push(geometry);
    const uniforms={uProgress:{value:0},uTime:{value:0},uPixelRatio:{value:Math.min(window.devicePixelRatio||1,2)},uSizeScale:{value:mobile?1.2:1},uOpacity:{value:.9},uReduced:{value:reduced?1:0}};
    const material=new T.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment,transparent:true,blending:T.AdditiveBlending,depthWrite:false,depthTest:true,toneMapped:true});
    const points=new T.Points(geometry,material);points.name='Reference cake · translucent stardust';points.frustumCulled=false;points.renderOrder=8;group.add(points);materials.unshift(material);

    // Procedural reference-style textures; no cake bitmap is used anywhere.
    function radialTexture(flame=false) {
      const size=128,data=new Uint8Array(size*size*4);
      for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
        const px=(x+.5)/size*2-1,py=(y+.5)/size*2-1;
        const d=flame?Math.sqrt((px/.52)**2+(py/.96)**2):Math.hypot(px,py);
        const alpha=flame?Math.max(0,1-d)**1.9:Math.max(0,Math.exp(-d*d*5.8)-Math.exp(-5.8))/(1-Math.exp(-5.8));
        const i=(y*size+x)*4;data[i]=255;data[i+1]=flame?Math.round(220+35*(1-Math.min(1,d))):255;data[i+2]=flame?Math.round(146+109*(1-Math.min(1,d))):255;data[i+3]=Math.round(alpha*255);
      }
      const texture=new T.DataTexture(data,size,size,T.RGBAFormat);texture.needsUpdate=true;texture.minFilter=T.LinearFilter;texture.magFilter=T.LinearFilter;textures.push(texture);return texture;
    }
    const glowTexture=radialTexture(),flameTexture=radialTexture(true);
    function glowSprite(texture,color,width,height,x,y,z,opacity,order=7) {
      const mat=new T.SpriteMaterial({map:texture,color,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false,depthTest:true,toneMapped:true});
      const sprite=new T.Sprite(mat);sprite.scale.set(width,height,1);sprite.position.set(x,y,z);sprite.renderOrder=order;group.add(sprite);materials.push(mat);return {sprite,opacity};
    }
    const bodyGlow=glowSprite(glowTexture,0xff8ab2,4.8*unit,4.2*unit,0,1.35*unit,0,.31);
    const baseGeo=new T.PlaneGeometry(7.5*unit,7.5*unit),baseMat=new T.MeshBasicMaterial({map:glowTexture,color:0xff87b3,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,toneMapped:true});
    const baseGlow=new T.Mesh(baseGeo,baseMat);baseGlow.rotation.x=-Math.PI/2;baseGlow.position.y=.02*unit;baseGlow.renderOrder=7;group.add(baseGlow);geometries.push(baseGeo);materials.push(baseMat);
    for(const flame of flames) {
      const [x,y,z]=flame.position;
      flame.light=glowSprite(flameTexture,0xffefc8,.045,.070,x,y,z,.90,10);
      flame.light.sprite.material.color.multiplyScalar(1.35);
      flame.glow=glowSprite(glowTexture,0xffd39e,.15,.15,x,y,z,.20,9);
    }
    group.userData={pointCount:p.length/3,candleCount:candlePositions.length,candleLayout:'filled-heart',candlePositions,candleRanges,tierRanges,baseRange,numberRange,tierRadii:tiers.map(t=>t.radius*unit),tierHeights:tiers.map(t=>(t.bottom+t.height)*unit),floorY:.02*unit,cakeHeight:top*unit,topperHeight:2.08,autoPulsePeriod:0,revealMode:'cloud-gather',revealWindows:{cloud:[0,.18],gather:[.18,.94],settle:[.94,1]},referenceStyle:'Cosmic Atlas three-tier additive stardust',coordinateSystem:'Y-up, origin at cake base'};
    function updateSecondary() {
      // The physical rim and flame sprites wait for the shared cloud to gather;
      // otherwise they would reveal a stationary wire cake ahead of its stars.
      const assembled=reduced?smooth(.10,.32,revealValue):smooth(.76,.97,revealValue);
      bodyGlow.sprite.material.opacity=bodyGlow.opacity*assembled;
      baseMat.opacity=.27*assembled;
      for(const rim of rims)rim.ring.material.opacity=rim.opacity*assembled;
      const lit=reduced?assembled:smooth(.84,.98,revealValue);
      for(const flame of flames) {
        const f=reduced?1:.94+Math.sin(time*7.2+flame.phase)*.045+Math.sin(time*19+flame.phase)*.015;
        flame.light.sprite.material.opacity=flame.light.opacity*lit;
        flame.light.sprite.scale.set(.045*f,.070*f,1);
        flame.glow.sprite.material.opacity=flame.glow.opacity*lit;
      }
    }
    return {
      group,materials,
      update(t,dt){time=Number.isFinite(t)?t:time+(Number.isFinite(dt)?dt:1/60);uniforms.uTime.value=reduced?0:time;updateSecondary();},
      reveal(v){revealValue=Number.isFinite(v)?clamp(v,0,1):0;group.visible=revealValue>0;uniforms.uProgress.value=revealValue;updateSecondary();},
      burst(){},
      resize(h,dpr){if(h&&typeof h==='object')dpr=h.pixelRatio;if(Number.isFinite(dpr)&&dpr>0)uniforms.uPixelRatio.value=Math.min(dpr,2);},
      setZoom(){},
      dispose(){for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();for(const texture of textures)texture.dispose();group.clear();}
    };
  }
  window.BirthdayCake=Object.freeze({create});
})();
