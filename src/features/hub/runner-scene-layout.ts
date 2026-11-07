export const SCENE_FOG={near:27,far:94} as const;
export const SCENERY_ROWS={
  hall:{count:8,spacing:15,start:4},
  tanks:{count:7,spacing:18,start:7},
} as const;
export function recycledRowZ(distance:number,index:number,spacing:number,start:number){
  return start-index*spacing+distance%spacing;
}
