/* Small pink hearts rise from the cake, then gather into one birthday wish. */
(() => {
  'use strict';
  const WISHES=Object.freeze(['天天开心','永远18岁！','平安幸福','万事顺遂','前程似锦','得偿所愿','岁岁无忧','熠熠生辉']);
  const vertex=`
    uniform float uAge,uDpr,uReduced;
    attribute vec3 aStart,aCloud,aScatter,aColor;
    attribute float aDelay,aPhase,aSize,aLeader;
    varying vec3 vColor;
    varying float vAlpha,vTurn;
    float easeOut(float t){return 1.-pow(1.-clamp(t,0.,1.),3.);}
    void main(){
      float localAge=max(0.,uAge-aDelay);
      float rising=easeOut(localAge/2.65);
      float forming=smoothstep(2.05+aDelay*.20,4.00+aDelay*.14,uAge);
      float dispersing=smoothstep(7.5,10.4,uAge);
      vec3 floating=mix(aStart,aCloud,rising);
      floating.y+=sin(rising*3.14159265)*.12;
      floating.x+=sin(localAge*1.45+aPhase)*.075*sin(rising*3.14159265);
      vec3 p=mix(floating,position,forming);
      p.x+=sin(uAge*.8+aPhase)*.0015*forming;
      p.y+=sin(uAge*.95)*.008*forming;
      p+=aScatter*dispersing;
      float appear=smoothstep(aDelay,aDelay+.32,uAge);
      appear*=mix(smoothstep(1.25,2.25,uAge),1.,aLeader);
      float fade=1.-smoothstep(8.5,10.4,uAge);
      float size=mix(mix(3.7,aSize,aLeader),3.5+aSize*.055,forming);
      vTurn=(1.-forming)*sin(uAge*1.25+aPhase)*.22;
      if(uReduced>.5){
        p=position;
        size=3.5+aSize*.055;
        appear=smoothstep(0.,.45,uAge);
        fade=1.-smoothstep(6.5,8.0,uAge);
        vTurn=0.;
      }
      vec4 mv=modelViewMatrix*vec4(p,1.);
      gl_Position=projectionMatrix*mv;
      gl_PointSize=clamp(size*uDpr,2.8*uDpr,11.*uDpr);
      vAlpha=appear*fade*.94;
      vColor=aColor;
    }`;
  const fragment=`
    varying vec3 vColor;
    varying float vAlpha,vTurn;
    void main(){
      if(vAlpha<.002)discard;
      vec2 q=gl_PointCoord*2.-1.;
      q.y=-q.y;
      float cs=cos(vTurn),sn=sin(vTurn);
      q=mat2(cs,-sn,sn,cs)*q;
      q*=vec2(1.22,1.28);
      q.y+=.10;
      float circle=dot(q,q)-1.;
      float field=circle*circle*circle-q.x*q.x*q.y*q.y*q.y;
      if(field>.065)discard;
      float edge=1.-smoothstep(-.035,.065,field);
      float shine=exp(-dot(q-vec2(-.28,.46),q-vec2(-.28,.46))*12.);
      vec3 color=vColor*(.91+.12*smoothstep(-.8,.8,q.y));
      color+=vec3(.50,.28,.32)*shine*.24;
      gl_FragColor=vec4(color,edge*vAlpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;

  function create(T,options={}){
    if(!T||!T.BufferGeometry)throw new Error('HeartWish requires THREE');
    const mobile=!!options.mobile,reduced=!!options.reducedMotion;
    const group=new T.Group();group.name='Cake hearts · birthday wishes';
    group.position.y=1.65;group.visible=false;
    const limit=mobile?680:850;
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;
    const context=canvas.getContext('2d',{willReadFrequently:true});
    if(!context)throw new Error('HeartWish requires a Canvas 2D text sampler');
    function sampleText(text){
      context.clearRect(0,0,canvas.width,canvas.height);
      let fontSize=144;
      const font=()=>`700 ${fontSize}px "Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif`;
      context.font=font();
      const measured=context.measureText(text).width;
      if(measured>696){fontSize*=696/measured;context.font=font();}
      context.fillStyle='#ffffff';context.textAlign='center';context.textBaseline='middle';
      context.fillText(text,canvas.width/2,canvas.height/2+2);
      const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
      let left=canvas.width,right=0,top=canvas.height,bottom=0;
      for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
        if(pixels[(y*canvas.width+x)*4+3]<140)continue;
        left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      }
      if(right<=left||bottom<=top)throw new Error('Cannot sample birthday wish characters');
      let samples=[];
      function collect(step){
        const result=[];
        for(let y=top+step*.5;y<=bottom;y+=step)for(let x=left+step*.5;x<=right;x+=step){
          if(pixels[(Math.round(y)*canvas.width+Math.round(x))*4+3]>140)result.push([x,y]);
        }
        return result;
      }
      samples=collect(mobile?6:5.4);
      if(samples.length<320)samples=collect(mobile?5:4.5);
      if(samples.length>limit){
        const source=samples;samples=[];
        for(let i=0;i<limit;i++)samples.push(source[Math.floor(i*source.length/limit)]);
      }
      const result=new Float32Array(samples.length*3),scale=1.80/(right-left);
      for(let i=0;i<samples.length;i++){
        result[i*3]=(samples[i][0]-(left+right)/2)*scale;
        result[i*3+1]=.70+((top+bottom)/2-samples[i][1])*scale;
        result[i*3+2]=0;
      }
      return {text,targets:result,count:samples.length,width:1.8,height:(bottom-top)*scale};
    }
    // All eight system-font masks are cached locally; no remote font or image.
    const layouts=WISHES.map(sampleText),poolSize=Math.max(...layouts.map(layout=>layout.count));
    const positions=new Float32Array(poolSize*3),starts=new Float32Array(poolSize*3),clouds=new Float32Array(poolSize*3),scatter=new Float32Array(poolSize*3),colors=new Float32Array(poolSize*3);
    const delays=new Float32Array(poolSize),phases=new Float32Array(poolSize),sizes=new Float32Array(poolSize),leaders=new Float32Array(poolSize);
    const palette=['#ff78a7','#ff9dbd','#ffc4d5','#ff819e'].map(color=>new T.Color(color).multiplyScalar(1.35));
    let seed=220110;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
    for(let i=0;i<poolSize;i++){
      const p=i*3,angle=random()*Math.PI*2,radius=Math.sqrt(random())*.45;
      starts[p]=Math.cos(angle)*radius;starts[p+1]=-.065+random()*.08;starts[p+2]=Math.sin(angle)*radius*.55;
      clouds[p]=(random()-.5)*2.0;clouds[p+1]=.42+random()*.70;clouds[p+2]=(random()-.5)*.30;
      scatter[p]=(random()-.5)*1.10;scatter[p+1]=.35+random()*.85;scatter[p+2]=(random()-.5)*.60;
      delays[i]=random()*1.30;phases[i]=random()*Math.PI*2;sizes[i]=6.5+random()*3.5;leaders[i]=i%6===0?1:0;
      const color=palette[i%palette.length];colors[p]=color.r;colors[p+1]=color.g;colors[p+2]=color.b;
    }
    const geometry=new T.BufferGeometry();
    function attr(name,array,size){geometry.setAttribute(name,new T.BufferAttribute(array,size));}
    attr('position',positions,3);attr('aStart',starts,3);attr('aCloud',clouds,3);attr('aScatter',scatter,3);attr('aColor',colors,3);
    attr('aDelay',delays,1);attr('aPhase',phases,1);attr('aSize',sizes,1);attr('aLeader',leaders,1);
    geometry.attributes.position.setUsage(T.DynamicDrawUsage);geometry.setDrawRange(0,0);
    const uniforms={uAge:{value:0},uDpr:{value:Math.min(window.devicePixelRatio||1,2)},uReduced:{value:reduced?1:0}};
    const material=new T.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment,transparent:true,blending:T.NormalBlending,depthTest:false,depthWrite:false,toneMapped:true});
    const points=new T.Points(geometry,material);points.name='Floating hearts become a wish';points.frustumCulled=false;points.renderOrder=16;group.add(points);
    const cameraQuaternion=new T.Quaternion(),parentQuaternion=new T.Quaternion();
    points.onBeforeRender=(renderer,scene,camera)=>{
      camera.getWorldQuaternion(cameraQuaternion);
      if(group.parent){group.parent.getWorldQuaternion(parentQuaternion);group.quaternion.copy(parentQuaternion).invert().multiply(cameraQuaternion);}
      else group.quaternion.copy(cameraQuaternion);
      group.updateWorldMatrix(false,true);
    };
    let active=false,age=0,lastIndex=-1,disposed=false;
    group.userData={active:false,stage:'idle',age:0,count:0,poolSize,wishCount:WISHES.length,text:'',currentWish:'',wishes:[...WISHES]};
    function reset(){active=false;age=0;group.visible=false;uniforms.uAge.value=0;Object.assign(group.userData,{active:false,stage:'idle',age:0});}
    return {
      group,
      burst(text){
        if(disposed)return false;
        const forced=typeof text==='string';
        if(!forced&&active&&age<.55)return false;
        let index;
        if(forced){index=WISHES.indexOf(text);if(index<0)return false;}
        else {index=Math.floor(Math.random()*(WISHES.length-(lastIndex>=0?1:0)));if(lastIndex>=0&&index>=lastIndex)index++;}
        lastIndex=index;const layout=layouts[index];
        positions.fill(0);positions.set(layout.targets);geometry.attributes.position.needsUpdate=true;geometry.setDrawRange(0,layout.count);
        age=0;active=true;group.visible=true;uniforms.uAge.value=0;
        Object.assign(group.userData,{active:true,stage:reduced?'forming':'rising',age:0,count:layout.count,text:layout.text,currentWish:layout.text,wordWidth:layout.width,wordHeight:layout.height});
        return true;
      },
      update(t,dt){
        if(!active||disposed)return;
        age+=Number.isFinite(dt)?Math.max(0,Math.min(.10,dt)):1/60;
        if(age>=(reduced?8:10.4)){reset();return;}
        uniforms.uAge.value=age;
        const stage=reduced?(age<.45?'forming':age<6.5?'holding':'dispersing'):age<2.05?'rising':age<4.2?'forming':age<7.5?'holding':'dispersing';
        Object.assign(group.userData,{active:true,stage,age});
      },
      reset,
      resize(h,dpr){if(h&&typeof h==='object')dpr=h.pixelRatio;if(Number.isFinite(dpr)&&dpr>0)uniforms.uDpr.value=Math.min(dpr,2);},
      dispose(){if(disposed)return;reset();disposed=true;geometry.dispose();material.dispose();group.clear();}
    };
  }
  window.HeartWish=Object.freeze({create,wishes:WISHES});
})();
