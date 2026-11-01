/* One WebGL scene and one continuous camera journey. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),T=window.THREE;
  const mobile=matchMedia('(max-width:750px)').matches,reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const R=1.7,D=Math.PI/180,H={lon:113.665412,lat:34.757975};
  let renderer;
  function fail(error){console.error(error);$('fatalMessage').textContent='三维星空暂时未能加载。请检查浏览器的 WebGL 支持，并重新打开页面。';$('fatalError').hidden=false;$('loadingScreen').classList.add('ready');}
  $('reloadPage').onclick=()=>location.reload();
  try{if(!T||!window.GalaxyScene||!window.BirthdayCake||!window.HeartWish||!window.StarTunnel||!window.GalaxyReference||!window.FirstPersonFlight)throw Error('3D libraries unavailable');renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch(e){fail(e);return;}
  renderer.setClearColor(0x02040b,1);renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.5:1.8));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.domElement.setAttribute('aria-label','三维星空。拖动旋转，轻点与光粒子互动。');renderer.domElement.tabIndex=0;$('sceneHost').append(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(46,1,.005,450);scene.add(camera);
  const cakeBloom=window.CakeBloom?.create(T,{mobile});
  const target=new T.Vector3(),galaxy=GalaxyScene.create(T,{mobile});scene.add(galaxy.group);galaxy.setFrozen(reduced);
  const planetRoot=new T.Group();planetRoot.visible=false;scene.add(planetRoot);const planetSpin=new T.Group();planetRoot.add(planetSpin);
  const cake=BirthdayCake.create(T,{mobile,reducedMotion:reduced}),cakeMount=new T.Group();cakeMount.add(cake.group);planetSpin.add(cakeMount);cake.group.scale.setScalar(mobile?.10:.13);
  const heartWish=HeartWish.create(T,{mobile,reducedMotion:reduced});cake.group.add(heartWish.group);
  // Match each tier so a tap beside the narrow upper tiers stays a sky tap.
  const cakeHit=new T.Group(),cakeHitMaterial=new T.MeshBasicMaterial({transparent:true,opacity:0,colorWrite:false,depthWrite:false});
  for(const [r,h,y]of[[1.03,.56,.372],[.75,.48,.891],[.53,.43,1.353],[.40,.57,1.82]]){
    const hit=new T.Mesh(new T.CylinderGeometry(r,r,h,24),cakeHitMaterial);hit.position.y=y;hit.rotation.y=Math.PI/24;cakeHit.add(hit);
  }
  cake.group.add(cakeHit);
  const fireworks=CelebrationFireworks.create(T,{mobile,reducedMotion:reduced});scene.add(fireworks.group);
  function geo(lon,lat,r){const a=lat*D,b=lon*D;return new T.Vector3(r*Math.cos(a)*Math.cos(b),r*Math.sin(a),-r*Math.cos(a)*Math.sin(b));}
  const henanNormal=geo(H.lon,H.lat,1),henanSurface=geo(H.lon,H.lat,R+.018);cakeMount.position.copy(henanSurface).addScaledVector(henanNormal,.028);cakeMount.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),henanNormal);
  let earth,province,width=1,height=1,aspect=1,phase='galaxy',busy=false,ready=false,flight=null,animation=0;
  let lastTime=performance.now(),startedAt=lastTime,azimuth=-.07,elevation=Math.asin(GalaxyReference.meta.axisRatio),drag=null,henanArrivedAt=0,toastTimer,inspectionTop=false;
  const solarWorld=new T.Vector3(),orbitPoint=new T.Vector3(),raycaster=new T.Raycaster(),pointer=new T.Vector2();
  const zoomLevels={galaxy:1,earth:1,cake:1},pointers=new Map();let pinch=null;
  const ease=p=>p*p*p*(p*(p*6-15)+10);
  function smooth(a,b,p){const x=T.MathUtils.clamp((p-a)/(b-a),0,1);return x*x*(3-2*x);}
  function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2800);}
  function galaxyCamera(){const r=Math.max(59,54/(2*Math.tan(23*D)*aspect)*1.03)/zoomLevels.galaxy;return new T.Vector3(Math.sin(azimuth)*Math.cos(elevation)*r,Math.sin(elevation)*r,Math.cos(azimuth)*Math.cos(elevation)*r);}
  function earthDistance(){return Math.max(R*1.35,Math.max(6.6,R/(Math.tan(23*D)*aspect)*1.25)/zoomLevels.earth);}
  function zoomForStage(){return zoomLevels[phase==='henan'?'cake':phase]||1;}
  function setZoom(value){
    if(!ready||busy)return;const key=phase==='henan'?'cake':phase;
    const ranges={galaxy:[.55,2.6],earth:[.65,2.1],cake:[.7,1.8]},range=ranges[key];if(!range)return;
    const old=zoomLevels[key],next=T.MathUtils.clamp(value,range[0],range[1]);zoomLevels[key]=next;
    if(key==='earth'){const direction=camera.position.clone().sub(planetRoot.position).normalize();camera.position.copy(planetRoot.position).addScaledVector(direction,earthDistance());}
    else if(key==='cake'){camera.position.sub(target).multiplyScalar(old/next).add(target);cake.setZoom(next);}
    $('zoomValue').textContent=Math.round(next*100)+'%';camera.lookAt(target);
  }
  function galaxyOpacity(a){galaxy.group.visible=a>.001;galaxy.materials.forEach(m=>m.uniforms.uOpacity.value=a);}
  function earthOpacity(a){earth?.materials.forEach(m=>m.uniforms.uOpacity.value=a);}
  const pointMaterials=[];
  const pointVertex=`attribute float aSize;uniform float uHeight;uniform float uSize;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*uSize*uHeight/max(.08,-mv.z),1.,40.);}`;
  const pointFragment=`uniform vec3 uColor;uniform float uOpacity;void main(){vec2 p=gl_PointCoord*2.-1.;float r=dot(p,p);if(r>1.)discard;float a=(exp(-r*24.)+.19*exp(-r*4.))*uOpacity;gl_FragColor=vec4(uColor,a);}`;
  function lightCloud(p,color,size,opacity){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('aSize',new T.Float32BufferAttribute(Array(p.length/3).fill(1),1));const m=new T.ShaderMaterial({vertexShader:pointVertex,fragmentShader:pointFragment,uniforms:{uColor:{value:new T.Color(color)},uOpacity:{value:opacity},uHeight:{value:height},uSize:{value:size}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});pointMaterials.push(m);return new T.Points(g,m);}
  function ringCloud(r,color,size,count=90){const p=[];for(let i=0;i<count;i++){const a=i/count*Math.PI*2;p.push(Math.cos(a)*r,Math.sin(a)*r,0);}return lightCloud(p,color,size,.8);}
  const solarBeacon=new T.Group();scene.add(solarBeacon);solarBeacon.add(lightCloud([0,0,0],0x9bceff,.30,1));const solarRing=ringCloud(.56,0x8bbcff,.08);solarBeacon.add(solarRing);
  function proxy(radius,parent){const m=new T.Mesh(new T.SphereGeometry(radius,12,8),new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false}));parent.add(m);return m;}
  const solarProxy=proxy(1.1,solarBeacon);
  const henanBeacon=new T.Group();henanBeacon.position.copy(henanSurface);henanBeacon.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),henanNormal);planetSpin.add(henanBeacon);henanBeacon.add(lightCloud([0,0,.002],0xffa4d0,.014,1));const henanRing=ringCloud(.038,0xff9ec9,.004);henanBeacon.add(henanRing);const henanProxy=proxy(.1,henanBeacon);
  let seed=87122;function random(){seed=(Math.imul(1664525,seed)+1013904223)|0;return(seed>>>0)/4294967296;}
  const far=[];for(let i=0;i<(mobile?6500:14000);i++){const y=random()*2-1,a=random()*Math.PI*2,r=150+random()*110,s=Math.sqrt(1-y*y);far.push(Math.cos(a)*s*r,y*r,Math.sin(a)*s*r);}const distantStars=lightCloud(far,0xb4c9f4,.37,.86);scene.add(distantStars);
  const tunnel=StarTunnel.create(T,{mobile});camera.add(tunnel.group);
  const warpMaterial={uniforms:tunnel.uniforms};
  function buildProvince(data){
    const group=new T.Group(),outline=[],fill=[],f=data.features?.[0]||data;
    const polys=f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates];
    polys.forEach(poly=>poly.forEach(ring=>ring.forEach(([lon,lat])=>{const p=geo(lon,lat,R+.009);outline.push(p.x,p.y,p.z);} )));
    const boundary=lightCloud(outline,0xff91c4,.0038,.95);group.add(boundary);
    function inside(lon,lat,ring){let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>lat)!==(b[1]>lat)&&lon<(b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
    const contains=(lon,lat)=>polys.some(p=>inside(lon,lat,p[0])&&!p.slice(1).some(r=>inside(lon,lat,r)));
    const count=mobile?500:1000;for(let i=0,n=0;i<count&&n<count*18;n++){const lon=110.36+random()*6.3,lat=31.38+random()*5;if(!contains(lon,lat))continue;const p=geo(lon,lat,R+.005+random()*.004);fill.push(p.x,p.y,p.z);i++;}
    const surface=lightCloud(fill,0xff84be,.0022,.3);group.add(surface);group.visible=false;planetSpin.add(group);return{group,boundary,surface,contains:contains(H.lon,H.lat)};
  }
  const content={
    galaxy:{n:'01',name:'MILKY WAY',tag:'SOMEWHERE IN THE UNIVERSE',title:'从银河，<br>找到你。',description:'亿万颗星光，缓缓旋转。<br>轻触星空，看光粒回应；点击上方的太阳系入口，开启旅程。',action:'寻找地球',hint:'拖动探索银河 · 滚轮或双指缩放'},
    earth:{n:'02',name:'EARTH',tag:'A SMALL BLUE WORLD',title:'穿过星海，<br>抵达地球。',description:'每一片大陆，都由微光连成。<br>找到中国的河南，继续靠近这份生日惊喜。',action:'前往河南',hint:'单指拖动旋转 · 双指或滚轮缩放'},
    henan:{n:'03',name:'HENAN · CHINA',tag:'CLOSER TO THE LIGHT',title:'下一站，<br>中国 · 河南。',description:'星光正沿着省界聚集。<br>一份小小的生日心意，正在这里亮起。',action:'星光正在聚集',hint:'沿着真实省界，抵达这份心意'},
    cake:{n:'04',name:'A BIRTHDAY WISH',tag:'11.01 · ONLY FOR XIAOSU',title:'小苏，<br>22 岁生日快乐。',description:'把银河里的这一束光，送到河南。<br>愿你所遇皆甜，往后的每一天，都有星光。',action:'收下一句祝福',hint:'轻点蛋糕 · 爱心汇成随机祝福 · 拖动或双指缩放'}
  };
  function showStage(name){const c=content[name];phase=name;renderer.setClearColor(0x02040b,name==='cake'?0:1);document.body.dataset.stage=name;$('sceneNumber').textContent=c.n;$('sceneName').textContent=c.name;$('storyEyebrow').textContent=c.tag;$('storyTitle').innerHTML=c.title;$('storyDescription').innerHTML=c.description;$('actionText').textContent=c.action;$('interactionHint').textContent=c.hint;const index=['galaxy','earth','henan','cake'].indexOf(name);document.querySelectorAll('[data-step]').forEach(node=>{const n=+node.dataset.step;node.classList.toggle('active',n===index);node.classList.toggle('complete',n<index);if(n===index)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');});$('solarTarget').hidden=name!=='galaxy';$('solarAnchor').hidden=name!=='galaxy';$('solarGuide').toggleAttribute('hidden',name!=='galaxy');$('henanTarget').hidden=name!=='earth';$('provinceCaption').hidden=name!=='cake';$('viewCandles').hidden=name!=='cake';$('birthdayMascot').hidden=name!=='cake';$('earthControls').hidden=name!=='earth';$('zoomValue').textContent=Math.round(zoomForStage()*100)+'%';$('primaryAction').disabled=busy||!ready;$('solarTarget').disabled=busy||!ready;}
  function travelling(value,text){busy=value;document.body.classList.toggle('is-travelling',value);if(text)$('travelCaption').querySelector('p').textContent=text;$('primaryAction').disabled=value||!ready;$('solarTarget').disabled=value||!ready;}
  function fly(to,focus,up,duration,lift,update,complete){const from=camera.position.clone();flight={start:performance.now(),duration:reduced?Math.min(duration,1.3):duration,fovBoost:phase==='galaxy'?18:7,curve:new T.CubicBezierCurve3(from,from.clone().lerp(to,.31).add(lift),from.clone().lerp(to,.8).add(lift.clone().multiplyScalar(.25)),to.clone()),fromTarget:target.clone(),toTarget:focus.clone(),fromUp:camera.up.clone(),toUp:up.clone(),update,complete};}
  function startEarth(){
    if(!ready||busy||phase!=='galaxy')return;cancelPointer();
    galaxy.setFrozen(true);galaxy.group.updateMatrixWorld(true);galaxy.group.localToWorld(solarWorld.copy(galaxy.solarPosition));
    planetRoot.position.copy(solarWorld);planetRoot.scale.setScalar(1);planetRoot.visible=false;henanBeacon.visible=false;earthOpacity(0);
    const approach=FirstPersonFlight.create(T,{from:camera.position,fromTarget:target,anchor:solarWorld,up:camera.up,endDistance:earthDistance(),localFront:geo(108,18,1)});
    planetRoot.position.copy(approach.destination);planetSpin.quaternion.copy(approach.orientation);
    travelling(true,'朝向那束蓝色微光，穿过漫天星辰。');
    flight={start:performance.now(),duration:reduced?1.3:9.6,firstPerson:approach,
      update(p,pose){
        document.body.dataset.flightPhase=pose.phase;
        galaxyOpacity(pose.galaxyOpacity);planetRoot.visible=p>.55;earthOpacity(pose.earthOpacity);
        warpMaterial.uniforms.uOpacity.value=reduced?0:pose.warpOpacity;tunnel.uniforms.uDensity.value=pose.warpDensity;tunnel.uniforms.uStretch.value=pose.warpStretch;distantStars.material.uniforms.uOpacity.value=.86*pose.backgroundOpacity;
        const captions={orienting:"朝向地球所在的方向。",cruise:"穿过星群，向前靠近。","push-in":"星海渐近，向前穿梭。",sparse:"星光逐渐退远，空间安静下来。",arriving:"在这片寂静里，找到地球。"};const caption=$('travelCaption').querySelector('p');if(caption.textContent!==captions[pose.phase])caption.textContent=captions[pose.phase];
        solarBeacon.visible=p<.38;solarBeacon.children.forEach(child=>{if(child.material?.uniforms?.uOpacity)child.material.uniforms.uOpacity.value=pose.beaconOpacity;});
      },
      complete(){
        delete document.body.dataset.flightPhase;planetRoot.visible=true;earthOpacity(1);
        warpMaterial.uniforms.uOpacity.value=0;galaxyOpacity(0);solarBeacon.visible=false;henanBeacon.visible=true;henanRing.visible=true;
        province.group.visible=true;province.boundary.material.uniforms.uOpacity.value=.28;province.surface.material.uniforms.uOpacity.value=.06;
        travelling(false);showStage('earth');
      }
    };
  }
  function startHenan(){
    if(!ready||busy||phase!=='earth')return;cancelPointer();planetSpin.updateMatrixWorld(true);const q=planetSpin.getWorldQuaternion(new T.Quaternion()),surface=planetSpin.localToWorld(henanSurface.clone()),normal=henanNormal.clone().applyQuaternion(q).normalize(),east=geo(H.lon+90,0,1).applyQuaternion(q).normalize(),north=new T.Vector3().crossVectors(normal,east).normalize();
    const s=Math.max(1,.72/aspect),to=surface.clone().addScaledVector(normal,.35*s).addScaledVector(east,.33*s).addScaledVector(north,-.32*s),focus=surface.clone().addScaledVector(normal,width<750?.10:.15);
    const localView=to.clone().sub(surface).applyQuaternion(planetSpin.getWorldQuaternion(new T.Quaternion()).invert()).applyQuaternion(cakeMount.quaternion.clone().invert());cake.group.rotation.y=Math.atan2(localView.x,localView.z);
    showStage('henan');travelling(true,'沿着光的方向，抵达中国河南。');
    fly(to,focus,normal,4.4,normal.clone().multiplyScalar(.5),p=>{earthOpacity(1-.97*smooth(.1,1,p));province.boundary.material.uniforms.uOpacity.value=.28+.72*p;province.surface.material.uniforms.uOpacity.value=.06+.24*p;henanBeacon.visible=p<.75;warpMaterial.uniforms.uOpacity.value=reduced?0:Math.sin(Math.PI*p)*.07;},()=>{warpMaterial.uniforms.uOpacity.value=0;henanBeacon.visible=false;henanArrivedAt=performance.now();travelling(false);showStage('cake');cake.reveal(.01);fireworks.start({camera,planetCenter:planetRoot.position,planetQuaternion:planetSpin.getWorldQuaternion(new T.Quaternion()),radius:R,focus});});
  }
  function reset(){if(!ready)return;fireworks.stop();heartWish.reset();delete canvas.dataset.wish;cake.setZoom(1);$('birthdayMascot').hidden=true;inspectionTop=false;$('viewCandles').disabled=false;$('viewCandles').textContent='俯瞰心形蜡烛 ↗';zoomLevels.galaxy=zoomLevels.earth=zoomLevels.cake=1;const cakeStart=phase==='cake'?1:0;const startOpacity=earth?.materials[0].uniforms.uOpacity.value||0;delete document.body.dataset.flightPhase;cancelPointer();azimuth=-.07;elevation=Math.asin(GalaxyReference.meta.axisRatio);const startStarsOpacity=distantStars.material.uniforms.uOpacity.value;travelling(true,'让我们，再从银河出发。');$('provinceCaption').hidden=true;fly(galaxyCamera(),new T.Vector3(),new T.Vector3(0,1,0),3,new T.Vector3(0,8,0),p=>{galaxyOpacity(smooth(.1,.9,p));distantStars.material.uniforms.uOpacity.value=startStarsOpacity+(.86-startStarsOpacity)*smooth(.1,.85,p);earthOpacity(startOpacity*(1-smooth(.08,.9,p)));cake.reveal(cakeStart*(1-p));warpMaterial.uniforms.uOpacity.value=reduced?0:Math.sin(Math.PI*p)*.12;},()=>{planetRoot.visible=false;planetRoot.scale.setScalar(1);planetSpin.quaternion.identity();cake.reveal(0);province.group.visible=false;henanBeacon.visible=true;solarBeacon.visible=true;solarBeacon.children.forEach(child=>{if(child.material?.uniforms?.uOpacity)child.material.uniforms.uOpacity.value=1;});warpMaterial.uniforms.uOpacity.value=0;galaxy.setFrozen(reduced);travelling(false);showStage('galaxy');});}
  function inspectCandles(){
    if(phase!=='cake'||busy)return;inspectionTop=!inspectionTop;
    const surface=planetSpin.localToWorld(henanSurface.clone()),normal=henanNormal.clone().applyQuaternion(planetSpin.getWorldQuaternion(new T.Quaternion())).normalize();
    const q=planetSpin.getWorldQuaternion(new T.Quaternion()),east=geo(H.lon+90,0,1).applyQuaternion(q).normalize(),north=new T.Vector3().crossVectors(normal,east).normalize(),scale=Math.max(1,.72/aspect)/zoomLevels.cake;
    let to,focus,up;
    if(inspectionTop){
      const origin=cakeMount.getWorldPosition(new T.Vector3());to=origin.clone().addScaledVector(normal,.72*scale);focus=origin.clone().addScaledVector(normal,.12);up=new T.Vector3(0,0,-1).applyQuaternion(cake.group.getWorldQuaternion(new T.Quaternion())).normalize();
    }else{to=surface.clone().addScaledVector(normal,.35*scale).addScaledVector(east,.33*scale).addScaledVector(north,-.32*scale);focus=surface.clone().addScaledVector(normal,width<750?.10:.15);up=normal;}
    busy=true;$('primaryAction').disabled=true;$('viewCandles').disabled=true;
    fly(to,focus,up,1.6,new T.Vector3(),()=>{},()=>{busy=false;$('primaryAction').disabled=false;$('viewCandles').disabled=false;});flight.fovBoost=0;
    $('viewCandles').textContent=inspectionTop?'返回蛋糕全景 ↙':'俯瞰心形蜡烛 ↗';
  }
  $('viewCandles').onclick=inspectCandles;
  function frameHeartWish(){
    camera.updateMatrixWorld();
    const scale=cake.group.getWorldScale(new T.Vector3()).x,up=new T.Vector3(0,1,0).applyQuaternion(camera.quaternion);
    const wordTop=heartWish.group.getWorldPosition(new T.Vector3()).addScaledVector(up,(.70+heartWish.group.userData.wordHeight*.5+.045)*scale).project(camera);
    const headerClearance=width<750?Math.max($('birthdayMascot').getBoundingClientRect().bottom,$('zoomControls').getBoundingClientRect().bottom)+14:0;
    const topLimit=1-2*Math.max(80,Math.min(110,height*.12),headerClearance)/height;
    if(wordTop.y<=topLimit)return;
    const old=zoomLevels.cake,next=T.MathUtils.clamp(old*topLimit/wordTop.y*.98,width<750?.6:.7,old);
    if(old-next<.01)return;
    zoomLevels.cake=next;cake.setZoom(next);$('zoomValue').textContent=Math.round(next*100)+'%';
    const to=camera.position.clone().sub(target).multiplyScalar(old/next).add(target);
    busy=true;$('primaryAction').disabled=true;$('viewCandles').disabled=true;
    fly(to,target,camera.up,reduced?.10:.75,new T.Vector3(),()=>{},()=>{busy=false;$('primaryAction').disabled=false;$('viewCandles').disabled=false;});flight.fovBoost=0;
  }
  function sendHeartWish(){if(cake.materials[0].uniforms.uProgress.value<.96)return;if(heartWish.burst()){frameHeartWish();canvas.dataset.wish=heartWish.group.userData.currentWish;toast('小苏，'+heartWish.group.userData.currentWish);}}
  function action(){if(busy||!ready)return;if(phase==='galaxy')startEarth();else if(phase==='earth')startHenan();else if(phase==='cake'){sendHeartWish();fireworks.encore();}}
  $('primaryAction').onclick=action;$('solarTarget').onclick=startEarth;$('henanTarget').onclick=startHenan;$('resetJourney').onclick=reset;$('brandHome').onclick=e=>{e.preventDefault();reset();};
  const canvas=renderer.domElement;
  const earthVelocity=new T.Vector2(),rotationUp=new T.Vector3(),rotationRight=new T.Vector3();
  const yawQuaternion=new T.Quaternion(),pitchQuaternion=new T.Quaternion();
  let suppressPinClickUntil=0;
  function spinEarth(yaw,pitch){
    rotationUp.copy(camera.up).normalize();rotationRight.set(1,0,0).applyQuaternion(camera.quaternion).normalize();
    yawQuaternion.setFromAxisAngle(rotationUp,yaw);pitchQuaternion.setFromAxisAngle(rotationRight,pitch);
    planetSpin.quaternion.premultiply(yawQuaternion).premultiply(pitchQuaternion).normalize();
    canvas.dataset.earthRotation=planetSpin.quaternion.toArray().map(v=>v.toFixed(4)).join(',');
  }
  function cancelPointer(){
    const ids=Array.from(pointers.keys());pointers.clear();pinch=null;for(const id of ids)if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
    drag=null;earthVelocity.set(0,0);document.body.classList.remove('is-rotating');
  }
  function pointerDown(e){
    if((e.isPrimary===false&&e.pointerType!=='touch')||e.button>0||busy)return;
    earthVelocity.set(0,0);
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,touch:e.pointerType==='touch'});
    const touches=[...pointers.values()].filter(p=>p.touch);
    if(touches.length>=2){
      drag=null;document.body.classList.remove('is-rotating');pinch={distance:Math.max(1,Math.hypot(touches[0].x-touches[1].x,touches[0].y-touches[1].y)),zoom:zoomForStage()};
      try{canvas.setPointerCapture(e.pointerId);}catch{}if(e.cancelable)e.preventDefault();return;
    }
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,time:performance.now(),moved:false,pin:e.currentTarget===$('henanTarget')};
    try{canvas.setPointerCapture(e.pointerId);}catch{}
    if(e.cancelable)e.preventDefault();
  }
  function pointerMove(e){
    if(pointers.has(e.pointerId)){const point=pointers.get(e.pointerId);point.x=e.clientX;point.y=e.clientY;}
    if(pinch){const touches=[...pointers.values()].filter(p=>p.touch);if(touches.length>=2){const distance=Math.hypot(touches[0].x-touches[1].x,touches[0].y-touches[1].y);setZoom(pinch.zoom*distance/pinch.distance);if(e.cancelable)e.preventDefault();}return;}
    if(!drag||e.pointerId!==drag.id||busy)return;
    const dx=e.clientX-drag.lastX,dy=e.clientY-drag.lastY;
    if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>5)drag.moved=true;
    if(drag.moved){
      if(phase==='galaxy'){azimuth-=dx*.004;elevation=T.MathUtils.clamp(elevation+dy*.003,.26,1.15);}
      else if(phase==='earth'){
        document.body.classList.add('is-rotating');const sensitivity=mobile?.008:.0065;
        spinEarth(dx*sensitivity,dy*sensitivity);
        earthVelocity.set(T.MathUtils.clamp(dx*sensitivity,-.06,.06)*.35,T.MathUtils.clamp(dy*sensitivity,-.06,.06)*.35);
      }else if(phase==='cake')cake.group.rotation.y+=dx*.007;
    }
    drag.lastX=e.clientX;drag.lastY=e.clientY;drag.time=performance.now();
  }
  function pointerUp(e){
    pointers.delete(e.pointerId);
    if(pinch){
      if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
      const remaining=[...pointers.entries()].filter(([,p])=>p.touch);earthVelocity.set(0,0);
      if(remaining.length<2){pinch=null;drag=remaining.length?{id:remaining[0][0],x:remaining[0][1].x,y:remaining[0][1].y,lastX:remaining[0][1].x,lastY:remaining[0][1].y,time:performance.now(),moved:true,pin:false}:null;}
      return;
    }
    if(!drag||e.pointerId!==drag.id)return;
    const previous=drag;drag=null;document.body.classList.remove('is-rotating');
    if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    if(previous.moved){suppressPinClickUntil=performance.now()+450;if(performance.now()-previous.time>100)earthVelocity.set(0,0);return;}
    earthVelocity.set(0,0);if(busy)return;
    if(previous.pin&&phase==='earth'){suppressPinClickUntil=performance.now()+300;startHenan();return;}
    pointer.set(e.clientX/width*2-1,1-e.clientY/height*2);raycaster.setFromCamera(pointer,camera);
    if(phase==='galaxy'){
      if(raycaster.intersectObject(solarProxy,true).length){startEarth();return;}
      const n=new T.Vector3(0,1,0).applyQuaternion(galaxy.group.quaternion),plane=new T.Plane().setFromNormalAndCoplanarPoint(n,galaxy.group.position),p=raycaster.ray.intersectPlane(plane,new T.Vector3());
      if(p)galaxy.impulse(galaxy.group.worldToLocal(p),(performance.now()-startedAt)/1000);
    }else if(phase==='earth'&&raycaster.intersectObject(henanProxy,true).length)startHenan();else if(phase==='cake'){if(raycaster.intersectObject(cakeHit,true).length)sendHeartWish();fireworks.encore(e.clientX,e.clientY);}
  }
  canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',cancelPointer);
  canvas.addEventListener('lostpointercapture',e=>{if(pointers.has(e.pointerId)&&!pinch)cancelPointer();});window.addEventListener('blur',cancelPointer);
  $('henanTarget').addEventListener('pointerdown',pointerDown);
  $('henanTarget').onclick=e=>{if(e.detail&&performance.now()<suppressPinClickUntil){e.preventDefault();return;}startHenan();};
  $('rotateEarthLeft').onclick=()=>{if(phase==='earth'&&!busy){earthVelocity.set(0,0);spinEarth(-.28,0);}};
  $('rotateEarthRight').onclick=()=>{if(phase==='earth'&&!busy){earthVelocity.set(0,0);spinEarth(.28,0);}};
  canvas.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){e.preventDefault();action();}
    else if(e.key==='Escape'){e.preventDefault();reset();}
    else if(!busy&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
      e.preventDefault();const horizontal=e.key==='ArrowLeft'?-.14:e.key==='ArrowRight'?.14:0,vertical=e.key==='ArrowUp'?-.14:e.key==='ArrowDown'?.14:0;
      if(phase==='galaxy'){azimuth+=horizontal;elevation=T.MathUtils.clamp(elevation+vertical,.26,1.15);}else if(phase==='earth'){earthVelocity.set(0,0);spinEarth(horizontal,vertical);}else if(phase==='cake')cake.group.rotation.y+=horizontal;
    }
  });
  function projectSolar(){
    const button=$('solarTarget'),anchor=$('solarAnchor'),guide=$('solarGuide');
    button.style.opacity=busy?'0':'1';button.style.pointerEvents=busy?'none':'auto';
    const p=solarBeacon.position.clone().project(camera),on=!busy&&p.z>-1&&p.z<1&&Math.abs(p.x)<.98&&Math.abs(p.y)<.98;
    anchor.style.opacity=guide.style.opacity=on?'1':'0';if(!on)return;
    const x=(p.x*.5+.5)*width,y=(.5-.5*p.y)*height;anchor.style.left=x+'px';anchor.style.top=y+'px';
    const box=button.getBoundingClientRect(),sx=box.left+box.width*.5,sy=box.bottom+6,dx=x-sx,dy=y-sy,length=Math.max(1,Math.hypot(dx,dy)),ex=x-dx/length*36,ey=y-dy/length*36;
    guide.setAttribute('viewBox','0 0 '+width+' '+height);
    $('solarGuidePath').setAttribute('d','M '+sx+' '+sy+' C '+sx+' '+(sy+30)+' '+ex+' '+(ey-35)+' '+ex+' '+ey);
  }
  function projectTarget(element,world,visible){if(element.hidden||!visible){element.style.opacity='0';element.style.pointerEvents='none';return;}const p=world.clone().project(camera),on=p.z>-1&&p.z<1&&Math.abs(p.x)<1.1&&Math.abs(p.y)<1.1;element.style.opacity=on?'1':'0';element.style.pointerEvents=on&&!busy?'auto':'none';const x=T.MathUtils.clamp((p.x*.5+.5)*width,23,width-23),y=T.MathUtils.clamp((-.5*p.y+.5)*height,140,height-180);element.style.left=x+'px';element.style.top=y+'px';element.classList.toggle('flip',x>width*.56);}
  function resize(){const oldAspect=aspect;width=innerWidth;height=innerHeight;aspect=width/height;renderer.setPixelRatio(Math.min(devicePixelRatio||1,width<750?1.5:1.8));renderer.setSize(width,height,false);if(!busy&&phase==='earth'){const direction=camera.position.clone().sub(planetRoot.position).normalize();camera.position.copy(planetRoot.position).addScaledVector(direction,earthDistance());}else if(!busy&&phase==='cake'){const ratio=Math.max(1,.72/aspect)/Math.max(1,.72/oldAspect);camera.position.sub(target).multiplyScalar(ratio).add(target);}camera.aspect=aspect;camera.updateProjectionMatrix();const dpr=renderer.getPixelRatio();cakeBloom?.resize(width,height,dpr);galaxy.resize(height,dpr);cake.resize(height,dpr);heartWish.resize(height,dpr);fireworks.resize(height,dpr);earth?.resize(height,dpr);pointMaterials.forEach(m=>m.uniforms.uHeight.value=height*dpr);tunnel.resize(height,dpr);if(phase==='galaxy'&&!busy){camera.position.copy(galaxyCamera());target.set(0,0,0);camera.up.set(0,1,0);camera.lookAt(target);}}
  $('zoomIn').onclick=()=>setZoom(zoomForStage()*1.2);$('zoomOut').onclick=()=>setZoom(zoomForStage()/1.2);$('zoomReset').onclick=()=>setZoom(1);
  $('universe').addEventListener('wheel',e=>{if(e.cancelable)e.preventDefault();if(!busy)setZoom(zoomForStage()*Math.exp(-e.deltaY*(e.ctrlKey?.006:.0012)));},{passive:false});
  addEventListener('resize',resize);canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(animation);fail(Error('WebGL context lost'));});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(animation);animation=0;}else{lastTime=performance.now();if(!animation)animation=requestAnimationFrame(frame);}});
  function frame(now){animation=0;if(document.hidden)return;const dt=Math.min((now-lastTime)/1000,.04),t=(now-startedAt)/1000;lastTime=now;galaxy.update(reduced?0:t,dt);earth?.update(reduced?0:t,dt);cake.update(reduced?0:t,dt);heartWish.update(t,dt);if(canvas.dataset.heartStage!==heartWish.group.userData.stage)canvas.dataset.heartStage=heartWish.group.userData.stage;tunnel.update(t,dt);fireworks.update(t,dt);
    if(phase==='galaxy'&&!busy){camera.position.lerp(orbitPoint.copy(galaxyCamera()),.09);target.set(0,0,0);galaxy.group.updateMatrixWorld(true);galaxy.group.localToWorld(solarWorld.copy(galaxy.solarPosition));solarBeacon.position.copy(solarWorld);planetRoot.position.copy(solarWorld);solarBeacon.quaternion.copy(camera.quaternion);solarRing.rotation.z=reduced?0:t*.11;}
    if(flight){
      const f=flight,p=Math.min(1,(now-f.start)/(f.duration*1000)),e=ease(p);
      if(f.firstPerson){const pose=f.firstPerson.sample(p);camera.position.copy(pose.position);target.copy(pose.target);camera.up.copy(pose.up);camera.fov=reduced?46:pose.fov;f.update(p,pose);}
      else{f.curve.getPoint(e,camera.position);target.lerpVectors(f.fromTarget,f.toTarget,e);camera.up.lerpVectors(f.fromUp,f.toUp,e).normalize();camera.fov=46+(reduced?0:Math.sin(Math.PI*p)*f.fovBoost);f.update(p);}
      camera.updateProjectionMatrix();if(p>=1){flight=null;camera.fov=46;camera.updateProjectionMatrix();f.complete();}
    }
    if(phase==='cake'&&!busy){const reveal=T.MathUtils.clamp((now-henanArrivedAt)/(reduced?1200:5400),0,1);canvas.dataset.cakeFormation=reveal<.18?'cloud':reveal<.96?'gathering':'ready';cake.reveal(reveal);const canWish=reveal>=.96;$('primaryAction').disabled=!canWish;$('viewCandles').disabled=!canWish;const cue=canWish?content.cake.action:'星光正在汇聚';if($('actionText').textContent!==cue)$('actionText').textContent=cue;province.boundary.material.uniforms.uOpacity.value=1-.62*reveal;province.surface.material.uniforms.uOpacity.value=.3-.23*reveal;henanRing.visible=false;}
    if(phase==='earth'&&!busy&&!drag&&earthVelocity.lengthSq()>.0000002){spinEarth(earthVelocity.x*dt*60,earthVelocity.y*dt*60);earthVelocity.multiplyScalar(Math.pow(.90,dt*60));}
    camera.lookAt(target);
    if(flight?.firstPerson)tunnel.aimAt(flight.firstPerson.destination,camera);else tunnel.resetAim();
    scene.updateMatrixWorld(true);
    if(phase==='galaxy')projectSolar();
    if(phase==='earth'){const p=planetSpin.localToWorld(henanSurface.clone()),n=henanNormal.clone().applyQuaternion(planetSpin.getWorldQuaternion(new T.Quaternion()));projectTarget($('henanTarget'),p,n.dot(camera.position.clone().sub(p).normalize())>.04&&!busy);henanRing.rotation.z=reduced?0:t*.3;}
    if(phase==='cake'&&cakeBloom)cakeBloom.render(renderer,scene,camera);else renderer.render(scene,camera);animation=requestAnimationFrame(frame);
  }
  resize();showStage('galaxy');animation=requestAnimationFrame(frame);
  const embedded=$('embeddedGeography');
  const geography=embedded?Promise.resolve().then(()=>{const d=JSON.parse(embedded.textContent);return[d.land,d.henan];}):Promise.all([fetch('assets/world-land.geojson').then(r=>{if(!r.ok)throw Error('World geography unavailable');return r.json();}),fetch('assets/henan.geojson').then(r=>{if(!r.ok)throw Error('Henan geography unavailable');return r.json();})]);
  geography.then(([land,henan])=>{if(!window.ParticleEarth)throw Error('Particle Earth unavailable');earth=ParticleEarth.create(T,{mobile,radius:R,landGeoJSON:land});planetSpin.add(earth.group);province=buildProvince(henan);if(!province.contains)throw Error('Henan anchor outside province');resize();ready=true;showStage('galaxy');$('loadingScreen').classList.add('ready');document.documentElement.dataset.ready='true';}).catch(fail);
})();
