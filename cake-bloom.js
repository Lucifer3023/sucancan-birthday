/* A restrained, transparent bloom pass for the birthday scene only.
 * The base stays full resolution; only light above the reference's .9 threshold
 * is blurred. The opening galaxy and the Canvas fireworks are not processed.
 */
(() => {
  'use strict';
  function create(T, options = {}) {
    const mobile = !!options.mobile;
    const vertex = `varying vec2 vUv;
      void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute([-1,-1,0, 3,-1,0, -1,3,0],3));
    geometry.setAttribute('uv', new T.Float32BufferAttribute([0,0, 2,0, 0,2],2));
    const screen = new T.Scene(), camera = new T.Camera();
    function material(fragmentShader, uniforms, toneMapped=false) {
      return new T.ShaderMaterial({vertexShader:vertex,fragmentShader,uniforms,
        depthTest:false,depthWrite:false,blending:T.NoBlending,toneMapped});
    }
    const bright = material(`uniform sampler2D uInput; varying vec2 vUv;
      void main(){vec3 c=texture2D(uInput,vUv).rgb;
        float luminance=dot(c,vec3(.2126,.7152,.0722));
        float gate=smoothstep(.9,1.1,luminance);
        gl_FragColor=vec4(c*gate,0.);}`,{uInput:{value:null}});
    const blur = material(`uniform sampler2D uInput;uniform vec2 uStep;varying vec2 vUv;
      void main(){vec3 c=texture2D(uInput,vUv).rgb*.227027027;
        c+=(texture2D(uInput,vUv+uStep*1.384615385).rgb+texture2D(uInput,vUv-uStep*1.384615385).rgb)*.316216216;
        c+=(texture2D(uInput,vUv+uStep*3.230769231).rgb+texture2D(uInput,vUv-uStep*3.230769231).rgb)*.070270270;
        gl_FragColor=vec4(c,0.);}`,{uInput:{value:null},uStep:{value:new T.Vector2()}});
    const compose = material(`uniform sampler2D uBase,uSmall,uWide;varying vec2 vUv;
      void main(){vec4 base=texture2D(uBase,vUv);
        vec3 light=texture2D(uSmall,vUv).rgb*.74+texture2D(uWide,vUv).rgb*.26;
        gl_FragColor=vec4(base.rgb+light*.62,base.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        // Canvas uses premultiplied alpha. Derive coverage from the visible
        // light, rather than putting an opaque black rectangle over fireworks.
        float coverage=max(gl_FragColor.r,max(gl_FragColor.g,gl_FragColor.b));
        gl_FragColor.a=clamp(max(base.a,coverage),0.,1.);
      }`,{uBase:{value:null},uSmall:{value:null},uWide:{value:null}},true);
    const triangle = new T.Mesh(geometry, bright);triangle.frustumCulled=false;screen.add(triangle);
    function target(depth=false) {
      return new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,
        minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:depth,
        stencilBuffer:false,generateMipmaps:false});
    }
    const base=target(true), brightTarget=target(), ping=target(), small=target(), widePing=target(), wide=target();
    base.samples=mobile?0:2;
    const color=new T.Color(), viewport=new T.Vector4(), scissor=new T.Vector4();
    let width=1,height=1,disposed=false;
    function resize(w,h,dpr=1) {
      width=Math.max(1,Math.round(w*dpr));height=Math.max(1,Math.round(h*dpr));
      base.setSize(width,height);
      const halfW=Math.max(1,Math.ceil(width/2)),halfH=Math.max(1,Math.ceil(height/2));
      brightTarget.setSize(halfW,halfH);ping.setSize(halfW,halfH);small.setSize(halfW,halfH);
      const quarterW=Math.max(1,Math.ceil(width/4)),quarterH=Math.max(1,Math.ceil(height/4));
      widePing.setSize(quarterW,quarterH);wide.setSize(quarterW,quarterH);
    }
    function draw(renderer, pass, destination) {
      triangle.material=pass;renderer.setRenderTarget(destination);renderer.render(screen,camera);
    }
    function render(renderer, scene, viewCamera) {
      if(disposed){renderer.render(scene,viewCamera);return;}
      const previousTarget=renderer.getRenderTarget(),autoClear=renderer.autoClear;
      const alpha=renderer.getClearAlpha();renderer.getClearColor(color);
      renderer.getViewport(viewport);renderer.getScissor(scissor);
      const scissorTest=renderer.getScissorTest();
      try {
        renderer.autoClear=true;renderer.setScissorTest(false);renderer.setClearColor(0,0);
        renderer.setRenderTarget(base);renderer.render(scene,viewCamera);
        bright.uniforms.uInput.value=base.texture;draw(renderer,bright,brightTarget);
        blur.uniforms.uInput.value=brightTarget.texture;blur.uniforms.uStep.value.set(1.4/brightTarget.width,0);draw(renderer,blur,ping);
        blur.uniforms.uInput.value=ping.texture;blur.uniforms.uStep.value.set(0,1.4/ping.height);draw(renderer,blur,small);
        blur.uniforms.uInput.value=small.texture;blur.uniforms.uStep.value.set(2.1/small.width,0);draw(renderer,blur,widePing);
        blur.uniforms.uInput.value=widePing.texture;blur.uniforms.uStep.value.set(0,2.1/widePing.height);draw(renderer,blur,wide);
        compose.uniforms.uBase.value=base.texture;compose.uniforms.uSmall.value=small.texture;compose.uniforms.uWide.value=wide.texture;
        draw(renderer,compose,previousTarget);
      } finally {
        renderer.setRenderTarget(previousTarget);renderer.setClearColor(color,alpha);renderer.autoClear=autoClear;
        renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);
      }
    }
    return {resize,render,dispose(){if(disposed)return;disposed=true;
      [base,brightTarget,ping,small,widePing,wide].forEach(t=>t.dispose());
      [bright,blur,compose].forEach(m=>m.dispose());geometry.dispose();screen.clear();}};
  }
  window.CakeBloom=Object.freeze({create});
})();
