/* The supplied galaxy reference reconstructed as a volumetric, rotatable point field. */
(() => {
  'use strict';
  const vertex=`
    attribute vec3 aColor;attribute float aSize;attribute float aAlpha;attribute float aPhase;
    uniform float uTime;uniform float uHeight;uniform float uRatio;uniform float uSizeBoost;uniform float uMaxPoint;
    uniform vec3 uImpulse;uniform float uImpulseTime;
    varying vec3 vColor;varying float vAlpha;varying float vSpark;
    void main(){
      vec3 p=position;float age=uTime-uImpulseTime;
      if(age>0.&&age<1.8){vec2 d=p.xz-uImpulse.xz;float r=length(d);float wave=exp(-pow((r-age*8.)/1.5,2.))*exp(-age*2.2);p.xz+=d/max(r,.01)*wave*.65;p.y+=sin(age*12.-r)*wave*.22;}
      vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
      gl_PointSize=clamp(aSize*uSizeBoost*uHeight/max(.6,-mv.z),1.7*uRatio,uMaxPoint);
      vColor=aColor;vSpark=step(.17,aSize);vAlpha=aAlpha*(.90+.10*sin(uTime*.7+aPhase*20.));
    }`;
  const fragment=`
    uniform float uOpacity;uniform float uBrightness;uniform float uLayerAlpha;uniform float uFog;
    varying vec3 vColor;varying float vAlpha;varying float vSpark;
    void main(){
      vec2 p=gl_PointCoord*2.-1.;float r=dot(p,p);if(r>1.)discard;
      float core=exp(-r*13.);float halo=exp(-r*3.4)*.25;
      float spikes=(exp(-abs(p.x)*70.-abs(p.y)*7.)+exp(-abs(p.y)*70.-abs(p.x)*7.))*.19*vSpark;
      float shape=mix(core+halo+spikes,exp(-r*3.2)*.55,uFog)*(1.-smoothstep(.7,1.,r));
      vec3 color=pow(vColor,vec3(1.12))*(.91+.09*vSpark);
      gl_FragColor=vec4(color,shape*vAlpha*uLayerAlpha*uOpacity*uBrightness);
    }`;
  function create(T,options={}){
    const source=window.GalaxyReference;
    if(!source?.data)throw Error('Galaxy point reference missing');
    const raw=atob(source.data),buffer=new ArrayBuffer(raw.length),bytes=new Uint8Array(buffer);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    const view=new DataView(buffer),total=view.getUint32(4,true),record=view.getUint32(8,true),scale=view.getFloat32(12,true);
    const mobile=!!options.mobile,count=Math.min(total,mobile?120000:240000),fogCount=mobile?12000:26000;
    const meta=source.meta,group=new T.Group(),disk=new T.Group();group.add(disk);group.name='Reference galaxy — volumetric light particles';
    const elevation=Math.asin(meta.axisRatio),normal=new T.Vector3(Math.sin(-.07)*Math.cos(elevation),Math.sin(elevation),Math.cos(-.07)*Math.cos(elevation));
    group.quaternion.setFromAxisAngle(normal,meta.positionAngle);
    const materials=[],geometries=[];let yaw=0,elapsed=0,frozen=false;
    function layer(n,fog){
      const positions=new Float32Array(n*3),colors=new Float32Array(n*3),sizes=new Float32Array(n),alphas=new Float32Array(n),phases=new Float32Array(n);
      for(let i=0;i<n;i++){
        const index=Math.floor(i*total/n),p=16+index*record,j=i*3;
        positions[j]=view.getInt16(p,true)/scale;positions[j+1]=view.getInt16(p+2,true)/scale;positions[j+2]=view.getInt16(p+4,true)/scale;
        colors[j]=bytes[p+6]/255;colors[j+1]=bytes[p+7]/255;colors[j+2]=bytes[p+8]/255;
        const k=bytes[p+9]/255;sizes[i]=fog?.45+k*.7:.055+k*k*.28;
        alphas[i]=(bytes[p+10]/255)*(fog?.10:1);phases[i]=bytes[p+11]/255;
      }
      const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('aColor',new T.BufferAttribute(colors,3));geometry.setAttribute('aSize',new T.BufferAttribute(sizes,1));geometry.setAttribute('aAlpha',new T.BufferAttribute(alphas,1));geometry.setAttribute('aPhase',new T.BufferAttribute(phases,1));geometry.boundingSphere=new T.Sphere(new T.Vector3(),35);geometries.push(geometry);
      const material=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:{uTime:{value:0},uHeight:{value:1000},uRatio:{value:1},uSizeBoost:{value:fog?1:2.35},uMaxPoint:{value:fog?50:25},uOpacity:{value:1},uBrightness:{value:fog?1.15:1.9},uLayerAlpha:{value:fog?.72:.68},uFog:{value:fog?1:0},uImpulse:{value:new T.Vector3(999,999,999)},uImpulseTime:{value:-99}},transparent:true,depthWrite:false,blending:T.NormalBlending,toneMapped:false});materials.push(material);
      const points=new T.Points(geometry,material);points.name=fog?'Colored stellar haze':'Sampled spatial stars';points.renderOrder=fog?1:2;disk.add(points);return points;
    }
    const dust=layer(fogCount,true),stars=layer(count,false),solarBase=new T.Vector3(...meta.solarPosition),solarPosition=solarBase.clone();
    const yAxis=new T.Vector3(0,1,0);
    return {group,materials,solarPosition,stars,dust,radius:30,referenceMeta:meta,
      update(time,delta=0){elapsed=Number.isFinite(time)?time:elapsed+delta;if(!frozen)yaw+=Math.min(.1,Math.max(0,delta))*.012;disk.rotation.y=yaw;solarPosition.copy(solarBase).applyAxisAngle(yAxis,yaw);materials.forEach(m=>m.uniforms.uTime.value=elapsed);},
      resize(height,ratio=1){ratio=Math.min(2,ratio);materials.forEach(m=>{m.uniforms.uHeight.value=height*ratio;m.uniforms.uRatio.value=ratio;m.uniforms.uMaxPoint.value=(m.uniforms.uFog.value?mobile?32:45:mobile?18:27)*ratio;});},
      impulse(point,time=elapsed){const p=point.clone().applyAxisAngle(yAxis,-yaw);materials.forEach(m=>{m.uniforms.uImpulse.value.copy(p);m.uniforms.uImpulseTime.value=time;});},
      setFrozen(value=true){frozen=!!value;},
      dispose(){materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());group.clear();}
    };
  }
  window.GalaxyScene=Object.freeze({create});
})();
