/* A continuous push-in with a gradual handoff from the galaxy to Earth. */
(() => {
  'use strict';
  const clamp=x=>Math.max(0,Math.min(1,x));
  const ease=p=>p*p*p*(p*(p*6-15)+10);
  const smooth=(a,b,p)=>{const x=clamp((p-a)/(b-a));return x*x*(3-2*x);};
  function create(T,{from,fromTarget,anchor,up,endDistance,framingOffset=0,localFront,localSpaceDepth=54}){
    const origin=from.clone(),waypoint=anchor.clone(),view=origin.clone().sub(waypoint).normalize();
    const destination=waypoint.clone().addScaledVector(view,-localSpaceDepth);
    const initialDirection=fromTarget.clone().sub(origin).normalize();
    const aimTurn=new T.Quaternion().setFromUnitVectors(initialDirection,view.clone().negate());
    const screenUp=up.clone().addScaledVector(view,-up.dot(view)).normalize();
    const screenRight=new T.Vector3().crossVectors(screenUp,view).normalize();
    const front=localFront.clone().normalize(),north=new T.Vector3(0,1,0).addScaledVector(front,-front.y).normalize();
    const right=new T.Vector3().crossVectors(north,front).normalize();
    const localBasis=new T.Matrix4().makeBasis(right,north,front);
    const worldBasis=new T.Matrix4().makeBasis(screenRight,screenUp,view);
    const orientation=new T.Quaternion().setFromRotationMatrix(worldBasis.multiply(localBasis.transpose()));
    const end=destination.clone().addScaledVector(view,endDistance);
    return {orientation,destination:destination.clone(),waypoint,arrivalDirection:view.clone(),endPosition:end.clone(),
      sample(progress){
        const p=clamp(progress),travel=clamp((p-.08)/.92),move=ease(travel)+9*travel**3*(1-travel)**3,look=ease(clamp((p-.03)/.89));
        const position=origin.clone().lerp(end,move),coreDistance=position.clone().sub(waypoint).dot(view);
        const direction=initialDirection.clone().applyQuaternion(new T.Quaternion().slerp(aimTurn,look));
        return {
          position,
          target:position.clone().addScaledVector(direction,position.distanceTo(destination)).addScaledVector(screenUp,framingOffset*smooth(.59,.87,p)),
          up:up.clone(),
          fov:46+Math.sin(Math.PI*ease(travel))*17,
          earthOpacity:smooth(.59,.87,p),
          galaxyOpacity:(1-smooth(.36,.59,p))*smooth(2,8,coreDistance),
          warpOpacity:smooth(.18,.34,p)*(1-smooth(.34,.70,p))*1.10,
          warpDensity:1-smooth(.35,.70,p),
          warpStretch:1-.94*smooth(.32,.69,p),
          backgroundOpacity:1-.985*smooth(.35,.72,p),
          beaconOpacity:1-smooth(.10,.35,p),
          phase:p<.14?'orienting':p<.35?'cruise':p<.50?'push-in':p<.70?'sparse':'arriving'
        };
      }
    };
  }
  window.FirstPersonFlight=Object.freeze({create});
})();
