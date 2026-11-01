/* The user's chosen cream-cake illustration, revealed over the 3D celebration. */
(() => {
  'use strict';
  function create(T){
    const group=new T.Group(),hero=document.getElementById('creamCakeHero');
    group.name='Cream cake geographic anchor';let visible=false;
    return {group,materials:[],
      update(){},
      reveal(progress){const value=Math.max(0,Math.min(1,Number(progress)||0));visible=value>0;hero.hidden=!visible;hero.style.opacity=String(Math.min(1,value*1.8));hero.style.setProperty('--cake-reveal',String(.93+.07*value));},
      setZoom(value){hero.style.setProperty('--cake-zoom',String(value));},
      burst(){},resize(){},
      dispose(){hero.hidden=true;group.clear();}
    };
  }
  window.CreamCake=Object.freeze({create});
})();
