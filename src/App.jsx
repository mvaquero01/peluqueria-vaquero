import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  BrowserRouter, Routes, Route, useNavigate, Navigate, useSearchParams
} from "react-router-dom";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { db } from "./firebase.js";
import { seedDatabase } from "./seed.js";
import {
  suscribirCitas, suscribirClientes, suscribirValoraciones,
  crearCita, actualizarCita, crearCliente, actualizarCliente,
  crearValoracion, actualizarValoracion, borrarValoracion
} from "./db.js";
import {
  collection, onSnapshot, addDoc, deleteDoc, doc,
  query, where, getDocs, updateDoc, getDoc, setDoc
} from "firebase/firestore";
import { CONFIG } from "./config.js";

// ─────────────────────────────────────────────
// CSS GLOBAL
// ─────────────────────────────────────────────
const STYLE = document.createElement("style");
STYLE.textContent = `
  @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
  .anim  { animation: fadeUp 0.5s ease both; }
  .anim-fade { animation: fadeIn 0.4s ease both; }
  * { box-sizing:border-box; margin:0; padding:0; }
  
  html, body, #root { 
    margin: 0; 
    padding: 0; 
    width: 100%; 
    min-height: 100vh; 
    background: #0D1F35; 
    overflow-x: hidden;
  }

  /* Contenedor principal: eliminamos el max-width de 1200px */
  #root > div.cliente-wrap {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    padding: 0 !important; /* Quitamos el padding de aquí */
    background: #F8FBFF;
    min-height: 100vh;
    box-shadow: none;
  }

  /* Contenedor interno: eliminamos el max-width de 560px/760px */
  .cliente-inner { 
    width: 100% !important; 
    max-width: 100% !important; 
    margin: 0 !important;
    min-height: 100vh; 
    background: #F8FBFF; 
  }

  .cliente-header-sticky {
    position: sticky;
    top: 0;
    z-index: 0;
    background: #F8FBFF;
    border-bottom: 1px solid #CED9E8;
    box-shadow: 0 1px 8px rgba(0,0,0,.05);
    width: 50%;
  }

  /* Eliminamos cualquier restricción en pantallas grandes */
  @media(min-width:900px)  { .cliente-inner { max-width: 100% !important; } }
  @media(min-width:1200px) { .cliente-inner { max-width: 100% !important; } }

  .cliente-root { 
    width: 100%; 
    min-height: 100vh;
    background: linear-gradient(160deg, #0D1F35 0%, #1B3A5C 50%, #0D1F35 100%);
    display: flex;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }


  @media(max-width:640px) {
    .admin-kpi-grid { grid-template-columns:repeat(2,1fr) !important; }
    .admin-two-col  { grid-template-columns:1fr !important; }
    .admin-table-wrap { overflow-x:auto; -webkit-overflow-scrolling:touch; }
    .admin-body { padding:10px 8px !important; }
    .hide-mobile { display:none !important; }
  }

  /* ── Calendario ── */
  .cal-scroll {
    display:flex;
    overflow-x:auto;
    overflow-y:auto;
    max-height:600px;
    background:#F8FBFF;
    border:1px solid #CED9E8;
    border-radius:13px;
    position:relative;
  }
  .cal-day-col {
    flex:1;
    min-width:130px;
    border-right:1px solid #CED9E8;
    display:flex;
    flex-direction:column;
  }
  /* ★ STICKY: cabeceras de día fijas al hacer scroll vertical */
  .cal-day-header {
    height: 52px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid #CED9E8;
    flex-shrink: 0;
    padding: 4px 8px;
    gap: 3px;
    position: sticky;
    top: 0;
    z-index: 6;
    background: #F0F4F9;
  }
  /* Eje horas: spacer sticky para alinearse con las cabeceras */
  .cal-hour-header {
    height:52px;
    flex-shrink:0;
    border-bottom:1px solid #CED9E8;
    position:sticky;
    top:0;
    z-index:7;
  }

  /* ── Mini calendario ── */
  .mini-cal { user-select:none; }
  .mini-cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
  .mini-cal-cell {
    aspect-ratio:1;
    display:flex; align-items:center; justify-content:center;
    border-radius:6px; font-size:12px; cursor:pointer; font-weight:500;
  }
  .mini-cal-cell:hover:not([disabled]) { background:#E0E8F2; }
  .mini-cal-cell[disabled] { opacity:.3; cursor:default; }
  .mini-cal-cell.selected { background:linear-gradient(135deg,#1B4F8A,#133A6A) !important; color:#fff !important; font-weight:700; }
  .mini-cal-cell.today { outline:2px solid #1B4F8A; outline-offset:-2px; }
  .mini-cal-cell.festivo { color:#dc2626; opacity:.4; cursor:default; }

  /* ── WhatsApp FAB ── */
  .wa-fab {
    position:fixed; bottom:24px; right:20px;
    width:54px; height:54px; background:#25D366; border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    box-shadow:0 4px 16px rgba(37,211,102,.55);
    z-index:50; text-decoration:none;
    transition:transform .2s,box-shadow .2s;
  }
  .wa-fab:hover { transform:scale(1.1); box-shadow:0 6px 24px rgba(37,211,102,.7); }

  /* ── Animaciones cliente ── */
  @keyframes pulse-ring {
    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(27,79,138,0.5); }
    50% { transform: scale(1.04); box-shadow: 0 0 0 16px rgba(27,79,138,0); }
    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(27,79,138,0); }
  }
  @keyframes slideInRight {
    from { opacity:0; transform:translateX(30px); }
    to { opacity:1; transform:translateX(0); }
  }
  @keyframes heroText {
    from { opacity:0; transform:translateY(20px); }
    to { opacity:1; transform:translateY(0); }
  }
  .btn-pulse {
    animation: pulse-ring 1.8s ease-in-out infinite;
  }
  .slide-in {
    animation: slideInRight 0.35s ease both;
  }
  .hero-emoji { animation: heroText 0.5s ease both; animation-delay: 0.1s; opacity:0; }
  .hero-title { animation: heroText 0.5s ease both; animation-delay: 0.25s; opacity:0; }
  .hero-slogan { animation: heroText 0.5s ease both; animation-delay: 0.4s; opacity:0; }
  .hero-dir { animation: heroText 0.5s ease both; animation-delay: 0.5s; opacity:0; }
  .hero-btn { animation: heroText 0.5s ease both; animation-delay: 0.65s; opacity:0; }

  /* ── Hover tarjetas ── */
  .card-hover {
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .card-hover:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.10) !important;
  }

  /* ── Scroll reveal ── */
  .reveal {
    opacity: 0;
    transform: translateY(22px);
    transition: opacity 0.55s ease, transform 0.55s ease;
  }
  .reveal.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .cat-content {
    overflow: hidden;
    animation: fadeUp 0.25s ease both;
  }

  @keyframes fadeSlotIn {
    from { opacity:0; transform:scale(0.9); }
    to { opacity:1; transform:scale(1); }
  }
  .slot-btn {
    animation: fadeSlotIn 0.2s ease both;
  }
  .slot-btn {
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .slot-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(27,79,138,0.2);
  }

  /* ── Sticky bottom bar en reserva ── */
  .sticky-bottom {
    position:fixed; bottom:0; left:0; right:0;
    background:#F8FBFF;
    border-top:1px solid #CED9E8;
    padding:12px 18px 16px;
    z-index:30;
    box-shadow:0 -4px 20px rgba(0,0,0,.08);
  }
`;
document.head.appendChild(STYLE);

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
const toMin = h=>{ const [hh,mm]=h.split(":").map(Number); return hh*60+mm; };
const toStr = m=>`${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
const DIAS_ES   = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const DIAS_FULL = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const MESES_ES  = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const MESES_FULL= ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const normalize = s=>s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
const isoDate   = d=>{ const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),dd=String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${dd}`; };
const fmtLarga  = d=>`${DIAS_FULL[d.getDay()]} ${d.getDate()} de ${MESES_ES[d.getMonth()]}`;
const haceNSemanas = n=>{ const d=new Date(); d.setDate(d.getDate()-n*7); return isoDate(d); };
const HOY = new Date(); HOY.setHours(0,0,0,0);
const HOY_ISO = isoDate(HOY);
let _citaEliminadaTemp=null, _clienteEliminadoTemp=null;

function levenshtein(a,b){
  const m=a.length,n=b.length;
  const dp=Array.from({length:m+1},(_,i)=>Array.from({length:n+1},(_,j)=>i===0?j:j===0?i:0));
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++)
    dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  return dp[m][n];
}
function similitud(q,nombre){
  const a=normalize(q),b=normalize(nombre);
  if(!a)return 100; if(a===b)return 100;
  if(b.startsWith(a)||a.startsWith(b))return 95;
  if(b.includes(a)||a.includes(b))return 88;
  return Math.max(0,Math.round((1-levenshtein(a,b)/Math.max(a.length,b.length))*100));
}
function generarSlots(hp,durMin){
  const slots=[]; let cur=toMin(hp.entrada);
  const fin=toMin(hp.salida)-durMin;
  while(cur<=fin){
    const finSlot=cur+durMin;
    if(hp.descanso){ const dI=toMin(hp.descanso.inicio),dF=toMin(hp.descanso.fin); if(cur<dF&&finSlot>dI){cur=dF;continue;} }
    slots.push(toStr(cur)); cur+=15;
  }
  return slots;
}
function filtrarSlotsOcupados(slots,durMin,citasDelDia){
  return slots.filter(slot=>{
    const sI=toMin(slot),sF=sI+durMin;
    return !citasDelDia.some(c=>{
      const svc=CONFIG.serviciosDefault.find(s=>s.id===c.servicioId)||{duracionMin:30};
      const cI=toMin(c.hora),cF=cI+svc.duracionMin;
      return sI<cF&&sF>cI;
    });
  });
}
function peluqueroEstaBloqueado(pelId,fechaISO,bloqueos){
  return bloqueos.some(b=>Number(b.peluqueroId)===pelId&&fechaISO>=b.desde&&fechaISO<=b.hasta);
}
function getWeekDays(offset=0){
  const hoy=new Date(); hoy.setHours(0,0,0,0);
  const dow=hoy.getDay();
  const mon=new Date(hoy); mon.setDate(hoy.getDate()-(dow===0?6:dow-1)+offset*7);
  return Array.from({length:6},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d;});
}
function getCalendarWeeks(){
  const hoy=new Date(); hoy.setHours(0,0,0,0);
  const dow=hoy.getDay();
  const lunes=new Date(hoy); lunes.setDate(hoy.getDate()-(dow===0?6:dow-1));
  const semanas=[];
  for(let s=0;s<3;s++){
    const sem=[];
    for(let d=0;d<7;d++){const dia=new Date(lunes);dia.setDate(lunes.getDate()+s*7+d);sem.push(dia);}
    semanas.push(sem);
  }
  return semanas;
}

// ─────────────────────────────────────────────
// FIREBASE HELPERS
// ─────────────────────────────────────────────
function suscribirFestivos(cb){return onSnapshot(collection(db,"festivos"),snap=>{cb(snap.docs.map(d=>({...d.data(),id:d.id})));});}
async function crearFestivo(data){await addDoc(collection(db,"festivos"),data);}
async function borrarFestivo(id){await deleteDoc(doc(db,"festivos",id));}
function suscribirBloqueos(cb){return onSnapshot(collection(db,"bloqueos"),snap=>{cb(snap.docs.map(d=>({...d.data(),id:d.id})));});}
async function crearBloqueo(data){await addDoc(collection(db,"bloqueos"),data);}
async function borrarBloqueo(id){await deleteDoc(doc(db,"bloqueos",id));}

// ── Servicios en Firebase ──
function suscribirServicios(cb){
  return onSnapshot(collection(db,"servicios"),snap=>{
    if(snap.empty){cb([...CONFIG.serviciosDefault]);return;}
    const data=snap.docs.map(d=>({...d.data()})).sort((a,b)=>a.id-b.id);
    const ids=new Set(data.map(s=>s.id));
    const faltantes=CONFIG.serviciosDefault.filter(s=>!ids.has(s.id));
    cb([...data,...faltantes].sort((a,b)=>a.id-b.id));
  });
}
async function guardarServicioFB(svc){
  const docId=svc.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/gi,"_");
  await setDoc(doc(db,"servicios",docId),svc);
}
async function borrarServicioFB(nombre){
  const docId=nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/gi,"_");
  await deleteDoc(doc(db,"servicios",docId));
}
async function guardarValoracionFB(val){
  const docId=val.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/gi,"_")+"_"+val.id;
  await setDoc(doc(db,"valoraciones",docId),val);
}
async function borrarValoracionFB(val){
  const docId=val.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/gi,"_")+"_"+val.id;
  await deleteDoc(doc(db,"valoraciones",docId));
}
function suscribirValoracionesFB(cb){
  return onSnapshot(collection(db,"valoraciones"),snap=>{
    cb(snap.docs.map(d=>({...d.data()})));
  });
}

async function seedServicios(){
  for(const svc of CONFIG.serviciosDefault){
    const docId=svc.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/gi,"_");
    await setDoc(doc(db,"servicios",docId),svc);
  }
}
async function borrarCita(id){
  const citaSnap=await getDoc(doc(db,"citas",id));
  if(citaSnap.exists()){
    const cita=citaSnap.data();
    if(cita.clienteTel){
      // Buscar cuántas citas tiene este cliente
      const q=query(collection(db,"clientes_citas")||collection(db,"citas"),where("clienteTel","==",cita.clienteTel));
      const todasCitas=await getDocs(q);
      // Si solo tiene esta cita (la que vamos a borrar), eliminar el cliente
      const otrasCitas=todasCitas.docs.filter(d=>d.id!==id);
      if(otrasCitas.length===0){
        // Solo eliminar si no tiene más citas de ningún tipo
        const docId=cita.clienteNombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/gi,"_")+"_"+cita.clienteTel;
        const clienteRef=doc(db,"clientes",docId);
        const clienteSnap=await getDoc(clienteRef);
        if(clienteSnap.exists()){
          const cl=clienteSnap.data();
          // Solo borrar si tiene 0 visitas y 0 gasto (nunca completó ninguna cita)
          if((cl.visitas||0)===0&&(cl.gasto||0)===0&&(cl.noShows||0)===0){
            await deleteDoc(clienteRef);
          }
        }
      } else {
        // Tiene más citas, solo actualizar si la cita era completada
        if(cita.estado==="completada"){
          const docId=cita.clienteNombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/gi,"_")+"_"+cita.clienteTel;
          const clienteRef=doc(db,"clientes",docId);
          const clienteSnap=await getDoc(clienteRef);
          if(clienteSnap.exists()){
            const cl=clienteSnap.data();
            const nuevoHistorial=(cl.historial||[]).filter(h=>!(h.fecha===cita.fecha&&h.servicio===cita.servicio&&h.peluquero===cita.peluquero));
            await updateDoc(clienteRef,{
              visitas:Math.max((cl.visitas||0)-1,0),
              gasto:Math.max((cl.gasto||0)-cita.precio,0),
              historial:nuevoHistorial,
              ultimaVisita:nuevoHistorial.length>0?nuevoHistorial[nuevoHistorial.length-1].fecha:""
            });
          }
        }
      }
    }
  }
  await deleteDoc(doc(db,"citas",id));
}
async function crearOActualizarCliente(datos){
  const docId=datos.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/gi,"_")+"_"+datos.telefono;
  const ref=doc(db,"clientes",docId);
  const snap=await getDoc(ref);
  if(snap.exists()){
    const a=snap.data();
    await updateDoc(ref,{visitas:(a.visitas||0)+1,gasto:(a.gasto||0)+datos.gasto,ultimaVisita:datos.ultimaVisita,historial:[...(a.historial||[]),...datos.historial]});
  } else {
    await setDoc(ref,datos);
  }
}

// ─────────────────────────────────────────────
// MOCK DATA (solo para seed)
// ─────────────────────────────────────────────
const semana=getWeekDays();
const STATS_INGRESOS=[{semana:"S1 Feb",actual:420,anterior:380},{semana:"S2 Feb",actual:580,anterior:490},{semana:"S3 Feb",actual:510,anterior:520},{semana:"S4 Feb",actual:690,anterior:610},{semana:"S1 Mar",actual:740,anterior:690},{semana:"S2 Mar",actual:620,anterior:580},{semana:"S3 Mar",actual:810,anterior:620}];
const STATS_DIAS=[{dia:"Lun",citas:8},{dia:"Mar",citas:11},{dia:"Mié",citas:9},{dia:"Jue",citas:13},{dia:"Vie",citas:16},{dia:"Sáb",citas:14}];
const STATS_SERVICIOS=[{nombre:"Corte",c:38},{nombre:"Fade",c:24},{nombre:"Corte+Barba",c:19},{nombre:"Coloración",c:14},{nombre:"Barba",c:18},{nombre:"Mechas",c:9}];

(()=>{
  ["https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js","https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"].forEach(src=>{
    if(!document.querySelector(`script[src="${src}"]`)){const s=document.createElement("script");s.src=src;document.head.appendChild(s);}
  });
  const l=document.createElement("link");l.rel="stylesheet";l.href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap";document.head.appendChild(l);
})();

const FONT="'Plus Jakarta Sans',sans-serif";
const A="#1B4F8A",CR="#F0F4F9",CR2="#E0E8F2",CR3="#CED9E8";
const WH="#F8FBFF",TX="#0D1F35",TX2="#4A6080";
const OK="#16a34a",ER="#dc2626";

// ─────────────────────────────────────────────
// ATOMS
// ─────────────────────────────────────────────
const Bdg=({children,color=A,small})=>(
  <span style={{background:color+"18",color,border:`1px solid ${color}33`,borderRadius:20,padding:small?"2px 7px":"3px 10px",fontSize:small?10:11,fontWeight:700,whiteSpace:"nowrap"}}>{children}</span>
);
const EstBdg=({e})=>{
  const m={completada:[OK,"Completada ✓"],pendiente:[A,"Pendiente"],"no-show":[ER,"No show ✗"]};
  const [c,l]=m[e]||[TX2,e]; return <Bdg color={c}>{l}</Bdg>;
};
const Divider=()=><div style={{height:1,background:CR2,margin:"12px 0"}}/>;
const Lbl=({children})=><div style={{fontSize:11,color:TX2,textTransform:"uppercase",letterSpacing:1,marginBottom:5,fontWeight:700}}>{children}</div>;
const Inp=({style,inputRef,...p})=><input ref={inputRef} style={{width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,padding:"10px 13px",fontSize:13,color:TX,outline:"none",boxSizing:"border-box",fontFamily:"inherit",...style}} {...p}/>;
const Sel=({style,...p})=><select style={{width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,padding:"10px 13px",fontSize:13,color:TX,outline:"none",boxSizing:"border-box",fontFamily:"inherit",...style}} {...p}/>;
const Btn=({ok=true,sm,style,children,...p})=>(
  <button style={{background:ok?`linear-gradient(135deg,${A},#133A6A)`:CR2,color:ok?WH:TX2,border:ok?"none":`1px solid ${CR3}`,borderRadius:sm?8:11,padding:sm?"7px 14px":"12px 20px",fontSize:sm?12:13,fontWeight:700,cursor:ok?"pointer":"not-allowed",letterSpacing:.5,boxShadow:ok?`0 3px 12px ${A}33`:"none",...style}} {...p}>{children}</button>
);
const WhatsAppIcon=()=>(
  <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
    <path d="M16 3C8.82 3 3 8.82 3 16c0 2.3.61 4.46 1.68 6.33L3 29l6.84-1.64A13 13 0 0 0 16 29c7.18 0 13-5.82 13-13S23.18 3 16 3z" fill="#fff"/>
    <path d="M21.9 18.8c-.3-.15-1.77-.87-2.04-.97-.28-.1-.48-.15-.68.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.68-1.63-.93-2.23-.24-.58-.49-.5-.68-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.79.37-.27.3-1.03 1.01-1.03 2.46 0 1.45 1.06 2.85 1.2 3.05.15.2 2.08 3.17 5.04 4.45.7.3 1.25.49 1.68.62.7.22 1.34.19 1.85.12.56-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.19-.57-.34z" fill="#25D366"/>
  </svg>
);

// ─────────────────────────────────────────────
// MINI CAL PICKER
// ─────────────────────────────────────────────
function MiniCalPicker({value,onChange,festivosSet,bloqueosPelId,bloqueos}){
  const today=new Date(); today.setHours(0,0,0,0);
  const [nav,setNav]=useState(()=>{
    if(value){const d=new Date(value+"T12:00:00");return{y:d.getFullYear(),m:d.getMonth()};}
    return{y:today.getFullYear(),m:today.getMonth()};
  });
  const firstDay=new Date(nav.y,nav.m,1);
  const offset=(firstDay.getDay()===0?6:firstDay.getDay()-1);
  const daysInMonth=new Date(nav.y,nav.m+1,0).getDate();
  const cells=[];
  for(let i=0;i<offset;i++) cells.push(null);
  for(let d=1;d<=daysInMonth;d++) cells.push(new Date(nav.y,nav.m,d));
  return(
    <div className="mini-cal" style={{background:WH,border:`1px solid ${CR3}`,borderRadius:12,padding:"12px",minWidth:260}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <button style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:TX2,padding:"2px 8px"}} onClick={()=>setNav(n=>n.m===0?{y:n.y-1,m:11}:{y:n.y,m:n.m-1})}>‹</button>
        <span style={{fontSize:13,fontWeight:700,color:TX}}>{MESES_FULL[nav.m]} {nav.y}</span>
        <button style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:TX2,padding:"2px 8px"}} onClick={()=>setNav(n=>n.m===11?{y:n.y+1,m:0}:{y:n.y,m:n.m+1})}>›</button>
      </div>
      <div className="mini-cal-grid" style={{marginBottom:4}}>
        {["Lu","Ma","Mi","Ju","Vi","Sá","Do"].map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:TX2,padding:"3px 0"}}>{d}</div>)}
      </div>
      <div className="mini-cal-grid">
        {cells.map((d,i)=>{
          if(!d) return <div key={i}/>;
          const iso=isoDate(d);
          const isPast=d<today, isDom=d.getDay()===0, isFest=festivosSet.has(iso);
          const noBloq=bloqueosPelId?peluqueroEstaBloqueado(bloqueosPelId,iso,bloqueos):false;
          const noH=!CONFIG.horarioGeneral[d.getDay()];
          const noHP=bloqueosPelId?(()=>{const p=CONFIG.peluqueros.find(x=>x.id===bloqueosPelId);return p?!p.horario[d.getDay()]:false;})():false;
          const disabled=isPast||isDom||isFest||noBloq||noH||noHP;
          const sel=value===iso, isToday=iso===HOY_ISO;
          let cls="mini-cal-cell";
          if(sel) cls+=" selected";
          else if(isFest||isDom) cls+=" festivo";
          else if(isToday) cls+=" today";
          return(
            <div key={i} className={cls} style={{color:disabled&&!sel?"#aaa":undefined,background:disabled&&!sel?"transparent":undefined}} onClick={()=>!disabled&&onChange(iso)}>
              {d.getDate()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CALENDARIO GRID — con cabeceras STICKY
// ─────────────────────────────────────────────
const PX_MIN=1.4;
const HORA_APE=9*60,HORA_CIE=20*60+30;
const TOTAL_MIN=HORA_CIE-HORA_APE;
const GRID_H=TOTAL_MIN*PX_MIN;
const HORA_LABELS=Array.from({length:12},(_,i)=>i+9);

function CalendarioGrid({dias,citas,peluqueroFiltroId}){
  return(
    <div className="cal-scroll">
      {/* eje horas */}
      <div style={{width:44,flexShrink:0,position:"relative",borderRight:`1px solid ${CR3}`,background:CR}}>
        {/* ★ sticky spacer para alinearse con las cabeceras de columna */}
        <div className="cal-hour-header" style={{background:CR}}/>
        <div style={{position:"relative",height:GRID_H}}>
          {HORA_LABELS.map(h=>(
            <div key={h} style={{position:"absolute",top:(h*60-HORA_APE)*PX_MIN-7,left:0,right:0,textAlign:"right",paddingRight:6,fontSize:9,color:TX2,fontWeight:600}}>{h}:00</div>
          ))}
        </div>
      </div>
      {/* columnas por día */}
      {dias.map((d,i)=>{
        const iso=isoDate(d);
        const esHoy=iso===HOY_ISO;
        const hGen=CONFIG.horarioGeneral[d.getDay()];
        const citasDia=citas.filter(c=>c.fecha===iso&&(!peluqueroFiltroId||c.peluqueroId===peluqueroFiltroId)).sort((a,b)=>a.hora.localeCompare(b.hora));
        const pelEnEsteDia=CONFIG.peluqueros.filter(p=>!!p.horario[d.getDay()]);
        return(
          <div key={i} className="cal-day-col">
            {/* ★ STICKY header */}
            <div className="cal-day-header" style={{background:esHoy?`#1B4F8A`:CR3}}>
              <span style={{fontSize:9,fontWeight:700,color:esHoy?"#fff":TX2,textTransform:"uppercase",letterSpacing:.5,whiteSpace:"nowrap"}}>{DIAS_ES[d.getDay()]}</span>
            <span style={{fontSize:12,fontWeight:700,color:esHoy?"#fff":TX,whiteSpace:"nowrap"}}>{d.getDate()} {MESES_ES[d.getMonth()]}</span>
            </div>
            {/* cuerpo */}
            <div style={{position:"relative",height:GRID_H,flexShrink:0}}>
              {HORA_LABELS.map(h=><div key={h} style={{position:"absolute",top:(h*60-HORA_APE)*PX_MIN,left:0,right:0,borderTop:`1px solid ${h%2===0?CR3:CR2}`,zIndex:0}}/>)}
              {!hGen&&<div style={{position:"absolute",inset:0,background:"repeating-linear-gradient(45deg,#F5F0E8,#F5F0E8 4px,#EDE6D9 4px,#EDE6D9 8px)",zIndex:1,opacity:.6}}/>}
              {hGen&&pelEnEsteDia.map(p=>{
                const hp=p.horario[d.getDay()]; if(!hp?.descanso) return null;
                const top=(toMin(hp.descanso.inicio)-HORA_APE)*PX_MIN;
                const height=(toMin(hp.descanso.fin)-toMin(hp.descanso.inicio))*PX_MIN;
                return <div key={p.id} style={{position:"absolute",left:0,right:0,top,height,background:p.color+"0A",zIndex:1,borderTop:`1px dashed ${p.color}33`,borderBottom:`1px dashed ${p.color}33`}}/>;
              })}
              {citasDia.map(c=>{
                const svc=CONFIG.serviciosDefault.find(s=>s.id===c.servicioId)||{duracionMin:30};
                const pel=CONFIG.peluqueros.find(p=>p.id===c.peluqueroId);
                const col=pel?.color||A;
                const top=(toMin(c.hora)-HORA_APE)*PX_MIN;
                const height=Math.max(svc.duracionMin*PX_MIN-2,18);
                const pelIdx=peluqueroFiltroId?0:CONFIG.peluqueros.findIndex(p=>p.id===c.peluqueroId);
                const total=peluqueroFiltroId?1:CONFIG.peluqueros.length;
                const cw=100/total;
                return(
                  <div key={c.id} style={{position:"absolute",top,left:`calc(${pelIdx*cw}% + 1px)`,width:`calc(${cw}% - 2px)`,height,background:`${col}22`,border:`1.5px solid ${col}99`,borderLeft:`3px solid ${col}`,borderRadius:4,padding:"2px 4px",overflow:"hidden",zIndex:2,boxSizing:"border-box"}}>
                    <div style={{fontSize:9,fontWeight:700,color:col,lineHeight:1.3}}>{c.hora}</div>
                    {height>20&&<div style={{fontSize:9,color:TX,fontWeight:600,lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.clienteNombre.split(" ")[0]}</div>}
                    {height>34&&<div style={{fontSize:8,color:TX2,lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.servicio}</div>}
                    {height>48&&<div style={{fontSize:8,color:col,fontWeight:600}}>{pel?.nombre}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeyendaPeluqueros(){
  return(
    <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:10}}>
      {CONFIG.peluqueros.map(p=>(
        <div key={p.id} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:TX}}>
          <div style={{width:10,height:10,borderRadius:2,background:p.color,flexShrink:0}}/>{p.emoji} {p.nombre}
        </div>
      ))}
    </div>
  );
}

function NavSemana({offset,onChange,weekDays}){
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
      <button style={{background:CR2,border:`1px solid ${CR3}`,borderRadius:7,padding:"5px 12px",fontSize:12,cursor:"pointer",color:TX}} onClick={()=>onChange(o=>o-1)}>← Anterior</button>
      <span style={{fontSize:12,fontWeight:700,color:TX}}>{weekDays[0].getDate()} {MESES_ES[weekDays[0].getMonth()]} – {weekDays[5].getDate()} {MESES_ES[weekDays[5].getMonth()]}</span>
      <div style={{display:"flex",gap:5}}>
        {offset!==0&&<button style={{background:CR2,border:`1px solid ${CR3}`,borderRadius:7,padding:"5px 10px",fontSize:11,cursor:"pointer",color:TX2}} onClick={()=>onChange(0)}>Hoy</button>}
        <button style={{background:CR2,border:`1px solid ${CR3}`,borderRadius:7,padding:"5px 12px",fontSize:12,cursor:"pointer",color:TX}} onClick={()=>onChange(o=>o+1)}>Siguiente →</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// AUTH GUARDS
// ─────────────────────────────────────────────
function RequireAdmin({children}){
  const role=sessionStorage.getItem("authRole");
  if(role!=="admin") return <Navigate to="/login" replace/>;
  return children;
}
function RequirePeluquero({children}){
  const role=sessionStorage.getItem("authRole");
  if(role!=="peluquero") return <Navigate to="/login" replace/>;
  return children;
}

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────
function LoginPage(){
  const navigate=useNavigate();
  const [user,setUser]=useState(""), [pass,setPass]=useState(""), [error,setError]=useState(false);
  const handleLogin=()=>{
    if(user===CONFIG.adminUser&&pass===CONFIG.adminPass){
      sessionStorage.setItem("authRole","admin");
      navigate("/admin");
      return;
    }
    const pel=CONFIG.peluqueros.find(x=>normalize(x.nombre)===normalize(user)&&x.password===pass);
    if(pel){
      sessionStorage.setItem("authRole","peluquero");
      sessionStorage.setItem("peluqueroData",JSON.stringify(pel));
      navigate("/mi-agenda");
      return;
    }
    setError(true); setTimeout(()=>setError(false),2500);
  };
  return(
    <div className="cliente-wrap" style={{minHeight:"100vh",background:`linear-gradient(160deg,#0D1F35 0%,#1B3A5C 60%,#0D1F35 100%)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:FONT}}>
      <div style={{background:WH,borderRadius:20,padding:"40px 36px",width:"100%",maxWidth:360,boxShadow:"0 20px 60px rgba(0,0,0,.4)"}}>
        <div style={{width:56,height:56,background:`linear-gradient(135deg,${A},#133A6A)`,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto 20px"}}>🔐</div>
        <h2 style={{textAlign:"center",fontSize:22,fontWeight:700,color:TX,marginBottom:4}}>Acceso privado</h2>
        <p style={{textAlign:"center",fontSize:13,color:TX2,marginBottom:24}}>{CONFIG.nombre}</p>
        {error&&<div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:8,padding:"10px 14px",fontSize:13,color:ER,textAlign:"center",marginBottom:14}}>Usuario o contraseña incorrectos</div>}
        <div style={{marginBottom:12}}><Lbl>Usuario</Lbl><Inp value={user} onChange={e=>setUser(e.target.value)} placeholder="admin · clara · fernando..."/></div>
        <div style={{marginBottom:20}}><Lbl>Contraseña</Lbl><Inp type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder="••••••"/></div>
        <Btn ok style={{width:"100%"}} onClick={handleLogin}>ENTRAR</Btn>
        <button style={{width:"100%",background:"none",border:"none",color:TX2,cursor:"pointer",fontSize:12,marginTop:14}} onClick={()=>navigate("/")}>← Volver a la web</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PELUQUERO VIEW
// ─────────────────────────────────────────────
function PeluqueroPage({citas}){
  const navigate=useNavigate();
  const peluquero=useMemo(()=>{ try{ return JSON.parse(sessionStorage.getItem("peluqueroData")); }catch{ return null; } },[]);
  const [weekOffset,setWeekOffset]=useState(0);
  const weekDays=getWeekDays(weekOffset);
  if(!peluquero) return <Navigate to="/login" replace/>;
  const misCitas=citas.filter(c=>c.peluqueroId===peluquero.id);
  const handleLogout=()=>{ sessionStorage.removeItem("authRole"); sessionStorage.removeItem("peluqueroData"); navigate("/"); };
  return(
    <div style={{minHeight:"100vh",background:CR,fontFamily:FONT,color:TX}}>
      <div style={{background:WH,borderBottom:`1px solid ${CR3}`,padding:"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,background:`linear-gradient(135deg,${peluquero.color},${peluquero.color}88)`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{peluquero.emoji}</div>
          <div><div style={{fontSize:15,fontWeight:700}}>{peluquero.nombre} — Mi agenda</div><div style={{fontSize:11,color:TX2}}>{CONFIG.nombre}</div></div>
        </div>
        <button style={{background:CR2,border:`1px solid ${CR3}`,borderRadius:8,padding:"6px 14px",fontSize:12,color:TX2,cursor:"pointer"}} onClick={handleLogout}>Salir →</button>
      </div>
      <div style={{padding:"18px"}}>
        <NavSemana offset={weekOffset} onChange={setWeekOffset} weekDays={weekDays}/>
        <CalendarioGrid dias={weekDays} citas={misCitas} peluqueroFiltroId={peluquero.id}/>
        <div style={{marginTop:16,background:WH,border:`1px solid ${CR3}`,borderRadius:13,padding:"16px"}}>
          <div style={{fontSize:11,fontWeight:700,color:TX2,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Citas de hoy</div>
          {misCitas.filter(c=>c.fecha===HOY_ISO).sort((a,b)=>a.hora.localeCompare(b.hora)).map(c=>(
            <div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${CR2}`}}>
              <div><span style={{fontSize:13,fontWeight:700,color:A,marginRight:10}}>{c.hora}</span><span style={{fontSize:13,color:TX}}>{c.clienteNombre}</span></div>
              <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:12,color:TX2}}>{c.servicio}</span><EstBdg e={c.estado}/></div>
            </div>
          ))}
          {misCitas.filter(c=>c.fecha===HOY_ISO).length===0&&<div style={{fontSize:13,color:TX2,fontStyle:"italic"}}>No tienes citas hoy</div>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CLIENTE APP — página home + flujo reserva
// ─────────────────────────────────────────────
function useScrollReveal(){
  useEffect(()=>{
    const els=document.querySelectorAll('.reveal');
    const obs=new IntersectionObserver(entries=>{
      entries.forEach(e=>{ if(e.isIntersecting) e.target.classList.add('visible'); });
    },{threshold:0.12});
    els.forEach(el=>obs.observe(el));
    return()=>obs.disconnect();
  },[]);
}

function ClientePage({valoraciones,citas,festivos,bloqueos,servicios,startPaso=0}){
  const navigate=useNavigate();
  const [paso,setPaso]=useState(startPaso);
  const [catAbierta,setCatAbierta]=useState(null);
  const [selServicio,setSelServicio]=useState(null);
  const [selPeluquero,setSelPeluquero]=useState(null);
  const [selDia,setSelDia]=useState(null);
  const [selHora,setSelHora]=useState(null);
  const [form,setForm]=useState({nombre:"",telefono:""});
  const festivosSet=useMemo(()=>new Set(festivos.map(f=>f.fecha)),[festivos]);

  const slots=useMemo(()=>{
    if(!selPeluquero||!selDia||!selServicio) return [];
    const hp=selPeluquero.horario[selDia.getDay()]; if(!hp) return [];
    const todos=generarSlots(hp,selServicio.duracionMin);
    const citasDelDia=citas.filter(c=>c.fecha===isoDate(selDia)&&c.peluqueroId===selPeluquero.id&&c.estado!=="no-show");
    const disponibles=filtrarSlotsOcupados(todos,selServicio.duracionMin,citasDelDia);
    if(isoDate(selDia)===HOY_ISO){
      const ahora=new Date(); const minAhora=ahora.getHours()*60+ahora.getMinutes()+15;
      return disponibles.filter(h=>toMin(h)>minAhora);
    }
    return disponibles;
  },[selPeluquero,selDia,selServicio,citas]);

  const scrollTop=()=>window.scrollTo({top:0,behavior:"smooth"});
  const irAPaso=n=>{
    scrollTop();
    if(n===0){ navigate("/"); return; }
    if(paso===0){ navigate("/reservar"); return; }
    setPaso(n);
  };
  const reset=()=>{ scrollTop(); navigate("/"); };
  const confirmarReserva=async()=>{
    if(!form.nombre||!form.telefono) return;
    await crearCita({clienteNombre:form.nombre,clienteTel:form.telefono,servicio:selServicio.nombre,servicioId:selServicio.id,peluqueroId:selPeluquero.id,peluquero:selPeluquero.nombre,fecha:isoDate(selDia),hora:selHora,precio:selServicio.precio,estado:"pendiente",nota:""});
    await crearOActualizarCliente({nombre:form.nombre,telefono:form.telefono,visitas:1,gasto:selServicio.precio,ultimaVisita:isoDate(selDia),nota:"",historial:[{fecha:isoDate(selDia),servicio:selServicio.nombre,peluquero:selPeluquero.nombre,precio:selServicio.precio}]});
    setPaso(5); scrollTop();
  };
  const waMsgCliente=`Hola ${form.nombre} 👋%0AReserva confirmada en *${CONFIG.nombre}*%0A%0A✂️ ${selServicio?.nombre}%0A💈 ${selPeluquero?.nombre}%0A📅 ${selDia?fmtLarga(selDia):""}%0A🕐 ${selHora}%0A💶 €${selServicio?.precio}%0A%0ATe esperamos 😊`;
  const horarioResumido=()=>{
    const g={};
    Object.entries(CONFIG.horarioGeneral).forEach(([d,h])=>{const k=`${h.apertura}–${h.cierre}`;if(!g[k])g[k]=[];g[k].push(Number(d));});
    return Object.entries(g).map(([h,ds])=>({horas:h,rango:ds.map(d=>DIAS_ES[d]).join(", ")}));
  };

  const cs={
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "10px 4%",
      background: "#F8FBFF", // Fuerza el color exacto de tu fondo
      borderBottom: `1px solid ${CR3}`,
      width: "100%",
      boxSizing: "border-box",
      height: "60px",
      zIndex: 1000 // Asegúrate de que este número sea el más alto de la página
    },
    hero: {
      backgroundImage: `linear-gradient(rgba(13, 31, 53, 0.7), rgba(13, 31, 53, 0.7)), url('https://i.postimg.cc/8CbxPT8S/salon-belleza-vs-peluqueria.jpg')`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      padding: "60px 20px", 
      marginTop: "0px", 
      textAlign: "center",
      position: "relative",
      overflow: "hidden",
      width: "100%",
      color: WH
    },
    heroGlow:{position:"absolute",top:-60,left:"50%",transform:"translateX(-50%)",width:300,height:300,background:`radial-gradient(circle,${A}22 0%,transparent 70%)`,pointerEvents:"none"},
    btnPpal:{background:`linear-gradient(135deg,${A},#133A6A)`,color:WH,border:"none",borderRadius:12,padding:"15px 40px",fontSize:15,fontWeight:700,cursor:"pointer",letterSpacing:1,boxShadow:`0 6px 24px ${A}55`},
    section: { 
      padding: "100px 20px", // Espaciado masivo de 100px arriba y abajo
      maxWidth: "100%", 
      margin: "0 auto",
      minHeight: "600px", // Reserva un espacio fijo para que lo de abajo no se mueva tanto
      display: "flex",
      flexDirection: "column"
    },
    sTitle: { 
      fontSize: "22px", 
      color: A, 
      letterSpacing: "6px", 
      textTransform: "uppercase", 
      marginTop: "10px",    /* Muy poco espacio con la línea de ARRIBA */
      marginBottom: "30px", /* Espacio con los servicios de ABAJO */
      fontWeight: 900,
      textAlign: "center",
      display: "block"
    },
    cat: { 
      background: WH, 
      border: `1px solid ${CR3}`, 
      borderRadius: 13, 
      marginBottom: "0", 
      overflow: "hidden", 
      boxShadow: "0 1px 4px rgba(0,0,0,.04)",
      transition: "all 0.3s ease" // Para que el despliegue sea fluido
    },
    catHeader:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",cursor:"pointer"},
    catLeft:{display:"flex",alignItems:"center",gap:10},
    catIcon:{width:38,height:38,background:CR2,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18},
    svcRow: sel => ({ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, padding: "12px 16px", cursor: "pointer", background: sel ? `${A}08` : CR, borderTop: `1px solid ${CR2}`, transition: "background .15s", width: "100%" }),
    horaBtn:a=>({background:a?`linear-gradient(135deg,${A},#133A6A)`:WH,border:`1px solid ${a?A:CR3}`,borderRadius:8,padding:"10px 0",cursor:"pointer",textAlign:"center",fontSize:13,color:a?WH:TX,fontWeight:a?700:400}),
    card:sel=>({background:sel?`${A}0D`:WH,border:`1px solid ${sel?A:CR3}`,borderRadius:13,padding:"13px 16px",marginBottom:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 1px 4px rgba(0,0,0,.04)"}),
    cardLeft:{display:"flex",alignItems:"center",gap:12},
    cardEmoji:{width:42,height:42,background:CR2,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18},
    resBox:{background:WH,border:`1px solid ${CR3}`,borderRadius:13,padding:"16px",marginBottom:12},
    resFila:last=>({display:"flex",justifyContent:"space-between",alignItems:"center",paddingBottom:last?0:9,marginBottom:last?0:9,borderBottom:last?"none":`1px solid ${CR2}`}),
    inp:{width:"100%",background:WH,border:`1px solid ${CR3}`,borderRadius:10,padding:"12px 14px",fontSize:14,color:TX,marginBottom:8,outline:"none",boxSizing:"border-box",fontFamily:"inherit"},
    backBtn:{background:"transparent",border:"none",color:TX2,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",gap:5,marginBottom:14,padding:0},
    progreso:{background:WH,borderBottom:`1px solid ${CR3}`,padding:"10px 18px",display:"flex",gap:4,alignItems:"center",justifyContent:"center"},
    prog:(d,a)=>({height:4,flex:1,maxWidth:55,borderRadius:2,background:d?A:a?A+"66":CR3}),
    successBox:{textAlign:"center",padding:"50px 20px"},
    successIcon:{width:72,height:72,background:`linear-gradient(135deg,${A},#133A6A)`,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,margin:"0 auto 20px"},
    infoBar:{display:"flex",background:WH,borderBottom:`1px solid ${CR3}`},
    infoItem:{flex:1,textAlign:"center",padding:"13px 6px",borderRight:`1px solid ${CR3}`},
    sectionServicios: { 
      /* 0px arriba, 4% lados, 100px abajo para reservar el hueco del desplegable */
      padding: "0px 4% 0px 4%", 
      maxWidth: "100%", 
      margin: "0 auto",
      minHeight: "500px", 
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box"
      
    },
    sectionCompacta: { 
      /* 0px arriba, 10% lados, 60px abajo */
      padding: "0px 10% 0px 10%", 
      maxWidth: "100%", 
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box"
    },
  };

  // ── HOME ──
  useScrollReveal();
  const scrollTo=id=>{
    const el=document.getElementById(id);
    if(el){
      const headerH=document.querySelector('.cliente-header-sticky')?.offsetHeight||50;
      const top=el.getBoundingClientRect().top+window.scrollY-headerH-50;
      window.scrollTo({top,behavior:"smooth"});
    }
  };
  if(paso===0) return(
    <div className="cliente-wrap" style={{ 
      fontFamily: FONT, 
      background: WH, 
      minHeight: "100vh",
      paddingTop: "60px" // Exactamente lo mismo que mide tu header
    }}>
      {/* HEADER FIJO */}
      <div style={{ 
        position: "fixed", 
        top: 0, 
        left: 0, 
        right: 0, 
        height: "70px", 
        background: WH, 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        padding: "0 4%", 
        zIndex: 2000, 
        borderBottom: `1px solid ${CR3}`,
        boxShadow: "0 2px 10px rgba(0, 0, 0, 0.05)"
      }}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center"}}>
            <img 
              src="https://i.postimg.cc/4xxWbVq0/postepelu.webp" 
              alt="Logo Peluquería" 
              style={{
                width: "100%", 
                height: "100%", 
                objectFit: "contain" // Esto evita que la imagen se deforme
              }} 
            />
          </div>
          <span style={{fontSize:17,fontWeight:700,color:TX}}>{CONFIG.nombre}</span>
        </div>
        <div className="hide-mobile" style={{position:"absolute",left:"50%",transform:"translateX(-50%)",display:"flex",gap:4}}>
          {[["servicios","Servicios"],["equipo","Equipo"],["opiniones","Opiniones"],["ubicacion","Contacto"]].map(([id,label])=>(
            <button key={id} style={{background:"transparent",border:"none",color:TX2,cursor:"pointer",fontSize:12,fontWeight:600,padding:"10px 20px",borderRadius:8,transition:"background .15s"}} onClick={()=>scrollTo(id)}
              onMouseEnter={e=>e.target.style.background=CR2}
              onMouseLeave={e=>e.target.style.background="transparent"}>
              {label}
            </button>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button style={{background:`linear-gradient(135deg,${A},#133A6A)`,color:WH,border:"none",borderRadius:100,padding:"9px 30px",fontSize:13,fontWeight:700,cursor:"pointer",letterSpacing:1}} onClick={()=>navigate("/reservar")}>RESERVAR</button>
          <button style={{background:"transparent",border:"none",color:CR3,cursor:"pointer",fontSize:13,padding:0}} onClick={()=>navigate("/login")}>⚙</button>
        </div>
      </div>
      <a href={`https://wa.me/${CONFIG.whatsapp}?text=Som l'Espanyol, i això és la nostra vida!!`} target="_blank" rel="noreferrer" className="wa-fab"><WhatsAppIcon/></a>
      <div className="anim" style={cs.hero}>
        <div style={cs.heroGlow}/>
        <div className="hero-emoji" style={{ 
          paddingTop: "70px",
          marginBottom: 20, 
          display: "flex", 
          justifyContent: "center", 
          width: "100%" 
        }}>
          <img 
            src="https://i.postimg.cc/4xxWbVq0/postepelu.webp" 
            alt="Logo" 
            style={{
              width: "60px",      // Ajusta el tamaño a tu gusto
              height: "auto",      // Para que no se deforme
              borderRadius: "0",   // Quita lo circular
              border: "none",      // Quita el borde
              objectFit: "contain" // Asegura que se vea la imagen completa
            }} 
          />
        </div>
        <h1 className="hero-title" style={{fontSize:32,fontWeight:700,color:WH,marginBottom:6,letterSpacing:1}}>{CONFIG.nombre}</h1>
        <p className="hero-slogan" style={{fontSize:15,color:"#9ec3e8",marginBottom:4,fontStyle:"italic"}}>"{CONFIG.slogan}"</p>
        <p className="hero-dir" style={{fontSize:12,color:"#9ec3e8",marginBottom:28}}>📍 {CONFIG.direccion} · 📞 {CONFIG.telefono}</p>
        <button className="hero-btn btn-pulse" style={cs.btnPpal} onClick={()=>navigate("/reservar")}>RESERVAR CITA</button>
      </div>
      
      <div style={{ padding: "0 4% 0px 4%", marginTop: 20, marginBottom: "30px" }}>
        <div style={{background:WH,border:`1px solid ${CR3}`,borderRadius:14,padding:"16px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <span style={{fontSize:14,fontWeight:700,color:TX,letterSpacing:1,textTransform:"uppercase"}}>Horario</span>
            <Bdg color={CONFIG.horarioGeneral[HOY.getDay()]?OK:ER}>{CONFIG.horarioGeneral[HOY.getDay()]?"Abierto hoy":"Cerrado hoy"}</Bdg>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:20}}>
            {horarioResumido().map(({rango,horas},i)=>(
              <div key={i} style={{background:`${A}12`,border:`1px solid ${A}33`,borderRadius:20,padding:"5px 20px",fontSize:12}}>
                <span style={{fontWeight:700,color:TX}}>{rango}</span><span style={{color:TX2,marginLeft:5}}>{horas}</span>
              </div>
            ))}
            <div style={{background:CR2,border:`1px solid ${CR3}`,borderRadius:20,padding:"5px 20px",fontSize:12,color:TX2}}>Dom — Cerrado</div>
          </div>
        </div>
      </div>
      

      {/* --- SECCIÓN 2: SERVICIOS (ANCHO COMPLETO Y MÁRGENES AJUSTABLES) --- */}
{(() => {
  // --- CONFIGURA AQUÍ TUS ESPACIOS ---
  const margenVertical = "0px";   // Espacio arriba y abajo de la sección
  const margenHorizontal = "4%"; // Espacio a los lados de la fila de cajas
  const separacionCajas = "20px";  // Espacio entre cada cuadrado
  const anchoCajaPC = "20%";     // Tamaño de cada cuadrado
  // ----------------------------------

  return (
    <div id="servicios" className="reveal" style={{ 
      padding: `${margenVertical} 0`, 
      backgroundColor: "#f8f9fa",
      width: "100%",
      overflow: "hidden" 
    }}>
      
      {/* Título de la sección */}
      <div style={cs.sTitle}>✦ Servicios</div>

      {/* Fila de Cajas Centrada */}
      <div style={{
        display: "flex",
        flexWrap: "nowrap",       
        justifyContent: "center", 
        gap: separacionCajas,
        width: "100%",
        padding: `0 ${margenHorizontal} 20px ${margenHorizontal}`,
        overflowX: "auto",        
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none"    
      }}>
        {CONFIG.categorias.map(cat => {
          const svcs = servicios.filter(s => cat.servicioIds.includes(s.id));
          const abierta = catAbierta === cat.id;

          return (
            <div 
              key={cat.id}
              onClick={() => setCatAbierta(abierta ? null : cat.id)}
              style={{
                position: "relative",
                flex: `0 0 ${anchoCajaPC}`,
                aspectRatio: "1 / 1",
                borderRadius: "20px",
                overflow: "hidden",
                cursor: "pointer",
                backgroundImage: `url(${cat.foto})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                boxShadow: abierta ? "0 15px 35px rgba(0,0,0,0.2)" : "0 10px 25px rgba(0,0,0,0.1)",
                transition: "all 0.5s cubic-bezier(0.25, 1, 0.5, 1)",
                transform: abierta ? "scale(1.02)" : "scale(1)"
              }}
            >
              <div style={{
                position: "absolute",
                top: 0, left: 0, right: 0, bottom: 0,
                background: abierta 
                  ? "rgba(0,0,0,0.95)" 
                  : "linear-gradient(to bottom, rgba(0,0,0,0) 60%, rgba(0,0,0,0.85) 100%)",
                display: "flex",
                flexDirection: "column",
                justifyContent: abierta ? "center" : "flex-end", 
                alignItems: "center",
                padding: abierta ? "15px" : "20px",
                transition: "background 0.4s ease-out"
              }}>
                
                {/* Cabecera Categoría */}
                <div style={{ textAlign: "center", marginBottom: abierta ? "15px" : "5px", width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                    <h3 style={{ 
                      color: "#FFF", margin: 0, 
                      fontSize: abierta ? "18px" : "18px", 
                      fontWeight: "800", textTransform: "uppercase" 
                    }}>{cat.nombre}</h3>
                    <div style={{ 
                      color: "#FFF", fontSize: "9px", 
                      transform: abierta ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.4s"
                    }}>▼</div>
                  </div>
                </div>

                {/* Listado de servicios */}
                <div style={{
                  width: "100%",
                  maxHeight: abierta ? "90%" : "0",
                  opacity: abierta ? 1 : 0,
                  transform: abierta ? "translateY(0)" : "translateY(10px)",
                  overflowY: "auto",
                  transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                }}>
                  {svcs.map(s => (
                    <div key={s.id} style={{ 
                        padding: "10px 0", 
                        borderBottom: "1px solid rgba(255,255,255,0.1)",
                        display: "flex",
                        alignItems: "center", // Centra verticalmente nombre/desc y precio
                        justifyContent: "space-between"
                    }}>
                      {/* Lado Izquierdo: Nombre, Tiempo y Desc */}
                      <div style={{ textAlign: "left", flex: 1, paddingRight: "10px" }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "20px", flexWrap: "wrap" }}>
                           <span style={{ color: "#FFF", fontSize: "12px", fontWeight: "600" }}>{s.nombre}</span>
                           <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "10px", fontWeight: "400" }}>
                             ⏱ {s.duracionMin}'
                           </span>
                        </div>
                        
                        {s.desc && (
                          <div style={{ 
                            color: "rgba(255,255,255,0.6)", 
                            fontSize: "10px", 
                            lineHeight: "1.1",
                            marginTop: "3px" 
                          }}>
                            {s.desc}
                          </div>
                        )}
                      </div>

                      {/* Lado Derecho: Precio más grande */}
                      <div style={{ 
                        color: "#FFF", 
                        fontWeight: "800", 
                        fontSize: "15px", // Un poco más grande
                        minWidth: "40px",
                        textAlign: "right"
                      }}>
                         {s.precio}€
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
})()}

      <hr style={{ 
        border: "none", 
        height: "1px", 
        background: `linear-gradient(to right, transparent, ${CR3}, transparent)`, 
        margin: "100px auto 30px auto", /* 100px de la sección anterior, solo 30px para el siguiente título */
        maxWidth: "100%"
      }} />

      {/* --- SECCIÓN EQUIPO DIVIDIDA (IMAGEN IZQ, LISTA DER) --- */}
      <div id="equipo" className="reveal" style={{
        ...cs.sectionEquipo,
        padding: 0, // Quitamos padding lateral para que la imagen pegue al borde si quieres
        overflow: "hidden"
      }}>
        
        <div style={{
          display: "flex",
          flexDirection: window.innerWidth > 768 ? "row" : "column",
          /* --- ESTA LÍNEA ES LA QUE CENTRA EL CONTENIDO DE LA DERECHA CON LA IMAGEN --- */
          alignItems: "center", 
          justifyContent: "center", // Centra el conjunto en el medio si la sección es muy ancha
          gap: "40px",              // Espacio entre la imagen y los nombres
          background: WH,
          padding: "0px"           // Un poco de aire alrededor
        }}>
          
          {/* 1. LADO IZQUIERDO: IMAGEN GRANDE */}
          <div style={{
            flex: "0 0 40%", // Ocupa exactamente el 50%
            position: "relative",
            minHeight: "300px"
          }}>
            <img 
              src="https://i.postimg.cc/Y0TygmSb/peluqueros.jpg" // Cambia esto por la foto de tu local o equipo
              alt="Nuestro Equipo"
              style={{
                width: "100%",
                height: "auto",
                objectFit: "cover", // Esto hace que la imagen rellene todo el espacio sin deformarse
                display: "block"
              }}
            />
          </div>

          {/* 2. LADO DERECHO: LISTA DE INTEGRANTES */}
          <div style={{
            flex: "1",
            padding: window.innerWidth > 768 ? "0px 0px" : "0px 0px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center", // Centra las cajas verticalmente
            gap: "30px"
          }}>
            <div style={{...cs.sTitle, textAlign: "left", marginBottom: "0px"}}>✦ Profesionales</div>
            
            {CONFIG.peluqueros.map(p => (
              <div key={p.id} className="card-hover" style={{
                display: "flex",
                alignItems: "center",
                gap: "15px",
                background: WH,
                padding: "15px",
                borderRadius: "20px",
                border: `1px solid ${CR3}`,
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
              }}>
                {/* Avatar pequeño dentro de la lista */}
                <div style={{ width: 50, height: 50, borderRadius: "50%", background: CR2, flexShrink: 0, overflow: 'hidden' }}>
                  <img src={p.foto || "https://i.postimg.cc/4xxWbVq0/postepelu.webp"} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                </div>
                
                <div>
                  <div style={{ fontWeight: 700, color: TX, fontSize: "16px", textAlign: "left"}}>{p.nombre}</div>
                  <div style={{ fontSize: "12px", color: A, fontWeight: 600, textAlign: "left" }}>{p.especialidad || "Estilista"}</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      <hr style={{ 
        border: "none", 
        height: "1px", 
        background: `linear-gradient(to right, transparent, ${CR3}, transparent)`, 
        margin: "80px auto 30px auto", /* 80px de la sección anterior, solo 30px para el siguiente título */
        maxWidth: "100%"
      }} />

      {/* --- SECCIÓN 3: OPINIONES --- */}
      {valoraciones && valoraciones.length > 0 && (
        <div id="opiniones" className="reveal" style={cs.sectionCompacta}>
          <div style={cs.sTitle}>✦ Opiniones</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
            {valoraciones.map(v => (
              <div key={v.id} style={{background: WH, border: `1px solid ${CR3}`, borderRadius: 13, padding: "20px"}}>
                <div style={{display: "flex", justifyContent: "space-between", marginBottom: 10, alignItems:"center"}}>
                  <span style={{fontSize: 13, fontWeight: 700}}>{v.nombre}</span>
                  <div style={{display: "flex", gap: 1}}>
                    {[1,2,3,4,5].map(i => <span key={i} style={{fontSize: 12, color: i <= v.estrellas ? "#F59E0B" : "#D1D5DB"}}>★</span>)}
                  </div>
                </div>
                <p style={{fontSize: 12, color: TX2, fontStyle: "italic", lineHeight: "1.5"}}>"{v.comentario}"</p>
                <div style={{fontSize: 10, color: A, fontWeight: 700, marginTop: 10}}>{v.servicio}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <hr style={{ 
        border: "none", 
        height: "1px", 
        background: `linear-gradient(to right, transparent, ${CR3}, transparent)`, 
        margin: "80px auto 30px auto", /* 80px de la sección anterior, solo 30px para el siguiente título */
        maxWidth: "1400px"
      }} />

      {/* --- SECCIÓN 4: UBICACIÓN Y CONTACTO --- */}
      <div id="ubicacion" className="reveal" style={cs.sectionCompacta}>
        
        {/* 1. ESTE ES EL NUEVO DIV PARA CONTROLAR EL ANCHO AL 80% */}
        <div style={{
          width: window.innerWidth > 768 ? "80%" : "100%", 
          margin: "0 auto", 
        }}>
          
          <div style={cs.sTitle}>✦ Contacto</div>

          <div style={{
            display: "flex",
            flexDirection: window.innerWidth > 768 ? "row" : "column",
            gap: "40px",
            alignItems: "center",
            marginTop: "0px"
          }}>
            
            {/* BLOQUE IZQUIERDO: TEXTOS */}
            <div style={{ flex: 1, textAlign: "left" }}>
              <p style={{fontSize:20,fontWeight:900, marginBottom: 5, color:TX}}>{CONFIG.nombre}</p>
              <p style={{ color: TX2, fontSize: 15, marginBottom: 25 }}>El detalle marca la diferencia</p>

              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: TX, marginBottom: 8 }}>Contacto</h3>
                <div style={{ fontSize: 14, color: TX2, lineHeight: "1.6" }}>
                  <div><strong>Dirección:</strong> Av. Diagonal 647, Barcelona</div>
                  <div><strong>Teléfono:</strong> <span style={{ color: A, fontWeight: 700 }}>711 212 526</span></div>
                  <div><strong>Email:</strong> mario.vaquero.ia@gmail.com</div>
                </div>
              </div>

              <div style={{ marginBottom: 30 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: TX, marginBottom: 8 }}>Horario</h3>
                <div style={{ fontSize: 14, color: TX2, lineHeight: "1.6" }}>
                  <div>Lunes a Jueves: 9:00 - 20:00</div>
                  <div>Viernes: 9:00 - 20:30</div>
                  <div>Sábado: 9:00 - 15:00</div>
                </div>
              </div>

              {/* BUSCA DONDE ESTÁ TU BOTÓN ACTUAL Y SUSTITÚYELO POR ESTO */}
              <div style={{ 
                display: "flex", 
                gap: "20px", 
                alignItems: "center", 
                marginTop: "25px" 
              }}>
                
                {/* BOTÓN PRINCIPAL CON ALTURA FIJA */}
                <button 
                  onClick={() => window.location.href = '/reservar'}
                  style={{
                    height: "50px", // <-- IGUALAMOS LA ALTURA AL BOTÓN DE INSTA
                    padding: "0 25px", // Quitamos el padding vertical (12px) y dejamos solo el horizontal
                    display: "flex", // Añadimos flex para centrar el texto verticalmente
                    alignItems: "center",
                    justifyContent: "center",
                    background: A,
                    color: WH,
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 14,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    flex: window.innerWidth > 768 ? "0 1 auto" : "1",
                    transition: "all 0.3s ease", // <-- ESTO HACE QUE SEA SUAVE
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.08)"}
                  onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                >
                  PEDIR CITA AHORA
                </button>

                {/* BOTÓN INSTAGRAM CON DEGRADADO COMPLETO */}
                <a 
                  href="https://www.instagram.com/_mvaquero01" // Pon aquí tu link real
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "50px",
                    height: "50px",
                    /* EL DEGRADADO DE INSTAGRAM */
                    background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
                    borderRadius: "8px",
                    textDecoration: "none",
                    flexShrink: 0,
                    boxShadow: "0 4px 10px rgba(220, 39, 67, 0.2)",
                    transition: "transform 0.2s ease",
                    transition: "all 0.3s ease", // <-- ESTO HACE QUE SEA SUAVE
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.08)"}
                  onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                >
                  {/* Icono en blanco para que resalte sobre el degradado */}
                  <svg 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="#FFFFFF" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    style={{ width: "27px", height: "27px" }}
                  >
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                  </svg>
                </a>
              </div>
            </div>

            {/* BLOQUE DERECHO: MAPA SIN ERRORES DE API */}
            <div style={{ flex: 1, width: "100%" }}>
              <div style={{ 
                width: "100%", 
                height: "380px", 
                borderRadius: 13, 
                overflow: "hidden", 
                border: `1px solid ${CR3}`,
                boxShadow: "0 4px 15px rgba(0,0,0,0.05)"
              }}>
                <iframe 
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2993.438515321355!2d2.115367676579222!3d41.38627059604164!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x12a4986487e3d81d%3A0x330058e578f1496a!2sAv.%20Diagonal%2C%20647%2C%20Les%20Corts%2C%2008028%20Barcelona!5e0!3m2!1ses!2ses!4v1715600000000!5m2!1ses!2ses" 
                  width="100%" 
                  height="100%" 
                  style={{ border: 0 }} 
                  allowFullScreen="" 
                  loading="lazy" 
                  referrerPolicy="no-referrer-when-downgrade"
                ></iframe>
              </div>

              {/* BOTÓN VER EN GOOGLE MAPS */}
              <div style={{ textAlign: "center", marginTop: "15px" }}>
                <a 
                  href="https://maps.app.goo.gl/ANdrx2wzSvmpSZJL6"
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    color: A,
                    fontSize: "14px",
                    fontWeight: 700,
                    textDecoration: "none",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    background: `${A}10`,
                    border: `1px solid ${A}30`
                  }}
                >
                  <span>🗺️ Ver en Google Maps</span>
                </a>
              </div>
            </div>
          </div>
        </div> {/* 2. CIERRE DEL DIV DEL 80% */}
      </div>
      <div style={{height:80}}/>
    </div>
  );



  // ── FLUJO RESERVA (pasos 1-5) ──
  // ★ Botón CONTINUAR fijo en la parte inferior
  const btnOk = paso===1?!!selServicio : paso===2?!!selPeluquero : paso===3?!!(selDia&&selHora) : paso===4?!!(form.nombre&&form.telefono) : false;
  const btnLabel = paso===4?"CONFIRMAR RESERVA ✓":"CONTINUAR →";
  const btnAction = ()=>{
    if(!btnOk) return;
    if(paso===1) irAPaso(2);
    else if(paso===2) irAPaso(3);
    else if(paso===3) irAPaso(4);
    else if(paso===4) confirmarReserva();
  };

  return(
    <div className="cliente-wrap" style={{ fontFamily: FONT, background: WH, minHeight: "100vh", paddingTop: "60px" }}>
      <div className="cliente-header-sticky" style={{ ...cs.header, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4%", background: WH, borderBottom: `1px solid ${CR3}`, width: "100%", boxSizing: "border-box", height: "70px", position: "fixed", top: 0, left: 0, zIndex:2000 }}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center"}}>
            <img 
              src="https://i.postimg.cc/4xxWbVq0/postepelu.webp" 
              alt="Logo Peluquería" 
              style={{
                width: "100%", 
                height: "100%", 
                objectFit: "contain" // Esto evita que la imagen se deforme
              }} 
            />
          </div>
          <span style={{fontSize:17,fontWeight:700,color:TX}}>{CONFIG.nombre}</span>
        </div>
      </div>

      {paso>=1&&paso<=4&&(
        <div style={cs.progreso}>
          {[1,2,3,4].map(p=><div key={p} style={cs.prog(paso>p,paso===p)}/>)}
          <span style={{fontSize:10,color:TX2,marginLeft:8}}>Paso {paso} de 4</span>
        </div>
      )}

      {/* ── contenido con padding-bottom para que no tape el botón fijo ── */}
      <div key={paso} className="slide-in" style={{paddingBottom: paso>=1&&paso<=4?90:0}}>

        {paso === 1 && (
          <div style={cs.section}>
            <button style={cs.backBtn} onClick={reset}>← Inicio</button>
            <div style={cs.sTitle}>✦ ¿Qué servicio necesitas?</div>
            
            {/* Contenedor en Grid para ponerlos uno al lado del otro */}
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", 
              gap: "15px",
              alignItems: "start" 
            }}>
              {CONFIG.categorias.map(cat => {
                const svcs = servicios.filter(s => cat.servicioIds.includes(s.id));
                const abierta = catAbierta === cat.id;
                
                return (
                  <div key={cat.id} className="card-hover" style={{
                    background: WH,
                    border: `1px solid ${CR3}`,
                    borderRadius: 13,
                    overflow: "hidden", // Para que el contenido no se salga de las esquinas redondeadas
                    height: "fit-content"
                  }}>
                    {/* Cabecera de la categoría */}
                    <div style={{...cs.catHeader, borderBottom: abierta ? `1px solid ${CR3}` : "none"}} 
                        onClick={() => setCatAbierta(abierta ? null : cat.id)}>
                      <div style={cs.catLeft}>
                        <div style={cs.catIcon}>{cat.emoji}</div>
                        <div>
                          <div style={{fontSize: 14, fontWeight: 700, color: TX}}>{cat.nombre}</div>
                          <div style={{fontSize: 11, color: TX2}}>{svcs.length} servicio{svcs.length > 1 ? "s" : ""}</div>
                        </div>
                      </div>
                      <span style={{
                        color: TX2, 
                        fontSize: 18, 
                        transform: abierta ? "rotate(180deg)" : "rotate(0deg)", 
                        transition: ".2s",
                        display: "inline-block"
                      }}>▾</span>
                    </div>

                    {/* Contenido desplegable (Sin position absolute para que funcione bien) */}
                    {abierta && (
                      <div style={{ background: WH }}>
                        {svcs.map(s => (
                          <div key={s.id} 
                              style={cs.svcRow(selServicio?.id === s.id)} 
                              onClick={() => setSelServicio(s)}>
                            <div style={{display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center"}}>
                              <div>
                                <span style={{fontSize: 13, color: TX, fontWeight: 600}}>{s.nombre}</span>
                                <span style={{fontSize: 11, color: TX2, marginLeft: 8}}>⏱ {s.duracionMin} min</span>
                              </div>
                              <div style={{display: "flex", alignItems: "center", gap: 8}}>
                                <span style={{fontSize: 14, fontWeight: 700, color: A}}>€{s.precio}</span>
                                {selServicio?.id === s.id && <span style={{color: A}}>✓</span>}
                              </div>
                            </div>
                            {s.desc && <div style={{fontSize: 11, color: TX2, marginTop: 2}}>{s.desc}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {paso === 2 && (
          <div style={cs.section}>
            <button style={cs.backBtn} onClick={() => { irAPaso(1); setSelPeluquero(null); }}>← Cambiar servicio</button>
            <div style={cs.sTitle}>✦ Elige tu profesional</div>
            <div style={{background: CR2, borderRadius: 10, padding: "9px 14px", marginBottom: 14, fontSize: 12, color: TX2}}>
              {selServicio?.emoji} {selServicio?.nombre} · ⏱ {selServicio?.duracionMin} min · <span style={{color: A, fontWeight: 700}}>€{selServicio?.precio}</span>
            </div>

            {/* Grid horizontal para selección de peluquero */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "20px"
            }}>
              {CONFIG.peluqueros.map(p => (
                <div key={p.id} className="card-hover" style={{...cs.card(selPeluquero?.id === p.id), marginBottom: 0}} onClick={() => setSelPeluquero(p)}>
                  <div style={cs.cardLeft}>
                    <div style={cs.cardEmoji}>{p.emoji}</div>
                    <div>
                      <div style={{fontSize: 14, fontWeight: 700, color: TX}}>{p.nombre}</div>
                      <div style={{fontSize: 11, color: TX2}}>{p.especialidad}</div>
                    </div>
                  </div>
                  {selPeluquero?.id === p.id ? <span style={{color: A, fontSize: 18}}>✓</span> : <div style={{width: 10, height: 10, borderRadius: "50%", background: p.color}} />}
                </div>
              ))}
            </div>
          </div>
        )}

        {paso===3&&(
          <div style={cs.section}>
            <button style={cs.backBtn} onClick={()=>{irAPaso(2);setSelDia(null);setSelHora(null);}}>← Cambiar profesional</button>
            <div style={cs.sTitle}>✦ Elige fecha y hora</div>
            <div style={{background:CR2,borderRadius:10,padding:"9px 14px",marginBottom:16,fontSize:12,color:TX2}}>{selPeluquero?.emoji} {selPeluquero?.nombre} · {selServicio?.nombre} · <span style={{color:A,fontWeight:700}}>€{selServicio?.precio}</span></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:4}}>
              {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map(d=>(
                <div key={d} style={{textAlign:"center",fontSize:12,fontWeight:700,color:d==="Dom"?ER+"99":TX2,textTransform:"uppercase",letterSpacing:.5,padding:"3px 0"}}>{d}</div>
              ))}
            </div>
            {getCalendarWeeks().map((sem,si)=>(
              <div key={si} style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:4}}>
                {sem.map((d,di)=>{
                  const dISO=isoDate(d), esPasado=d<HOY, esDom=d.getDay()===0, esFest=festivosSet.has(dISO);
                  const abiertoPelu=!!selPeluquero?.horario[d.getDay()], abiertoGen=!!CONFIG.horarioGeneral[d.getDay()];
                  const estaBloqueado=selPeluquero?peluqueroEstaBloqueado(selPeluquero.id,dISO,bloqueos):false;
                  const disp=!esPasado&&!esDom&&!esFest&&abiertoPelu&&abiertoGen&&!estaBloqueado;
                  const a=selDia?.toDateString()===d.toDateString();
                  return(
                    <button key={di} style={{background:a?`linear-gradient(135deg,${A},#133A6A)`:disp?WH:CR,border:`1px solid ${a?A:esDom||esPasado||esFest||estaBloqueado?"transparent":disp?CR3:CR3}`,borderRadius:9,padding:"6px 2px",cursor:disp?"pointer":"default",textAlign:"center",opacity:esPasado?.25:esFest||estaBloqueado?.35:1}} disabled={!disp} onClick={()=>{if(disp){setSelDia(d);setSelHora(null);}}}>
                      <span style={{fontSize:15,fontWeight:700,color:a?WH:esDom?ER+"88":esFest||estaBloqueado?ER+"66":disp?TX:TX2,display:"block"}}>{d.getDate()}</span>
                      <span style={{fontSize:12,color:a?"#FFE4A0":TX2,display:"block"}}>{MESES_ES[d.getMonth()]}</span>
                    </button>
                  );
                })}
              </div>
            ))}
            {/* 1. Primero verás la condición del día seleccionado */}
            {selDia && (
              <>
                <div style={{ height: 0 }} />
                <div style={{ ...cs.sTitle, marginTop: 50}}>
                  Horas disponibles — {fmtLarga(selDia)}
                </div>

                {/* 2. AQUÍ ESTÁ EL CONTENEDOR QUE BUSCAS */}
                {slots.length > 0 ? (
                  <div style={{
                    display: "flex",          // Cambia el estilo aquí
                    flexWrap: "wrap",
                    justifyContent: "center", 
                    gap: "20px",
                    marginTop: "15px",
                    width: "90%",
                    maxWidth: "90%",
                    margin: "0 auto"
                  }}>
                    {/* 3. Y aquí dentro está el mapeo de los botones */}
                    {slots.map((h, i) => (
                      <button 
                        key={h} 
                        className="slot-btn" 
                        style={{
                          ...cs.horaBtn(selHora === h),
                          flex: "0 1 85px", 
                          minWidth: "15px",
                          textAlign: "center",
                          padding: "10px 5px"
                        }} 
                        onClick={() => setSelHora(h)}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                ) : (
                  /* El div de "Sin disponibilidad" */
                  <div style={{ textAlign: "center", padding: "10px", color: TX2, fontSize: 15, background: CR2, borderRadius: 12 }}>Sin disponibilidad este día</div>
                )}
              </>

          )}
          </div>
        )}

        {paso===4&&(
          <div style={cs.section}>
            <button style={cs.backBtn} onClick={()=>irAPaso(3)}>← Cambiar fecha</button>
            <div style={cs.sTitle}>✦ Confirmar reserva</div>
            <div style={cs.resBox}>
              {[["Servicio",selServicio?.nombre],["Duración",`${selServicio?.duracionMin} min`],["Profesional",`${selPeluquero?.emoji} ${selPeluquero?.nombre}`],["Fecha",selDia?fmtLarga(selDia):""],["Hora",selHora]].map(([l,v],i,arr)=>(
                <div key={i} style={cs.resFila(i===arr.length-1)}><span style={{fontSize:11,color:TX2,textTransform:"uppercase",letterSpacing:1}}>{l}</span><span style={{fontSize:13,color:TX,fontWeight:700,textAlign:"right"}}>{v}</span></div>
              ))}
            </div>
            <div style={{...cs.resBox,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:13,color:TX2}}>Total</span><span style={{fontSize:26,fontWeight:700,color:A}}>€{selServicio?.precio}</span></div>
            <input style={cs.inp} placeholder="Tu nombre completo" value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})}/>
            <input style={cs.inp} placeholder="Tu WhatsApp (recibirás confirmación)" value={form.telefono} onChange={e=>setForm({...form,telefono:e.target.value})}/>
          </div>
        )}

        {paso===5&&(
          <div style={cs.successBox}>
            <div style={cs.successIcon}>✓</div>
            <h2 style={{fontSize:24,color:A,marginBottom:6,letterSpacing:1}}>¡Reserva confirmada!</h2>
            <p style={{color:TX2,marginBottom:20,fontStyle:"italic"}}>Te esperamos, {form.nombre}</p>
            <div style={{...cs.resBox,maxWidth:340,margin:"0 auto 16px",textAlign:"left"}}>
              {[["Peluquería",CONFIG.nombre],["Servicio",selServicio?.nombre],["Profesional",`${selPeluquero?.emoji} ${selPeluquero?.nombre}`],["Fecha y hora",selDia?`${fmtLarga(selDia)} · ${selHora}`:""],[" Precio",`€${selServicio?.precio}`]].map(([l,v],i,arr)=>(
                <div key={i} style={cs.resFila(i===arr.length-1)}><span style={{fontSize:11,color:TX2,textTransform:"uppercase",letterSpacing:1}}>{l.trim()}</span><span style={{fontSize:13,fontWeight:700,color:i===arr.length-1?A:TX,textAlign:"right"}}>{v}</span></div>
              ))}
            </div>
            <div style={{background:"#25D36610",border:"1px solid #25D36633",borderRadius:12,padding:"12px 16px",maxWidth:340,margin:"0 auto 20px"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><span style={{fontSize:18}}>💬</span><span style={{fontSize:12,fontWeight:700,color:"#25D366"}}>Confirmación por WhatsApp</span></div>
              <a href={`https://wa.me/${CONFIG.whatsapp}?text=${waMsgCliente}`} target="_blank" rel="noreferrer" style={{display:"inline-block",background:"#25D366",color:WH,borderRadius:8,padding:"8px 16px",fontSize:12,fontWeight:700,textDecoration:"none"}}>Ver mensaje →</a>
            </div>
            <button style={{background:`linear-gradient(135deg,${A},#133A6A)`,color:WH,border:"none",borderRadius:12,padding:"14px 40px",fontSize:14,fontWeight:700,cursor:"pointer"}} onClick={reset}>VOLVER AL INICIO</button>
          </div>
        )}
      </div>

      {/* ★ STICKY BOTTOM BUTTON — solo en pasos 1-4 */}
      {paso>=1&&paso<=4&&(
        <div className="sticky-bottom">
          <button
            style={{width:"100%",background:btnOk?`linear-gradient(135deg,${A},#133A6A)`:CR2,color:btnOk?WH:TX2,border:btnOk?"none":`1px solid ${CR3}`,borderRadius:12,padding:"14px",fontSize:14,fontWeight:700,cursor:btnOk?"pointer":"not-allowed",letterSpacing:.5}}
            disabled={!btnOk}
            onClick={btnAction}
          >
            {btnLabel}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// ADMIN PANEL
// ─────────────────────────────────────────────
function NuevaCitaModal({show, onClose, clientes, servicios, bloqueos, festivosSet, citas, onCreada}){
  const [form,setForm]=useState({nombre:"",telefono:"",servicioId:"",peluqueroId:"",fecha:"",hora:"",nota:""});
  const [clienteRec,setClienteRec]=useState(null);
  const [showCal,setShowCal]=useState(false);

  const buscarCliente=tel=>{
    const found=clientes.find(c=>c.telefono===tel.replace(/\s/g,""));
    setClienteRec(found||null);
    if(found) setForm(f=>({...f,nombre:found.nombre,telefono:tel}));
  };

  const slotsManuales=useMemo(()=>{
    if(!form.peluqueroId||!form.fecha||!form.servicioId) return [];
    if(festivosSet.has(form.fecha)) return [];
    const pel=CONFIG.peluqueros.find(p=>p.id===Number(form.peluqueroId));
    if(!pel||peluqueroEstaBloqueado(pel.id,form.fecha,bloqueos)) return [];
    const fecha=new Date(form.fecha+"T12:00:00");
    const hp=pel.horario[fecha.getDay()]; if(!hp) return [];
    const svc=servicios.find(s=>s.id===Number(form.servicioId)); if(!svc) return [];
    const todos=generarSlots(hp,svc.duracionMin);
    const citasDelDia=citas.filter(c=>c.fecha===form.fecha&&c.peluqueroId===pel.id&&c.estado!=="no-show");
    const disponibles=filtrarSlotsOcupados(todos,svc.duracionMin,citasDelDia);
    if(form.fecha===HOY_ISO){const ahora=new Date();const m=ahora.getHours()*60+ahora.getMinutes()+15;return disponibles.filter(h=>toMin(h)>m);}
    return disponibles;
  },[form.peluqueroId,form.fecha,form.servicioId,citas,bloqueos,festivosSet]);

  const confirmar=async()=>{
    if(!form.nombre||!form.servicioId||!form.peluqueroId||!form.fecha||!form.hora) return;
    const svc=servicios.find(s=>s.id===Number(form.servicioId));
    const pel=CONFIG.peluqueros.find(p=>p.id===Number(form.peluqueroId));
    await crearCita({clienteNombre:form.nombre,clienteTel:form.telefono,servicio:svc.nombre,servicioId:svc.id,peluqueroId:pel.id,peluquero:pel.nombre,fecha:form.fecha,hora:form.hora,precio:svc.precio,estado:"pendiente",nota:form.nota});
    if(form.telefono){
      const docId=form.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/gi,"_")+"_"+form.telefono;
      const ref=doc(db,"clientes",docId);
      const snap=await getDoc(ref);
      if(!snap.exists()){
        await setDoc(ref,{nombre:form.nombre,telefono:form.telefono,visitas:0,gasto:0,ultimaVisita:"",nota:"",historial:[]});
      }
    }
    setForm({nombre:"",telefono:"",servicioId:"",peluqueroId:"",fecha:"",hora:"",nota:""});
    setClienteRec(null);
    onCreada();
  };

  if(!show) return null;
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:WH,borderRadius:18,padding:"28px",width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h3 style={{fontSize:16,fontWeight:700,color:TX}}>Nueva cita manual</h3>
          <button style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:TX2}} onClick={onClose}>✕</button>
        </div>
        <div style={{marginBottom:10}}><Lbl>Teléfono</Lbl><Inp value={form.telefono} onChange={e=>{setForm(f=>({...f,telefono:e.target.value}));buscarCliente(e.target.value);}} placeholder="Ej: 666 111 222"/>{clienteRec&&<div style={{background:`${OK}12`,border:`1px solid ${OK}33`,borderRadius:8,padding:"8px 12px",marginTop:6,fontSize:12,color:TX}}>✓ {clienteRec.nombre} · {clienteRec.visitas} visitas</div>}</div>
        <div style={{marginBottom:10}}><Lbl>Nombre</Lbl><Inp value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} placeholder="Nombre del cliente"/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div><Lbl>Servicio</Lbl><Sel value={form.servicioId} onChange={e=>setForm(f=>({...f,servicioId:e.target.value,hora:""}))}>
            <option value="">Elige servicio</option>{servicios.map(s=><option key={s.id} value={s.id}>{s.nombre} — €{s.precio}</option>)}
          </Sel></div>
          <div><Lbl>Peluquero</Lbl><Sel value={form.peluqueroId} onChange={e=>setForm(f=>({...f,peluqueroId:e.target.value,hora:"",fecha:""}))}>
            <option value="">Elige peluquero</option>{CONFIG.peluqueros.map(p=><option key={p.id} value={p.id}>{p.emoji} {p.nombre}</option>)}
          </Sel></div>
        </div>
        <div style={{marginBottom:10}}>
          <Lbl>Fecha</Lbl>
          <div style={{position:"relative"}}>
            <button style={{width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,padding:"10px 13px",fontSize:13,color:form.fecha?TX:TX2,textAlign:"left",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"space-between"}} onClick={()=>setShowCal(v=>!v)}>
              <span>{form.fecha||"Seleccionar fecha..."}</span><span>📅</span>
            </button>
            {showCal&&<div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:200}}><MiniCalPicker value={form.fecha} onChange={iso=>{setForm(f=>({...f,fecha:iso,hora:""}));setShowCal(false);}} festivosSet={festivosSet} bloqueosPelId={form.peluqueroId?Number(form.peluqueroId):null} bloqueos={bloqueos}/></div>}
          </div>
        </div>
        <div style={{marginBottom:10}}><Lbl>Hora</Lbl><Sel value={form.hora} onChange={e=>setForm(f=>({...f,hora:e.target.value}))} disabled={!slotsManuales.length}><option value="">{!slotsManuales.length?"Elige servicio, peluquero y fecha":"Elige hora"}</option>{slotsManuales.map(h=><option key={h} value={h}>{h}</option>)}</Sel></div>
        <div style={{marginBottom:16}}><Lbl>Nota (opcional)</Lbl><Inp value={form.nota} onChange={e=>setForm(f=>({...f,nota:e.target.value}))} placeholder="Observaciones..."/></div>
        <div style={{display:"flex",gap:8}}>
          <Btn ok={false} onClick={onClose}>Cancelar</Btn>
          <Btn ok={!!(form.nombre&&form.servicioId&&form.peluqueroId&&form.fecha&&form.hora)} onClick={confirmar} style={{flex:1}}>Confirmar cita →</Btn>
        </div>
      </div>
    </div>
  );
}

function AdminPage({valoraciones,setValoraciones,festivos,setFestivos,bloqueos,setBloqueos,servicios,setServicios}){
  const navigate=useNavigate();
  const [searchParams,setSearchParams]=useSearchParams();
  const tab=searchParams.get("tab")||"citas";
  const setTab=t=>setSearchParams({tab:t});

  // ★ subTab para Config elevado aquí para no perder el subtab al guardar
  const [configSubTab,setConfigSubTab]=useState("servicios");

  const handleLogout=()=>{ sessionStorage.removeItem("authRole"); navigate("/"); };

  const [toastVisible,setToastVisible]=useState(false);
  const [toastTimer,setToastTimer]=useState(null);
  const [toastClienteVisible,setToastClienteVisible]=useState(false);
  const [toastClienteTimer,setToastClienteTimer]=useState(null);
  const [clienteSel,setClienteSel]=useState(null);
  const [citas,setCitas]=useState([]);
  const [clientes,setClientes]=useState([]);

  // filtros elevados para que no se pierdan al cambiar estado
  const [vistaCitas,setVistaCitas]=useState("hoy");
  const [weekOffsetCitas,setWeekOffsetCitas]=useState(0);
  const [pelFiltroCitas,setPelFiltroCitas]=useState(null);
  const [filtFecha,setFiltFecha]=useState("hoy");
  const [filtDesde,setFiltDesde]=useState("");
  const [filtHasta,setFiltHasta]=useState("");
  const [filtPel,setFiltPel]=useState("todas");
  const [filtEstado,setFiltEstado]=useState("todos");
  const [mostrarBuscador,setMostrarBuscador]=useState(false);
  const [filtSemanaOffset,setFiltSemanaOffset]=useState(0);
  const busqCitaRef=useRef("");

  useEffect(()=>{ const u1=suscribirCitas(setCitas); const u2=suscribirClientes(setClientes); return()=>{u1();u2();}; },[]);

  const cambiarEstado=useCallback(async(id,estado,estadoAnterior="pendiente")=>{
    setCitas(prev=>prev.map(c=>c.id===id?{...c,estado}:c));
    try{
      await actualizarCita(id,{estado});
      const citaSnap=await getDoc(doc(db,"citas",id));
      if(!citaSnap.exists()) return;
      const cita=citaSnap.data();
      if(!cita.clienteTel) return;
      console.log("Buscando cliente:", cita.clienteNombre, cita.clienteTel);
      const nuevoDocId=cita.clienteNombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/gi,"_")+"_"+cita.clienteTel;
      let clienteRef=doc(db,"clientes",nuevoDocId);
      let clienteSnap=await getDoc(clienteRef);
      // Si no lo encuentra por nombre_telefono, busca por teléfono (clientes antiguos)
      if(!clienteSnap.exists()){
        const q=query(collection(db,"clientes"),where("telefono","==",cita.clienteTel));
        const snap=await getDocs(q);
        if(snap.empty) return;
        clienteRef=doc(db,"clientes",snap.docs[0].id);
        clienteSnap=await getDoc(clienteRef);
      }
      if(!clienteSnap.exists()) return;
      const cl=clienteSnap.data();
      if(estado==="completada") await updateDoc(clienteRef,{visitas:(cl.visitas||0)+1,gasto:(cl.gasto||0)+cita.precio,ultimaVisita:cita.fecha,historial:[...(cl.historial||[]),{fecha:cita.fecha,servicio:cita.servicio,peluquero:cita.peluquero,precio:cita.precio}]});
      if(estado==="no-show") await updateDoc(clienteRef,{noShows:(cl.noShows||0)+1});
      if(estado==="pendiente"&&estadoAnterior==="completada") await updateDoc(clienteRef,{visitas:Math.max((cl.visitas||0)-1,0),gasto:Math.max((cl.gasto||0)-cita.precio,0),historial:(cl.historial||[]).filter((_,i,arr)=>i!==arr.length-1)});
      if(estado==="pendiente"&&estadoAnterior==="no-show") await updateDoc(clienteRef,{noShows:Math.max((cl.noShows||0)-1,0)});
    }catch(e){console.error(e);}
  },[]);

  const festivosSet=useMemo(()=>new Set(festivos.map(f=>f.fecha)),[festivos]);

  const as = {
    root: { 
      minHeight: "100vh", 
      background: CR, 
      fontFamily: FONT, 
      color: TX, 
      width: "100%", 
      margin: 0 
    },
    header: { 
      background: WH, 
      borderBottom: `1px solid ${CR3}`, 
      padding: "11px 18px", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "space-between", 
      position: "sticky", 
      top: 0, 
      zIndex: 20, 
      width: "100%" 
    },
    tabBar: { 
      display: "flex", 
      background: WH, 
      borderBottom: `1px solid ${CR3}`, 
      overflowX: "auto", 
      padding: "0 12px", 
      position: "sticky", 
      top: "var(--header-h,64px)", 
      zIndex: 19, 
      width: "100%" 
    },
    body: { 
      padding: "18px", 
      width: "90%", 
      maxWidth: "90%", 
      margin: 0 
    },
    card: { 
      background: WH, 
      border: `1px solid ${CR3}`, 
      borderRadius: 14, 
      padding: "18px", 
      marginBottom: 14, 
      width: "100%" 
    },
    kpiGrid: { 
      display: "grid", 
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
      gap: 10, 
      marginBottom: 16, 
      width: "100%" 
    },
    twoCol: { 
      display: "grid", 
      gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", 
      gap: 14, 
      width: "100%" 
    },
    table: { width: "100%", borderCollapse: "collapse" },
    th: { textAlign: "left", fontSize: 10, color: TX2, textTransform: "uppercase", padding: "7px 10px", borderBottom: `1px solid ${CR2}`, background: CR },
    td: { padding: "10px 10px", fontSize: 12, color: TX, borderBottom: `1px solid ${CR2}` },
    actBtn: c => ({ background: c + "15", border: `1px solid ${c}33`, color: c, borderRadius: 6, padding: "4px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer", marginRight: 4 }),
    row: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${CR2}` },
    tabBtn: a => ({ padding: "11px 14px", fontSize: 12, fontWeight: a ? 700 : 400, color: a ? A : TX2, borderBottom: a ? `2px solid ${A}` : "2px solid transparent", cursor: "pointer", background: "none", border: "none", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }),
    kpi: { background: WH, border: `1px solid ${CR3}`, borderRadius: 12, padding: "14px", boxShadow: "0 1px 4px rgba(0,0,0,.04)" },
    kpiVal: { fontSize: 24, fontWeight: 700, color: A, marginBottom: 2 },
    kpiLbl: { fontSize: 10, color: TX2, textTransform: "uppercase", letterSpacing: 1 },
    cardTitle: { fontSize: 11, fontWeight: 700, color: TX2, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14 },
    chartH: { height: 180, marginTop: 8, width: "100%" },
  };

  // ──────────────────────
  // TAB CITAS
  // ──────────────────────
  const TabCitas=()=>{
    const [,forceUpdate]=useState(0);
    const localBusqRef=useRef(busqCitaRef.current);
    const [showManual,setShowManual]=useState(false);
    const [editNota,setEditNota]=useState(null);
    const [notaVal,setNotaVal]=useState("");
    const [manForm,setManForm]=useState({nombre:"",telefono:"",servicioId:"",peluqueroId:"",fecha:"",hora:"",nota:""});
    const telefonoValRef=useRef("");
    const nombreValRef=useRef("");
    const notaValRef=useRef("");
    const [clienteRec,setClienteRec]=useState(null);
    const [showCalPicker,setShowCalPicker]=useState(false);
    const [showFiltDesdeCalPicker,setShowFiltDesdeCalPicker]=useState(false);
    const [showFiltHastaCalPicker,setShowFiltHastaCalPicker]=useState(false);
    const [menuAbierto,setMenuAbierto]=useState(null);
    const [citaEditando,setCitaEditando]=useState(null);
    const [citaBorrar,setCitaBorrar]=useState(null);
    const [showEditCalPicker,setShowEditCalPicker]=useState(false);
    const weekDays=getWeekDays(weekOffsetCitas);
    const filtWeekDays=getWeekDays(filtSemanaOffset);

    const citasHoy=citas.filter(c=>c.fecha===HOY_ISO).sort((a,b)=>a.hora.localeCompare(b.hora));
    const citasFiltradas=useMemo(()=>{
      let res=[...citas];
      if(filtFecha==="hoy") res=res.filter(c=>c.fecha===HOY_ISO);
      else if(filtFecha==="semana") res=res.filter(c=>filtWeekDays.some(d=>isoDate(d)===c.fecha));
      else if(filtFecha==="fecha"&&filtDesde) res=res.filter(c=>c.fecha===filtDesde);
      else if(filtFecha==="rango"&&filtDesde) res=res.filter(c=>c.fecha>=filtDesde&&(!filtHasta||c.fecha<=filtHasta));
      if(filtPel!=="todas") res=res.filter(c=>c.peluqueroId===Number(filtPel));
      if(filtEstado!=="todos") res=res.filter(c=>c.estado===filtEstado);
      if(localBusqRef.current){ const q=normalize(localBusqRef.current); res=res.filter(c=>normalize(c.clienteNombre).includes(q)||c.clienteTel?.includes(localBusqRef.current)||similitud(localBusqRef.current,c.clienteNombre)>60); }
      return res.sort((a,b)=>a.fecha===b.fecha?a.hora.localeCompare(b.hora):a.fecha.localeCompare(b.fecha));
    },[citas,filtFecha,filtDesde,filtHasta,filtPel,filtEstado,weekDays]);

    const hayFiltros=localBusqRef.current||filtFecha!=="hoy"||filtPel!=="todas"||filtEstado!=="todos";
    const ingrHoy=citasHoy.filter(c=>c.estado==="completada").reduce((s,c)=>s+c.precio,0);
    const pendHoy=citasHoy.filter(c=>c.estado==="pendiente").length;
    const noShowHoy=citasHoy.filter(c=>c.estado==="no-show").length;

    const guardarNota=async(id)=>{ setCitas(prev=>prev.map(c=>c.id===id?{...c,nota:notaVal}:c)); try{await actualizarCita(id,{nota:notaVal});}catch(e){} setEditNota(null); };
    const buscarCliente=tel=>{
      const found=clientes.find(c=>c.telefono===tel.replace(/\s/g,""));
      setClienteRec(found||null);
      if(found) setManForm(f=>({...f,nombre:found.nombre,telefono:tel}));
    };

    const slotsManuales=useMemo(()=>{
      if(!manForm.peluqueroId||!manForm.fecha||!manForm.servicioId) return [];
      if(festivosSet.has(manForm.fecha)) return [];
      const pel=CONFIG.peluqueros.find(p=>p.id===Number(manForm.peluqueroId)); if(!pel) return [];
      if(peluqueroEstaBloqueado(pel.id,manForm.fecha,bloqueos)) return [];
      const fecha=new Date(manForm.fecha+"T12:00:00"); const hp=pel.horario[fecha.getDay()]; if(!hp) return [];
      const svc=servicios.find(s=>s.id===Number(manForm.servicioId)); if(!svc) return [];
      const todos=generarSlots(hp,svc.duracionMin);
      const citasDelDia=citas.filter(c=>c.fecha===manForm.fecha&&c.peluqueroId===pel.id&&c.estado!=="no-show");
      const disponibles=filtrarSlotsOcupados(todos,svc.duracionMin,citasDelDia);
      if(manForm.fecha===HOY_ISO){ const ahora=new Date(); const m=ahora.getHours()*60+ahora.getMinutes()+15; return disponibles.filter(h=>toMin(h)>m); }
      return disponibles;
    },[manForm.peluqueroId,manForm.fecha,manForm.servicioId,citas,bloqueos,festivosSet]);

    const crearCitaManual=async()=>{
      if(!manForm.nombre||!manForm.servicioId||!manForm.peluqueroId||!manForm.fecha||!manForm.hora) return;
      const svc=servicios.find(s=>s.id===Number(manForm.servicioId));
      const pel=CONFIG.peluqueros.find(p=>p.id===Number(manForm.peluqueroId));
      await crearCita({clienteNombre:nombre,clienteTel:telefono,servicio:svc.nombre,servicioId:svc.id,peluqueroId:pel.id,peluquero:pel.nombre,fecha:manForm.fecha,hora:manForm.hora,precio:svc.precio,estado:"pendiente",nota:manForm.nota});
      if(manForm.telefono){
        const docId=nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/gi,"_")+"_"+manForm.telefono;
        const ref=doc(db,"clientes",docId);
        const snap=await getDoc(ref);
        console.log("Buscando cliente con ID:", docId, "Existe:", snap.exists());
        if(!snap.exists()){
          const q=query(collection(db,"clientes"),where("telefono","==",manForm.telefono));
          const snapQ=await getDocs(q);
          console.log("Búsqueda por teléfono, resultados:", snapQ.size, snapQ.docs.map(d=>d.id));
          await setDoc(ref,{nombre:nombre,telefono:telefono,visitas:1,gasto:svc.precio,ultimaVisita:manForm.fecha,nota:"",historial:[{fecha:manForm.fecha,servicio:svc.nombre,peluquero:pel.nombre,precio:svc.precio}]});
        } else {
          const cl=snap.data();
          await updateDoc(ref,{
            visitas:(cl.visitas||0)+1,
            gasto:(cl.gasto||0)+svc.precio,
            ultimaVisita:manForm.fecha,
            historial:[...(cl.historial||[]),{fecha:manForm.fecha,servicio:svc.nombre,peluquero:pel.nombre,precio:svc.precio}]
          });
        }
      }
      setShowManual(false); setManForm({nombre:"",telefono:"",servicioId:"",peluqueroId:"",fecha:"",hora:"",nota:""});
        telefonoValRef.current="";
        nombreValRef.current="";
        notaValRef.current=""; setClienteRec(null);
            };

    const mostrarToast=cita=>{ _citaEliminadaTemp=cita; setToastVisible(true); if(toastTimer)clearTimeout(toastTimer); const t=setTimeout(()=>{setToastVisible(false);_citaEliminadaTemp=null;},6000); setToastTimer(t); };
    const confirmarBorrado=async()=>{ const cita={...citaBorrar}; await borrarCita(cita.id); setCitaBorrar(null); mostrarToast(cita); };

    const AccionesCita=({c})=>(
      <td style={{...as.td,position:"relative"}}>
        {c.estado==="pendiente"&&<><button style={as.actBtn(OK)} onClick={()=>cambiarEstado(c.id,"completada")}>✓</button><button style={as.actBtn(ER)} onClick={()=>cambiarEstado(c.id,"no-show")}>✗</button></>}
        {c.estado!=="pendiente"&&<button style={as.actBtn(TX2)} onClick={()=>cambiarEstado(c.id,"pendiente",c.estado)}>↩</button>}
        <button style={as.actBtn(TX2)} onClick={()=>setMenuAbierto(menuAbierto===c.id?null:c.id)}>•••</button>
        {menuAbierto===c.id&&(
          <div style={{position:"absolute",right:0,top:"100%",background:WH,border:`1px solid ${CR3}`,borderRadius:10,boxShadow:"0 4px 16px rgba(0,0,0,.12)",zIndex:50,minWidth:140,overflow:"hidden"}}>
            <button style={{display:"block",width:"100%",padding:"10px 16px",fontSize:12,fontWeight:600,color:TX,background:"none",border:"none",cursor:"pointer",textAlign:"left"}} onClick={()=>{setCitaEditando({...c});setMenuAbierto(null);}}>✏️ Editar cita</button>
            <button style={{display:"block",width:"100%",padding:"10px 16px",fontSize:12,fontWeight:600,color:ER,background:"none",border:"none",cursor:"pointer",textAlign:"left"}} onClick={()=>{setCitaBorrar({...c});setMenuAbierto(null);}}>🗑 Eliminar</button>
          </div>
        )}
      </td>
    );

    const CalModal=({show,setShow,title,children})=>show?(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div style={{background:WH,borderRadius:18,padding:"28px",width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <h3 style={{fontSize:16,fontWeight:700,color:TX}}>{title}</h3>
            <button style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:TX2}} onClick={()=>setShow(false)}>✕</button>
          </div>
          {children}
        </div>
      </div>
    ):null;

    return(
      <div>
        <div className="admin-kpi-grid" style={as.kpiGrid}>
          {[["€"+ingrHoy,"Ingresos hoy"],[citasHoy.length,"Citas hoy"],[pendHoy,"Pendientes"],[noShowHoy,"No shows"]].map(([v,l],i)=>(
            <div key={i} style={as.kpi}><div style={as.kpiVal}>{v}</div><div style={as.kpiLbl}>{l}</div></div>
          ))}
        </div>
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
          {[["hoy","📋 Tabla hoy"],["semana","📅 Semana"],["peluquero","✂️ Por peluquero"]].map(([v,l])=>(
            <button key={v} style={{background:vistaCitas===v?A:CR2,color:vistaCitas===v?WH:TX,border:`1px solid ${vistaCitas===v?A:CR3}`,borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={()=>setVistaCitas(v)}>{l}</button>
          ))}
          <button style={{marginLeft:"auto",background:`linear-gradient(135deg,${A},#133A6A)`,color:WH,border:"none",borderRadius:8,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={()=>setShowManual(true)}>+ Nueva cita</button>
        </div>

        {/* Modal nueva cita */}
        <NuevaCitaModal
          show={showManual}
          onClose={()=>setShowManual(false)}
          clientes={clientes}
          servicios={servicios}
          bloqueos={bloqueos}
          festivosSet={festivosSet}
          citas={citas}
          onCreada={()=>setShowManual(false)}
        />

        {/* Modal editar cita */}
        {citaEditando&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{background:WH,borderRadius:18,padding:"28px",width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                <h3 style={{fontSize:16,fontWeight:700,color:TX}}>Editar cita</h3>
                <button style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:TX2}} onClick={()=>{setCitaEditando(null);setShowEditCalPicker(false);}}>✕</button>
              </div>
              <div style={{marginBottom:10}}><Lbl>Cliente</Lbl><Inp value={citaEditando.clienteNombre} onChange={e=>setCitaEditando(f=>({...f,clienteNombre:e.target.value}))}/></div>
              <div style={{marginBottom:10}}><Lbl>Teléfono</Lbl><Inp value={citaEditando.clienteTel} onChange={e=>setCitaEditando(f=>({...f,clienteTel:e.target.value}))}/></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <div style={{position:"relative"}}>
                  <Lbl>Fecha</Lbl>
                  <button style={{width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,padding:"10px 13px",fontSize:13,color:citaEditando.fecha?TX:TX2,textAlign:"left",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"space-between",boxSizing:"border-box",outline:"none"}} onClick={()=>setShowEditCalPicker(v=>!v)}>
                    <span>{citaEditando.fecha||"Seleccionar..."}</span><span>📅</span>
                  </button>
                  {showEditCalPicker&&<div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:200}}><MiniCalPicker value={citaEditando.fecha} onChange={iso=>{setCitaEditando(f=>({...f,fecha:iso}));setShowEditCalPicker(false);}} festivosSet={festivosSet} bloqueosPelId={citaEditando.peluqueroId} bloqueos={bloqueos}/></div>}
                </div>
                <div><Lbl>Hora</Lbl><Inp type="time" value={citaEditando.hora} onChange={e=>setCitaEditando(f=>({...f,hora:e.target.value}))}/></div>
              </div>
              <div style={{marginBottom:10}}><Lbl>Estado</Lbl><Sel value={citaEditando.estado} onChange={e=>setCitaEditando(f=>({...f,estado:e.target.value}))}><option value="pendiente">Pendiente</option><option value="completada">Completada</option><option value="no-show">No show</option></Sel></div>
              <div style={{marginBottom:16}}><Lbl>Nota</Lbl><Inp value={citaEditando.nota||""} onChange={e=>setCitaEditando(f=>({...f,nota:e.target.value}))}/></div>
              <div style={{display:"flex",gap:8}}>
                <Btn ok={false} onClick={()=>{setCitaEditando(null);setShowEditCalPicker(false);}}>Cancelar</Btn>
                <Btn style={{flex:1}} onClick={async()=>{await actualizarCita(citaEditando.id,citaEditando);setCitas(prev=>prev.map(c=>c.id===citaEditando.id?citaEditando:c));setCitaEditando(null);setShowEditCalPicker(false);}}>Guardar cambios</Btn>
              </div>
            </div>
          </div>
        )}

        {/* Modal confirmar borrado */}
        {citaBorrar&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{background:WH,borderRadius:18,padding:"32px",width:"100%",maxWidth:400,boxShadow:"0 20px 60px rgba(0,0,0,.3)",textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:16}}>🗑</div>
              <h3 style={{fontSize:17,fontWeight:700,color:TX,marginBottom:8}}>¿Eliminar esta cita?</h3>
              <p style={{fontSize:13,color:TX2,marginBottom:6}}>{citaBorrar.clienteNombre}</p>
              <p style={{fontSize:12,color:TX2,marginBottom:24}}>{citaBorrar.servicio} · {citaBorrar.fecha} · {citaBorrar.hora}</p>
              <div style={{display:"flex",gap:10}}>
                <Btn ok={false} style={{flex:1}} onClick={()=>setCitaBorrar(null)}>Cancelar</Btn>
                <button style={{flex:1,background:`linear-gradient(135deg,${ER},#b91c1c)`,color:WH,border:"none",borderRadius:11,padding:"12px 20px",fontSize:13,fontWeight:700,cursor:"pointer"}} onClick={confirmarBorrado}>Eliminar</button>
              </div>
            </div>
          </div>
        )}

        {vistaCitas==="hoy"&&(
          <div style={as.card}>
            <div style={{background:CR,border:`1px solid ${hayFiltros?A:CR3}`,borderRadius:10,padding:"10px 12px",marginBottom:14}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:mostrarBuscador||hayFiltros?10:0}}>
                <input
                  style={{flex:1,marginBottom:0,padding:"7px 12px",fontSize:12,width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,color:TX,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}
                  defaultValue={busqCitaRef.current}
                  onChange={e=>{busqCitaRef.current=e.target.value;localBusqRef.current=e.target.value;forceUpdate(n=>n+1);}}
                  placeholder="🔍 Buscar por nombre o teléfono..."
                />
                <button style={{background:mostrarBuscador?`${A}15`:WH,border:`1px solid ${mostrarBuscador?A:CR3}`,borderRadius:8,padding:"7px 12px",fontSize:11,fontWeight:700,cursor:"pointer",color:mostrarBuscador?A:TX2,whiteSpace:"nowrap"}} onClick={()=>setMostrarBuscador(v=>!v)}>{mostrarBuscador?"▲ Filtros":"▼ Filtros"}{hayFiltros?" ●":""}</button>
                {hayFiltros&&<button style={{background:ER+"15",border:`1px solid ${ER}33`,borderRadius:8,padding:"7px 10px",fontSize:11,fontWeight:700,cursor:"pointer",color:ER}} onClick={()=>{busqCitaRef.current="";localBusqRef.current="";forceUpdate(n=>n+1);setFiltFecha("hoy");setFiltDesde("");setFiltHasta("");setFiltPel("todas");setFiltEstado("todos");setMostrarBuscador(false);}}>✕</button>}
              </div>
              {(mostrarBuscador||hayFiltros)&&(
                <>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,alignItems:"end",width:"100%"}}>
                  <div style={{minWidth:120}}>
                    <Lbl>Fecha</Lbl>
                    <Sel style={{padding:"6px 9px",fontSize:11}} value={filtFecha} onChange={e=>{setFiltFecha(e.target.value);setFiltSemanaOffset(0);}}>
                      <option value="todas">Todas</option>
                      <option value="hoy">Hoy</option>
                      <option value="semana">Esta semana</option>
                      <option value="fecha">Fecha concreta</option>
                      <option value="rango">Rango</option>
                    </Sel>
                  </div>
                  {filtFecha==="fecha"&&(
                    <div style={{position:"relative",minWidth:150}}>
                      <Lbl>Fecha concreta</Lbl>
                      <button style={{width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,padding:"6px 9px",fontSize:11,color:filtDesde?TX:TX2,textAlign:"left",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"space-between",outline:"none"}} onClick={()=>setShowFiltDesdeCalPicker(v=>!v)}>
                        <span>{filtDesde||"Seleccionar..."}</span><span>📅</span>
                      </button>
                      {showFiltDesdeCalPicker&&<div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:200}}><MiniCalPicker value={filtDesde} onChange={iso=>{setFiltDesde(iso);setShowFiltDesdeCalPicker(false);}} festivosSet={festivosSet} bloqueosPelId={null} bloqueos={[]}/></div>}
                    </div>
                  )}
                  {filtFecha==="rango"&&<>
                    <div style={{position:"relative",minWidth:130}}>
                      <Lbl>Desde</Lbl>
                      <button style={{width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,padding:"6px 9px",fontSize:11,color:filtDesde?TX:TX2,textAlign:"left",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"space-between",outline:"none"}} onClick={()=>setShowFiltDesdeCalPicker(v=>!v)}>
                        <span>{filtDesde||"Desde..."}</span><span>📅</span>
                      </button>
                      {showFiltDesdeCalPicker&&<div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:200}}><MiniCalPicker value={filtDesde} onChange={iso=>{setFiltDesde(iso);setShowFiltDesdeCalPicker(false);}} festivosSet={festivosSet} bloqueosPelId={null} bloqueos={[]}/></div>}
                    </div>
                    <div style={{position:"relative",minWidth:130}}>
                      <Lbl>Hasta</Lbl>
                      <button style={{width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,padding:"6px 9px",fontSize:11,color:filtHasta?TX:TX2,textAlign:"left",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"space-between",outline:"none"}} onClick={()=>setShowFiltHastaCalPicker(v=>!v)}>
                        <span>{filtHasta||"Hasta..."}</span><span>📅</span>
                      </button>
                      {showFiltHastaCalPicker&&<div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:200}}><MiniCalPicker value={filtHasta} onChange={iso=>{setFiltHasta(iso);setShowFiltHastaCalPicker(false);}} festivosSet={festivosSet} bloqueosPelId={null} bloqueos={[]}/></div>}
                    </div>
                  </>}
                  <div>
                    <Lbl>Peluquero</Lbl>
                    <Sel style={{padding:"6px 9px",fontSize:11}} value={filtPel} onChange={e=>setFiltPel(e.target.value)}>
                      <option value="todas">Todos</option>
                      {CONFIG.peluqueros.map(p=><option key={p.id} value={p.id}>{p.emoji} {p.nombre}</option>)}
                    </Sel>
                  </div>
                  <div>
                    <Lbl>Estado</Lbl>
                    <Sel style={{padding:"6px 9px",fontSize:11}} value={filtEstado} onChange={e=>setFiltEstado(e.target.value)}>
                      <option value="todos">Todos</option>
                      <option value="pendiente">Pendiente</option>
                      <option value="completada">Completada</option>
                      <option value="no-show">No show</option>
                    </Sel>
                  </div>
                </div>
                {filtFecha==="semana"&&(
                  <div style={{display:"flex",alignItems:"center",gap:6,marginTop:8}}>
                    <button style={{background:CR2,border:`1px solid ${CR3}`,borderRadius:7,padding:"5px 10px",fontSize:11,cursor:"pointer",color:TX}} onClick={()=>setFiltSemanaOffset(o=>o-1)}>← Anterior</button>
                    <span style={{fontSize:11,fontWeight:700,color:TX,flex:1,textAlign:"center"}}>{filtWeekDays[0].getDate()} {MESES_ES[filtWeekDays[0].getMonth()]} – {filtWeekDays[5].getDate()} {MESES_ES[filtWeekDays[5].getMonth()]}</span>
                    {filtSemanaOffset!==0&&<button style={{background:CR2,border:`1px solid ${CR3}`,borderRadius:7,padding:"5px 10px",fontSize:11,cursor:"pointer",color:TX2}} onClick={()=>setFiltSemanaOffset(0)}>Hoy</button>}
                    <button style={{background:CR2,border:`1px solid ${CR3}`,borderRadius:7,padding:"5px 10px",fontSize:11,cursor:"pointer",color:TX}} onClick={()=>setFiltSemanaOffset(o=>o+1)}>Siguiente →</button>
                  </div>
                )}
                </>
              )}
            </div>
            {hayFiltros?(
              <>
                <div style={{fontSize:11,fontWeight:700,color:A,marginBottom:10}}>{citasFiltradas.length} resultado{citasFiltradas.length!==1?"s":""}</div>
                {citasFiltradas.length===0?<div style={{fontSize:13,color:TX2,fontStyle:"italic"}}>No se encontraron citas</div>:(
                  <div className="admin-table-wrap"><table style={as.table}><thead><tr>{["Fecha","Hora","Cliente","Servicio","Prof.","€","Estado","Acc."].map(h=><th key={h} style={as.th}>{h}</th>)}</tr></thead>
                  <tbody>{citasFiltradas.map(c=>(
                    <tr key={c.id}>
                      <td style={{...as.td,fontSize:11,color:TX2}}>{c.fecha===HOY_ISO?"Hoy":c.fecha}</td>
                      <td style={{...as.td,fontWeight:700,color:A}}>{c.hora}</td>
                      <td style={as.td}>{c.clienteNombre}</td><td style={as.td}>{c.servicio}</td>
                      <td style={as.td}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:"50%",background:CONFIG.peluqueros.find(p=>p.id===c.peluqueroId)?.color||A,flexShrink:0}}/>{c.peluquero}</span></td>
                      <td style={{...as.td,fontWeight:700}}>€{c.precio}</td>
                      <td style={as.td}><EstBdg e={c.estado}/></td>
                      <AccionesCita c={c}/>
                    </tr>
                  ))}</tbody></table></div>
                )}
              </>
            ):(
              <>
                <div style={{fontSize:11,fontWeight:700,color:TX2,textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>Citas de hoy — {fmtLarga(HOY)}</div>
                {citasHoy.length===0?<div style={{fontSize:13,color:TX2,fontStyle:"italic"}}>No hay citas para hoy</div>:(
                  <div className="admin-table-wrap"><table style={as.table}><thead><tr>{["Hora","Cliente","Servicio","Profesional","Precio","Estado","Nota","Acc."].map(h=><th key={h} style={as.th}>{h}</th>)}</tr></thead>
                  <tbody>{citasHoy.map(c=>(
                    <tr key={c.id}>
                      <td style={{...as.td,fontWeight:700,color:A}}>{c.hora}</td>
                      <td style={as.td}>{c.clienteNombre}<div style={{fontSize:10,color:TX2}}>{c.clienteTel}</div></td>
                      <td style={as.td}>{c.servicio}</td>
                      <td style={as.td}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:"50%",background:CONFIG.peluqueros.find(p=>p.id===c.peluqueroId)?.color||A,flexShrink:0}}/>{c.peluquero}</span></td>
                      <td style={{...as.td,fontWeight:700}}>€{c.precio}</td>
                      <td style={as.td}><EstBdg e={c.estado}/></td>
                      <td style={as.td}>{editNota===c.id?(<div style={{display:"flex",gap:4}}><Inp style={{padding:"4px 8px",fontSize:11}} value={notaVal} onChange={e=>setNotaVal(e.target.value)}/><button style={as.actBtn(OK)} onClick={()=>guardarNota(c.id)}>✓</button></div>):(<span style={{fontSize:11,color:c.nota?TX:TX2,cursor:"pointer",fontStyle:c.nota?"normal":"italic"}} onClick={()=>{setEditNota(c.id);setNotaVal(c.nota||"");}}>{ c.nota||"+ nota"}</span>)}</td>
                      <AccionesCita c={c}/>
                    </tr>
                  ))}</tbody></table></div>
                )}
              </>
            )}
          </div>
        )}

        {vistaCitas==="semana"&&(
          <div style={as.card}>
            <NavSemana offset={weekOffsetCitas} onChange={setWeekOffsetCitas} weekDays={weekDays}/>
            <LeyendaPeluqueros/>
            <CalendarioGrid dias={weekDays} citas={citas} peluqueroFiltroId={null}/>
          </div>
        )}

        {vistaCitas==="peluquero"&&(
          <div>
            <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
              {CONFIG.peluqueros.map(p=>(
                <button key={p.id} style={{background:pelFiltroCitas===p.id?p.color:CR2,color:pelFiltroCitas===p.id?WH:TX,border:`1px solid ${pelFiltroCitas===p.id?p.color:CR3}`,borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}} onClick={()=>setPelFiltroCitas(pelFiltroCitas===p.id?null:p.id)}>
                  {p.emoji} {p.nombre}{pelFiltroCitas===p.id&&<span style={{fontSize:10}}>✓</span>}
                </button>
              ))}
            </div>
            <div style={as.card}>
              <NavSemana offset={weekOffsetCitas} onChange={setWeekOffsetCitas} weekDays={weekDays}/>
              {pelFiltroCitas&&<div style={{marginBottom:8,display:"flex",alignItems:"center",gap:8}}><div style={{width:10,height:10,borderRadius:2,background:CONFIG.peluqueros.find(p=>p.id===pelFiltroCitas)?.color}}/><span style={{fontSize:12,fontWeight:700,color:TX}}>{CONFIG.peluqueros.find(p=>p.id===pelFiltroCitas)?.nombre}</span></div>}
              {!pelFiltroCitas&&<LeyendaPeluqueros/>}
              <CalendarioGrid dias={weekDays} citas={citas} peluqueroFiltroId={pelFiltroCitas}/>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ──────────────────────
  // TAB CLIENTES
  // ──────────────────────
  const TabClientes=()=>{
    const [busq,setBusq]=useState("");
    const [clienteBorrar,setClienteBorrar]=useState(null);
    const [inactivos,setInactivos]=useState(false);
    const [editNota,setEditNota]=useState(false);
    const [notaVal,setNotaVal]=useState("");
    const semMil=CONFIG.semanasSinVisita*7*24*60*60*1000;
    const clientesFiltrados=useMemo(()=>{
      let lista=clientes;
      if(inactivos){const lim=new Date(Date.now()-semMil);lista=lista.filter(c=>new Date(c.ultimaVisita)<lim);}
      if(!busq) return lista.sort((a,b)=>a.nombre.localeCompare(b.nombre));
      return lista.map(c=>({...c,score:c.telefono?.includes(busq)?90:similitud(busq,c.nombre)})).filter(c=>c.score>=60).sort((a,b)=>b.score-a.score);
    },[busq,inactivos,clientes]);
    const guardarNota=async()=>{ setClientes(prev=>prev.map(c=>c.id===clienteSel.id?{...c,nota:notaVal}:c)); setClienteSel(prev=>({...prev,nota:notaVal})); setEditNota(false); try{await actualizarCliente(clienteSel.id,{nota:notaVal});}catch(e){console.error(e);} };
    return(
      <div>
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
          <Inp style={{flex:1,minWidth:200,marginBottom:0}} defaultValue={busq} onChange={e=>setBusq(e.target.value)} placeholder="🔍 Buscar por nombre o teléfono..."/>
          <button style={{background:inactivos?A:CR2,color:inactivos?WH:TX,border:`1px solid ${inactivos?A:CR3}`,borderRadius:8,padding:"9px 14px",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}} onClick={()=>setInactivos(v=>!v)}>{inactivos?"✓ ":""}{`+${CONFIG.semanasSinVisita}sem sin visita`}</button>
        </div>
        <div style={{fontSize:11,color:TX2,marginBottom:10}}>{clientesFiltrados.length} cliente{clientesFiltrados.length!==1?"s":""}</div>
        <div style={as.twoCol}>
          <div>
            {clientesFiltrados.map(c=>(
              <div key={c.id} style={{background:clienteSel?.id===c.id?`${A}0D`:WH,border:`1px solid ${clienteSel?.id===c.id?A:CR3}`,borderRadius:12,padding:"13px 15px",marginBottom:8,cursor:"pointer"}} onClick={()=>{setClienteSel(c);setEditNota(false);}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div><div style={{fontSize:13,fontWeight:700,color:TX,marginBottom:2}}>{c.nombre}</div><div style={{fontSize:11,color:TX2}}>📞 {c.telefono}</div><div style={{fontSize:11,color:TX2}}>Última: {c.ultimaVisita}</div></div>
                  <div style={{textAlign:"right"}}><div style={{fontSize:15,fontWeight:700,color:A}}>€{c.gasto}</div><div style={{fontSize:10,color:TX2}}>{c.visitas} visitas</div>{busq&&c.score>=60&&<div style={{marginTop:4}}><Bdg small color={c.score>=90?OK:c.score>=70?A:"#d97706"}>{c.score}%</Bdg></div>}</div>
                </div>
              </div>
            ))}
            {clientesFiltrados.length===0&&<div style={{textAlign:"center",padding:"30px",color:TX2,fontSize:13,background:WH,borderRadius:12,border:`1px solid ${CR3}`}}>No se encontraron clientes</div>}
          </div>
          {clienteSel&&(
            <div style={as.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                <div style={{fontSize:15,fontWeight:700,color:TX}}>{clienteSel.nombre}</div>
                <button style={{background:ER+"15",border:`1px solid ${ER}33`,color:ER,borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}} onClick={()=>setClienteBorrar(clienteSel)}>🗑 Eliminar</button>
              </div>
              <div style={{fontSize:12,color:TX2,marginBottom:14}}>📞 {clienteSel.telefono}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:14}}>
                {[["€"+clienteSel.gasto,"Total"],[clienteSel.visitas,"Visitas"],["€"+Math.round(clienteSel.gasto/Math.max(clienteSel.visitas,1)),"Promedio"],[clienteSel.noShows||0,"No shows"]].map(([v,l])=>(
                  <div key={l} style={{background:CR,borderRadius:9,padding:"10px",textAlign:"center"}}><div style={{fontSize:17,fontWeight:700,color:A}}>{v}</div><div style={{fontSize:10,color:TX2}}>{l}</div></div>
                ))}
              </div>
              <Divider/>
              <div style={{fontSize:11,fontWeight:700,color:TX2,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Nota</div>
              {editNota?(<div><Inp value={notaVal} onChange={e=>setNotaVal(e.target.value)} placeholder="Añade una nota..."/><div style={{display:"flex",gap:6,marginTop:6}}><Btn ok={false} sm onClick={()=>setEditNota(false)}>Cancelar</Btn><Btn sm onClick={guardarNota}>Guardar</Btn></div></div>):(
                <div style={{background:CR,borderRadius:8,padding:"10px 12px",fontSize:13,color:clienteSel.nota?TX:TX2,fontStyle:clienteSel.nota?"normal":"italic",cursor:"pointer"}} onClick={()=>{setEditNota(true);setNotaVal(clienteSel.nota||"");}}>{clienteSel.nota||"Sin notas. Pulsa para añadir..."}</div>
              )}
              <Divider/>
              <div style={{fontSize:11,fontWeight:700,color:TX2,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Historial</div>
              {(clienteSel.historial||[]).filter(h=>h.estado==="completada"||!h.estado).length===0?<div style={{fontSize:12,color:TX2,fontStyle:"italic"}}>Sin historial</div>:(clienteSel.historial||[]).filter(h=>h.estado==="completada"||!h.estado).map((h,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${CR2}`,fontSize:12}}>
                  <div><span style={{color:TX2,marginRight:8}}>{h.fecha}</span><span style={{color:TX}}>{h.servicio}</span></div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{color:TX2,fontSize:11}}>{h.peluquero}</span><span style={{fontWeight:700,color:A}}>€{h.precio}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
        {clienteBorrar&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{background:WH,borderRadius:18,padding:"32px",width:"100%",maxWidth:400,boxShadow:"0 20px 60px rgba(0,0,0,.3)",textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:16}}>🗑</div>
              <h3 style={{fontSize:17,fontWeight:700,color:TX,marginBottom:8}}>¿Eliminar este cliente?</h3>
              <p style={{fontSize:13,color:TX2,marginBottom:6}}>{clienteBorrar.nombre}</p>
              <p style={{fontSize:12,color:TX2,marginBottom:24}}>📞 {clienteBorrar.telefono} · {clienteBorrar.visitas} visitas</p>
              <div style={{display:"flex",gap:10}}>
                <Btn ok={false} style={{flex:1}} onClick={()=>setClienteBorrar(null)}>Cancelar</Btn>
                <button style={{flex:1,background:`linear-gradient(135deg,${ER},#b91c1c)`,color:WH,border:"none",borderRadius:11,padding:"12px 20px",fontSize:13,fontWeight:700,cursor:"pointer"}} onClick={async()=>{
                  _clienteEliminadoTemp={...clienteBorrar};
                  if(clienteSel?.id===clienteBorrar.id) setClienteSel(null);
                  await deleteDoc(doc(db,"clientes",clienteBorrar.id));
                  setClienteBorrar(null);
                  setToastClienteVisible(true);
                  if(toastClienteTimer)clearTimeout(toastClienteTimer);
                  const t=setTimeout(()=>{setToastClienteVisible(false);_clienteEliminadoTemp=null;},6000); setToastClienteTimer(t);
                }}>Eliminar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ──────────────────────
  // TAB CAJA
  // ──────────────────────
  const TabCaja=()=>{
    const ingHoy=citas.filter(c=>c.fecha===HOY_ISO&&c.estado==="completada").reduce((s,c)=>s+c.precio,0);
    const noShows=citas.filter(c=>c.fecha===HOY_ISO&&c.estado==="no-show").length;
    const totalHoy=citas.filter(c=>c.fecha===HOY_ISO).length;
    const tasaNS=totalHoy>0?Math.round(noShows/totalHoy*100):0;
    const ingSemana=ingHoy*4.8|0, ingMes=ingHoy*19|0, ingMesAnt=ingHoy*18|0;
    const [showPDF,setShowPDF]=useState(false);
    const exportarExcel=()=>{
      try{const XLSX=window.XLSX;if(!XLSX){alert("Cargando...");return;}
        const datos=[["RESUMEN DE CAJA — "+CONFIG.nombre],[],[],["Hoy","Semana","Mes","Mes ant."],[`€${ingHoy}`,`€${ingSemana}`,`€${ingMes}`,`€${ingMesAnt}`]];
        const ws=XLSX.utils.aoa_to_sheet(datos);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Caja");XLSX.writeFile(wb,`caja-${HOY_ISO}.xlsx`);
      }catch(e){alert("Error: "+e.message);}
    };
    return(
      <div>
        {showPDF&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{background:WH,borderRadius:18,width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto"}}>
              <div style={{background:`linear-gradient(135deg,#0D1F35,#1B3A5C)`,padding:"20px 24px",borderRadius:"18px 18px 0 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div><div style={{fontSize:16,fontWeight:700,color:WH}}>{CONFIG.nombre}</div><div style={{fontSize:11,color:"#7AADD4"}}>Resumen de caja — {new Date().toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div></div>
                <button style={{background:"none",border:"none",color:"#7AADD4",fontSize:20,cursor:"pointer"}} onClick={()=>setShowPDF(false)}>✕</button>
              </div>
              <div style={{padding:"20px 24px"}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:20}}>
                  {[["Hoy",`€${ingHoy}`],["Esta semana",`€${ingSemana}`],["Este mes",`€${ingMes}`],["Mes anterior",`€${ingMesAnt}`]].map(([l,v])=>(
                    <div key={l} style={{background:CR,borderRadius:8,padding:"10px 12px"}}><div style={{fontSize:18,fontWeight:700,color:A}}>{v}</div><div style={{fontSize:10,color:TX2,textTransform:"uppercase"}}>{l}</div></div>
                  ))}
                </div>
                {CONFIG.peluqueros.map(p=>{const t=citas.filter(c=>c.peluqueroId===p.id&&c.estado==="completada").reduce((s,c)=>s+c.precio,0);return(<div key={p.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${CR2}`}}><span style={{display:"flex",alignItems:"center",gap:8}}><span style={{width:8,height:8,borderRadius:2,background:p.color}}/>{p.nombre}</span><span style={{fontWeight:700,color:A}}>€{t}</span></div>);})}
                <button onClick={()=>window.print()} style={{width:"100%",background:`linear-gradient(135deg,${A},#133A6A)`,color:WH,border:"none",borderRadius:10,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer",marginTop:16}}>🖨️ Imprimir / Guardar PDF</button>
              </div>
            </div>
          </div>
        )}
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14,gap:8}}>
          <button style={{background:"#16a34a",color:WH,border:"none",borderRadius:8,padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={exportarExcel}>📊 Exportar Excel</button>
          <button style={{background:A,color:WH,border:"none",borderRadius:8,padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={()=>setShowPDF(true)}>📄 Ver resumen PDF</button>
        </div>
        <div className="admin-kpi-grid" style={as.kpiGrid}>
          {[["€"+ingHoy,"Hoy"],["€"+ingSemana,"Esta semana"],["€"+ingMes,"Este mes"],["€"+ingMesAnt,"Mes anterior"]].map(([v,l],i)=>(
            <div key={i} style={as.kpi}><div style={as.kpiVal}>{v}</div><div style={as.kpiLbl}>{l}</div></div>
          ))}
        </div>
        <div style={as.card}><div style={as.cardTitle}>Evolución ingresos</div><div style={as.chartH}><ResponsiveContainer width="100%" height="100%"><LineChart data={STATS_INGRESOS}><XAxis dataKey="semana" tick={{fontSize:9,fill:TX2}}/><YAxis tick={{fontSize:9,fill:TX2}}/><Tooltip formatter={v=>`€${v}`} contentStyle={{background:WH,border:`1px solid ${CR3}`,borderRadius:8,fontSize:11}}/><Line type="monotone" dataKey="actual" stroke={A} strokeWidth={2.5} dot={{fill:A,r:3}}/><Line type="monotone" dataKey="anterior" stroke={CR3} strokeWidth={2} strokeDasharray="4 4" dot={false}/></LineChart></ResponsiveContainer></div></div>
        <div className="admin-two-col" style={as.twoCol}>
          <div style={as.card}><div style={as.cardTitle}>Por peluquero</div>{CONFIG.peluqueros.map(p=>{const t=citas.filter(c=>c.peluqueroId===p.id&&c.estado==="completada").reduce((s,c)=>s+c.precio,0);const nc=citas.filter(c=>c.peluqueroId===p.id).length;return(<div key={p.id} style={as.row}><span style={{fontSize:13,display:"flex",alignItems:"center",gap:6}}><span style={{width:8,height:8,borderRadius:2,background:p.color}}/>{p.nombre}<span style={{fontSize:11,color:TX2}}>{nc} citas</span></span><span style={{fontSize:14,fontWeight:700,color:A}}>€{t}</span></div>);})}</div>
          <div style={as.card}><div style={as.cardTitle}>Servicios populares</div><div style={{height:160}}><ResponsiveContainer width="100%" height="100%"><BarChart data={STATS_SERVICIOS} layout="vertical"><XAxis type="number" tick={{fontSize:9,fill:TX2}}/><YAxis dataKey="nombre" type="category" tick={{fontSize:10,fill:TX}} width={80}/><Tooltip contentStyle={{background:WH,border:`1px solid ${CR3}`,borderRadius:8,fontSize:11}}/><Bar dataKey="c" fill={A} radius={[0,4,4,0]}/></BarChart></ResponsiveContainer></div></div>
        </div>
        <div className="admin-two-col" style={as.twoCol}>
          <div style={as.card}><div style={as.cardTitle}>Citas por día</div><div style={as.chartH}><ResponsiveContainer width="100%" height="100%"><BarChart data={STATS_DIAS}><XAxis dataKey="dia" tick={{fontSize:10,fill:TX2}}/><YAxis tick={{fontSize:9,fill:TX2}}/><Tooltip contentStyle={{background:WH,border:`1px solid ${CR3}`,borderRadius:8,fontSize:11}}/><Bar dataKey="citas" radius={[4,4,0,0]}>{STATS_DIAS.map((_,i)=><Cell key={i} fill={i===4?A:A+"77"}/>)}</Bar></BarChart></ResponsiveContainer></div></div>
          <div style={as.card}><div style={as.cardTitle}>Resumen del día</div>{[["Citas totales",totalHoy],["Completadas",citas.filter(c=>c.fecha===HOY_ISO&&c.estado==="completada").length],["Pendientes",citas.filter(c=>c.fecha===HOY_ISO&&c.estado==="pendiente").length],["No shows",noShows],["Tasa no-show",tasaNS+"%"]].map(([l,v])=>(<div key={l} style={as.row}><span style={{fontSize:13,color:TX}}>{l}</span><span style={{fontSize:14,fontWeight:700,color:A}}>{v}</span></div>))}</div>
        </div>
      </div>
    );
  };

  // ──────────────────────
  // TAB DISPONIBILIDAD
  // ──────────────────────
  const TabDisponibilidad=()=>{
    const [showFF,setShowFF]=useState(false),[showBF,setShowBF]=useState(false);
    const [festForm,setFestForm]=useState({fecha:"",hasta:"",motivo:"",tipo:"dia"});
    const [bloqForm,setBloqForm]=useState({peluqueroId:"",tipo:"dia",desde:"",hasta:"",motivo:""});
    const [showFestCal,setShowFestCal]=useState(false);
    const [showFestHastaCal,setShowFestHastaCal]=useState(false),[showBloqDesdeCal,setShowBloqDesdeCal]=useState(false),[showBloqHastaCal,setShowBloqHastaCal]=useState(false);
    return(
      <div style={as.twoCol}>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <h3 style={{fontSize:13,fontWeight:700,color:TX,margin:0}}>🗓️ Días festivos</h3>
            <Btn sm onClick={()=>setShowFF(v=>!v)}>+ Añadir</Btn>
          </div>
          {showFF&&(
            <div style={{...as.card,marginBottom:12}}>
              <div style={{marginBottom:8}}><Lbl>Tipo</Lbl>
                <Sel value={festForm.tipo} onChange={e=>setFestForm(f=>({...f,tipo:e.target.value}))}>
                  <option value="dia">Día suelto</option>
                  <option value="rango">Rango de días</option>
                </Sel>
              </div>
              <div style={{display:"grid",gridTemplateColumns:festForm.tipo==="rango"?"1fr 1fr":"1fr",gap:8,marginBottom:8}}>
                <div style={{position:"relative"}}>
                  <Lbl>{festForm.tipo==="rango"?"Fecha inicio":"Fecha"}</Lbl>
                  <button style={{width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,padding:"10px 13px",fontSize:13,color:festForm.fecha?TX:TX2,textAlign:"left",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"space-between",outline:"none"}} onClick={()=>setShowFestCal(v=>!v)}>
                    <span>{festForm.fecha||"Seleccionar fecha..."}</span><span>📅</span>
                  </button>
                  {showFestCal&&<div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:200}}><MiniCalPicker value={festForm.fecha} onChange={iso=>{setFestForm(f=>({...f,fecha:iso}));setShowFestCal(false);}} festivosSet={festivosSet} bloqueosPelId={null} bloqueos={[]}/></div>}
                </div>
                {festForm.tipo==="rango"&&(
                  <div style={{position:"relative"}}>
                    <Lbl>Fecha fin</Lbl>
                    <button style={{width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,padding:"10px 13px",fontSize:13,color:festForm.hasta?TX:TX2,textAlign:"left",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"space-between",outline:"none"}} onClick={()=>setShowFestHastaCal(v=>!v)}>
                      <span>{festForm.hasta||"Seleccionar fecha..."}</span><span>📅</span>
                    </button>
                    {showFestHastaCal&&<div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:200}}><MiniCalPicker value={festForm.hasta} onChange={iso=>{setFestForm(f=>({...f,hasta:iso}));setShowFestHastaCal(false);}} festivosSet={festivosSet} bloqueosPelId={null} bloqueos={[]}/></div>}
                  </div>
                )}
              </div>
              <div style={{marginBottom:10}}><Lbl>Motivo</Lbl><Inp value={festForm.motivo} onChange={e=>setFestForm(f=>({...f,motivo:e.target.value}))} placeholder="Ej: Navidad"/></div>
              <div style={{display:"flex",gap:6}}>
                <Btn ok={false} sm onClick={()=>setShowFF(false)}>Cancelar</Btn>
                <Btn sm onClick={async()=>{
                  if(!festForm.fecha||!festForm.motivo) return;
                  await crearFestivo({...festForm, hasta: festForm.tipo==="dia" ? festForm.fecha : festForm.hasta});
                  setFestForm({fecha:"",hasta:"",motivo:"",tipo:"dia"});
                  setShowFF(false);
                }}>Guardar</Btn>
              </div>
            </div>
          )}
          {festivos.sort((a,b)=>a.fecha.localeCompare(b.fecha)).map(f=>(
            <div key={f.id} style={{...as.card,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",marginBottom:8}}>
              <div><div style={{fontSize:13,fontWeight:700,color:TX}}>{f.motivo}</div><div style={{fontSize:11,color:TX2}}>{f.fecha}</div></div>
              <button style={as.actBtn(ER)} onClick={()=>borrarFestivo(f.id)}>Quitar</button>
            </div>
          ))}
        </div>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <h3 style={{fontSize:13,fontWeight:700,color:TX,margin:0}}>✂️ Bloqueos por peluquero</h3>
            <Btn sm onClick={()=>setShowBF(v=>!v)}>+ Añadir</Btn>
          </div>
          {showBF&&(
            <div style={{...as.card,marginBottom:12}}>
              <div style={{marginBottom:8}}><Lbl>Peluquero</Lbl><Sel value={bloqForm.peluqueroId} onChange={e=>setBloqForm(f=>({...f,peluqueroId:e.target.value}))}><option value="">Elige</option>{CONFIG.peluqueros.map(p=><option key={p.id} value={p.id}>{p.emoji} {p.nombre}</option>)}</Sel></div>
              <div style={{marginBottom:8}}><Lbl>Tipo</Lbl><Sel value={bloqForm.tipo} onChange={e=>setBloqForm(f=>({...f,tipo:e.target.value}))}><option value="dia">Día suelto</option><option value="semana">Rango de días</option></Sel></div>
              <div style={{display:"grid",gridTemplateColumns:bloqForm.tipo==="semana"?"1fr 1fr":"1fr",gap:8,marginBottom:8}}>
                <div style={{position:"relative"}}>
                  <Lbl>{bloqForm.tipo==="semana"?"Fecha inicio":"Fecha"}</Lbl>
                  <button style={{width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,padding:"10px 13px",fontSize:13,color:bloqForm.desde?TX:TX2,textAlign:"left",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"space-between",outline:"none"}} onClick={()=>setShowBloqDesdeCal(v=>!v)}>
                    <span>{bloqForm.desde||"Fecha..."}</span><span>📅</span>
                  </button>
                  {showBloqDesdeCal&&<div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:200}}><MiniCalPicker value={bloqForm.desde} onChange={iso=>{setBloqForm(f=>({...f,desde:iso}));setShowBloqDesdeCal(false);}} festivosSet={festivosSet} bloqueosPelId={bloqForm.peluqueroId?Number(bloqForm.peluqueroId):null} bloqueos={bloqueos}/></div>}
                </div>
                {bloqForm.tipo==="semana"&&(
                  <div style={{position:"relative"}}>
                    <Lbl>Fecha fin</Lbl>
                    <button style={{width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,padding:"10px 13px",fontSize:13,color:bloqForm.hasta?TX:TX2,textAlign:"left",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"space-between",outline:"none"}} onClick={()=>setShowBloqHastaCal(v=>!v)}>
                      <span>{bloqForm.hasta||"Fecha..."}</span><span>📅</span>
                    </button>
                    {showBloqHastaCal&&<div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:200}}><MiniCalPicker value={bloqForm.hasta} onChange={iso=>{setBloqForm(f=>({...f,hasta:iso}));setShowBloqHastaCal(false);}} festivosSet={festivosSet} bloqueosPelId={bloqForm.peluqueroId?Number(bloqForm.peluqueroId):null} bloqueos={bloqueos}/></div>}
                  </div>
                )}
              </div>
              <div style={{marginBottom:10}}><Lbl>Motivo</Lbl><Inp value={bloqForm.motivo} onChange={e=>setBloqForm(f=>({...f,motivo:e.target.value}))} placeholder="Ej: Vacaciones"/></div>
              <div style={{display:"flex",gap:6}}>
                <Btn ok={false} sm onClick={()=>setShowBF(false)}>Cancelar</Btn>
                <Btn sm onClick={async()=>{if(!bloqForm.peluqueroId||!bloqForm.desde||!bloqForm.motivo)return;await crearBloqueo({...bloqForm,hasta:bloqForm.tipo==="dia"?bloqForm.desde:bloqForm.hasta});setBloqForm({peluqueroId:"",tipo:"dia",desde:"",hasta:"",motivo:""});setShowBF(false);}}>Guardar</Btn>
              </div>
            </div>
          )}
          {bloqueos.map(b=>{
            const pel=CONFIG.peluqueros.find(p=>p.id===Number(b.peluqueroId));
            return(
              <div key={b.id} style={{...as.card,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",marginBottom:8}}>
                <div><div style={{fontSize:13,fontWeight:700,color:TX}}>{pel?.emoji} {pel?.nombre} — {b.motivo}</div><div style={{fontSize:11,color:TX2}}>{b.tipo==="dia"?b.desde:`${b.desde} → ${b.hasta}`}</div></div>
                <button style={as.actBtn(ER)} onClick={()=>borrarBloqueo(b.id)}>Quitar</button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ──────────────────────
  // TAB STATS
  // ──────────────────────
  const TabStats=()=>{
    const [periodo,setPeriodo]=useState("mes");
    const ahora=new Date();
    const inicioMes=`${ahora.getFullYear()}-${String(ahora.getMonth()+1).padStart(2,"0")}-01`;
    const inicioSemana=isoDate(getWeekDays()[0]);
    const citasPeriodo=citas.filter(c=>{
      if(periodo==="hoy") return c.fecha===HOY_ISO;
      if(periodo==="semana") return c.fecha>=inicioSemana&&c.fecha<=HOY_ISO;
      if(periodo==="mes") return c.fecha>=inicioMes&&c.fecha<=HOY_ISO;
      return true;
    });
    return(
      <div>
        <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
          {[["hoy","Hoy"],["semana","Esta semana"],["mes","Este mes"],["todo","Todo"]].map(([v,l])=>(
            <button key={v} style={{background:periodo===v?A:CR2,color:periodo===v?WH:TX,border:`1px solid ${periodo===v?A:CR3}`,borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={()=>setPeriodo(v)}>{l}</button>
          ))}
        </div>
        {CONFIG.peluqueros.map(p=>{
          const mc=citasPeriodo.filter(c=>c.peluqueroId===p.id);
          const comp=mc.filter(c=>c.estado==="completada");
          const ing=comp.reduce((s,c)=>s+c.precio,0);
          const ns=mc.filter(c=>c.estado==="no-show").length;
          const tns=mc.length>0?Math.round(ns/mc.length*100):0;
          const sc={}; mc.forEach(c=>{sc[c.servicio]=(sc[c.servicio]||0)+1;});
          const top=Object.entries(sc).sort((a,b)=>b[1]-a[1])[0];
          return(
            <div key={p.id} style={{...as.card,marginBottom:14,borderLeft:`4px solid ${p.color}`}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                <span style={{fontSize:24}}>{p.emoji}</span>
                <div><div style={{fontSize:15,fontWeight:700,color:TX}}>{p.nombre}</div><div style={{fontSize:12,color:TX2}}>{p.especialidad}</div></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
                {[[mc.length,"Citas totales"],[comp.length,"Completadas"],[`€${ing}`,"Ingresos"],[`${tns}%`,"No shows"]].map(([v,l])=>(
                  <div key={l} style={{background:CR,borderRadius:9,padding:"10px",textAlign:"center"}}><div style={{fontSize:17,fontWeight:700,color:p.color}}>{v}</div><div style={{fontSize:10,color:TX2,textTransform:"uppercase",letterSpacing:.5}}>{l}</div></div>
                ))}
              </div>
              {top?<div style={{background:`${p.color}10`,border:`1px solid ${p.color}30`,borderRadius:8,padding:"8px 12px",fontSize:12}}><span style={{color:TX2}}>Servicio más popular: </span><span style={{fontWeight:700,color:p.color}}>{top[0]}</span><span style={{color:TX2}}> ({top[1]} veces)</span></div>
                  :<div style={{fontSize:12,color:TX2,fontStyle:"italic"}}>Sin citas en este período</div>}
            </div>
          );
        })}
      </div>
    );
  };

  // ──────────────────────
  // TAB CONFIG — ★ usa configSubTab del padre para no perder la pestaña al guardar
  // ──────────────────────
  const TabConfig=()=>{
    const [editSvc,setEditSvc]=useState(null);
    const [newSvc,setNewSvc]=useState({nombre:"",duracionMin:30,precio:0,emoji:"✂️",desc:""});
    const [showNew,setShowNew]=useState(false);
    const [showNewVal,setShowNewVal]=useState(false);
    const [newVal,setNewVal]=useState({nombre:"",estrellas:5,comentario:"",servicio:""});
    const [editVal,setEditVal]=useState(null);

    const guardarSvc=async()=>{
      if(!editSvc.nombre) return;
      const updated=servicios.map(s=>s.id===editSvc.id?editSvc:s);
      setServicios(updated);
      await guardarServicioFB(editSvc);
      setEditSvc(null);
    };
    const addSvc=async()=>{
      if(!newSvc.nombre) return;
      if(servicios.some(s=>s.nombre.toLowerCase()===newSvc.nombre.toLowerCase())){
        alert("Ya existe un servicio con ese nombre.");
        return;
      }
      const svc={...newSvc,id:Date.now(),precio:Number(newSvc.precio),duracionMin:Number(newSvc.duracionMin)};
      setServicios(prev=>[...prev,svc]);
      await guardarServicioFB(svc);
      setNewSvc({nombre:"",duracionMin:30,precio:0,emoji:"✂️",desc:""});
      setShowNew(false);
    };
    const deleteSvc=async(id,nombre)=>{
      setServicios(prev=>prev.filter(s=>s.id!==id));
      await borrarServicioFB(nombre);
    };
    const addVal=async()=>{
      if(!newVal.nombre||!newVal.comentario) return;
      const nueva={...newVal,id:Date.now()};
      setValoraciones(p=>[...p,nueva]);
      await guardarValoracionFB(nueva);
      setNewVal({nombre:"",estrellas:5,comentario:"",servicio:""});
      setShowNewVal(false);
    };
    // ★ saveEdit NO cambia configSubTab — permanece en "valoraciones"
    const saveEdit=async()=>{
      if(!editVal) return;
      setValoraciones(p=>p.map(v=>v.id===editVal.id?editVal:v));
      await guardarValoracionFB(editVal);
      setEditVal(null);
    };

    return(
      <div>
        <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
          {[["servicios","Servicios"],["valoraciones","Opiniones"],["horarios","Horarios"]].map(([v,l])=>(
            // ★ usa setConfigSubTab del padre
            <button key={v} style={{background:configSubTab===v?A:CR2,color:configSubTab===v?WH:TX,border:`1px solid ${configSubTab===v?A:CR3}`,borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={()=>setConfigSubTab(v)}>{l}</button>
          ))}
        </div>

        {configSubTab==="servicios"&&(
          <div>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}><Btn sm onClick={()=>setShowNew(v=>!v)}>+ Nuevo servicio</Btn></div>
            {showNew&&(
              <div style={{...as.card,marginBottom:12}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                  <div><Lbl>Nombre</Lbl><Inp value={newSvc.nombre} onChange={e=>setNewSvc(f=>({...f,nombre:e.target.value}))} placeholder="Nombre"/></div>
                  <div><Lbl>Emoji</Lbl><Inp value={newSvc.emoji} onChange={e=>setNewSvc(f=>({...f,emoji:e.target.value}))}/></div>
                  <div><Lbl>Duración (min)</Lbl><Inp type="number" value={newSvc.duracionMin} onChange={e=>setNewSvc(f=>({...f,duracionMin:e.target.value}))}/></div>
                  <div><Lbl>Precio (€)</Lbl><Inp type="number" value={newSvc.precio} onChange={e=>setNewSvc(f=>({...f,precio:e.target.value}))}/></div>
                  <div style={{gridColumn:"1/-1"}}><Lbl>Descripción</Lbl><Inp value={newSvc.desc} onChange={e=>setNewSvc(f=>({...f,desc:e.target.value}))} placeholder="Descripción breve"/></div>
                </div>
                <div style={{display:"flex",gap:6}}><Btn ok={false} sm onClick={()=>setShowNew(false)}>Cancelar</Btn><Btn sm onClick={addSvc}>Añadir y guardar en Firebase</Btn></div>
              </div>
            )}
            <div style={as.card}>
              <table style={as.table}>
                <thead><tr>{["Emoji","Nombre","Duración","Precio","Acciones"].map(h=><th key={h} style={as.th}>{h}</th>)}</tr></thead>
                <tbody>{servicios.map(s=>(
                  <tr key={s.id}>{editSvc?.id===s.id?(
                    <>
                      <td style={as.td}><Inp style={{width:50,padding:"4px 8px"}} value={editSvc.emoji} onChange={e=>setEditSvc(f=>({...f,emoji:e.target.value}))}/></td>
                      <td style={as.td}><Inp style={{padding:"4px 8px"}} value={editSvc.nombre} onChange={e=>setEditSvc(f=>({...f,nombre:e.target.value}))}/></td>
                      <td style={as.td}><Inp style={{width:70,padding:"4px 8px"}} type="number" value={editSvc.duracionMin} onChange={e=>setEditSvc(f=>({...f,duracionMin:Number(e.target.value)}))}/></td>
                      <td style={as.td}><Inp style={{width:70,padding:"4px 8px"}} type="number" value={editSvc.precio} onChange={e=>setEditSvc(f=>({...f,precio:Number(e.target.value)}))}/></td>
                      <td style={as.td}><button style={as.actBtn(OK)} onClick={guardarSvc}>✓ Guardar</button><button style={as.actBtn(TX2)} onClick={()=>setEditSvc(null)}>✕</button></td>
                    </>
                  ):(
                    <>
                      <td style={as.td}>{s.emoji}</td>
                      <td style={{...as.td,fontWeight:600}}>{s.nombre}</td>
                      <td style={as.td}>{s.duracionMin} min</td>
                      <td style={{...as.td,fontWeight:700,color:A}}>€{s.precio}</td>
                      <td style={as.td}><button style={as.actBtn(A)} onClick={()=>setEditSvc({...s})}>✏️</button><button style={as.actBtn(ER)} onClick={()=>deleteSvc(s.id,s.nombre)}>🗑</button></td>
                    </>
                  )}</tr>
                ))}</tbody>
              </table>
            </div>
            <div style={{background:`${A}10`,border:`1px solid ${A}30`,borderRadius:10,padding:"10px 14px",fontSize:12,color:TX2}}>
              💡 Los cambios de servicios se guardan en Firebase automáticamente al pulsar ✓ Guardar.
            </div>
          </div>
        )}

        {configSubTab==="valoraciones"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontSize:12,color:TX2}}>Opiniones visibles en la web</div>
              <Btn sm onClick={()=>setShowNewVal(v=>!v)}>+ Añadir</Btn>
            </div>
            {showNewVal&&(
              <div style={{...as.card,marginBottom:14,border:`1px solid ${A}44`}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                  <div><Lbl>Nombre</Lbl><Inp value={newVal.nombre} onChange={e=>setNewVal(f=>({...f,nombre:e.target.value}))} placeholder="Ej: Laura M."/></div>
                  <div><Lbl>Servicio</Lbl><Inp value={newVal.servicio} onChange={e=>setNewVal(f=>({...f,servicio:e.target.value}))} placeholder="Ej: Corte"/></div>
                </div>
                <div style={{marginBottom:10}}><Lbl>Valoración</Lbl><div style={{display:"flex",gap:4}}>{[1,2,3,4,5].map(i=><span key={i} style={{fontSize:22,cursor:"pointer",color:i<=newVal.estrellas?"#F59E0B":"#D1D5DB"}} onClick={()=>setNewVal(f=>({...f,estrellas:i}))}>★</span>)}</div></div>
                <div style={{marginBottom:14}}><Lbl>Comentario</Lbl><textarea value={newVal.comentario} onChange={e=>setNewVal(f=>({...f,comentario:e.target.value}))} style={{width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,padding:"10px 13px",fontSize:13,color:TX,outline:"none",boxSizing:"border-box",fontFamily:FONT,minHeight:80,resize:"vertical"}}/></div>
                <div style={{display:"flex",gap:8}}><Btn ok={false} sm onClick={()=>setShowNewVal(false)}>Cancelar</Btn><Btn sm onClick={addVal}>Guardar</Btn></div>
              </div>
            )}
            {valoraciones.map(v=>(
              <div key={v.id} style={{...as.card,marginBottom:10}}>
                {editVal?.id===v.id?(
                  <div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                      <div><Lbl>Nombre</Lbl><Inp value={editVal.nombre} onChange={e=>setEditVal(f=>({...f,nombre:e.target.value}))}/></div>
                      <div><Lbl>Servicio</Lbl><Inp value={editVal.servicio} onChange={e=>setEditVal(f=>({...f,servicio:e.target.value}))}/></div>
                    </div>
                    <div style={{marginBottom:10}}><Lbl>Valoración</Lbl><div style={{display:"flex",gap:4}}>{[1,2,3,4,5].map(i=><span key={i} style={{fontSize:22,cursor:"pointer",color:i<=editVal.estrellas?"#F59E0B":"#D1D5DB"}} onClick={()=>setEditVal(f=>({...f,estrellas:i}))}>★</span>)}</div></div>
                    <div style={{marginBottom:12}}><Lbl>Comentario</Lbl><textarea value={editVal.comentario} onChange={e=>setEditVal(f=>({...f,comentario:e.target.value}))} style={{width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,padding:"10px 13px",fontSize:13,color:TX,outline:"none",boxSizing:"border-box",fontFamily:FONT,minHeight:70,resize:"vertical"}}/></div>
                    <div style={{display:"flex",gap:8}}><Btn ok={false} sm onClick={()=>setEditVal(null)}>Cancelar</Btn><Btn sm onClick={saveEdit}>Guardar</Btn></div>
                  </div>
                ):(
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                        <span style={{fontSize:13,fontWeight:700,color:TX}}>{v.nombre}</span>
                        <div style={{display:"flex",gap:1}}>{Array.from({length:5}).map((_,i)=><span key={i} style={{fontSize:12,color:i<v.estrellas?"#F59E0B":"#D1D5DB"}}>★</span>)}</div>
                        <span style={{fontSize:11,color:TX2}}>{v.servicio}</span>
                      </div>
                      <p style={{fontSize:12,color:TX2,margin:0,fontStyle:"italic"}}>"{v.comentario}"</p>
                    </div>
                    <div style={{display:"flex",gap:6,marginLeft:12}}>
                      <button style={as.actBtn(A)} onClick={()=>setEditVal({...v})}>✏️</button>
                      <button style={as.actBtn(ER)} onClick={async()=>{setValoraciones(p=>p.filter(x=>x.id!==v.id));await borrarValoracionFB(v);}}>🗑</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {valoraciones.length===0&&<div style={{textAlign:"center",padding:"30px",color:TX2,fontSize:13,background:WH,borderRadius:12,border:`1px solid ${CR3}`,fontStyle:"italic"}}>No hay opiniones.</div>}
          </div>
        )}

        {configSubTab==="horarios"&&(
          <div>{CONFIG.peluqueros.map(p=>(
            <div key={p.id} style={{...as.card,marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:700,color:TX,marginBottom:12,display:"flex",alignItems:"center",gap:8}}><span style={{width:10,height:10,borderRadius:2,background:p.color}}/>{p.emoji} {p.nombre}</div>
              <table style={as.table}><thead><tr>{["Día","Entrada","Salida","Descanso"].map(h=><th key={h} style={as.th}>{h}</th>)}</tr></thead>
              <tbody>{[1,2,3,4,5,6].map(d=>{const h=p.horario[d];return(<tr key={d}><td style={{...as.td,fontWeight:700}}>{DIAS_FULL[d]}</td><td style={as.td}>{h?h.entrada:<span style={{color:TX2}}>—</span>}</td><td style={as.td}>{h?h.salida:<span style={{color:TX2}}>—</span>}</td><td style={as.td}>{h?.descanso?`${h.descanso.inicio}–${h.descanso.fin}`:<span style={{color:TX2}}>—</span>}</td></tr>);})}</tbody>
              </table>
            </div>
          ))}</div>
        )}
      </div>
    );
  };

  // ──────────────────────
  // TAB COMUNICACIÓN
  // ──────────────────────
  const TabComunicacion=()=>{
    const msgs=[
      {icon:"✅",titulo:"Confirmación de reserva",cuando:"Inmediatamente al reservar",msg:`Hola [Nombre] 👋\nReserva confirmada en *${CONFIG.nombre}*\n\n✂️ [Servicio]\n💈 [Peluquero]\n📅 [Fecha]\n🕐 [Hora]\n💶 €[Precio]\n\nTe esperamos 😊`},
      {icon:"⏰",titulo:"Recordatorio 24h antes",cuando:"24h antes de la cita",msg:`Hola [Nombre] 👋\nMañana tienes cita en *${CONFIG.nombre}*\n\n✂️ [Servicio] con [Peluquero]\n🕐 [Hora]\n📍 ${CONFIG.direccion}\n\n¿Necesitas cancelar? Avísanos 🙏`},
      {icon:"⭐",titulo:"Mensaje post-cita",cuando:"24h después de la cita",msg:`Hola [Nombre]!\nEsperamos que hayas quedado genial 💈\n\n¿Cómo fue tu experiencia?\nTu opinión nos ayuda mucho 🙏`},
      {icon:"🔄",titulo:"Recordatorio de vuelta",cuando:"X semanas después",msg:`Hola [Nombre] 👋\n¿Toca pasar por *${CONFIG.nombre}*?\n\nReserva cuando quieras 😊\n👉 [Enlace reserva]`},
      {icon:"📊",titulo:"Resumen diario al dueño",cuando:"Cada mañana a las 8:00",msg:`*Resumen del día — ${CONFIG.nombre}*\n📅 [Fecha]\n\nCitas: [N] · Clara: [N] · Fernando: [N] · Marta: [N]\n💶 Ingresos previstos: €[Total]`},
      {icon:"🔔",titulo:"Aviso nueva reserva",cuando:"Cada vez que alguien reserva",msg:`*Nueva reserva 🎉*\n\n👤 [Cliente] · ✂️ [Servicio]\n💈 [Peluquero] · 📅 [Fecha] 🕐 [Hora]`},
    ];
    return(
      <div>
        <div style={{background:"#25D36610",border:"1px solid #25D36633",borderRadius:12,padding:"14px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:24}}>💬</span>
          <div><div style={{fontSize:13,fontWeight:700,color:TX}}>Mensajes automáticos por WhatsApp</div><div style={{fontSize:12,color:TX2}}>Vista previa de los mensajes que se enviarán automáticamente.</div></div>
        </div>
        {msgs.map((m,i)=>(
          <div key={i} style={{...as.card,marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:20}}>{m.icon}</span><div><div style={{fontSize:13,fontWeight:700,color:TX}}>{m.titulo}</div><div style={{fontSize:11,color:TX2}}>{m.cuando}</div></div></div>
              <Bdg color={OK} small>Activo</Bdg>
            </div>
            <div style={{background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:10,padding:"12px 14px"}}>
              <div style={{fontSize:11,color:"#166534",fontWeight:700,marginBottom:6}}>Vista previa:</div>
              <div style={{fontSize:12,color:TX,lineHeight:1.7,whiteSpace:"pre-line",fontFamily:"monospace"}}>{m.msg}</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const tabs=[["citas","📅","Citas"],["clientes","👥","Clientes"],["caja","💰","Caja"],["stats","📊","Estadísticas"],["disponibilidad","🗓️","Disponibilidad"],["config","⚙️","Config"],["comunicacion","💬","WhatsApp"]];

  return (
    <div style={as.root}>
      <div style={as.header} ref={el=>{if(el) document.documentElement.style.setProperty('--header-h',el.offsetHeight+'px')}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center"}}>
            <img 
              src="https://i.postimg.cc/4xxWbVq0/postepelu.webp" 
              alt="Logo Peluquería" 
              style={{
                width: "100%", 
                height: "100%", 
                objectFit: "contain" // Esto evita que la imagen se deforme
              }} 
            />
          </div>
          <div><div style={{fontSize:14,fontWeight:700,color:TX}}>{CONFIG.nombre} — ADMINISTRADOR</div><div style={{fontSize:11,color:TX2}}>{fmtLarga(HOY)}</div></div>
        </div>
        <button style={{background:CR2,border:`1px solid ${CR3}`,borderRadius:8,padding:"6px 14px",fontSize:12,color:TX2,cursor:"pointer"}} onClick={handleLogout}>Cerrar sesión →</button>
      </div>
      <div style={as.tabBar}>{tabs.map(([id,ic,l])=><button key={id} style={as.tabBtn(tab===id)} onClick={()=>setTab(id)}>{ic} {l}</button>)}</div>
      <div className="admin-body" style={{...as.body, margin:"0 auto"}}>
        {tab==="citas"&&<TabCitas/>}
        {tab==="clientes"&&<TabClientes/>}
        {tab==="caja"&&<TabCaja/>}
        {tab==="stats"&&<TabStats/>}
        {tab==="disponibilidad"&&<TabDisponibilidad/>}
        {tab==="config"&&<TabConfig/>}
        {tab==="comunicacion"&&<TabComunicacion/>}
      </div>
      {toastVisible&&(
        <div style={{position:"fixed",bottom:30,left:"50%",transform:"translateX(-50%)",background:"#1e293b",color:WH,borderRadius:12,padding:"14px 20px",display:"flex",alignItems:"center",gap:16,boxShadow:"0 8px 24px rgba(0,0,0,.3)",zIndex:200,fontSize:13,whiteSpace:"nowrap"}}>
          <span>🗑 Cita eliminada</span>
          <button style={{background:A,color:WH,border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={async()=>{ if(!_citaEliminadaTemp)return; const{id,...resto}=_citaEliminadaTemp; await crearCita(resto); _citaEliminadaTemp=null; setToastVisible(false); if(toastTimer)clearTimeout(toastTimer); }}>Deshacer</button>
        </div>
      )}
      {toastClienteVisible&&(
        <div style={{position:"fixed",bottom:30,left:"50%",transform:"translateX(-50%)",background:"#1e293b",color:WH,borderRadius:12,padding:"14px 20px",display:"flex",alignItems:"center",gap:16,boxShadow:"0 8px 24px rgba(0,0,0,.3)",zIndex:200,fontSize:13,whiteSpace:"nowrap"}}>
          <span>🗑 Cliente eliminado</span>
          <button style={{background:A,color:WH,border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={async()=>{ if(!_clienteEliminadoTemp)return; const{id,...resto}=_clienteEliminadoTemp; await addDoc(collection(db,"clientes"),resto); _clienteEliminadoTemp=null; setToastClienteVisible(false); if(toastClienteTimer)clearTimeout(toastClienteTimer); }}>Deshacer</button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// APP ROOT — carga datos y monta el router
// ─────────────────────────────────────────────
function AppData(){
  const [citas,setCitas]=useState([]);
  const [valoraciones,setValoraciones]=useState([]);
  const [festivos,setFestivos]=useState([]);
  const [bloqueos,setBloqueos]=useState([]);
  const [servicios,setServicios]=useState([...CONFIG.serviciosDefault]);
  const [cargando,setCargando]=useState(true);
  const [iniciado,setIniciado]=useState(false);

  useEffect(()=>{
    const u1=suscribirCitas(data=>{setCitas(data);setCargando(false);});
    const u2=suscribirValoracionesFB(setValoraciones);
    const u3=suscribirFestivos(setFestivos);
    const u4=suscribirBloqueos(setBloqueos);
    // ★ suscribir servicios desde Firebase
    const u5=suscribirServicios(data=>{ if(data&&data.length>0) setServicios(data); });
    const t=setTimeout(()=>setCargando(false),5000);
    return()=>{ u1();u2();u3();u4();u5();clearTimeout(t); };
  },[]);

  useEffect(()=>{
    if(!cargando&&citas.length===0&&!iniciado){
      setIniciado(true);
      seedDatabase().then(()=>console.log("Seed OK"));
      seedServicios().then(()=>console.log("Servicios sembrados"));
    }
  },[cargando,citas,iniciado]);

  if(cargando) return(
    <div className="cliente-wrap" style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#F8FBFF",fontFamily:FONT}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:40,marginBottom:16}}>✂️</div>
        <div style={{fontSize:16,fontWeight:700,color:"#0D1F35"}}>Cargando...</div>
        <div style={{fontSize:12,color:"#4A6080",marginTop:8}}>Conectando con Firebase</div>
      </div>
    </div>
  );

  const sharedProps={valoraciones,citas,festivos,bloqueos,servicios};

  return(
    <Routes>
      {/* Web pública */}
      <Route path="/" element={<ClientePage {...sharedProps} startPaso={0}/>}/>
      {/* Flujo reserva — remount limpio cada vez */}
      <Route path="/reservar" element={<ClientePage key="reservar" {...sharedProps} startPaso={1}/>}/>
      {/* Login */}
      <Route path="/login" element={<LoginPage/>}/>
      {/* Admin */}
      <Route path="/admin" element={
        <RequireAdmin>
          <AdminPage
            valoraciones={valoraciones} setValoraciones={setValoraciones}
            festivos={festivos} setFestivos={setFestivos}
            bloqueos={bloqueos} setBloqueos={setBloqueos}
            servicios={servicios} setServicios={setServicios}
          />
        </RequireAdmin>
      }/>
      {/* Vista peluquero */}
      <Route path="/mi-agenda" element={<RequirePeluquero><PeluqueroPage citas={citas}/></RequirePeluquero>}/>
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
  );
}

export default function App(){
  return(
    <BrowserRouter>
      <AppData/>
    </BrowserRouter>
  );
}