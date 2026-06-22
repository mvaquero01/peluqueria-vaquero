import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useLocation } from 'react-router-dom';
import {
  BrowserRouter, Routes, Route, useNavigate, Navigate, useSearchParams, useParams
} from "react-router-dom";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { db } from "./firebase.js";
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
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase.js";

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
    overflow-x: clip;
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
    top: 0px;
    z-index: 6;
    background: #F0F4F9;
  }
  /* Eje horas: spacer sticky para alinearse con las cabeceras */
  .cal-hour-header {
    height:52px;
    flex-shrink:0;
    border-bottom:1px solid #CED9E8;
    position:sticky;
    top: 0px;
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
    opacity: 1 !important;
    transform: translateY(0) !important;
  }

  .cat-content {
    overflow: hidden;
    animation: fadeUp 0.4s ease both;
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
  /* Botón flotante centrado */
  .sticky-bottom {
    position: fixed;
    bottom: 30px; /* Separado del borde inferior */
    left: 50%;
    transform: translateX(-50%); /* Centrado horizontal perfecto */
    z-index: 2000; /* Por encima de todo */
    display: flex;
    justify-content: center;
    width: auto;
    background: transparent; /* Quitamos el fondo blanco de barra */
    border: none;
    padding: 0;
    box-shadow: none;
  }

  /* Efecto de Zoom y Pulsación para el botón */
  /* Botón con sombra mucho más suave */
  .btn-continuar-float {
    padding: 16px 40px;
    border-radius: 50px;
    font-size: 15px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    /* SOMBRA SUAVE: Reducimos de 0.4 a 0.15 */
    box-shadow: 0 4px 12px rgba(27, 79, 138, 0.15); 
    border: none;
    white-space: nowrap;
  }

  .btn-continuar-float:hover:not(:disabled) {
    transform: scale(1.05); /* Zoom un poco más discreto */
    /* SOMBRA EN HOVER: Reducimos de 0.6 a 0.25 */
    box-shadow: 0 6px 18px rgba(27, 79, 138, 0.25);
  }

  .btn-continuar-float:active:not(:disabled) {
    transform: scale(0.95); /* Efecto de click */
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
const fmtFechaES = iso => { if(!iso) return ""; const [y,m,d]=iso.split("-"); return `${d}/${m}/${y}`; };
const fmtLarga  = d=>`${DIAS_FULL[d.getDay()]} ${d.getDate()} de ${MESES_ES[d.getMonth()]}`;
const haceNSemanas = n=>{ const d=new Date(); d.setDate(d.getDate()-n*7); return isoDate(d); };
const HOY = new Date(); HOY.setHours(0,0,0,0);
const HOY_ISO = isoDate(HOY);
let _citaEliminadaTemp=null, _clienteEliminadoTemp=null, _valEliminadaTemp=null, _svcEliminadoTemp=null, _catEliminadaTemp=null;
let _festivoEliminadoTemp=null, _bloqueoEliminadoTemp=null, _horarioEspEliminadoTemp=null;

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
function getTramosDia(pelId, fechaISO, horariosEspeciales, horariosGenerales){
  const fecha = new Date(fechaISO+"T12:00:00");
  const diaSemana = fecha.getDay();
  const pel = CONFIG.peluqueros.find(p => p.id === pelId);
  if(!pel) return [];

  // 1. Obtener tramos base del peluquero (especial o normal)
  let tramosBase = [];
  const especial = (horariosEspeciales||[]).find(h => Number(h.peluqueroId) === pelId && h.fecha === fechaISO);
  if(especial){
    if(especial.tramos && especial.tramos.length > 0) tramosBase = especial.tramos;
    else if(especial.entrada && especial.salida) tramosBase = [{entrada: especial.entrada, salida: especial.salida}];
    else return [];
  } else {
    const hp = pel.horario[diaSemana];
    if(!hp) return [];
    tramosBase = [hp];
  }

  // 2. Comprobar si hay horario general especial para este día
  const general = (horariosGenerales||[]).find(h => h.fecha === fechaISO);
  if(!general || !general.tramos || general.tramos.length === 0) return tramosBase;

  // 3. Recortar tramos del peluquero según ventanas del horario general
  const tramosRecortados = [];
  for(const tramoBase of tramosBase){
    const ini = toMin(tramoBase.entrada);
    const fin = toMin(tramoBase.salida);
    for(const ventana of general.tramos){
      const vIni = toMin(ventana.entrada);
      const vFin = toMin(ventana.salida);
      const inicio = Math.max(ini, vIni);
      const final = Math.min(fin, vFin);
      if(inicio < final){
        tramosRecortados.push({ entrada: toStr(inicio), salida: toStr(final), descanso: tramoBase.descanso || null });
      }
    }
  }
  return tramosRecortados;
}
function generarSlotsTramos(tramos, durMin){
  const slots = [];
  for(const hp of tramos){
    const s = generarSlots(hp, durMin);
    s.forEach(h => { if(!slots.includes(h)) slots.push(h); });
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
function suscribirFestivos(cb){
  return onSnapshot(collection(db,"cierres"),snap=>{
    cb(snap.docs.map(d=>({...d.data(),id:d.id})));
  });
}
async function crearFestivo(nombreDocumento, data){
  await setDoc(doc(db,"cierres",nombreDocumento),data);
}
async function borrarFestivo(id){
  await deleteDoc(doc(db,"cierres",id));
}

function suscribirBloqueos(cb){
  return onSnapshot(collection(db,"bloqueos"),snap=>{
    cb(snap.docs.map(d=>({...d.data(),id:d.id})));
  });
}
async function crearBloqueo(nombreDocumento, data){
  await setDoc(doc(db,"bloqueos",nombreDocumento),data);
}
async function borrarBloqueo(id){
  await deleteDoc(doc(db,"bloqueos",id));
}

function suscribirHorariosEspeciales(cb){
  return onSnapshot(collection(db,"horariosEspeciales"),snap=>{
    cb(snap.docs.map(d=>({...d.data(),id:d.id})));
  });
}
async function guardarHorarioEspecial(docId, data){
  await setDoc(doc(db,"horariosEspeciales",docId), data);
}
async function borrarHorarioEspecial(id){
  await deleteDoc(doc(db,"horariosEspeciales",id));
}

function suscribirHorariosGenerales(cb){
  return onSnapshot(collection(db,"horariosGenerales"),snap=>{
    cb(snap.docs.map(d=>({...d.data(),id:d.id})));
  });
}
async function guardarHorarioGeneral(docId, data){
  await setDoc(doc(db,"horariosGenerales",docId), data);
}
async function borrarHorarioGeneral(id){
  await deleteDoc(doc(db,"horariosGenerales",id));
}

// ── Servicios en Firebase ──
function suscribirServicios(cb){
  return onSnapshot(collection(db,"servicios"),snap=>{
    if(snap.empty){cb([]);return;}
    const data=snap.docs.map(d=>({...d.data()})).filter(Boolean).sort((a,b)=>(a.orden??a.id)-(b.orden??b.id));
    cb(data);
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
function suscribirCategorias(cb){
  return onSnapshot(collection(db,"categorias"),snap=>{
    if(snap.empty){ cb([]); return; }
    cb(snap.docs.map(d=>({...d.data()})).filter(Boolean).sort((a,b)=>(a.orden??a.id)-(b.orden??b.id)));
  });
}
async function guardarCategoriaFB(cat){
  const docId = cat.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/gi,"_");
  await setDoc(doc(db,"categorias",docId),cat);
}
async function borrarCategoriaFB(id, nombre){
  if(nombre){
    const docId = nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/gi,"_");
    await deleteDoc(doc(db,"categorias",docId));
  } else {
    await deleteDoc(doc(db,"categorias",String(id)));
  }
}
async function seedCategorias(){
  for(const cat of CONFIG.categorias){
    await setDoc(doc(db,"categorias",String(cat.id)),cat);
  }
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
      const docId = cita.clienteTel.replace(/\D/g,'');
      const clienteRef = doc(db,"clientes",docId);
      const clienteSnap = await getDoc(clienteRef);
      if(clienteSnap.exists()){
        const cl = clienteSnap.data();
        if(cita.estado==="completada"){
          const nuevoHistorial=(cl.historial||[]).filter(h=>!(h.fecha===cita.fecha&&h.servicio===cita.servicio&&h.peluquero===cita.peluquero));
          await updateDoc(clienteRef,{
            visitas:Math.max((cl.visitas||0)-1,0),
            gasto:Math.max((cl.gasto||0)-cita.precio,0),
            historial:nuevoHistorial,
            ultimaVisita:nuevoHistorial.length>0?nuevoHistorial[nuevoHistorial.length-1].fecha:""
          });
        } else if(cita.estado==="no-show"){
          await updateDoc(clienteRef,{
            noShows:Math.max((cl.noShows||0)-1,0)
          });
        }
        // Si no tiene visitas ni gasto ni noshows, borrar la ficha
        const clAct = (await getDoc(clienteRef)).data();
        if((clAct.visitas||0)===0&&(clAct.gasto||0)===0&&(clAct.noShows||0)===0){
          await deleteDoc(clienteRef);
        }
      }
    }
  }
  await deleteDoc(doc(db,"citas",id));
}
async function crearOActualizarCliente(datos){
  const docId = datos.telefono.replace(/\D/g, '');
  const ref = doc(db,"clientes",docId);
  const snap = await getDoc(ref);
  if(snap.exists()){
    const a = snap.data();
    await updateDoc(ref,{
      nombre: datos.nombre,
      visitas:(a.visitas||0)+1,
      gasto:(a.gasto||0)+datos.gasto,
      ultimaVisita:datos.ultimaVisita,
      historial:[...(a.historial||[]),...datos.historial]
    });
  } else {
    await setDoc(ref,{...datos, telefono: docId});
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

function asignarPeluqueroAleatorio(servicioId, fecha, hora, citas, bloqueos, festivosSet, servicios, horariosEspeciales, horariosGenerales) {
  const svc = servicios.find(s => s.id === servicioId);
  if (!svc) return null;
  const disponibles = CONFIG.peluqueros.filter(p => {
    if (peluqueroEstaBloqueado(p.id, fecha, bloqueos)) return false;
    if (festivosSet && festivosSet.has(fecha)) return false;
    const tramos = getTramosDia(p.id, fecha, horariosEspeciales || [], horariosGenerales || []);
    if (tramos.length === 0) return false;
    // Comprobar que la hora está dentro de algún tramo del peluquero
    const sI = toMin(hora), sF = sI + svc.duracionMin;
    const cabeEnAlgunTramo = tramos.some(t => sI >= toMin(t.entrada) && sF <= toMin(t.salida));
    if (!cabeEnAlgunTramo) return false;
    // Comprobar que no choca con otras citas
    const citasDelDia = citas.filter(c => c.fecha === fecha && c.peluqueroId === p.id && c.estado !== "no-show");
    const libre = !citasDelDia.some(c => {
      const sv = servicios.find(s => s.id === c.servicioId) || {duracionMin:30};
      const cI = toMin(c.hora), cF = cI + sv.duracionMin;
      return sI < cF && sF > cI;
    });
    return libre;
  });
  if (disponibles.length === 0) return null;
  return disponibles[Math.floor(Math.random() * disponibles.length)];
}

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
function MiniCalPicker({value,onChange,festivosSet,bloqueosPelId,bloqueos,horariosEspeciales}){
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
          const noHP=bloqueosPelId?getTramosDia(bloqueosPelId,iso,horariosEspeciales||[],[]).length===0:false;
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
const PX_MIN=1.8;
const HORA_APE=8*60+45,HORA_CIE=20*60+30;
const TOTAL_MIN=HORA_CIE-HORA_APE;
const GRID_H=TOTAL_MIN*PX_MIN;
const HORA_LABELS=Array.from({length:12},(_,i)=>i+9);

function CalendarioGrid({ dias, citas, peluqueroFiltroId }) {
  const scrollRef = useRef(null);

  // Sincroniza el scroll horizontal de cabecera y cuerpo
  const onBodyScroll = () => {
    if (scrollRef.current) {
      const header = document.getElementById('cal-header-row');
      if (header) header.scrollLeft = scrollRef.current.scrollLeft;
    }
  };

  return (
    <div style={{ width: "100%", position: "relative" }}>

      {/* CABECERA FIJA — sticky respecto a la página */}
      <div
        id="cal-header-row"
        style={{
          position: "sticky",
          top: "213px",
          zIndex: 5,
          background: "#F8FBFF",
          display: "flex",
          overflowX: "hidden",
          borderRadius: "13px 13px 0 0",
          border: "1px solid #CED9E8",
          borderBottom: "none",
        }}
      >
        {/* Hueco del eje de horas */}
        <div style={{ width: 52, flexShrink: 0, background: "#E8EEF6", borderRight: "1px solid #CED9E8", height: 52, zIndex: 0 }} />
        {/* Cabeceras de días */}
        {dias.map((d, i) => {
          const iso = isoDate(d);
          const esHoy = iso === HOY_ISO;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                minWidth: 130,
                height: 52,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                borderRight: "1px solid #CED9E8",
                background: esHoy ? "#1B4F8A" : "#E8EEF6",
                padding: "4px 8px",
                gap: 7,
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 700, color: esHoy ? "#fff" : "#4A6080", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap", lineHeight: 1 }}>
                {DIAS_ES[d.getDay()]}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: esHoy ? "#fff" : "#0D1F35", whiteSpace: "nowrap", lineHeight: 1 }}>
                {d.getDate()} {MESES_ES[d.getMonth()]}
              </span>
            </div>
          );
        })}
      </div>

      {/* CUERPO — scroll horizontal, sin cabeceras */}
      <div
        ref={scrollRef}
        onScroll={onBodyScroll}
        style={{
          display: "flex",
          overflowX: "auto",
          overflowY: "visible",
          background: "#F8FBFF",
          border: "1px solid #CED9E8",
          borderTop: "none",
          borderRadius: "0 0 13px 13px",
          width: "100%",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Eje de horas */}
        <div style={{ width: 52, flexShrink: 0, position: "relative", borderRight: "1px solid #CED9E8", background: "#E8EEF6" }}>
          <div style={{ position: "relative", height: GRID_H, paddingTop: 8 }}>
            {HORA_LABELS.map((h) => (
              <div key={h} style={{ position: "absolute", top: (h * 60 - HORA_APE) * PX_MIN, left: 0, right: 0, textAlign: "center", fontSize: 11, color: "#4A6080", fontWeight: 700, transform: "translateY(-50%)" }}>
                {h}:00
              </div>
            ))}
          </div>
        </div>

        {/* Columnas por día */}
        {dias.map((d, i) => {
          const iso = isoDate(d);
          const hGen = CONFIG.horarioGeneral[d.getDay()];
          const citasDia = citas.filter((c) => c.fecha === iso && (!peluqueroFiltroId || c.peluqueroId === peluqueroFiltroId)).sort((a, b) => a.hora.localeCompare(b.hora));
          const pelEnEsteDia = CONFIG.peluqueros.filter((p) => !!p.horario[d.getDay()]);

          return (
            <div key={i} style={{ flex: 1, minWidth: 130, borderRight: "1px solid #CED9E8", display: "flex", flexDirection: "column" }}>
              <div style={{ position: "relative", height: GRID_H, flexShrink: 0, paddingTop: 8 }}>
                {HORA_LABELS.map((h) => (
                  <div key={h} style={{ position: "absolute", top: (h * 60 - HORA_APE) * PX_MIN, left: 0, right: 0, borderTop: `1px solid ${h % 2 === 0 ? "#CED9E8" : "#E0E8F2"}`, zIndex: 0 }} />
                ))}
                {!hGen && (
                  <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(45deg,#F5F0E8,#F5F0E8 4px,#EDE6D9 4px,#EDE6D9 8px)", zIndex: 1, opacity: 0.6 }} />
                )}
                {hGen && (peluqueroFiltroId
                  ? CONFIG.peluqueros.filter(p => p.id === peluqueroFiltroId)
                  : pelEnEsteDia
                ).map((p) => {
                  const hp = p.horario[d.getDay()];
                  if (!hp?.descanso) return null;
                  const top = (toMin(hp.descanso.inicio) - HORA_APE) * PX_MIN;
                  const height = (toMin(hp.descanso.fin) - toMin(hp.descanso.inicio)) * PX_MIN;
                  return (
                    <div key={p.id} style={{ position: "absolute", left: 0, right: 0, top, height, background: p.color + "0A", zIndex: 1, borderTop: `1px dashed ${p.color}33`, borderBottom: `1px dashed ${p.color}33` }} />
                  );
                })}
                {citasDia.map((c) => {
                  const svc = CONFIG.serviciosDefault.find((s) => s.id === c.servicioId) || { duracionMin: 30 };
                  const pel = CONFIG.peluqueros.find((p) => p.id === c.peluqueroId);
                  const col = pel?.color || "#1B4F8A";
                  const top = (toMin(c.hora) - HORA_APE) * PX_MIN;
                  const height = Math.max(svc.duracionMin * PX_MIN - 2, 18);
                  const pelIdx = peluqueroFiltroId ? 0 : CONFIG.peluqueros.findIndex((p) => p.id === c.peluqueroId);
                  const total = peluqueroFiltroId ? 1 : CONFIG.peluqueros.length;
                  const cw = 100 / total;
                  return (
                    <div key={c.id} style={{ position: "absolute", top, left: `calc(${pelIdx * cw}% + 1px)`, width: `calc(${cw}% - 2px)`, height, background: `${col}22`, border: `1.5px solid ${col}99`, borderLeft: `3px solid ${col}`, borderRadius: 4, padding: "2px 4px", overflow: "hidden", zIndex: 2, boxSizing: "border-box" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: col, lineHeight: 1.3 }}>{c.hora}</div>
                      {height > 20 && <div style={{ fontSize: 9, color: "#0D1F35", fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.clienteNombre.split(" ")[0]}</div>}
                      {height > 34 && <div style={{ fontSize: 8, color: "#4A6080", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.servicio}</div>}
                      {height > 48 && <div style={{ fontSize: 8, color: col, fontWeight: 600 }}>{pel?.nombre}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
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
  const btnS={background:WH,border:`2px solid ${CR3}`,borderRadius:50,padding:"6px 18px",fontSize:12,fontWeight:700,cursor:"pointer",color:TX,transition:"all 0.2s ease"};
  return(
    <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <button style={btnS} onClick={()=>onChange(o=>o-1)}>← Anterior</button>
        <span style={{fontSize:12,fontWeight:700,color:TX,textAlign:"center"}}>{weekDays[0].getDate()} {MESES_ES[weekDays[0].getMonth()]} – {weekDays[5].getDate()} {MESES_ES[weekDays[5].getMonth()]}</span>
        <div style={{display:"flex",gap:8}}>
          <button style={btnS} onClick={()=>onChange(o=>o+1)}>Siguiente →</button>
        </div>
      </div>
      {offset!==0&&(
        <div style={{display:"flex",justifyContent:"center"}}>
          <button style={{...btnS,background:A,color:WH,border:`2px solid ${A}`}} onClick={()=>onChange(0)}>Volver a hoy</button>
        </div>
      )}
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
  const handleLogin=async()=>{
    // Intentar login como admin con Firebase Auth
    try {
      await signInWithEmailAndPassword(auth, user, pass);
      sessionStorage.setItem("authRole","admin");
      navigate("/admin");
      return;
    } catch(e) {
      // No es admin, probar con peluqueros
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
function ClientePage({ sharedProps, startPaso=0 }){ 

  // PEGA ESTA LÍNEA AQUÍ (Justo después de la llave de apertura)
  // Esto extrae todo lo necesario de sharedProps
  const { valoraciones, citas, festivos, bloqueos, servicios, categorias, setCategorias, isMobile, sliderRef, scrollSlider, sliderAtStart, setSliderAtStart, sliderAtEnd, setSliderAtEnd, horariosEspeciales, horariosGenerales } = sharedProps || {};

  if (!sharedProps) return null;

  // --- PANEL DE CONTROL VISUAL (Modifica estos valores para ajustar distancias) ---
  const CONFIG_RESERVA = {
    anchoContenedor: "90%",      // Ancho total de la zona de reserva
    separacionSuperior: "100px",    // Distancia del título con el header (techo)
    distanciaTituloCajas: "50px",   // Espacio entre el título y las fotos/contenido
    anchoCajaPC: "25%",             // Tamaño de los cuadros de servicio/peluquero
    anchoCajaMovil: "48%",          // Tamaño en móviles
    colorFondo: "#F8FBFF"           // Fondo de la zona de reserva
  };

  const [paso, setPaso] = useState(startPaso);
  const [selServicio, setSelServicio] = useState(null);
  const [selPeluquero, setSelPeluquero] = useState({ id: "cualquiera", nombre: "Cualquiera", foto: "https://i.postimg.cc/k44vVkYC/cualquiera.png" });
  const navigate = useNavigate();
  const { serviceId } = useParams();
  const location = useLocation();

  // Resetear datos al volver al home con flecha del navegador
  useEffect(() => {
    if (location.pathname === '/') {
      window.scrollTo({ top: 0, behavior: "instant" });
      setSelServicio(null);
      setSelPeluquero(null);
      setSelHora(null);
      setForm({nombre:"", telefono:""});
      setCatAbiertaSync(null);
      setTimeout(() => {
        document.querySelectorAll('.reveal').forEach(el => {
          el.classList.remove('visible');
          void el.offsetHeight;
          el.classList.add('visible');
        });
      }, 50);
    } else if (location.pathname === '/reservar') {
      setSelPeluquero(null);
      setSelHora(null);
      if(catAbiertaRef.current) setCatAbierta(catAbiertaRef.current);
    }
  }, [location.pathname, categorias]);

  // Escuchador de la URL + Motor de Animaciones
  useEffect(() => {
    const sId = serviceId;

    if (sId && servicios && servicios.length > 0) {
      const encontrado = servicios.find(s => String(s.id) === String(sId));
      if (encontrado) {
        setSelServicio(encontrado);
        setSelPeluquero({ id: "cualquiera", nombre: "Cualquiera", foto: "https://i.postimg.cc/k44vVkYC/cualquiera.png" });
        setSelHora(null);
        setSelDia(new Date());
        setMesRef(new Date());
        setCatAbierta(null);
        setPaso(2);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } else if (location.pathname === '/reservar') {
      setCatAbierta(null);
      setPaso(1);
    } else if (location.pathname === '/') {
      setPaso(0);
    }
  }, [servicios, location.pathname, serviceId]);
  
  // Función para avanzar/retroceder
  const irAPaso = (n) => {
    setPaso(n);

    if (n === 1) {
      setSelPeluquero({ id: "cualquiera", nombre: "Cualquiera", foto: "https://i.postimg.cc/k44vVkYC/cualquiera.png" });
      setSelHora(null);
      setSelDia(new Date());
      if (selServicio) {
        const catDelSvc = categorias?.find(cat => (cat.servicioIds||[]).includes(selServicio.id));
        if (catDelSvc) setCatAbiertaSync(catDelSvc.id);
        else setCatAbiertaSync(null);
      } else {
        setCatAbiertaSync(null);
      }
    }
    if (n === 2) {
      setSelHora(null);
      setSelDia(new Date());
      setMesRef(new Date());
      setSelPeluquero({ id: "cualquiera", nombre: "Cualquiera", foto: "https://i.postimg.cc/k44vVkYC/cualquiera.png" });
    }
    if (n === 0) {
      setSelServicio(null);
      setSelPeluquero(null);
      setSelHora(null);
      setForm({nombre:"", telefono:""});
      setCatAbierta(null);
    }
    
    const params = new URLSearchParams();
    // El servicio siempre se mantiene si existe
    if (selServicio) params.set('serviceId', selServicio.id);

    if (n === 0) {
      navigate("/", { replace: false });
    } else if (n === 1) {
      // no navegamos, solo cambiamos estado
    } else if (n === 2) {
      const svcId = selServicio?.id || params.get('serviceId');
      navigate(`/reservar/${svcId}`, { replace: false });
    } else {
      const svcId = selServicio?.id || params.get('serviceId');
      navigate(`/reservar/${svcId}`, { replace: false });
    }
    
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const [catAbierta,setCatAbierta]=useState(null);
  const catAbiertaRef = useRef(null);
  const setCatAbiertaSync = (id) => { catAbiertaRef.current = id; setCatAbierta(id); };
  const [selDia, setSelDia] = useState(new Date()); // Inicializa con hoy
  const [selHora,setSelHora]=useState(null);
  const [mesRef, setMesRef] = useState(new Date());
  const [form,setForm]=useState({nombre:"",telefono:""});
  const festivosSet=useMemo(()=>new Set(festivos.map(f=>f.fecha)),[festivos]);

  const CUALQUIERA_ID = "cualquiera";
  const slots=useMemo(()=>{
    if(!selPeluquero||!selDia||!selServicio) return [];
    if(festivosSet.has(isoDate(selDia))) return [];
    if(!CONFIG.horarioGeneral[selDia.getDay()]) return [];
    if(selPeluquero.id===CUALQUIERA_ID){
      // Unión de todos los slots disponibles de todos los peluqueros
      const slotsSet = new Set();
      CONFIG.peluqueros.forEach(p=>{
        if(peluqueroEstaBloqueado(p.id,isoDate(selDia),bloqueos)) return;
        const tramos=getTramosDia(p.id,isoDate(selDia),horariosEspeciales||[],horariosGenerales||[]);
        if(tramos.length===0) return;
        const todos=generarSlotsTramos(tramos,selServicio.duracionMin);
        const citasDelDia=citas.filter(c=>c.fecha===isoDate(selDia)&&c.peluqueroId===p.id&&c.estado!=="no-show");
        const disponibles=filtrarSlotsOcupados(todos,selServicio.duracionMin,citasDelDia);
        disponibles.forEach(h=>slotsSet.add(h));
      });
      let arr=[...slotsSet].sort();
      if(isoDate(selDia)===HOY_ISO){
        const ahora=new Date(); const minAhora=ahora.getHours()*60+ahora.getMinutes()+15;
        arr=arr.filter(h=>toMin(h)>minAhora);
      }
      return arr;
    }
    const tramos=getTramosDia(selPeluquero.id,isoDate(selDia),horariosEspeciales||[],horariosGenerales||[]);
    if(tramos.length===0) return [];
    const todos=generarSlotsTramos(tramos,selServicio.duracionMin);
    const citasDelDia=citas.filter(c=>c.fecha===isoDate(selDia)&&c.peluqueroId===selPeluquero.id&&c.estado!=="no-show");
    const disponibles=filtrarSlotsOcupados(todos,selServicio.duracionMin,citasDelDia);
    if(isoDate(selDia)===HOY_ISO){
      const ahora=new Date(); const minAhora=ahora.getHours()*60+ahora.getMinutes()+15;
      return disponibles.filter(h=>toMin(h)>minAhora);
    }
    return disponibles;
  },[selPeluquero,selDia,selServicio,citas,bloqueos,horariosEspeciales]);

  const scrollTop=()=>window.scrollTo({top:0,behavior:"smooth"});
  const reset=()=>{ scrollTop(); navigate("/"); };
  const confirmarReserva=async()=>{
    if(!form.nombre||!form.telefono) return;
    let pelFinal = selPeluquero;
    if(selPeluquero.id === CUALQUIERA_ID){
      const asignado = asignarPeluqueroAleatorio(selServicio.id, isoDate(selDia), selHora, citas, bloqueos, festivosSet, servicios, horariosEspeciales, horariosGenerales);
      if(!asignado) return; // no hay nadie disponible (no debería pasar)
      pelFinal = asignado;
    }
    await crearCita({clienteNombre:form.nombre,clienteTel:form.telefono,servicio:selServicio.nombre,servicioId:selServicio.id,peluqueroId:pelFinal.id,peluquero:pelFinal.nombre,fecha:isoDate(selDia),hora:selHora,precio:selServicio.precio,estado:"pendiente",nota:""});
    const docId = form.telefono.replace(/\D/g, '');
    const ref = doc(db,"clientes",docId);
    const snap = await getDoc(ref);
    if(!snap.exists()){
      // Buscar ficha antigua con formato nombre_telefono
      const q = query(collection(db,"clientes"), where("telefono","==",docId));
      const viejas = await getDocs(q);
      if(!viejas.empty){
        // Migrar la ficha antigua al nuevo formato
        const viejaData = viejas.docs[0].data();
        await setDoc(ref, {...viejaData, telefono: docId, nombre: form.nombre});
        await deleteDoc(doc(db,"clientes", viejas.docs[0].id));
      } else {
        await setDoc(ref,{nombre:form.nombre,telefono:docId,visitas:0,gasto:0,ultimaVisita:"",nota:"",historial:[]});
      }
    } else {
      await updateDoc(ref,{nombre:form.nombre});
    }
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
      marginTop: "0px",    /* Muy poco espacio con la línea de ARRIBA */
      marginBottom: "0px", /* Espacio con los servicios de ABAJO */
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
      /* 0px arriba, 4% lados, 00px abajo para reservar el hueco del desplegable */
      padding: "0px 4% 0px 4%", 
      maxWidth: "100%", 
      margin: "0 auto",
      minHeight: "500px", 
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box"
      
    },
    sectionCompacta: { 
      /* 0px arriba, 10% lados, 0px abajo */
      padding: "0px 10% 0px 10%", 
      maxWidth: "100%", 
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box"
    },
  };

  // ── HOME ──
  const scrollTo=id=>{
    const el=document.getElementById(id);
    if(el){
      const headerH=70;
      if(id==="servicios"){
        el.classList.add("visible");
      }
      setTimeout(()=>{
        const top=el.getBoundingClientRect().top+window.scrollY-headerH;
        window.scrollTo({top,behavior:"smooth"});
      },50);
    }
  };
  const esMovil = window.innerWidth <= 768;
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
          <button onClick={()=>irAPaso(1)} style={{ background:`linear-gradient(135deg,${A},#133A6A)`, color:WH, border:"none", borderRadius:"8px", height:"45px", padding:"0 30px", fontSize:"14px", fontWeight:700, cursor:"pointer", display:"inline-flex", alignItems:"center", justifyContent:"center", letterSpacing:"0.5px", textTransform:"uppercase", transition:"transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)", backfaceVisibility:"hidden", willChange:"transform", transform:"scale(1)" }} onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"} onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}>RESERVAR</button>
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
        <p className="hero-dir" style={{fontSize:12,color:"#9ec3e8",marginBottom:20}}>📍 {CONFIG.direccion} · 📞 {CONFIG.telefono}</p>
        <button onClick={()=>irAPaso(1)} style={{ background:`linear-gradient(135deg,${A},#133A6A)`, color:WH, border:"none", borderRadius:"8px", height:"60px", padding:"0 50px", fontSize:"18px", fontWeight:700, cursor:"pointer", display:"inline-flex", alignItems:"center", justifyContent:"center", letterSpacing:"0.5px", textTransform:"uppercase", transition:"transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)", backfaceVisibility:"hidden", willChange:"transform", transform:"scale(1)" }} onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"} onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}>RESERVAR</button>
      </div>
      
      <div style={{ padding: "0 4% 0px 4%", marginTop: 20, marginBottom: "0px" }}>
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

      
      {/* --- SECCIÓN 2: SERVICIOS EN EL HOME --- */}
      {(() => {
        const margenSuperiorSeccion = "40px"; 
        const separacionTituloFotos = "40px"; 
        const margenHorizontal = "4%"; 
        const separacionCajas = "20px"; 
        
        return (
          <div id="servicios" style={{ paddingTop: margenSuperiorSeccion, paddingBottom: "0px", backgroundColor: "transparent", width: "100%" }}>
            
            <div style={{ ...cs.sTitle, marginBottom: separacionTituloFotos, display: "flex", justifyContent: "center", alignItems: "center" }}>
              ✦ Servicios
            </div>

            <div style={{ 
              display: "flex", 
              flexWrap: "wrap", 
              justifyContent: "center", 
              gap: separacionCajas, 
              width: "100%", 
              padding: `0px ${margenHorizontal} 0px ${margenHorizontal}`
            }}>
              {[...(categorias||[])].sort((a,b) => (a.orden??a.id) - (b.orden??b.id)).map(cat => {
                const svcs = (cat.servicioIds||[]).map(id => servicios.find(s => s.id === id)).filter(Boolean);
                const abierta = catAbierta === cat.id;

                if(esMovil) return (
                  <div key={cat.id} style={{ width: "100%", borderRadius: "16px", overflow: "hidden", border: `1px solid ${CR3}`, background: WH, marginBottom: "8px" }}>
                    <div onClick={() => setCatAbierta(abierta ? null : cat.id)} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 16px", cursor: "pointer" }}>
                      <img src={cat.foto} style={{ width: "56px", height: "56px", borderRadius: "12px", objectFit: "cover", flexShrink: 0 }} />
                      <div style={{ flex: 1, fontWeight: 800, fontSize: "15px", color: TX, textTransform: "uppercase", letterSpacing: "0.5px" }}>{cat.nombre}</div>
                      <div style={{ fontSize: "12px", color: TX2, transform: abierta ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.3s" }}>▼</div>
                    </div>
                    {abierta && (
                      <div style={{ borderTop: `1px solid ${CR2}` }}>
                        {svcs.map(s => (
                          <div key={s.id} onClick={(e) => { e.stopPropagation(); window.scrollTo({ top: 0, behavior: "smooth" }); navigate(`/reservar/${s.id}`); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${CR2}`, cursor: "pointer" }}>
                              <div>
                                <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                                  <span style={{ fontSize: "13px", fontWeight: 700, color: TX }}>{s.nombre}</span>
                                  <span style={{ fontSize: "11px", color: TX2 }}>⏱ {s.duracionMin}'</span>
                                </div>
                                {s.desc && <div style={{ fontSize: "11px", color: TX2, marginTop: "2px", textAlign: "left" }}>{s.desc}</div>}
                              </div>
                              <div style={{ fontWeight: 800, fontSize: "15px", color: A, flexShrink: 0, marginLeft: "10px" }}>{s.precio}€</div>
                            </div>
                        ))}
                      </div>
                    )}
                  </div>
                );

                return (
                  <div 
                    key={cat.id}
                    onClick={() => setCatAbierta(abierta ? null : cat.id)}
                    className="card-hover"
                    style={{ 
                      position: "relative", 
                      flex: `0 1 ${CONFIG_RESERVA.anchoCajaPC}`,
                      minWidth: "250px",
                      aspectRatio: "1 / 1", 
                      borderRadius: "20px", 
                      overflow: "hidden", 
                      cursor: "pointer", 
                      backgroundImage: `url(${cat.foto})`, 
                      backgroundSize: "cover", 
                      backgroundPosition: "center", 
                      transition: "all 0.4s cubic-bezier(0.25, 1, 0.5, 1)", 
                      transform: abierta ? "scale(1.02)" : "scale(1)"
                    }}
                  >
                    <div style={{ 
                      position: "absolute", 
                      top: 0, left: 0, right: 0, bottom: 0, 
                      background: abierta ? "rgba(0,0,0,0.95)" : "linear-gradient(to bottom, rgba(0,0,0,0) 60%, rgba(0,0,0,0.85) 100%)", 
                      display: "flex", 
                      flexDirection: "column", 
                      justifyContent: abierta ? "center" : "flex-end", 
                      alignItems: "center", 
                      padding: abierta ? "15px" : "20px", 
                      transition: "background 0.4s ease-out" 
                    }}>
                      <div style={{ textAlign: "center", marginBottom: abierta ? "15px" : "5px", width: "100%" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                          <h3 style={{ color: "#FFF", margin: 0, fontSize: "18px", fontWeight: "800", textTransform: "uppercase" }}>{cat.nombre}</h3>
                          <div style={{ color: "#FFF", fontSize: "9px", transform: abierta ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.4s" }}>▼</div>
                        </div>
                      </div>
                      <div style={{ 
                        width: "100%", 
                        maxHeight: abierta ? "400px" : "0", 
                        opacity: abierta ? 1 : 0, 
                        transform: abierta ? "translateY(0)" : "translateY(10px)", 
                        overflowY: "auto", 
                        transition: "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
                        scrollbarWidth: "none"
                      }}>
                        {svcs.map(s => (
                          <div key={s.id} onClick={(e) => { e.stopPropagation(); window.scrollTo({ top: 0, behavior: "smooth" }); navigate(`/reservar/${s.id}`); }} style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                            <div style={{ textAlign: "left", flex: 1, paddingRight: "10px" }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                                <span style={{ color: "#FFF", fontSize: "12px", fontWeight: "600" }}>{s.nombre}</span>
                                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "10px" }}>⏱ {s.duracionMin}'</span>
                              </div>
                              {s.desc && <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "10px", lineHeight: "1.1", marginTop: "3px" }}>{s.desc}</div>}
                            </div>
                            <div style={{ color: "#FFF", fontWeight: "800", fontSize: "14px" }}>{s.precio}€</div>
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

      <hr id="equipo" style={{ 
        border: "none", 
        height: "1px", 
        background: `linear-gradient(to right, transparent, ${CR3}, transparent)`, 
        margin: "40px auto 40px auto",
        maxWidth: "100%"
      }} />

      {/* --- SECCIÓN EQUIPO (ESTRUCTURA DE CONTROL TOTAL) --- */}
      <div className="reveal" style={{ width: "100%", background: WH, overflow: "hidden", padding: 0 }}>
        <div style={{ display: "flex", flexDirection: esMovil ? "column" : "row", alignItems: "stretch", width: "100%" }}>
          {!esMovil && (
            <div style={{ flex: "0 0 40%", position: "relative" }}>
              <img src="https://i.postimg.cc/Y0TygmSb/peluqueros.jpg" alt="Nuestro Equipo" style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }} />
            </div>
          )}
          <div style={{ flex: "1", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0px 0", background: WH }}>
            {(() => {
              const tituloDistanciaIzquierda = "40px";
              const tituloMargenInferior = "40px";
              const separacionEntreCajas = esMovil ? "16px" : "40px";
              const anchoCaja = "250px";
              const altoCaja = "300px";
              return (
                <>
                  <div style={{ ...cs.sTitle, textAlign: esMovil ? "center" : "left", paddingLeft: esMovil ? "0" : tituloDistanciaIzquierda, marginBottom: tituloMargenInferior }}>
                    ✦ Profesionales
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: separacionEntreCajas, justifyContent: "center", width: "100%", paddingLeft: esMovil ? "20px" : "0%", paddingRight: esMovil ? "20px" : "0%" }}>
                    {CONFIG.peluqueros.map(p => (
                      <div key={p.id} className="card-hover" style={{
                        width: esMovil ? "100%" : anchoCaja,
                        flex: esMovil ? "0 0 100%" : `0 0 ${anchoCaja}`,
                        minHeight: esMovil ? "auto" : altoCaja,
                        display: "flex",
                        flexDirection: esMovil ? "row" : "column",
                        alignItems: "center",
                        justifyContent: esMovil ? "flex-start" : "center",
                        background: "#FFF",
                        padding: esMovil ? "16px 20px" : "20px",
                        borderRadius: esMovil ? "16px" : "24px",
                        border: `1px solid ${CR3}`,
                        boxShadow: "0 4px 15px rgba(0,0,0,0.04)",
                        textAlign: esMovil ? "left" : "center",
                        gap: esMovil ? "20px" : "0"
                      }}>
                        <div style={{ width: esMovil ? "80px" : "115px", height: esMovil ? "80px" : "115px", borderRadius: "50%", marginBottom: esMovil ? "0" : "18px", flexShrink: 0, overflow: "hidden", border: `3px solid ${A}15` }}>
                          <img src={p.foto || "https://i.postimg.cc/4xxWbVq0/postepelu.webp"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: TX, fontSize: esMovil ? "17px" : "19px" }}>{p.nombre}</div>
                          <div style={{ fontSize: esMovil ? "12px" : "12px", color: A, fontWeight: 700, textTransform: "uppercase", marginTop: esMovil ? "4px" : "6px", letterSpacing: "0.5px", lineHeight: "1.2" }}>{p.especialidad}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>


      <hr id="opiniones" style={{ 
        border: "none", 
        height: "1px", 
        background: `linear-gradient(to right, transparent, ${CR3}, transparent)`, 
        margin: "40px auto 40px auto",
        maxWidth: "100%"
      }} />

      {/* --- SECCIÓN 3: OPINIONES (Exactamente 3 en PC, 1 en Móvil + Asomo) --- */}
      {valoraciones && valoraciones.length > 0 && (
        <div className="reveal" style={{...cs.sectionCompacta, paddingLeft: 0, paddingRight: 0, maxWidth: "100%"}}>
          
          <style>{`
            .carrusel-opiniones::-webkit-scrollbar { display: none; }
            .carrusel-opiniones { -ms-overflow-style: none; scrollbar-width: none; }
          `}</style>

          <div style={{ marginTop: "0px", marginBottom: "40px", textAlign: "center" }}>
            <div style={{ ...cs.sTitle, marginBottom: 0 }}>✦ Opiniones</div>
          </div>

          <div style={{ 
            position: "relative", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            width: "100%",
            maxWidth: "1400px", // Tope para pantallas gigantes
            margin: "0 auto",
            marginBottom: "0px",
            marginTop: "0px"
          }}>
            
            {/* FLECHA IZQUIERDA */}
            {!sliderAtStart && (isMobile ? valoraciones.length > 1 : valoraciones.length > 3) && (
              <button 
                onClick={() => scrollSlider("left")}
                style={{ 
                  position: "absolute", 
                  left: isMobile ? "6px" : "20px",
                  zIndex: 10,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12px",
                  color: TX2,
                  padding: "0 6px",
                  display: "inline-flex",
                  alignItems: "center",
                  transform: "rotate(90deg)"
                }}
              >
                ▼
              </button>
            )}

            {/* EL CARRUSEL */}
            <div 
              ref={sliderRef}
              className="carrusel-opiniones"
              onScroll={(e) => {
                const el = e.target;
                setSliderAtStart(el.scrollLeft < 10);
                setSliderAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 10);
              }}
              style={{ 
                display: "flex", 
                gap: "24px", 
                overflowX: "auto", 
                scrollSnapType: "x mandatory",
                scrollBehavior: "smooth",
                padding: isMobile ? "0px 12%" : "0px 8%", 
                scrollPadding: isMobile ? "0 12%" : "0 8%", 
                width: "100%",
                boxSizing: "border-box",
                justifyContent: !isMobile && valoraciones.length <= 3 ? "center" : "flex-start",
                maskImage: "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
                WebkitMaskImage: "linear-gradient(to right, transparent, black 12%, black 88%, transparent)"
              }}
            >
              {[...valoraciones].sort((a,b) => (a.orden??0) - (b.orden??0)).map(v => (
                <div 
                  key={v.id} 
                  style={{
                    // MATEMÁTICA EXACTA:
                    // Móvil = 100% (cabe 1 entera).
                    // PC = calc(33.333% - 16px) (caben exactamente 3 enteras restando los 2 huecos de 24px)
                    flex: isMobile ? "0 0 100%" : "0 0 calc(33.333% - 16px)", 
                    scrollSnapAlign: "start", // Anclaje perfecto al padding
                    background: WH, 
                    border: `1px solid ${CR3}`, 
                    borderRadius: 16, 
                    padding: "28px", 
                    boxSizing: "border-box",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.03)"
                  }}
                >
                  <div style={{display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems:"center"}}>
                    <span style={{fontSize: 15, fontWeight: 800, color: TX}}>{v.nombre}</span>
                    <div style={{display: "flex", gap: 1}}>
                      {[1,2,3,4,5].map(i => <span key={i} style={{fontSize: 13, color: i <= v.estrellas ? "#F59E0B" : "#D1D5DB"}}>★</span>)}
                    </div>
                  </div>
                  <p style={{fontSize: 14, color: TX2, fontStyle: "italic", lineHeight: "1.6", margin: 0}}>"{v.comentario}"</p>
                  <div style={{fontSize: 11, color: A, fontWeight: 700, marginTop: 18, textTransform: "uppercase", letterSpacing: 1}}>{v.servicio}</div>
                </div>
              ))}
            </div>

            {/* FLECHA DERECHA */}
            {!sliderAtEnd && (isMobile ? valoraciones.length > 1 : valoraciones.length > 3) && (
              <button 
                onClick={() => scrollSlider("right")}
                style={{ 
                  position: "absolute", 
                  right: isMobile ? "6px" : "20px",
                  zIndex: 10,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12px",
                  color: TX2,
                  padding: "0 6px",
                  display: "inline-flex",
                  alignItems: "center",
                  transform: "rotate(-90deg)"
                }}
              >
                ▼
              </button>
            )}

          </div>
        </div>
      )}

      <hr id="ubicacion" style={{ 
        border: "none", 
        height: "1px", 
        background: `linear-gradient(to right, transparent, ${CR3}, transparent)`, 
        margin: "40px auto 40px auto",
        maxWidth: "1400px"
      }} />

      {/* --- SECCIÓN 4: UBICACIÓN Y CONTACTO --- */}
      <div className="reveal" style={cs.sectionCompacta}>
        
        <div style={{ width: window.innerWidth > 768 ? "80%" : "100%", margin: "0 auto" }}>
          
          <div style={{ ...cs.sTitle, marginTop: "0px" }}>✦ Contacto</div>

          <div style={{ display: "flex", flexDirection: window.innerWidth > 768 ? "row" : "column", gap: "40px", alignItems: "center", marginTop: "40px" }}>
            
            {/* BLOQUE IZQUIERDO: TEXTOS */}
            <div style={{ flex: 1, textAlign: "left" }}>
              <p style={{ fontSize: 20, fontWeight: 900, marginBottom: 5, color: TX }}>{CONFIG.nombre}</p>
              <p style={{ color: TX2, fontSize: 15, marginBottom: 25 }}>El detalle marca la diferencia</p>

              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: TX, marginBottom: 8 }}>Contacto</h3>
                <div style={{ fontSize: 14, color: TX2, lineHeight: "1.6" }}>
                  <div><strong>Dirección:</strong> {CONFIG.direccion}</div>
                  <div><strong>Teléfono:</strong> <span style={{ color: A, fontWeight: 700 }}>{CONFIG.telefono}</span></div>
                  <div><strong>Email:</strong> {CONFIG.email}</div>
                </div>
              </div>

              <div style={{ marginBottom: 30 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: TX, marginBottom: 8 }}>Horario</h3>
                <div style={{ fontSize: 14, color: TX2, lineHeight: "1.6" }}>
                  {Object.entries(CONFIG.horarioGeneral).map(([d,h])=>(
                    <div key={d}>{DIAS_FULL[Number(d)]}: {h.apertura} - {h.cierre}</div>
                  ))}
                </div>
              </div>

              {/* CONTENEDOR DE BOTONES UNIFICADOS */}
              <div style={{ display: "flex", gap: "15px", alignItems: "center", marginTop: "30px" }}>
                
                {/* BOTÓN PEDIR CITA (ESTILO RESERVAR) */}
                <button onClick={()=>irAPaso(1)} style={{ background:`linear-gradient(135deg,${A},#133A6A)`, color:WH, border:"none", borderRadius:"8px", height:"45px", padding:"0 30px", fontSize:"14px", fontWeight:700, cursor:"pointer", display:"inline-flex", alignItems:"center", justifyContent:"center", letterSpacing:"0.5px", textTransform:"uppercase", transition:"transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)", backfaceVisibility:"hidden", willChange:"transform", transform:"scale(1)" }} onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"} onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}>RESERVAR</button>

                {/* BOTÓN INSTAGRAM (SIN ERRORES VISUALES) */}
                <a href={CONFIG.instagram} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "45px", height: "45px", background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)", borderRadius: "8px", textDecoration: "none", flexShrink: 0, cursor: "pointer", transition: "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)", backfaceVisibility: "hidden", willChange: "transform", transform: "scale(1)", transformStyle: "preserve-3d" }} onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"} onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "27px", height: "27px", pointerEvents: "none", display: "block" }}>
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                  </svg>
                </a>
              </div>
            </div>

            {/* BLOQUE DERECHO: MAPA */}
            <div style={{ flex: 1, width: "100%" }}>
              <div style={{ width: "100%", height: "300px", borderRadius: 13, overflow: "hidden", border: `1px solid ${CR3}`, boxShadow: "0 4px 15px rgba(0,0,0,0.05)" }}>
                <iframe 
                  src={CONFIG.googleMapsEmbed}
                  width="100%" height="100%" style={{ border: 0 }} allowFullScreen="" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                ></iframe>
              </div>

              {/* BOTÓN VER EN GOOGLE MAPS */}
              <div style={{ textAlign: "center", marginTop: "30px" }}>
                <a href={CONFIG.googleMapsLink} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: A, fontSize: "14px", fontWeight: 700, textDecoration: "none", padding: "8px 16px", borderRadius: "8px", background: `${A}10`, border: `1px solid ${A}30`, transition: "all 0.3s ease" }} onMouseEnter={(e) => e.currentTarget.style.background = `${A}20`} onMouseLeave={(e) => e.currentTarget.style.background = `${A}10`}>
                  <span>🗺️ Ver en Google Maps</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ height: 80 }} />
    </div>
  );



  // ── FLUJO RESERVA (pasos 1-5) ──
  // ★ Botón CONTINUAR fijo en la parte inferior
  // --- LÓGICA DE BOTÓN CONTINUAR ---
  const formValido = form.nombre?.trim() !== '' && form.telefono?.trim() !== '';
  const btnOk = paso === 1 ? !!selServicio : paso === 2 ? !!(selPeluquero && selDia && selHora && formValido) : false;
  const btnLabel = paso === 2
    ? (btnOk ? "CONFIRMAR RESERVA ✓" : "COMPLETA TODOS LOS CAMPOS")
    : "CONTINUAR →";
  const btnAction = () => {
    if (!btnOk) return;
    if (paso === 1) irAPaso(2);
    else if (paso === 2) confirmarReserva();
  };

  // --- RETURN ÚNICO (Sustituye todo el flujo anterior) ---
  return (
    <div className="cliente-wrap" style={{ fontFamily: FONT, background: CONFIG_RESERVA.colorFondo, minHeight: "100vh", paddingTop: esMovil ? "0px" : "70px" }}>
      
      {/* 1. HEADER FIJO — solo en escritorio */}
      {!esMovil && (
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
                style={{ width: "100%", height: "100%", objectFit: "contain" }} 
              />
            </div>
            <span style={{fontSize:17,fontWeight:700,color:TX}}>{CONFIG.nombre}</span>
          </div>
        </div>
      )}

      {/* 2. CONTENEDOR MAESTRO (Controla el ancho) */}
      <div style={{ maxWidth: CONFIG_RESERVA.anchoContenedor, margin: "0 auto", padding: `0 20px`, paddingTop: esMovil ? "20px" : CONFIG_RESERVA.separacionSuperior }}>
        
        {/* 3. BOTONES VOLVER ATRÁS (Fácil de modificar) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative", marginBottom: CONFIG_RESERVA.distanciaTituloCajas }}>
          {paso === 1 && (
            <button style={{ position: "absolute", left: 0, background: "transparent", border: "none", color: TX2, cursor: "pointer", fontSize: "20px", padding: 0, lineHeight: 1 }} onClick={() => irAPaso(0)}>←</button>
          )}
          {paso === 2 && (
            <button style={{ position: "absolute", left: 0, background: "transparent", border: "none", color: TX2, cursor: "pointer", fontSize: "20px", padding: 0, lineHeight: 1 }} onClick={() => irAPaso(1)}>←</button>
          )}
          <div style={{ ...cs.sTitle, marginBottom: 0 }}>
            {paso === 1 && "✦ ¿Qué servicio necesitas?"}
            {paso === 2 && "✦ Completa tu reserva"}
          </div>
        </div>

        {/* 5. CONTENIDO DE LOS PASOS */}
        <div className="slide-in" style={{ paddingBottom: "140px" }}>
          
          {paso === 1 && (
            <div style={{ 
              display: "flex", 
              flexWrap: "wrap",        // Permite saltar a la siguiente fila
              justifyContent: "center", 
              gap: "20px", 
              width: "100%",
              paddingBottom: "50px" 
            }}>
              {[...(categorias||[])].sort((a,b) => (a.orden??a.id) - (b.orden??b.id)).map(cat => {
                const svcs = (cat.servicioIds||[]).map(id => servicios.find(s => s.id === id)).filter(Boolean);
                const abierta = catAbierta === cat.id;

                if(esMovil) return (
                  <div key={cat.id} style={{ width: "100%", borderRadius: "16px", overflow: "hidden", border: `1px solid ${CR3}`, background: WH, marginBottom: "8px" }}>
                    <div onClick={() => setCatAbierta(abierta ? null : cat.id)} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 16px", cursor: "pointer" }}>
                      <img src={cat.foto} style={{ width: "56px", height: "56px", borderRadius: "12px", objectFit: "cover", flexShrink: 0 }} />
                      <div style={{ flex: 1, fontWeight: 800, fontSize: "15px", color: TX, textTransform: "uppercase", letterSpacing: "0.5px" }}>{cat.nombre}</div>
                      <div style={{ fontSize: "12px", color: TX2, transform: abierta ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.3s" }}>▼</div>
                    </div>
                    {abierta && (
                      <div style={{ borderTop: `1px solid ${CR2}` }}>
                        {svcs.map(s => {
                          const esSeleccionado = selServicio?.id === s.id;
                          return (
                            <div key={s.id} onClick={(e) => { e.stopPropagation(); setSelServicio(s); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${CR2}`, cursor: "pointer", background: esSeleccionado ? `${A}10` : WH }}>
                              <div style={{ textAlign: "left" }}>
                                <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                                  <span style={{ fontSize: "13px", fontWeight: 700, color: TX }}>{s.nombre}</span>
                                  <span style={{ fontSize: "11px", color: TX2 }}>⏱ {s.duracionMin}'</span>
                                </div>
                                {s.desc && <div style={{ fontSize: "11px", color: TX2, marginTop: "2px", textAlign: "left" }}>{s.desc}</div>}
                              </div>
                              <div style={{ fontWeight: 800, fontSize: "15px", color: A, flexShrink: 0, marginLeft: "10px" }}>{s.precio}€</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );

                return (
                  <div 
                    key={cat.id}
                    onClick={() => setCatAbierta(abierta ? null : cat.id)}
                    className="card-hover"
                    style={{ 
                      position: "relative", 
                      flex: `0 1 ${CONFIG_RESERVA.anchoCajaPC}`,
                      minWidth: "250px",
                      aspectRatio: "1 / 1",
                      borderRadius: "20px", 
                      overflow: "hidden", 
                      cursor: "pointer", 
                      backgroundImage: `url(${cat.foto})`, 
                      backgroundSize: "cover", 
                      backgroundPosition: "center", 
                      transform: abierta ? "scale(1.02)" : "scale(1)",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
                      transition: "all 0.4s cubic-bezier(0.25, 1, 0.5, 1)"
                    }}
                  >
                    <div style={{ 
                      position: "absolute", 
                      inset: 0, 
                      background: abierta ? "rgba(0,0,0,0.95)" : "linear-gradient(to bottom, rgba(0,0,0,0) 60%, rgba(0,0,0,0.85) 100%)", 
                      display: "flex", 
                      flexDirection: "column", 
                      justifyContent: abierta ? "center" : "flex-end", 
                      alignItems: "center", 
                      padding: abierta ? "10px" : "20px",
                      transition: "background 0.4s ease-out"
                    }}>
                      <div style={{ textAlign: "center", marginBottom: abierta ? "15px" : "5px", width: "100%" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                          <h3 style={{ color: "#FFF", margin: 0, fontSize: "18px", fontWeight: "800", textTransform: "uppercase" }}>{cat.nombre}</h3>
                          <div style={{ color: "#FFF", fontSize: "9px", transform: abierta ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.4s" }}>▼</div>
                        </div>
                      </div>
                      <div style={{ width: "100%", maxHeight: abierta ? "400px" : "0", opacity: abierta ? 1 : 0, transform: abierta ? "translateY(0)" : "translateY(10px)", overflowY: "auto", transition: catAbierta === cat.id && paso === 1 ? "none" : "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)", scrollbarWidth: "none" }}>
                        {svcs.map((s, index) => {
                          const esSeleccionado = selServicio?.id === s.id;
                          return (
                            <div key={s.id} style={{ width: "100%" }}>
                              <div onClick={(e) => { e.stopPropagation(); setSelServicio(s); }} style={{ padding: "10px 0px", margin: "2px 0px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", borderRadius: "8px", background: esSeleccionado ? "rgba(27, 79, 138, 0.5)" : "transparent", transition: "background 0.2s ease" }}>
                                <div style={{ textAlign: "left", flex: 1, paddingLeft: "10px" }}>
                                  <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                                    <span style={{ color: "#FFF", fontSize: "12px", fontWeight: "700" }}>{s.nombre}</span>
                                    <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "9px" }}>⏱ {s.duracionMin}'</span>
                                  </div>
                                  {s.desc && <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "10px", lineHeight: "1.2", marginTop: "2px" }}>{s.desc}</div>}
                                </div>
                                <div style={{ color: "#FFF", fontWeight: "800", fontSize: "13px", textAlign: "right", paddingRight: "10px" }}>{s.precio}€</div>
                              </div>
                              {index < svcs.length - 1 && <div style={{ height: "1px", background: "rgba(255,255,255,0.1)", margin: "0" }} />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {paso === 2 && (() => {
            const generarTodasLasHoras = () => {
              const horas = [];
              for (let h = 9; h <= 20; h++) {
                const horaStr = h < 10 ? `0${h}` : `${h}`;
                horas.push(`${horaStr}:00`, `${horaStr}:15`, `${horaStr}:30`, `${horaStr}:45`);
              }
              return horas;
            };
            const todasLasHoras = generarTodasLasHoras();

            const startOfMonth = new Date(mesRef.getFullYear(), mesRef.getMonth(), 1);
            const endOfMonth = new Date(mesRef.getFullYear(), mesRef.getMonth() + 1, 0);
            let startCol = startOfMonth.getDay();
            if (startCol === 0) startCol = 7;
            const diasLocal = [];
            for (let i = 1; i < startCol; i++) diasLocal.push(null);
            for (let i = 1; i <= endOfMonth.getDate(); i++) {
              diasLocal.push(new Date(mesRef.getFullYear(), mesRef.getMonth(), i));
            }
            const navegar = (n) => setMesRef(new Date(mesRef.getFullYear(), mesRef.getMonth() + n, 1));

            let textoDia = '';
            if (selDia) {
              const nombreDia = selDia.toLocaleDateString('es-ES', { weekday: 'long' });
              const diaNum = selDia.getDate();
              const mes = selDia.toLocaleDateString('es-ES', { month: 'long' });
              textoDia = `${nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1)} ${diaNum} de ${mes}`;
            }

            const sty = {
              card: { background: "#FFF", borderRadius: "16px", border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(0,0,0,0.04)", padding: "14px" },
              lbl: { fontSize: "10px", fontWeight: 800, color: "#A0AEC0", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" },
            };

            // SELECTOR DE PELUQUERO
            const pelOpciones = [{ id: CUALQUIERA_ID, nombre: "Cualquiera", foto: "https://i.postimg.cc/k44vVkYC/cualquiera.png" }, ...CONFIG.peluqueros];
            const SelectorPeluquero = () => (
              <div>
                <div style={sty.lbl}>Profesional</div>
                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
                  {pelOpciones.map((p, idx) => {
                    const sel = selPeluquero?.id === p.id;
                    return (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        {idx === 1 && (
                          <div style={{ width: "1px", height: "52px", background: "#E2E8F0", flexShrink: 0, alignSelf: "flex-start", marginTop: "3px" }} />
                        )}
                        <div onClick={() => { setSelPeluquero(p); setSelHora(null); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                          <img src={p.foto} style={{ width: "52px", height: "52px", borderRadius: "50%", objectFit: "cover", border: `3px solid ${sel ? A : "#E2E8F0"}`, transition: "border 0.2s", boxShadow: sel ? `0 0 0 3px ${A}30` : "none" }} />
                          <span style={{ fontSize: "11px", fontWeight: sel ? 800 : 600, color: sel ? A : "#64748B" }}>{p.nombre}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );

            // CALENDARIO

            // HELPER DISPONIBILIDAD POR DÍA
            const getDisponibilidadDia = (fecha) => {
              if(!selServicio) return null;
              const iso = isoDate(fecha);
              if(festivosSet.has(iso)) return null;
              if(fecha.getDay() === 0) return null;
              let count = 0;
              if(selPeluquero?.id === CUALQUIERA_ID){
                const slotsSet = new Set();
                CONFIG.peluqueros.forEach(p => {
                  if(peluqueroEstaBloqueado(p.id, iso, bloqueos)) return;
                  const tramos = getTramosDia(p.id, iso, horariosEspeciales||[], horariosGenerales||[]);
                  if(tramos.length===0) return;
                  const todos = generarSlotsTramos(tramos, selServicio.duracionMin);
                  const citasDelDia = citas.filter(c => c.fecha === iso && c.peluqueroId === p.id && c.estado !== "no-show");
                  filtrarSlotsOcupados(todos, selServicio.duracionMin, citasDelDia).forEach(h => slotsSet.add(h));
                });
                count = slotsSet.size;
              } else {
                if(peluqueroEstaBloqueado(selPeluquero.id, iso, bloqueos)) return null;
                const tramos = getTramosDia(selPeluquero.id, iso, horariosEspeciales||[]);
                if(tramos.length===0) return null;
                const todos = generarSlotsTramos(tramos, selServicio.duracionMin);
                const citasDelDia = citas.filter(c => c.fecha === iso && c.peluqueroId === selPeluquero.id && c.estado !== "no-show");
                count = filtrarSlotsOcupados(todos, selServicio.duracionMin, citasDelDia).length;
              }
              if(count === 0) return null;
              if(count >= 4) return { color: "#10B981", ancho: "55%" };
              if(count >= 2) return { color: "#F59E0B", ancho: "35%" };
              return { color: "#EF4444", ancho: "20%" };
            };

            const Calendario = () => (
              <div>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", marginBottom: "8px" }}>
                  <button onClick={() => navegar(-1)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "11px", color: "#A0AEC0", transform: "rotate(90deg)" }}>▼</button>
                  <span style={{ fontSize: "13px", fontWeight: 900, color: "#0A1F3D", textTransform: "uppercase", minWidth: "160px", textAlign: "center" }}>{mesRef.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}</span>
                  <button onClick={() => navegar(1)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "11px", color: "#A0AEC0", transform: "rotate(-90deg)" }}>▼</button>
                </div>
                <div style={sty.card}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: "6px" }}>
                    {['L','M','X','J','V','S','D'].map(d => <div key={d} style={{ textAlign: "center", fontSize: "10px", fontWeight: 900, color: "#A0AEC0" }}>{d}</div>)}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "3px" }}>
                    {diasLocal.map((d, di) => {
                      if (!d) return <div key={di} />;
                      const iso = isoDate(d);
                      const isSel = selDia?.toDateString() === d.toDateString();
                      const isHoy = iso === HOY_ISO;
                      const festivo = festivosSet.has(iso);
                      const bloq = selPeluquero ? peluqueroEstaBloqueado(selPeluquero.id, iso, bloqueos) : false;
                      const disp = d >= HOY && d.getDay() !== 0 && !festivo && !bloq;
                      return (
                        <button key={di} onClick={() => { if (disp) { setSelDia(d); setSelHora(null); } }} style={{ borderRadius: "8px", border: isSel ? "2px solid #1B4F8A" : "1px solid transparent", background: "#F7FAFC",
                          color: disp ? "#0A1F3D" : "#CBD5E0",
                          fontWeight: disp || isSel || isHoy ? 800 : 500,
                          cursor: disp ? "pointer" : "default",
                          fontSize: "12px",
                          padding: "7px 0",
                          position: "relative",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "3px",
                          border: isHoy ? "1.5px solid #1B4F8A" : "1px solid transparent",
                          outline: isSel ? "2.5px solid #1B4F8A" : "none",
                          outlineOffset: "-1px",}}>
                          {d.getDate()}
                          {(() => {
                            if(d < HOY) return null;
                            const disp2 = getDisponibilidadDia(d);
                            if(!disp2) return null;
                            return (
                              <div style={{ width: disp2.ancho, height: "2.5px", borderRadius: "2px", background: disp2.color, transition: "width 0.3s ease" }} />
                            );
                          })()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );

            // HORAS
            const Horas = () => (
              <div>
                <div style={{ ...sty.lbl, marginTop: "4px" }}>✦ Disponibilidad {selDia ? `${selDia.getDate()} ${selDia.toLocaleString('es-ES', { month: 'short' })}` : ""}</div>
                <div style={sty.card}>
                  {slots.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "20px 0", fontSize: "13px", color: "#94A3B8", fontStyle: "italic" }}>
                      No hay horas disponibles para este día
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
                      {slots.map(h => {
                        const seleccionado = selHora === h;
                        return (
                          <button key={h} onClick={() => setSelHora(h)} style={{ borderRadius: "8px", fontWeight: 700, fontSize: "13px", cursor: "pointer", border: seleccionado ? "2px solid #1B4F8A" : "1px solid #E2E8F0", background: seleccionado ? "#1B4F8A" : "#FFF", color: seleccionado ? "#FFF" : "#2D3748", width: "72px", height: "38px", transition: "all 0.15s ease", flexShrink: 0 }}>
                            {h}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );

            // RESUMEN
            const Resumen = () => (
              <div style={sty.card}>
                <div style={sty.lbl}>Resumen</div>
                {/* Fila 1: servicio | tiempo + coste */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", paddingBottom: "12px", borderBottom: "1px solid #F1F5F9" }}>
                  <span style={{ fontSize: "14px", fontWeight: 800, color: "#0A1F3D" }}>{selServicio?.nombre || "—"}</span>
                  <span style={{ fontSize: "12px", color: "#94A3B8", whiteSpace: "nowrap" }}>⏱ {selServicio?.duracionMin} min</span>
                  <span style={{ fontSize: "14px", fontWeight: 800, color: "#0A1F3D", whiteSpace: "nowrap" }}>{selServicio?.precio} €</span>
                </div>
                {/* Fila 2: profesional centrado */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "14px 4px", borderBottom: "1px solid #F1F5F9" }}>
                  {selPeluquero?.foto && <img src={selPeluquero.foto} style={{ width: "30px", height: "30px", borderRadius: "50%", objectFit: "cover" }} />}
                  <span style={{ fontSize: "15px", fontWeight: 700, color: "#0A1F3D" }}>{selPeluquero?.nombre || "—"}</span>
                </div>
                {/* Fila 3: fecha centrada */}
                <div style={{ textAlign: "center", padding: "14px 8px 0 8px" }}>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: "#0A1F3D" }}>
                    {selDia ? textoDia : "—"}{selHora ? ` · ${selHora}` : ""}
                  </span>
                </div>
              </div>
            );

            return (
              <div style={{ width: "100%", animation: "fadeIn 0.5s ease", paddingBottom: "120px" }}>
                {esMovil ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    <SelectorPeluquero />
                    <Calendario />
                    <Horas />
                    <Resumen />
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div>
                          <label style={{ ...sty.lbl, marginBottom: "5px", display: "block" }}>Nombre completo</label>
                          <input style={{ width: "100%", padding: "11px 14px", borderRadius: "12px", border: "1px solid #E2E8F0", fontSize: "14px", fontWeight: 600, color: "#0A1F3D", outline: "none", background: "#FFF", boxSizing: "border-box" }} placeholder="Escribe tu nombre" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                        </div>
                        <div>
                          <label style={{ ...sty.lbl, marginBottom: "5px", display: "block" }}>Teléfono</label>
                          <input type="tel" inputMode="numeric" pattern="[0-9]*" style={{ width: "100%", padding: "11px 14px", borderRadius: "12px", border: "1px solid #E2E8F0", fontSize: "14px", fontWeight: 600, color: "#0A1F3D", outline: "none", background: "#FFF", boxSizing: "border-box" }} placeholder="Tu número de móvil" value={form.telefono} onKeyDown={e => { if(!/[0-9]/.test(e.key) && !['Backspace','Delete','ArrowLeft','ArrowRight','Tab'].includes(e.key)) e.preventDefault(); }}
onChange={e => setForm({ ...form, telefono: e.target.value.replace(/\D/g, '') })} />
                        </div>
                      </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
                    {/* Columna izquierda */}
                    <div style={{ flex: "1.3", display: "flex", flexDirection: "column", gap: "16px" }}>
                      <Calendario />
                      <Horas />
                    </div>
                    {/* Columna derecha */}
                    <div style={{ flex: "0.9", display: "flex", flexDirection: "column", gap: "16px" }}>
                      <SelectorPeluquero />
                      <Resumen />
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div>
                          <label style={{ ...sty.lbl, marginBottom: "5px", display: "block" }}>Nombre completo</label>
                          <input style={{ width: "100%", padding: "11px 14px", borderRadius: "12px", border: "1px solid #E2E8F0", fontSize: "14px", fontWeight: 600, color: "#0A1F3D", outline: "none", background: "#FFF", boxSizing: "border-box" }} placeholder="Escribe tu nombre" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                        </div>
                        <div>
                          <label style={{ ...sty.lbl, marginBottom: "5px", display: "block" }}>Teléfono</label>
                          <input type="tel" inputMode="numeric" pattern="[0-9]*" style={{ width: "100%", padding: "11px 14px", borderRadius: "12px", border: "1px solid #E2E8F0", fontSize: "14px", fontWeight: 600, color: "#0A1F3D", outline: "none", background: "#FFF", boxSizing: "border-box" }} placeholder="Tu número de móvil" value={form.telefono} onKeyDown={e => { if(!/[0-9]/.test(e.key) && !['Backspace','Delete','ArrowLeft','ArrowRight','Tab'].includes(e.key)) e.preventDefault(); }} onChange={e => setForm({ ...form, telefono: e.target.value.replace(/\D/g, '') })} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}


          {paso === 5 && (() => {
  // --- PANEL DE CONTROL DEL PASO 5 ---
  const OK_ST = {
    anchoMax: esMovil ? "100%" : "30%",            
    alturaCaja: "auto",              
    borderRadiusMarco: "20px",
    borderRadiusBtn: "12px",
    
    // 2. COLORES
    colorPrimario: "#1B4F8A",
    colorTexto: "#0A1F3D",           
    colorSecundario: "#64748B",      
    colorFondo: "#FFF",
    colorBorde: "#E2E8F0",
    
    // 3. COLORES DEL CHECK
    colorCheck: "#059669",           
    bgCheck: "#D1FAE5",              
    bgHalo: "rgba(16, 185, 129, 0.12)", 

    // 4. DISTANCIAS (Control de posición en pantalla)
    margenSuperior: esMovil ? "0px" : "-70px",
    margenInferior: esMovil ? "0px" : "-70px",
    paddingMarco: "28px 24px",      
    shadow: "0 20px 40px rgba(0,0,0,0.08)" 
  };

  // Formateo de la fecha (Ej: "Martes 21 de abril")
  let textoDia = '';
  if (selDia) {
    const nombreDia = selDia.toLocaleDateString('es-ES', { weekday: 'long' });
    const diaNum = selDia.getDate();
    const mes = selDia.toLocaleDateString('es-ES', { month: 'long' });
    textoDia = `${nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1)} ${diaNum} de ${mes}`;
  }

  // Rescatamos el nombre completo y el teléfono
  const nombreCompleto = form.nombre ? form.nombre.trim() : '';
  const telefonoCliente = form.telefono ? form.telefono.trim() : '';

  return (
    <div style={{ 
      width: '100%', 
      maxWidth: OK_ST.anchoMax, 
      // Aquí aplicamos los márgenes personalizados arriba y abajo, y 'auto' para centrar a los lados
      margin: `${OK_ST.margenSuperior} auto ${OK_ST.margenInferior}`, 
      animation: 'fadeIn 0.6s ease', 
      padding: '0 0px'
    }}>
      
      <div style={{ 
        height: OK_ST.alturaCaja, 
        background: OK_ST.colorFondo, 
        borderRadius: OK_ST.borderRadiusMarco, 
        padding: OK_ST.paddingMarco, 
        border: `1px solid ${OK_ST.colorBorde}`, 
        boxShadow: OK_ST.shadow,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center', 
        textAlign: 'center',
        boxSizing: 'border-box' 
      }}>

        {/* --- ICONO DE ÉXITO --- */}
        <div style={{
          width: '70px',
          height: '70px',
          borderRadius: '50%',
          background: OK_ST.bgCheck,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '25px',
          boxShadow: `0 0 0 10px ${OK_ST.bgHalo}` 
        }}>
          <span style={{ fontSize: '35px', color: OK_ST.colorCheck, fontWeight: '900' }}>✓</span>
        </div>

        {/* --- TÍTULO --- */}
        <h2 style={{ 
          margin: '0 0 12px 0', 
          fontSize: '22px', 
          fontWeight: '900', 
          color: OK_ST.colorTexto, 
          letterSpacing: '-0.5px' 
        }}>
          ¡Reserva confirmada!
        </h2>

        {/* --- MENSAJE DE SALUDO --- */}
        <p style={{ 
          margin: '0 0 25px 0', 
          fontSize: '15px', 
          color: OK_ST.colorSecundario, 
          lineHeight: '1.5'
        }}>
          ¡Genial, <strong style={{ color: OK_ST.colorTexto }}>{nombreCompleto}</strong>! <br/>
          Hemos anotado tu cita en nuestra agenda.
        </p>

        {/* --- CAJA DE RECORDATORIO --- */}
        <div style={{
          background: '#F8FAFC',
          border: `1px solid ${OK_ST.colorBorde}`,
          borderRadius: '16px',
          padding: '18px 20px',
          width: '100%',
          boxSizing: 'border-box',
          marginBottom: '20px', 
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
           <div style={{ fontSize: '11px', fontWeight: '800', color: OK_ST.colorSecundario, textTransform: 'uppercase', letterSpacing: '1px' }}>
             TU CITA
           </div>
           
           {/* Día en negro (colorTexto) */}
           <div style={{ fontSize: '16px', fontWeight: '800', color: OK_ST.colorTexto, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             {textoDia}
           </div>
           
           {/* Hora en negro (colorTexto) en lugar de colorPrimario */}
           <div style={{ fontSize: '16px', fontWeight: '800', color: OK_ST.colorTexto, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             a las {selHora}
           </div>
        </div>

        {/* --- NOTIFICACIÓN WHATSAPP --- */}
        <p style={{ 
          margin: '0 0 30px 0', 
          fontSize: '13px', 
          color: OK_ST.colorSecundario, 
          lineHeight: '1.5',
          padding: '0 10px'
        }}>
          Te hemos enviado un mensaje por WhatsApp al <strong>{telefonoCliente}</strong> con los detalles de tu reserva.
        </p>

        {/* --- BOTÓN DE VOLVER --- */}
        <button 
          onClick={reset} 
          style={{
            width: '100%',
            padding: '18px',
            borderRadius: OK_ST.borderRadiusBtn,
            border: 'none',
            background: OK_ST.colorPrimario,
            color: '#FFF',
            fontSize: '13px',
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            cursor: 'pointer',
            transition: 'all 0.3s',
            boxShadow: `0 10px 20px ${OK_ST.colorPrimario}40`,
            marginTop: 'auto' 
          }}
        >
          Volver al inicio
        </button>

      </div>
    </div>
  );
})()}
        </div>
      </div>

      {/* 6. BOTÓN CONTINUAR FLOTANTE */}
      {paso >= 1 && paso <= 4 && (
        <div className="sticky-bottom">
          <button 
            className="btn-continuar-float" 
            onClick={btnAction} 
            disabled={!btnOk} 
            style={{ 
              // CAMBIO: Usamos backgroundColor (colores sólidos) para que la animación sea perfecta
              backgroundColor: !btnOk 
                ? "#E2E8F0" // Gris claro cuando está bloqueado
                : (paso === 4 
                    ? "#10B981" // Verde esmeralda sólido
                    : A),       // Azul sólido de tu marca
              
              color: !btnOk ? "#94A3B8" : WH,
              
              // Ajustamos la sombra para que coincida con el color activo
              boxShadow: !btnOk 
                ? "none" 
                : (paso === 4 
                    ? "0 8px 24px rgba(16, 185, 129, 0.4)" // Sombra verde
                    : `0 8px 24px ${A}40`),               // Sombra azul
              
              border: "none",
              
              // Forzamos que la transición de color sea fluida
              transition: "background-color 0.4s ease, box-shadow 0.4s ease, color 0.4s ease, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
            }}
          >
            {btnLabel}
          </button>
        </div>
      )}
    </div>
  );
} // FIN DE CLIENTEPAGE

// ─────────────────────────────────────────────
// ADMIN PANEL
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// MODAL UNIFICADO: NUEVA CITA / EDITAR CITA
// ─────────────────────────────────────────────
function CitaModal({ show, onClose, citas, clientes, servicios, bloqueos, festivosSet, citaInicial, onGuardada, horariosEspeciales, horariosGenerales }) {
  const esEdicion = !!citaInicial;

  const [form, setForm] = useState({
    nombre: "", telefono: "", servicioId: "", peluqueroId: "",
    fecha: "", hora: "", nota: "", estado: "pendiente"
  });
  const [clienteRec, setClienteRec] = useState(null);
  const [showCal, setShowCal] = useState(false);

  // Cada vez que se abre el modal, inicializa el form
  useEffect(() => {
    if (!show) return;
    if (esEdicion) {
      setForm({
        nombre:      citaInicial.clienteNombre || "",
        telefono:    citaInicial.clienteTel    || "",
        servicioId:  String(citaInicial.servicioId || ""),
        peluqueroId: String(citaInicial.peluqueroId || ""),
        fecha:       citaInicial.fecha         || "",
        hora:        citaInicial.hora          || "",
        nota:        citaInicial.nota          || "",
        estado:      citaInicial.estado        || "pendiente",
      });
    } else {
      setForm({ nombre:"", telefono:"", servicioId:"", peluqueroId:"", fecha:"", hora:"", nota:"", estado:"pendiente" });
      setClienteRec(null);
    }
    setShowCal(false);
  }, [show, citaInicial]);

  const buscarCliente = tel => {
    const found = clientes.find(c => c.telefono === tel.replace(/\s/g, ""));
    setClienteRec(found || null);
    if (found) setForm(f => ({ ...f, nombre: found.nombre, telefono: tel }));
  };

  const slotsManuales = useMemo(() => {
    if (!form.peluqueroId || !form.fecha || !form.servicioId) return [];
    if (festivosSet.has(form.fecha)) return [];
    if(form.peluqueroId === "cualquiera"){
      const svc = servicios.find(s => s.id === Number(form.servicioId));
      if(!svc) return [];
      const slotsSet = new Set();
      CONFIG.peluqueros.forEach(p=>{
        if(peluqueroEstaBloqueado(p.id,form.fecha,bloqueos)) return;
        const tramos = getTramosDia(p.id, form.fecha, horariosEspeciales||[]);
        if(tramos.length===0) return;
        const todos=generarSlotsTramos(tramos,svc.duracionMin);
        const citasDelDia=citas.filter(c=>c.fecha===form.fecha&&c.peluqueroId===p.id&&c.estado!=="no-show"&&(!esEdicion||c.id!==citaInicial?.id));
        filtrarSlotsOcupados(todos,svc.duracionMin,citasDelDia).forEach(h=>slotsSet.add(h));
      });
      let arr=[...slotsSet].sort();
      if(form.fecha===HOY_ISO){ const ahora=new Date(); const m=ahora.getHours()*60+ahora.getMinutes()+15; arr=arr.filter(h=>toMin(h)>m); }
      return arr;
    }
    const pel = CONFIG.peluqueros.find(p => p.id === Number(form.peluqueroId));
    if (!pel || peluqueroEstaBloqueado(pel.id, form.fecha, bloqueos)) return [];
    const tramos = getTramosDia(pel.id, form.fecha, horariosEspeciales||[], horariosGenerales||[]);
    if (tramos.length===0) return [];
    const svc = servicios.find(s => s.id === Number(form.servicioId));
    if (!svc) return [];
    const todos = generarSlotsTramos(tramos, svc.duracionMin);
    const citasDelDia = citas.filter(c =>
      c.fecha === form.fecha &&
      c.peluqueroId === pel.id &&
      c.estado !== "no-show" &&
      (!esEdicion || c.id !== citaInicial?.id)   // excluir la propia cita al editar
    );
    const disponibles = filtrarSlotsOcupados(todos, svc.duracionMin, citasDelDia);
    if (form.fecha === HOY_ISO) {
      const ahora = new Date();
      const m = ahora.getHours() * 60 + ahora.getMinutes() + 15;
      return disponibles.filter(h => toMin(h) > m);
    }
    return disponibles;
  }, [form.peluqueroId, form.fecha, form.servicioId, citas, bloqueos, festivosSet, horariosEspeciales]);

  const confirmar = async () => {
    if (!form.nombre || !form.servicioId || !form.peluqueroId || !form.fecha || !form.hora) return;
    const svc = servicios.find(s => s.id === Number(form.servicioId));
    let pel = CONFIG.peluqueros.find(p => p.id === Number(form.peluqueroId));
    if(form.peluqueroId === "cualquiera"){
      const festivosSetLocal = new Set(festivos ? festivos.map(f=>f.fecha) : []);
      pel = asignarPeluqueroAleatorio(svc.id, form.fecha, form.hora, citas, bloqueos, festivosSetLocal, servicios, horariosEspeciales, horariosGenerales);
      if(!pel) return;
    }

    if (esEdicion) {
      const datos = {
        clienteNombre: form.nombre,
        clienteTel:    form.telefono,
        servicio:      svc.nombre,
        servicioId:    svc.id,
        peluqueroId:   pel.id,
        peluquero:     pel.nombre,
        fecha:         form.fecha,
        hora:          form.hora,
        precio:        svc.precio,
        estado:        form.estado,
        nota:          form.nota,
      };
      await actualizarCita(citaInicial.id, datos);
      onGuardada({ id: citaInicial.id, ...datos });
    } else {
      await crearCita({
        clienteNombre: form.nombre, clienteTel: form.telefono,
        servicio: svc.nombre, servicioId: svc.id,
        peluqueroId: pel.id, peluquero: pel.nombre,
        fecha: form.fecha, hora: form.hora,
        precio: svc.precio, estado: "pendiente", nota: form.nota,
      });
      if (form.telefono) {
        const docId = form.telefono.replace(/\D/g, '');
        const ref = doc(db, "clientes", docId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          const q = query(collection(db,"clientes"), where("telefono","==",docId));
          const viejas = await getDocs(q);
          if(!viejas.empty){
            const viejaData = viejas.docs[0].data();
            await setDoc(ref, {...viejaData, telefono: docId, nombre: form.nombre});
            await deleteDoc(doc(db,"clientes", viejas.docs[0].id));
          } else {
            await setDoc(ref, { nombre: form.nombre, telefono: docId, visitas: 0, gasto: 0, ultimaVisita: "", nota: "", historial: [] });
          }
        } else {
          await updateDoc(ref, { nombre: form.nombre });
        }
      }
      onGuardada(null);
    }
  };

  if (!show) return null;

  const inputS = { width:"100%", background:"#F0F4F9", border:"1px solid #CED9E8", borderRadius:9, padding:"7px 11px", fontSize:13, color:"#0D1F35", outline:"none", boxSizing:"border-box", fontFamily:"inherit" };
  const selS   = { ...inputS };
  const lblS   = { fontSize:11, color:"#4A6080", textTransform:"uppercase", letterSpacing:1, marginBottom:5, fontWeight:700, display:"block" };

  const formValido = !!(form.nombre && form.servicioId && form.peluqueroId && form.fecha && form.hora);

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:10000,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"140px 16px 16px"}}>
      <div style={{background:"#F8FBFF",borderRadius:18,padding:"16px",width:"100%",maxWidth:440,maxHeight:"calc(100vh - 160px)",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>

        {/* Cabecera */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h3 style={{fontSize:15,fontWeight:700,color:"#0D1F35",margin:0}}>
            {esEdicion ? "✏️ Editar cita" : "➕ Nueva cita"}
          </h3>
          <button style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#4A6080"}} onClick={onClose}>✕</button>
        </div>

        {/* Fila 1: Teléfono + Nombre */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
          <div>
            <label style={lblS}>Teléfono</label>
            <input style={inputS} value={form.telefono}
              onChange={e=>{ setForm(f=>({...f,telefono:e.target.value})); if(!esEdicion) buscarCliente(e.target.value); }}
              placeholder="666 111 222"/>
          </div>
          <div>
            <label style={lblS}>Nombre</label>
            <input style={inputS} value={form.nombre}
              onChange={e=>setForm(f=>({...f,nombre:e.target.value}))}
              placeholder="Nombre cliente"/>
          </div>
        </div>

        {/* Cliente encontrado */}
        {!esEdicion && clienteRec && (
          <div style={{background:"#D1FAE5",border:"1px solid #6EE7B7",borderRadius:8,padding:"6px 10px",marginBottom:10,fontSize:11,color:"#065F46"}}>
            ✓ Cliente existente: {clienteRec.nombre} · {clienteRec.visitas} visitas · {clienteRec.gasto}€
          </div>
        )}

        {/* Fila 2: Servicio + Peluquero */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:7}}>
          <div>
            <label style={lblS}>Servicio</label>
            <select style={selS} value={form.servicioId}
              onChange={e=>{
                const nuevoSvcId = e.target.value;
                const nuevoSvc = servicios.find(s=>s.id===Number(nuevoSvcId));
                setForm(f=>{
                  if(!f.hora || !nuevoSvc) return {...f, servicioId:nuevoSvcId, hora:""};
                  // Comprobar si la hora actual cabe con el nuevo servicio
                  const pel = CONFIG.peluqueros.find(p=>p.id===Number(f.peluqueroId));
                  if(!pel) return {...f, servicioId:nuevoSvcId, hora:""};
                  const fecha = new Date(f.fecha+"T12:00:00");
                  const hp = pel.horario[fecha.getDay()];
                  if(!hp) return {...f, servicioId:nuevoSvcId, hora:""};
                  const finSlot = toMin(f.hora) + nuevoSvc.duracionMin;
                  const finJornada = toMin(hp.salida);
                  const cabeEnJornada = finSlot <= finJornada;
                  // Comprobar que no choca con otras citas
                  const citasDelDia = citas.filter(c=>c.fecha===f.fecha&&c.peluqueroId===pel.id&&c.estado!=="no-show"&&(!esEdicion||c.id!==citaInicial?.id));
                  const noCruce = !citasDelDia.some(c=>{
                    const cI=toMin(c.hora), cF=cI+(servicios.find(s=>s.id===c.servicioId)||{duracionMin:30}).duracionMin;
                    const sI=toMin(f.hora), sF=sI+nuevoSvc.duracionMin;
                    return sI<cF&&sF>cI;
                  });
                  return {...f, servicioId:nuevoSvcId, hora: cabeEnJornada&&noCruce ? f.hora : ""};
                });
              }}>
              <option value="">Elige servicio</option>
              {servicios.map(s=><option key={s.id} value={s.id}>{s.nombre} — €{s.precio}</option>)}
            </select>
          </div>
          <div>
            <label style={lblS}>Peluquero</label>
            <select style={selS} value={form.peluqueroId}
              onChange={e=>setForm(f=>({...f,peluqueroId:e.target.value,hora:"",fecha:""}))}>
              <option value="">Elige peluquero</option>
              <option value="cualquiera">🎲 Cualquiera (aleatorio)</option>
              {CONFIG.peluqueros.map(p=><option key={p.id} value={p.id}>{p.emoji} {p.nombre}</option>)}
            </select>
          </div>
        </div>

        {/* Fila 3: Fecha */}
        <div style={{marginBottom:7}}>
          <label style={lblS}>Fecha</label>
          <div style={{position:"relative"}}>
            <button style={{...inputS,textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}
              onClick={()=>setShowCal(v=>!v)}>
              <span style={{color:form.fecha?"#0D1F35":"#4A6080"}}>{form.fecha||"Seleccionar fecha..."}</span>
              <span>📅</span>
            </button>
            {showCal && (
              <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:200}}>
                <MiniCalPicker
                  value={form.fecha}
                  onChange={iso=>{ setForm(f=>({...f,fecha:iso,hora:""})); setShowCal(false); }}
                  festivosSet={festivosSet}
                  bloqueosPelId={form.peluqueroId ? Number(form.peluqueroId) : null}
                  bloqueos={bloqueos}/>
              </div>
            )}
          </div>
        </div>

        {/* Fila 4: Hora */}
        <div style={{marginBottom:7}}>
          <label style={lblS}>Hora</label>
          <select style={selS} value={form.hora}
            onChange={e=>setForm(f=>({...f,hora:e.target.value}))}
            disabled={!slotsManuales.length && !esEdicion}>
            <option value="">
              {(!form.servicioId || !form.peluqueroId || !form.fecha)
                ? "Elige servicio, peluquero y fecha"
                : slotsManuales.length === 0
                  ? "Sin huecos disponibles"
                  : "Elige hora"}
            </option>
            {/* En edición, añadimos la hora actual si no está en los slots */}
            {esEdicion && form.hora && !slotsManuales.includes(form.hora) && (
              <option value={form.hora}>{form.hora} (hora actual)</option>
            )}
            {slotsManuales.map(h=><option key={h} value={h}>{h}</option>)}
          </select>
        </div>

        {/* Fila 6: Nota */}
        <div style={{marginBottom:16}}>
          <label style={lblS}>Nota (opcional)</label>
          <input style={inputS} value={form.nota}
            onChange={e=>setForm(f=>({...f,nota:e.target.value}))}
            placeholder="Observaciones..."/>
        </div>

        {/* Botones */}
        <div style={{display:"flex",gap:10}}>
          <button
            style={{background:"#E0E8F2",color:"#4A6080",border:"1px solid #CED9E8",borderRadius:11,padding:"9px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}}
            onClick={onClose}>
            Cancelar
          </button>
          <button
            style={{flex:1,background:formValido?"linear-gradient(135deg,#1B4F8A,#133A6A)":"#E0E8F2",color:formValido?"#F8FBFF":"#4A6080",border:"none",borderRadius:11,padding:"9px 16px",fontSize:13,fontWeight:700,cursor:formValido?"pointer":"not-allowed"}}
            onClick={formValido ? confirmar : undefined}>
            {esEdicion ? "Guardar cambios" : "Confirmar cita →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminPage({valoraciones,setValoraciones,festivos,setFestivos,bloqueos,setBloqueos,servicios,setServicios,categorias,setCategorias,horariosEspeciales,setHorariosEspeciales,horariosGenerales,setHorariosGenerales}){
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  const navigate=useNavigate();
  const [searchParams,setSearchParams]=useSearchParams();
  const tab=searchParams.get("tab")||"citas";
  const setTab=t=>{ setSearchParams({tab:t}); requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:0}))); };
  useEffect(()=>{ const tm=setTimeout(()=>window.scrollTo({top:0}),80); return ()=>clearTimeout(tm); },[tab]);
  useEffect(()=>{ window.scrollTo({top:0,behavior:"auto"}); },[tab]);

  // ★ subTab para Config elevado aquí para no perder el subtab al guardar
  const [configSubTab,setConfigSubTab]=useState("servicios");

  const handleLogout=()=>{ sessionStorage.removeItem("authRole"); navigate("/"); };

  const [toastVisible,setToastVisible]=useState(false);
  const [toastTimer,setToastTimer]=useState(null);
  const [toastValVisible, setToastValVisible] = useState(false);
  const [toastValTimer, setToastValTimer] = useState(null);
  const [toastSvcVisible, setToastSvcVisible] = useState(false);
  const [toastSvcTimer, setToastSvcTimer] = useState(null);
  const [toastCatVisible, setToastCatVisible] = useState(false);
  const [toastCatTimer, setToastCatTimer] = useState(null);
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

  useEffect(()=>{ window.history.scrollRestoration='manual'; },[]);
  useEffect(()=>{ const u1=suscribirCitas(setCitas); const u2=suscribirClientes(setClientes); return()=>{u1();u2();}; },[]);

  const cambiarEstado=useCallback(async(id,estado,estadoAnterior="pendiente")=>{
    const tw=document.querySelector('.admin-table-wrap');
    const sl=tw?tw.scrollLeft:0;
    const focoActivo=document.activeElement;
    setCitas(prev=>prev.map(c=>c.id===id?{...c,estado}:c));
    requestAnimationFrame(()=>{
      const tw2=document.querySelector('.admin-table-wrap');
      if(tw2)tw2.scrollLeft=sl;
      if(focoActivo&&focoActivo.focus)focoActivo.focus();
    });
    try{
      await actualizarCita(id,{estado});
      const citaSnap=await getDoc(doc(db,"citas",id));
      if(!citaSnap.exists()) return;
      const cita=citaSnap.data();
      if(!cita.clienteTel) return;
      console.log("Buscando cliente:", cita.clienteNombre, cita.clienteTel);
      const nuevoDocId = cita.clienteTel.replace(/\D/g,'');
      let clienteRef = doc(db,"clientes",nuevoDocId);
      let clienteSnap = await getDoc(clienteRef);
      if(!clienteSnap.exists()){
        const q=query(collection(db,"clientes"),where("telefono","==",nuevoDocId));
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
      margin: 0,
      overflow: "visible"
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
    const localBusqRef=useRef(busqCitaRef?.current || "");
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
    const [menuPos,setMenuPos]=useState({top:0,right:0});
    useEffect(()=>{
      if(!menuAbierto) return;
      const h=()=>setMenuAbierto(null);
      const t=setTimeout(()=>document.addEventListener('click',h,{once:true}),150);
      return ()=>{clearTimeout(t);document.removeEventListener('click',h);};
    },[menuAbierto]);
    const [citaEditando,setCitaEditando]=useState(null);
    const [citaBorrar,setCitaBorrar]=useState(null);
    const [showEditCalPicker,setShowEditCalPicker]=useState(false);
    
    const weekDays=getWeekDays(weekOffsetCitas);
    const filtWeekDays=getWeekDays(filtSemanaOffset);

    const FOTO_DEFAULT = "https://i.postimg.cc/WbKz7QyQ/avatar-default.png";

    // ★ AQUÍ PONDRÁS LOS LINKS DE TUS PROPIOS ICONOS O FOTOS
    const LINK_EFECTIVO = "https://cdn-icons-png.flaticon.com/512/2489/2489756.png"; 
    const LINK_TARJETA  = "https://cdn-icons-png.flaticon.com/512/1086/1086741.png";
    const LINK_BIZUM    = "https://cdn-icons-png.flaticon.com/512/11559/11559814.png";

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
      await crearCita({clienteNombre:manForm.nombre,clienteTel:manForm.telefono,servicio:svc.nombre,servicioId:svc.id,peluqueroId:pel.id,peluquero:pel.nombre,fecha:manForm.fecha,hora:manForm.hora,precio:svc.precio,estado:"pendiente",nota:manForm.nota});
      if(manForm.telefono){
        const docId = manForm.telefono.replace(/\D/g, '');
        const ref = doc(db,"clientes",docId);
        const snap = await getDoc(ref);
        if(!snap.exists()){
          await setDoc(ref,{nombre:manForm.nombre,telefono:docId,visitas:0,gasto:0,ultimaVisita:"",nota:"",historial:[]});
        } else {
          await updateDoc(ref,{nombre:manForm.nombre});
        }
      }
      setShowManual(false); setManForm({nombre:"",telefono:"",servicioId:"",peluqueroId:"",fecha:"",hora:"",nota:""});
    };

    const mostrarToast=cita=>{ _citaEliminadaTemp=cita; setToastVisible(true); if(toastTimer)clearTimeout(toastTimer); const t=setTimeout(()=>{setToastVisible(false);_citaEliminadaTemp=null;},6000); setToastTimer(t); };
    const confirmarBorrado=async()=>{ 
      const cita={...citaBorrar}; 
      await borrarCita(cita.id); 
      setCitaBorrar(null); 
      mostrarToast(cita); 
    };

    // Actualizar Método de Pago con un clic (Permite pasar null para deseleccionar)
    const cambiarMetodoPago = async (id, metodo) => {
      const tw=document.querySelector('.admin-table-wrap');
      const sl=tw?tw.scrollLeft:0;
      const focoActivo=document.activeElement;
      setCitas(prev => prev.map(c => c.id === id ? { ...c, metodoPago: metodo } : c));
      requestAnimationFrame(()=>{
        const tw2=document.querySelector('.admin-table-wrap');
        if(tw2)tw2.scrollLeft=sl;
        if(focoActivo&&focoActivo.focus)focoActivo.focus();
      });
      try {
        await actualizarCita(id, { metodoPago: metodo });
      } catch (error) {
        console.error("Error al guardar método de pago", error);
      }
    };

    // --- SUBCOMPONENTES DE CELDAS PREMIUM ---
    const EstadoPremium=({estado})=>{
      const config = {
        "pendiente":  { bg: "#FEF3C7", tx: "#D97706", lbl: "Pendiente" },
        "completada": { bg: "#D1FAE5", tx: "#059669", lbl: "Completada" },
        "no-show":    { bg: "#FEE2E2", tx: "#DC2626", lbl: "No show" }
      };
      const st = config[estado] || config["pendiente"];
      return <span style={{background:st.bg, color:st.tx, padding:"6px 12px", borderRadius:"20px", fontSize:"10px", fontWeight:800}}>{st.lbl}</span>;
    };

    // ★ SELECTOR DE PAGO: Permite deseleccionar y mantiene las fotos opacas si está completado
    const SelectorPago = ({ cita }) => {
      const p = cita.metodoPago;
      const esCompletada = cita.estado === "completada";

      const st = (activo, colorBg, colorBorder) => ({
        width: "28px",        
        height: "28px",       
        padding: 0,           
        borderRadius: "6px",
        border: `1px solid ${activo && esCompletada ? colorBorder : "#E2E8F0"}`,
        background: activo && esCompletada ? colorBg : "#F8FAFC",
        cursor: esCompletada ? "pointer" : "not-allowed", 
        opacity: esCompletada ? 1 : 0.4, // ★ Todo el botón opaco si la cita está completada
        transition: "all 0.2s ease",
        display: "flex",      
        alignItems: "center", 
        justifyContent: "center", 
        boxSizing: "border-box"
      });

      const handleSelect = (metodo) => {
        if (esCompletada) {
          // ★ Si ya estaba seleccionado ese método, pasamos null para desmarcarlo
          cambiarMetodoPago(cita.id, p === metodo ? null : metodo);
        }
      };

      return (
        <div style={{display:"flex", gap:"6px", justifyContent:"center"}}>
          <button 
            title={esCompletada ? "Pago en Efectivo" : "Confirma primero la cita"} 
            style={st(p==='efectivo', '#DEF7EC', '#059669')} 
            onClick={()=>handleSelect('efectivo')}
            disabled={!esCompletada} 
          >
            <img src={LINK_EFECTIVO} alt="Efectivo" style={{width:"16px", height:"16px", objectFit:"contain", opacity: esCompletada ? 1 : 0.3}} />
          </button>
          
          <button 
            title={esCompletada ? "Pago con Tarjeta" : "Confirma primero la cita"}  
            style={st(p==='tarjeta', '#E1EFFE', '#1E429F')} 
            onClick={()=>handleSelect('tarjeta')}
            disabled={!esCompletada}
          >
            <img src={LINK_TARJETA} alt="Tarjeta" style={{width:"16px", height:"16px", objectFit:"contain", opacity: esCompletada ? 1 : 0.3}} />
          </button>

          <button 
            title={esCompletada ? "Pago por Bizum" : "Confirma primero la cita"}    
            style={st(p==='bizum', '#FCE8F3', '#99154B')} 
            onClick={()=>handleSelect('bizum')}
            disabled={!esCompletada}
          >
            <img src={LINK_BIZUM} alt="Bizum" style={{width:"16px", height:"16px", objectFit:"contain", opacity: esCompletada ? 1 : 0.3}} />
          </button>
        </div>
      );
    };

    const AccionesCitaPremium=({c})=>(
      <td style={{padding:"8px 10px", verticalAlign:"middle"}}>
        <div style={{display:"flex", alignItems:"center", justifyContent:"center", gap:"4px", flexWrap:"nowrap"}}>
          {c.estado==="pendiente"&&<>
            <button type="button" title="Confirmar" style={{width:"28px", height:"28px", borderRadius:"8px", background:"#D1FAE5", color:"#059669", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px", fontWeight:"900"}} onClick={e=>{e.preventDefault();e.stopPropagation();cambiarEstado(c.id,"completada");}}>✓</button>
            <button type="button" title="No Show" style={{width:"28px", height:"28px", borderRadius:"8px", background:"#FEE2E2", color:"#DC2626", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"13px", fontWeight:"900"}} onClick={e=>{e.preventDefault();e.stopPropagation();cambiarEstado(c.id,"no-show");}}>✕</button>
          </>}
          {c.estado!=="pendiente"&&<button type="button" title="Revertir" style={{width:"28px", height:"28px", borderRadius:"8px", background:"#F1F5F9", color:"#64748B", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"15px"}} onClick={e=>{e.preventDefault();e.stopPropagation();cambiarEstado(c.id,"pendiente",c.estado);}}>↩</button>}
          <button type="button" title="Editar" style={{width:"28px", height:"28px", borderRadius:"8px", background:"#E0E7FF", color:"#4F46E5", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"13px"}} onClick={e=>{e.preventDefault();e.stopPropagation();setCitaEditando({...c});}}>✏️</button>
          <button type="button" title="Eliminar" style={{width:"28px", height:"28px", borderRadius:"8px", background:"#FEE2E2", color:"#DC2626", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"13px"}} onClick={e=>{e.preventDefault();e.stopPropagation();setCitaBorrar({...c});}}>🗑</button>
        </div>
      </td>
    );

    return(
      <div>
        <style>{`
          .fila-premium { transition: background-color 0.2s ease; border-bottom: 1px solid #F1F5F9; }
          .fila-premium:hover { background-color: #F8FAFC; }
          .tabla-premium { width: 100%; border-collapse: collapse; }
          .th-premium { padding: 5px 10px; color: #64748B; font-size: 10px; font-weight: 800; text-transform: uppercase; border-bottom: 2px solid #F1F5F9; text-align: center; }
          .td-premium { padding: 5px 10px; vertical-align: middle; text-align: center; }
        `}</style>

        {/* 1. KPIs VISIBLES SIEMPRE */}
        <div className="admin-kpi-grid" style={as.kpiGrid}>
          {[[ingrHoy + " €","Ingresos hoy"],[citasHoy.length,"Citas hoy"],[pendHoy,"Pendientes"],[noShowHoy,"No shows"]].map(([v,l],i)=>(
            <div key={i} style={as.kpi}><div style={as.kpiVal}>{v}</div><div style={as.kpiLbl}>{l}</div></div>
          ))}
        </div>

        {/* 2. PESTAÑAS PRINCIPALES DE VISTA */}
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
          {[["hoy","📋 Tabla"],["peluquero","📅 Calendario"]].map(([v,l])=>(
            <button key={v} style={{background:vistaCitas===v?A:WH,color:vistaCitas===v?WH:TX,border:`2px solid ${vistaCitas===v?A:CR3}`,borderRadius:50,padding:"7px 20px",fontSize:12,fontWeight:700,cursor:"pointer",transition:"all 0.2s ease"}} onClick={()=>{
              setVistaCitas(v);
            }}>{l}</button>
          ))}
          <button style={{marginLeft:"auto",background:`linear-gradient(135deg,${A},#133A6A)`,color:WH,border:"none",borderRadius:8,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={()=>setShowManual(true)}>+ Nueva cita</button>
        </div>

        {/* Modal unificado: nueva cita */}
        <CitaModal
          show={showManual}
          onClose={()=>setShowManual(false)}
          citas={citas}
          clientes={clientes}
          servicios={servicios}
          bloqueos={bloqueos}
          festivosSet={festivosSet}
          citaInicial={null}
          onGuardada={()=>setShowManual(false)}
          hhorariosEspeciales={horariosEspeciales}
          horariosGenerales={horariosGenerales}
        />

        {/* Modal unificado: editar cita */}
        <CitaModal
          show={!!citaEditando}
          onClose={()=>setCitaEditando(null)}
          citas={citas}
          clientes={clientes}
          servicios={servicios}
          bloqueos={bloqueos}
          festivosSet={festivosSet}
          citaInicial={citaEditando}
          onGuardada={(datosActualizados)=>{
            if(datosActualizados){
              setCitas(prev=>prev.map(c=>c.id===datosActualizados.id?datosActualizados:c));
            }
            setCitaEditando(null);
          }}
          horariosEspeciales={horariosEspeciales}
          horariosGenerales={horariosGenerales}
        />

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

        {/* --- VISTA: TABLA --- */}
        {vistaCitas==="hoy"&&(
          <div style={{ background: WH, borderRadius: "24px", boxShadow: "0 4px 20px rgba(0,0,0,0.04)", padding: "20px 24px", width: "100%", boxSizing: "border-box" }}>
            <div style={{background:CR,border:`1px solid ${hayFiltros?A:CR3}`,borderRadius:10,padding:"10px 12px",marginBottom:14}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:mostrarBuscador||hayFiltros?10:0}}>
                <input
                  style={{flex:1,marginBottom:0,padding:"7px 12px",fontSize:12,width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,color:TX,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}
                  defaultValue={busqCitaRef?.current || ""}
                  onChange={e=>{busqCitaRef.current=e.target.value;localBusqRef.current=e.target.value;forceUpdate(n=>n+1);}}
                  placeholder="🔍 Buscar por nombre o teléfono..."
                />
                <button style={{background:mostrarBuscador?`${A}15`:WH,border:`1px solid ${mostrarBuscador?A:CR3}`,borderRadius:8,padding:"7px 12px",fontSize:11,fontWeight:700,cursor:"pointer",color:mostrarBuscador?A:TX2,whiteSpace:"nowrap"}} onClick={()=>setMostrarBuscador(v=>!v)}>
                  {mostrarBuscador?"▲ Ocultar Filtros":"▼ Ver Filtros"}{hayFiltros?" ●":""}
                </button>
                {hayFiltros&&<button style={{background:ER+"15",border:`1px solid ${ER}33`,borderRadius:8,padding:"7px 10px",fontSize:11,fontWeight:700,cursor:"pointer",color:ER}} onClick={()=>{busqCitaRef.current="";localBusqRef.current="";forceUpdate(n=>n+1);setFiltFecha("hoy");setFiltDesde("");setFiltHasta("");setFiltPel("todas");setFiltEstado("todos");setMostrarBuscador(false);}}>✕</button>}
              </div>

              {mostrarBuscador&&(
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",gap:10,alignItems:"end",width:"100%", marginTop: "10px"}}>
                  <div>
                    <Lbl>Filtrar por Fecha</Lbl>
                    <Sel style={{padding:"6px 9px",fontSize:11}} value={filtFecha} onChange={e=>{setFiltFecha(e.target.value);setFiltSemanaOffset(0);}}>
                      <option value="hoy">Hoy</option>
                      <option value="semana">Esta semana</option>
                      <option value="fecha">Fecha concreta</option>
                      <option value="rango">Rango de fechas</option>
                      <option value="todas">Todas las citas</option>
                    </Sel>
                  </div>

                  {filtFecha==="semana"&&(
                    <div style={{display:"flex",alignItems:"center",gap:4, height: "28px"}}>
                      <button style={{background:WH,border:`1px solid ${CR3}`,borderRadius:6,padding:"0 8px",fontSize:11,height:"100%",cursor:"pointer"}} onClick={()=>setFiltSemanaOffset(o=>o-1)}>←</button>
                      <span style={{fontSize:10,fontWeight:700,color:TX,flex:1,textAlign:"center",whiteSpace:"nowrap"}}>{filtWeekDays[0].getDate()} {MESES_ES[filtWeekDays[0].getMonth()]} - {filtWeekDays[5].getDate()} {MESES_ES[filtWeekDays[5].getMonth()]}</span>
                      {filtSemanaOffset!==0&&<button style={{background:CR2,border:`1px solid ${CR3}`,borderRadius:6,padding:"0 6px",fontSize:10,height:"100%",cursor:"pointer"}} onClick={()=>setFiltSemanaOffset(0)}>Hoy</button>}
                      <button style={{background:WH,border:`1px solid ${CR3}`,borderRadius:6,padding:"0 8px",fontSize:11,height:"100%",cursor:"pointer"}} onClick={()=>setFiltSemanaOffset(o=>o+1)}>→</button>
                    </div>
                  )}

                  {filtFecha==="fecha"&&(
                    <div style={{position:"relative"}}>
                      <Lbl>Selecciona el día</Lbl>
                      <button style={{width:"100%",background:WH,border:`1px solid ${CR3}`,borderRadius:9,padding:"6px 9px",fontSize:11,color:filtDesde?TX:TX2,textAlign:"left",cursor:"pointer",display:"flex",justifyContent:"space-between"}} onClick={()=>setShowFiltDesdeCalPicker(v=>!v)}>
                        <span>{filtDesde||"Seleccionar..."}</span><span>📅</span>
                      </button>
                      {showFiltDesdeCalPicker&&<div style={{position:"absolute",top:"100%",left:0,zIndex:200}}><MiniCalPicker value={filtDesde} onChange={iso=>{setFiltDesde(iso);setShowFiltDesdeCalPicker(false);}} festivosSet={festivosSet} bloqueosPelId={null} bloqueos={[]}/></div>}
                    </div>
                  )}

                  {filtFecha==="rango"&&(
                    <>
                      <div style={{position:"relative"}}>
                        <Lbl>Desde el día</Lbl>
                        <button style={{width:"100%",background:WH,border:`1px solid ${CR3}`,borderRadius:9,padding:"6px 9px",fontSize:11,color:filtDesde?TX:TX2,textAlign:"left",cursor:"pointer",display:"flex",justifyContent:"space-between"}} onClick={()=>setShowFiltDesdeCalPicker(v=>!v)}>
                          <span>{filtDesde||"Inicio..."}</span><span>📅</span>
                        </button>
                        {showFiltDesdeCalPicker&&<div style={{position:"absolute",top:"100%",left:0,zIndex:200}}><MiniCalPicker value={filtDesde} onChange={iso=>{setFiltDesde(iso);setShowFiltDesdeCalPicker(false);}} festivosSet={festivosSet} bloqueosPelId={null} bloqueos={[]}/></div>}
                      </div>
                      <div style={{position:"relative"}}>
                        <Lbl>Hasta el día</Lbl>
                        <button style={{width:"100%",background:WH,border:`1px solid ${CR3}`,borderRadius:9,padding:"6px 9px",fontSize:11,color:filtHasta?TX:TX2,textAlign:"left",cursor:"pointer",display:"flex",justifyContent:"space-between"}} onClick={()=>setShowFiltHastaCalPicker(v=>!v)}>
                          <span>{filtHasta||"Fin..."}</span><span>📅</span>
                        </button>
                        {showFiltHastaCalPicker&&<div style={{position:"absolute",top:"100%",left:0,zIndex:200}}><MiniCalPicker value={filtHasta} onChange={iso=>{setFiltHasta(iso);setShowFiltHastaCalPicker(false);}} festivosSet={festivosSet} bloqueosPelId={null} bloqueos={[]}/></div>}
                      </div>
                    </>
                  )}

                  <div><Lbl>Peluquero</Lbl><Sel style={{padding:"6px 9px",fontSize:11}} value={filtPel} onChange={e=>setFiltPel(e.target.value)}><option value="todas">Todos</option>{CONFIG.peluqueros.map(p=><option key={p.id} value={p.id}>{p.emoji} {p.nombre}</option>)}</Sel></div>
                  <div><Lbl>Estado</Lbl><Sel style={{padding:"6px 9px",fontSize:11}} value={filtEstado} onChange={e=>setFiltEstado(e.target.value)}><option value="todos">Todos</option><option value="pendiente">Pendiente</option><option value="completada">Completada</option><option value="no-show">No show</option></Sel></div>
                </div>
              )}
            </div>

            {hayFiltros?(
              <>
                <div style={{fontSize:11,fontWeight:700,color:A,marginBottom:10}}>{citasFiltradas.length} resultado{citasFiltradas.length!==1?"s":""}</div>
                {citasFiltradas.length===0?<div style={{fontSize:13,color:TX2,fontStyle:"italic"}}>No se encontraron citas</div>:(
                  <div className="admin-table-wrap" style={{overflowX:"auto"}}>
                    <table className="tabla-premium">
                      <thead>
                        <tr>
                          <th className="th-premium">Fecha</th>
                          <th className="th-premium">Hora</th>
                          <th className="th-premium">Cliente</th>
                          <th className="th-premium">Servicio</th>
                          <th className="th-premium">Profesional</th>
                          <th className="th-premium" style={{textAlign:"center", fontSize:"10px"}}>Precio</th>
                          <th className="th-premium">Estado</th>
                          <th className="th-premium">Pago</th>
                          <th className="th-premium">Acc.</th>
                        </tr>
                      </thead>
                      <tbody>{citasFiltradas.map(c=>(
                        <tr key={c.id} className="fila-premium">
                          <td className="td-premium" style={{fontSize:"10px",color:TX2}}>{c.fecha===HOY_ISO?"Hoy":fmtFechaES(c.fecha)}</td>
                          <td className="td-premium" style={{fontWeight:700,color:A, fontSize:"12px"}}>{c.hora}</td>
                          <td className="td-premium">
                            <div style={{fontWeight:600, fontSize:"12px"}}>{c.clienteNombre}</div>
                            <div style={{fontSize:"9px",color:TX2}}>{c.clienteTel}</div>
                          </td>
                          <td className="td-premium" style={{color:"#475569", fontSize:"12px"}}>{c.servicio}</td>
                          <td className="td-premium">
                            <div style={{display:"flex", alignItems:"center", justifyContent:"center", gap:"6px"}}>
                              <img src={CONFIG.peluqueros.find(p=>p.id===c.peluqueroId)?.foto || FOTO_DEFAULT} alt={c.peluquero} style={{width:"24px", height:"24px", borderRadius:"50%", objectFit:"cover"}} />
                              <span style={{fontSize:"12px", fontWeight:600, color:"#0A1F3D"}}>{c.peluquero}</span>
                            </div>
                          </td>
                          <td className="td-premium" style={{fontWeight:700, textAlign:"center", fontSize:"12px"}}>{c.precio}€</td>
                          <td className="td-premium"><EstadoPremium estado={c.estado}/></td>
                          <td className="td-premium"><SelectorPago cita={c} /></td>
                          <AccionesCitaPremium c={c}/>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </>
            ):(
              <>
                <div style={{fontSize:11,fontWeight:700,color:TX2,textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>Citas de hoy — {fmtLarga(HOY)}</div>
                {citasHoy.length===0?<div style={{fontSize:13,color:TX2,fontStyle:"italic"}}>No hay citas para hoy</div>:(
                  <div className="admin-table-wrap" style={{overflowX:"auto"}}>
                    <table className="tabla-premium">
                      <thead>
                        <tr>
                          <th className="th-premium">Hora</th>
                          <th className="th-premium">Cliente</th>
                          <th className="th-premium">Servicio</th>
                          <th className="th-premium">Profesional</th>
                          <th className="th-premium" style={{textAlign:"center", fontSize:"10px"}}>Precio</th>
                          <th className="th-premium">Estado</th>
                          <th className="th-premium">Pago</th>
                          <th className="th-premium">Nota</th>
                          <th className="th-premium">Acc.</th>
                        </tr>
                      </thead>
                      <tbody>{citasHoy.map(c=>(
                        <tr key={c.id} className="fila-premium">
                          <td className="td-premium" style={{fontWeight:700,color:A, fontSize:"12px"}}>{c.hora}</td>
                          <td className="td-premium">
                            <div style={{fontWeight:600, fontSize:"13px"}}>{c.clienteNombre}</div>
                            <div style={{fontSize:"9px",color:TX2}}>{c.clienteTel}</div>
                          </td>
                          <td className="td-premium" style={{color:"#475569", fontSize:"12px"}}>{c.servicio}</td>
                          <td className="td-premium">
                            <div style={{display:"flex", alignItems:"center", justifyContent:"center", gap:"6px"}}>
                              <img src={CONFIG.peluqueros.find(p=>p.id===c.peluqueroId)?.foto || FOTO_DEFAULT} alt={c.peluquero} style={{width:"24px", height:"24px", borderRadius:"50%", objectFit:"cover"}} />
                              <span style={{fontSize:"12px", fontWeight:600, color:"#0A1F3D"}}>{c.peluquero}</span>
                            </div>
                          </td>
                          <td className="td-premium" style={{fontWeight:700, textAlign:"center", fontSize:"12px"}}>{c.precio}€</td>
                          <td className="td-premium"><EstadoPremium estado={c.estado}/></td>
                          <td className="td-premium"><SelectorPago cita={c} /></td>
                          <td className="td-premium">
                            {editNota===c.id?(
                              <div style={{display:"flex", justifyContent:"center", gap:4}}>
                                <Inp style={{padding:"4px 8px",fontSize:"10px", width:"80px"}} value={notaVal} onChange={e=>setNotaVal(e.target.value)}/>
                                <button style={{background:"#10B981",color:"white",border:"none",borderRadius:6,padding:"4px 8px"}} onClick={()=>guardarNota(c.id)}>✓</button>
                              </div>
                            ):(<span style={{fontSize:"10px",color:c.nota?TX:TX2,cursor:"pointer",fontStyle:c.nota?"normal":"italic"}} onClick={()=>{setEditNota(c.id);setNotaVal(c.nota||"");}}>{ c.nota||"+ nota"}</span>)}
                          </td>
                          <AccionesCitaPremium c={c}/>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* --- VISTA: CALENDARIO SEMANAL --- */}
        {vistaCitas==="semana"&&(
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <div style={{ background: WH, borderRadius: "24px", boxShadow: "0 4px 20px rgba(0,0,0,0.04)", padding: "20px", width: "100%", boxSizing: "border-box" }}>
                <div style={{ position: "sticky", top: 130, zIndex: 10, background: WH, marginLeft: -20, marginRight: -20, paddingLeft: 20, paddingRight: 20, marginTop: -20, paddingTop: 20, paddingBottom: 12, borderRadius: "24px 24px 0 0" }}>
                  <NavSemana offset={weekOffsetCitas} onChange={setWeekOffsetCitas} weekDays={weekDays}/>
                </div>
                <LeyendaPeluqueros/>
                <div style={{ marginTop: "16px" }}>
                  <CalendarioGrid dias={weekDays} citas={citas} peluqueroFiltroId={null}/>
                </div>
              </div>
            </div>
        )}

        {/* --- VISTA: CALENDARIO POR PELUQUERO --- */}
        {vistaCitas==="peluquero"&&(
          <div>
            <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
              {CONFIG.peluqueros.map(p=>(
                <button key={p.id} style={{background:pelFiltroCitas===p.id?p.color:WH,color:pelFiltroCitas===p.id?WH:TX,border:`2px solid ${pelFiltroCitas===p.id?p.color:CR3}`,borderRadius:50,padding:"5px 14px 5px 5px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:8,transition:"all 0.2s ease"}} onClick={()=>setPelFiltroCitas(pelFiltroCitas===p.id?null:p.id)}>
                  <img src={p.foto} alt={p.nombre} style={{width:28,height:28,borderRadius:"50%",objectFit:"cover",border:`2px solid ${pelFiltroCitas===p.id?"rgba(255,255,255,0.5)":CR3}`,flexShrink:0}}/>
                  {p.nombre}
                </button>
              ))}
            </div>
            <div style={{ background: WH, borderRadius: "24px", boxShadow: "0 4px 20px rgba(0,0,0,0.04)", padding: "20px", width: "100%", boxSizing: "border-box", overflow: "visible" }}>
              <div style={{ position: "sticky", top: 130, zIndex: 10, background: WH, marginLeft: -20, marginRight: -20, paddingLeft: 20, paddingRight: 20, marginTop: -20, paddingTop: 20, paddingBottom: 12, borderRadius: "24px 24px 0 0" }}>
                <NavSemana offset={weekOffsetCitas} onChange={setWeekOffsetCitas} weekDays={weekDays}/>
              </div>
              <div style={{ marginTop: "16px" }}>
                <CalendarioGrid dias={weekDays} citas={citas} peluqueroFiltroId={pelFiltroCitas}/>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
  // ──────────────────────
// TAB CLIENTES (Versión Corregida con Márgenes para Móvil)
  // ────────────────────────────────────────────────────────
  const TabClientes = ({ isMobile, onClienteEliminado }) => {
    // Memoria persistente para el buscador y filtros
    const [busq, setBusq] = useState(() => window._busqCache || "");
    const [clienteBorrar, setClienteBorrar] = useState(null);
    const [inactivos, setInactivos] = useState(() => window._inactivosCache || false);
    const [editNota, setEditNota] = useState(false);
    const [notaVal, setNotaVal] = useState("");
    const semMil = CONFIG.semanasSinVisita * 7 * 24 * 60 * 60 * 1000;
    
    const clientesFiltrados = useMemo(() => {
      let lista = clientes;
      if (inactivos) {
        const lim = new Date(Date.now() - semMil);
        lista = lista.filter(c => new Date(c.ultimaVisita) < lim);
      }
      if (!busq) return lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
      return lista
        .map(c => ({ ...c, score: c.telefono?.includes(busq) ? 90 : similitud(busq, c.nombre) }))
        .filter(c => c.score >= 60)
        .sort((a, b) => b.score - a.score);
    }, [busq, inactivos, clientes]);

    const guardarNota = async () => {
      setClientes(prev => prev.map(c => (c.id === clienteSel.id ? { ...c, nota: notaVal } : c)));
      setClienteSel(prev => ({ ...prev, nota: notaVal }));
      setEditNota(false);
      try { await actualizarCliente(clienteSel.id, { nota: notaVal }); } catch (e) { console.error(e); }
    };
    
    return (
      <div style={{ width: "100%", boxSizing: "border-box", padding: "0 16px 20px 16px" }}>
        
        {/* BUSCADOR Y FILTROS */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center", width: "100%", boxSizing: "border-box" }}>
          <Inp 
            style={{ flex: 1, minWidth: "200px", marginBottom: 0, boxSizing: "border-box" }} 
            value={busq} 
            onChange={e => {
              setBusq(e.target.value);
              window._busqCache = e.target.value; 
            }} 
            placeholder="🔍 Buscar nombre o móvil..."
          />
        </div>

        <div style={{ fontSize: 11, color: TX2, marginBottom: 10 }}>
          {clientesFiltrados.length} cliente{clientesFiltrados.length !== 1 ? "s" : ""}
        </div>
        
        {/* CONTENEDOR DE COLUMNAS (Responsive) */}
        <div style={{ display: "flex", flexWrap: "wrap", flexDirection: isMobile && clienteSel ? "column-reverse" : "row", gap: "20px", width: "100%", boxSizing: "border-box" }}>
          
          {/* COLUMNA 1: LISTA DE CLIENTES */}
          <div style={{ flex: "1 1 320px", minWidth: 0, boxSizing: "border-box" }}>
            {clientesFiltrados.map(c => (
              <div 
                key={c.id} 
                style={{
                  background: clienteSel?.id === c.id ? `${A}0D` : WH,
                  border: `1px solid ${clienteSel?.id === c.id ? A : CR3}`,
                  borderRadius: 12,
                  padding: "13px 15px",
                  marginBottom: 8,
                  cursor: "pointer",
                  boxSizing: "border-box",
                  width: "100%"
                }} 
                onClick={() => { setClienteSel(c); setEditNota(false); }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", boxSizing: "border-box" }}>
                  <div style={{ textAlign: "left", maxWidth: "65%" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: TX, marginBottom: 2 }}>{c.nombre}</div>
                    <div style={{ fontSize: 11, color: TX2 }}>📞 {c.telefono}</div>
                    <div style={{ fontSize: 11, color: TX2 }}>Última: {fmtFechaES(c.ultimaVisita)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: A }}>{c.gasto} €</div>
                    <div style={{ fontSize: 10, color: TX2 }}>{c.visitas} visitas</div>
                  </div>
                </div>
              </div>
            ))}
            {clientesFiltrados.length === 0 && (
              <div style={{ textAlign: "center", padding: "30px", color: TX2, fontSize: 13, background: WH, borderRadius: 12, border: `1px solid ${CR3}`, boxSizing: "border-box" }}>
                No se encontraron clientes
              </div>
            )}
          </div>

          {/* COLUMNA 2: FICHA DETALLADA */}
          <div style={{ flex: "1 1 320px", minWidth: 0, boxSizing: "border-box" }}>
            {clienteSel ? (
              <div style={{ ...as.card, boxSizing: "border-box", width: "100%", padding: isMobile ? "16px" : "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: TX }}>{clienteSel.nombre}</div>
                  <button style={{ background: ER + "15", border: `1px solid ${ER}33`, color: ER, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }} onClick={() => setClienteBorrar(clienteSel)}>Eliminar cliente</button>
                </div>
                <div style={{ fontSize: 12, color: TX2, marginBottom: 14 }}>📞 {clienteSel.telefono}</div>
                
                {/* GRID DE ESTADÍSTICAS */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 14, boxSizing: "border-box" }}>
                  {[[clienteSel.gasto + " €", "Gasto Total"], [clienteSel.visitas, "Visitas"], [Math.round(clienteSel.gasto / Math.max(clienteSel.visitas, 1)) + " €", "Ticket Medio"], [clienteSel.noShows || 0, "No shows"]].map(([v, l]) => (
                    <div key={l} style={{ background: CR, borderRadius: 9, padding: "10px", textAlign: "center", boxSizing: "border-box" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: A }}>{v}</div>
                      <div style={{ fontSize: 9, color: TX2, textTransform: "uppercase" }}>{l}</div>
                    </div>
                  ))}
                </div>

                <Divider />
                <div style={{ fontSize: 11, fontWeight: 700, color: TX2, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Nota interna</div>
                {editNota ? (
                  <div style={{ boxSizing: "border-box", width: "100%" }}>
                    <Inp style={{ boxSizing: "border-box", width: "100%" }} value={notaVal} onChange={e => setNotaVal(e.target.value)} placeholder="Añade una nota..." />
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      <Btn ok={false} sm onClick={() => setEditNota(false)}>Cancelar</Btn>
                      <Btn sm onClick={guardarNota}>Guardar</Btn>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: CR, borderRadius: 8, padding: "12px", fontSize: 13, color: clienteSel.nota ? TX : TX2, fontStyle: clienteSel.nota ? "normal" : "italic", cursor: "pointer", boxSizing: "border-box" }} onClick={() => { setEditNota(true); setNotaVal(clienteSel.nota || ""); }}>
                    {clienteSel.nota || "Toca para añadir una nota sobre el cliente..."}
                  </div>
                )}

                <Divider />
                <div style={{ fontSize: 11, fontWeight: 700, color: TX2, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Historial de servicios</div>
                {(clienteSel.historial || []).filter(h => h.estado === "completada" || !h.estado).length === 0 ? (
                  <div style={{ fontSize: 12, color: TX2, fontStyle: "italic" }}>Sin servicios registrados</div>
                ) : (
                  (clienteSel.historial || []).filter(h => h.estado === "completada" || !h.estado).map((h, i) => (
                    <div key={i} style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center", // Centra verticalmente el precio con el texto de la izquierda
                      padding: "10px 0", 
                      borderBottom: `1px solid ${CR2}`, 
                      fontSize: 12 
                    }}>
                      {/* Contenedor de texto alineado a la izquierda */}
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontWeight: 600, color: TX, marginBottom: 2 }}>{h.servicio}</div>
                        <div style={{ fontSize: 10, color: TX2 }}>
                          {fmtFechaES(h.fecha)} <span style={{ margin: "0 4px" }}>•</span> {h.peluquero}
                        </div>
                      </div>
                      
                      {/* Precio a la derecha */}
                      <div style={{ fontWeight: 700, color: A, fontSize: 13 }}>
                        {h.precio} €
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div style={{ background: CR, border: `2px dashed ${CR3}`, borderRadius: 12, height: "100%", minHeight: "150px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: TX2, padding: 20, textAlign: "center", boxSizing: "border-box" }}>
                <span style={{ fontSize: 24, marginBottom: 8 }}>👤</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Selecciona un cliente para ver detalles</span>
              </div>
            )}
          </div>
        </div>

        {/* MODAL DE ELIMINACIÓN */}
        {clienteBorrar && (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{background:WH,borderRadius:18,padding:"32px",width:"100%",maxWidth:400,boxShadow:"0 20px 60px rgba(0,0,0,.3)",textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:16}}>🗑</div>
              <h3 style={{fontSize:17,fontWeight:700,color:TX,marginBottom:8}}>¿Eliminar este cliente?</h3>
              <p style={{fontSize:13,color:TX2,marginBottom:24}}>Se borrará el historial de <b>{clienteBorrar.nombre}</b>.</p>
              <div style={{display:"flex",gap:10}}>
                <Btn ok={false} style={{flex:1}} onClick={() => setClienteBorrar(null)}>Cancelar</Btn>
                <button style={{flex:1,background:`linear-gradient(135deg,${ER},#b91c1c)`,color:WH,border:"none",borderRadius:11,padding:"12px 20px",fontSize:13,fontWeight:700,cursor:"pointer"}} onClick={async () => {
                  const copia = {...clienteBorrar};
                  if(clienteSel?.id === clienteBorrar.id) setClienteSel(null);
                  await deleteDoc(doc(db,"clientes",clienteBorrar.id));
                  setClienteBorrar(null);
                  onClienteEliminado(copia);
                }}>Eliminar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
// ──────────────────────
  // TAB CAJA - VERSIÓN POSICIÓN PERFECTA + FOTOS Y EUROS AL FINAL
  // ──────────────────────────────────────────────
  const TabCaja = () => {
    const [fechaCaja, setFechaCaja] = useState(HOY_ISO);
    const [fondoCaja, setFondoCaja] = useState(50);
    const [gastosCaja, setGastosCaja] = useState(0);
    const [notaCierre, setNotaCierre] = useState("");
    
    const [datosOriginales, setDatosOriginales] = useState({ nota: "", fondo: 50, gastos: 0 });
    const [guardando, setGuardando] = useState(false);
    const [showPicker, setShowPicker] = useState(false);

    const fmtEs = (iso) => {
      if (!iso) return "";
      const [y, m, d] = iso.split("-");
      return `${d}/${m}/${y}`;
    };

    // 1. CARGAR DATOS
    useEffect(() => {
      const cargarDatosDia = async () => {
        try {
          const docRef = doc(db, "notasCaja", fechaCaja);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const d = docSnap.data();
            const carga = { 
              nota: d.texto || "", 
              fondo: d.fondoInicial || 50, 
              gastos: d.gastos || 0 
            };
            setNotaCierre(carga.nota);
            setFondoCaja(carga.fondo);
            setGastosCaja(carga.gastos);
            setDatosOriginales(carga);
          } else {
            const vacio = { nota: "", fondo: 50, gastos: 0 };
            setNotaCierre(""); setFondoCaja(50); setGastosCaja(0);
            setDatosOriginales(vacio);
          }
        } catch (e) { console.error(e); }
      };
      cargarDatosDia();
    }, [fechaCaja]);

    // 2. CÁLCULOS
    const citasDia = citas.filter(c => c.fecha === fechaCaja);
    const completadas = citasDia.filter(c => c.estado === "completada");
    const efec = completadas.filter(c => c.metodoPago === "efectivo").reduce((s, c) => s + c.precio, 0);
    const tarj = completadas.filter(c => c.metodoPago === "tarjeta").reduce((s, c) => s + c.precio, 0);
    const biz = completadas.filter(c => c.metodoPago === "bizum").reduce((s, c) => s + c.precio, 0);
    const facturadoDia = efec + tarj + biz;
    const dineroFisicoEsperado = parseFloat(fondoCaja || 0) + efec - parseFloat(gastosCaja || 0);

    const hayCambios = notaCierre !== datosOriginales.nota || 
                       parseFloat(fondoCaja) !== datosOriginales.fondo || 
                       parseFloat(gastosCaja) !== datosOriginales.gastos;

    // 3. GUARDAR
    const handleGuardarCierre = async () => {
      setGuardando(true);
      try {
        const nuevosDatos = {
          texto: notaCierre,
          fecha: fechaCaja,
          fondoInicial: parseFloat(fondoCaja),
          gastos: parseFloat(gastosCaja),
          ingresosTotales: facturadoDia,
          actualizado: new Date().toISOString()
        };
        await setDoc(doc(db, "notasCaja", fechaCaja), nuevosDatos);
        setDatosOriginales({ 
          nota: notaCierre, 
          fondo: parseFloat(fondoCaja), 
          gastos: parseFloat(gastosCaja) 
        });
      } catch (e) { console.error(e); }
      setGuardando(false);
    };

    return (
      <div style={{ position: "relative", minHeight: "100vh" }}>
        
        {/* CABECERA FIJA: FECHA CENTRADA + BOTÓN HOY FLOTANTE */}
        <div style={{ 
          position: "fixed", top: "145px", left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, pointerEvents: "none", width: "100%", maxWidth: "400px", display: "flex", justifyContent: "center"
        }}>
          
          {/* Botón Volver a Hoy - POSICIÓN ABSOLUTA para no mover el centro */}
          {fechaCaja !== HOY_ISO && (
            <div 
              style={{
                position: "absolute",
                left: "10px", 
                pointerEvents: "auto", background: A, color: WH, 
                padding: "8px 14px", borderRadius: "50px", fontSize: 11, 
                fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                display: "flex", alignItems: "center", transition: "0.2s"
              }}
              onClick={() => setFechaCaja(HOY_ISO)}
            >
              HOY
            </div>
          )}

          {/* LA CAJITA DE LA FECHA (Se queda quieta en el centro) */}
          <div style={{ pointerEvents: "auto", position: "relative" }}>
            <div 
              style={{
                display: "inline-flex", alignItems: "center", gap: 10, background: WH, 
                padding: "8px 20px", borderRadius: "50px", border: `1px solid ${CR3}`,
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)", cursor: "pointer"
              }} 
              onClick={() => setShowPicker(!showPicker)}
            >
              <span style={{ fontSize: 12, color: TX2, fontWeight: 600 }}>Caja del:</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: A }}>{fmtEs(fechaCaja)}</span>
              <span style={{ fontSize: 10, color: A }}>▼</span>
            </div>

            {showPicker && (
              <>
                <div 
                  style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 10000 }} 
                  onClick={() => setShowPicker(false)}
                />
                <div style={{
                  position: "absolute", top: "120%", left: "50%", transform: "translateX(-50%)",
                  zIndex: 10001, boxShadow: "0 10px 30px rgba(0,0,0,0.2)", borderRadius: 12, overflow: "hidden"
                }}>
                  <MiniCalPicker value={fechaCaja} onChange={(iso) => { setFechaCaja(iso); setShowPicker(false); }} festivosSet={festivosSet} bloqueosPelId={null} bloqueos={[]} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* CONTENIDO */}
        <div style={{ paddingTop: "70px" }}>
          
          {/* KPIs */}
          <div className="admin-kpi-grid" style={{ ...as.kpiGrid, marginBottom: 25 }}>
            <div style={{ ...as.kpi, borderLeft: `4px solid ${A}` }}>
              <div style={as.kpiVal}>{facturadoDia} €</div>
              <div style={as.kpiLbl}>Facturado Hoy</div>
            </div>
            <div style={{ ...as.kpi, background: "#DEF7EC" }}>
              <div style={{ ...as.kpiVal, color: "#059669" }}>{efec} €</div>
              <div style={{ ...as.kpiLbl, color: "#03543F" }}>💵 Efectivo</div>
            </div>
            <div style={{ ...as.kpi, background: "#E1EFFE" }}>
              <div style={{ ...as.kpiVal, color: "#1D4ED8" }}>{tarj} €</div>
              <div style={{ ...as.kpiLbl, color: "#1E429F" }}>💳 Tarjeta</div>
            </div>
            <div style={{ ...as.kpi, background: "#FCE8F3" }}>
              <div style={{ ...as.kpiVal, color: "#BE185D" }}>{biz} €</div>
              <div style={{ ...as.kpiLbl, color: "#99154B" }}>📱 Bizum</div>
            </div>
          </div>

          {/* CUADRE Y NOTAS */}
          <div className="admin-two-col" style={{ ...as.twoCol, marginBottom: 25 }}>
            <div style={as.card}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, color: TX }}>🧮 Cuadre Físico</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: TX2, fontWeight: 700 }}>FONDO INICIAL</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <Inp type="number" value={fondoCaja} onChange={e => setFondoCaja(e.target.value)} style={{ width: 70, textAlign: "right", margin: 0, fontWeight: 700 }} />
                    <span style={{ fontWeight: 700 }}>€</span>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: TX2, fontWeight: 700 }}>INGRESOS EFECTIVO</span>
                  <span style={{ fontWeight: 700, color: "#059669" }}>+ {efec} €</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: TX2, fontWeight: 700 }}>GASTOS / SALIDAS</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <Inp type="number" value={gastosCaja} onChange={e => setGastosCaja(e.target.value)} style={{ width: 70, textAlign: "right", margin: 0, color: ER, fontWeight: 700 }} />
                    <span style={{ fontWeight: 700, color: ER }}>€</span>
                  </div>
                </div>
                <div style={{ marginTop: 10, paddingTop: 15, borderTop: `2px solid ${CR2}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 800 }}>HABER EN CAJA</span>
                  <span style={{ fontSize: 26, fontWeight: 900, color: A }}>{dineroFisicoEsperado} €</span>
                </div>
              </div>
            </div>

            <div style={as.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: TX }}>📝 Nota de Cierre</div>
                <button
                  onClick={handleGuardarCierre}
                  style={{
                    background: guardando ? "#94a3b8" : (hayCambios ? "#16a34a" : "#94a3b8"),
                    color: WH, border: "none", borderRadius: 8,
                    padding: "8px 18px", fontSize: 11, fontWeight: 700,
                    cursor: hayCambios ? "pointer" : "default",
                    transition: "background 0.4s ease"
                  }}
                >
                  {guardando ? "GUARDANDO..." : (hayCambios ? "GUARDAR CAJA" : "GUARDADO")}
                </button>
              </div>
              <textarea
                value={notaCierre}
                onChange={e => setNotaCierre(e.target.value)}
                style={{
                  width: "100%", height: 120, borderRadius: 12, border: `1px solid ${CR3}`,
                  padding: 15, outline: "none", resize: "none", fontSize: 13, background: CR, color: TX, lineHeight: "1.5"
                }}
                placeholder="Notas del día..."
              />
            </div>
          </div>

          {/* REPARTO POR PROFESIONAL (CON FOTOS) */}
          <div style={{ ...as.card, marginBottom: 40 }}>
            <div style={{ ...as.cardTitle, marginBottom: 20 }}>Facturación por Profesional</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
              {CONFIG.peluqueros.map(p => {
                const t = completadas.filter(c => c.peluqueroId === p.id).reduce((s, c) => s + c.precio, 0);
                const nc = citasDia.filter(c => c.peluqueroId === p.id).length;
                return (
                  <div key={p.id} style={{ background: WH, padding: "16px 20px", borderRadius: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${CR2}`, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
                    
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      {/* FOTO CIRCULAR */}
                      <img src={p.foto} alt={p.nombre} style={{ width: "44px", height: "44px", borderRadius: "50%", objectFit: "cover", border: `2px solid ${p.color || '#e2e8f0'}` }} />
                      
                      {/* NOMBRE Y CONTADOR DE SERVICIOS */}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: TX }}>{p.nombre}</span>
                        <span style={{ fontSize: 12, color: TX2, fontWeight: 600, background: CR, padding: "3px 8px", borderRadius: "20px" }}>{nc} servicios</span>
                      </div>
                    </div>

                    {/* EUROS AL FINAL */}
                    <span style={{ fontSize: 22, fontWeight: 900, color: A }}>{t} €</span>
                    
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ──────────────────────
  // TAB DISPONIBILIDAD (CIERRES Y AUSENCIAS)
  // ──────────────────────
  const TabDisponibilidad = ({ isMobile, horariosEspeciales, horariosGenerales }) => {
    const [showFF, setShowFF] = useState(false);
    const [showBF, setShowBF] = useState(false);
    
    const [festForm, setFestForm] = useState({ desde: "", hasta: "", motivo: "" });
    const [bloqForm, setBloqForm] = useState({ peluqueroId: "", desde: "", hasta: "", motivo: "" });
    
    const [showFestCal, setShowFestCal] = useState(false);
    const [showFestHastaCal, setShowFestHastaCal] = useState(false);
    const [showBloqDesdeCal, setShowBloqDesdeCal] = useState(false);
    const [showBloqHastaCal, setShowBloqHastaCal] = useState(false);
    
    // Horario especial por peluquero
    const [showHE, setShowHE] = useState(false);
    const [showHECal, setShowHECal] = useState(false);
    const [heForm, setHeForm] = useState({peluqueroId:"", fecha:"", tramos:[{entrada:"", salida:""}]});
    
    // Horario especial general
    const [showHG, setShowHG] = useState(false);
    const [showHGCal, setShowHGCal] = useState(false);
    const [hgForm, setHgForm] = useState({fecha:"", tramos:[{entrada:"", salida:""}]});

    // FORMATOS DE FECHA
    const toDMY = (iso) => iso ? iso.split("-").reverse().join("/") : "";
    const toSafeDMY = (iso) => iso ? iso.split("-").reverse().join("-") : "";

    // LÓGICA DE DÍAS
    const obtenerDiasEntre = (inicio, fin) => {
      const fechas = [];
      let actual = new Date(inicio);
      const final = new Date(fin || inicio);
      while (actual <= final) {
        fechas.push(actual.toISOString().split('T')[0]);
        actual.setDate(actual.getDate() + 1);
      }
      return fechas;
    };

    // FUNCIÓN ROBUSTA PARA SACAR EL MOTIVO DEL ID DEL DOCUMENTO
    const getMotivo = (item, isBloqueo) => {
      if (item.id) {
        const partes = item.id.split(" - ");
        if (isBloqueo && partes.length >= 3) return partes[1]; // Peluquero - Motivo - Fecha
        if (!isBloqueo && partes.length >= 2) return partes[0]; // Motivo - Fecha
      }
      return item.motivo || (isBloqueo ? "Ausencia" : "Cierre");
    };

    // AGRUPAR PARA LA VISTA ADMIN
    const agruparItems = (items) => {
      const agrupados = [];
      const procesados = new Set();
      const ordenados = [...items].sort((a, b) => (a.fecha || a.desde).localeCompare(b.fecha || b.desde));

      ordenados.forEach(item => {
        if (procesados.has(item.id)) return;
        
        const isBloqueo = !!item.peluqueroId;
        const motivoVisual = getMotivo(item, isBloqueo);

        if (item.rangoId) {
          const hermanos = ordenados.filter(i => i.rangoId === item.rangoId);
          hermanos.forEach(h => procesados.add(h.id));
          agrupados.push({
            isGroup: true,
            ids: hermanos.map(h => h.id),
            motivo: motivoVisual,
            peluqueroId: item.peluqueroId,
            inicio: hermanos[0].fecha || hermanos[0].desde,
            fin: hermanos[hermanos.length - 1].fecha || hermanos[hermanos.length - 1].desde,
          });
        } else {
          agrupados.push({
            isGroup: false,
            ids: [item.id],
            motivo: motivoVisual,
            peluqueroId: item.peluqueroId,
            inicio: item.fecha || item.desde,
            fin: item.fecha || item.desde
          });
        }
      });
      return agrupados;
    };

    // --- ESTILOS DE DISTRIBUCIÓN ---
    const containerStyle = {
      display: "grid", 
      gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", 
      gap: isMobile ? "20px" : "10%",                   
      maxWidth: "90%", margin: "20px auto", padding: "0 0px", alignItems: "start"
    };
    const colStyle = { background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" };
    const btnBlue = { background: "#1e3a8a", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 12px", fontSize: "11px", fontWeight: "700", cursor: "pointer" };
    const inputS = { width: "100%", padding: "8px 10px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "12px", boxSizing: "border-box", textAlign: "left" };

    const tramoStyle = { display:"flex", gap:"8px", alignItems:"center", marginBottom:"6px" };
    const timeInputS = { ...inputS, cursor:"text" };
    const btnAddTramo = { background:"#e0f2fe", color:"#0369a1", border:"none", borderRadius:"6px", padding:"5px 10px", fontSize:"11px", fontWeight:700, cursor:"pointer" };
    const btnDelTramo = { background:"#fee2e2", color:"#dc2626", border:"none", borderRadius:"6px", width:"24px", height:"24px", cursor:"pointer", fontSize:"13px", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 };

    return (
      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr 1fr", gap:"20px", maxWidth:"100%", margin:"20px auto", padding:"0", alignItems:"start" }}>
        
        {/* COLUMNA 1: CIERRES GLOBALES */}
        <div style={colStyle}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"16px", alignItems:"center" }}>
            <h4 style={{ margin:10, fontSize:"14px", fontWeight:"800", color:"#1e293b" }}>Cierres</h4>
            <button onClick={() => setShowFF(!showFF)} style={btnBlue}>{showFF ? "Cancelar" : "+ Añadir"}</button>
          </div>

          {showFF && (
            <div className="anim" style={{ background:"#fff", padding:"12px", borderRadius:"10px", marginBottom:"12px", border:"1px solid #cbd5e1" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"8px" }}>
                <div style={{ position:"relative" }}>
                  <label style={{fontSize:10, fontWeight:700, color:"#64748b"}}>Desde</label>
                  <button style={inputS} onClick={() => setShowFestCal(!showFestCal)}>{festForm.desde ? toDMY(festForm.desde) : "..."}</button>
                  {showFestCal && (
                    <div style={{ position:"absolute", zIndex:200, marginTop:"4px" }}>
                      <MiniCalPicker value={festForm.desde} onChange={d => { setFestForm({...festForm, desde:d}); setShowFestCal(false); }} festivosSet={festivosSet} bloqueosPelId={null} bloqueos={[]} />
                    </div>
                  )}
                </div>
                <div style={{ position:"relative" }}>
                  <label style={{fontSize:10, fontWeight:700, color:"#64748b"}}>Hasta (Opcional)</label>
                  <button style={inputS} onClick={() => setShowFestHastaCal(!showFestHastaCal)}>{festForm.hasta ? toDMY(festForm.hasta) : "..."}</button>
                  {showFestHastaCal && (
                    <div style={{ position:"absolute", zIndex:200, marginTop:"4px", right:0 }}>
                      <MiniCalPicker value={festForm.hasta} onChange={d => { setFestForm({...festForm, hasta:d}); setShowFestHastaCal(false); }} festivosSet={festivosSet} bloqueosPelId={null} bloqueos={[]} />
                    </div>
                  )}
                </div>
              </div>
              <input style={{...inputS, marginBottom:"12px", cursor:"text"}} placeholder="Motivo (Ej: Festivo local)" value={festForm.motivo} onChange={e=>setFestForm({...festForm, motivo:e.target.value})} />
              <button style={{...btnBlue, width:"100%", padding:"10px", background:"#10b981", fontSize:"12px"}} onClick={async () => {
                if(!festForm.desde || !festForm.motivo) return;
                const dias = obtenerDiasEntre(festForm.desde, festForm.hasta || festForm.desde);
                const rId = Date.now().toString();
                for(const d of dias){
                  const docName = `${festForm.motivo} - ${toSafeDMY(d)}`;
                  await crearFestivo(docName, { fecha:d, rangoId:rId, todoElDia:true });
                }
                setFestForm({desde:"", hasta:"", motivo:""}); setShowFF(false);
              }}>Guardar Cierre</button>
            </div>
          )}

          {agruparItems(festivos).map((f, i) => (
            <div key={i} style={{ background:"#fff", padding:"10px 14px", borderRadius:"8px", marginBottom:"8px", display:"flex", justifyContent:"space-between", alignItems:"flex-start", border:"1px solid #e2e8f0" }}>
              <div style={{ display:"flex", flexDirection:"column", gap:"2px", alignItems:"flex-start", textAlign:"left" }}>
                <span style={{ fontSize:"13px", fontWeight:"700", color:"#1e293b" }}>{f.motivo}</span>
                <span style={{ fontSize:"11px", color:"#64748b" }}>{toDMY(f.inicio)}{f.inicio !== f.fin ? ` — ${toDMY(f.fin)}` : ""}</span>
              </div>
              <button style={{ color:"#ef4444", background:"none", border:"none", cursor:"pointer", fontSize:"15px", padding:"4px" }} onClick={async () => { for(const id of f.ids) await borrarFestivo(id); }}>✕</button>
            </div>
          ))}
        </div>

        {/* COLUMNA 2: AUSENCIAS POR PELUQUERO */}
        <div style={colStyle}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"16px", alignItems:"center" }}>
            <h4 style={{ margin:10, fontSize:"14px", fontWeight:"800", color:"#1e293b" }}>Ausencias</h4>
            <button onClick={() => setShowBF(!showBF)} style={btnBlue}>{showBF ? "Cancelar" : "+ Añadir"}</button>
          </div>

          {showBF && (
            <div className="anim" style={{ background:"#fff", padding:"12px", borderRadius:"10px", marginBottom:"12px", border:"1px solid #cbd5e1" }}>
              <select style={{...inputS, marginBottom:"8px"}} value={bloqForm.peluqueroId} onChange={e=>setBloqForm({...bloqForm, peluqueroId:e.target.value})}>
                <option value="">¿Peluquero?</option>
                {CONFIG.peluqueros.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"8px" }}>
                <div style={{ position:"relative" }}>
                  <label style={{fontSize:10, fontWeight:700, color:"#64748b"}}>Desde</label>
                  <button style={inputS} onClick={()=>setShowBloqDesdeCal(!showBloqDesdeCal)}>{bloqForm.desde ? toDMY(bloqForm.desde) : "..."}</button>
                  {showBloqDesdeCal && (
                    <div style={{ position:"absolute", zIndex:200, marginTop:"4px" }}>
                      <MiniCalPicker value={bloqForm.desde} onChange={d=>{setBloqForm({...bloqForm, desde:d});setShowBloqDesdeCal(false);}} festivosSet={festivosSet} bloqueosPelId={bloqForm.peluqueroId ? Number(bloqForm.peluqueroId) : null} bloqueos={bloqueos} />
                    </div>
                  )}
                </div>
                <div style={{ position:"relative" }}>
                  <label style={{fontSize:10, fontWeight:700, color:"#64748b"}}>Hasta (Opcional)</label>
                  <button style={inputS} onClick={()=>setShowBloqHastaCal(!showBloqHastaCal)}>{bloqForm.hasta ? toDMY(bloqForm.hasta) : "..."}</button>
                  {showBloqHastaCal && (
                    <div style={{ position:"absolute", zIndex:200, marginTop:"4px", right:0 }}>
                      <MiniCalPicker value={bloqForm.hasta} onChange={d=>{setBloqForm({...bloqForm, hasta:d});setShowBloqHastaCal(false);}} festivosSet={festivosSet} bloqueosPelId={bloqForm.peluqueroId ? Number(bloqForm.peluqueroId) : null} bloqueos={bloqueos} />
                    </div>
                  )}
                </div>
              </div>
              <input style={{...inputS, marginBottom:"12px", cursor:"text"}} placeholder="Motivo (Ej: Vacaciones)" value={bloqForm.motivo} onChange={e=>setBloqForm({...bloqForm, motivo:e.target.value})} />
              <button style={{...btnBlue, width:"100%", padding:"10px", background:"#10b981", fontSize:"12px"}} onClick={async () => {
                const pel = CONFIG.peluqueros.find(p => String(p.id) === String(bloqForm.peluqueroId));
                if(!pel || !bloqForm.desde || !bloqForm.motivo) return;
                const dias = obtenerDiasEntre(bloqForm.desde, bloqForm.hasta || bloqForm.desde);
                const rId = Date.now().toString();
                for(const d of dias){
                  const docName = `${pel.nombre} - ${bloqForm.motivo} - ${toSafeDMY(d)}`;
                  await crearBloqueo(docName, { desde:d, hasta:d, rangoId:rId, peluqueroId:pel.id, todoElDia:true });
                }
                setBloqForm({peluqueroId:"", desde:"", hasta:"", motivo:""}); setShowBF(false);
              }}>Guardar Ausencia</button>
            </div>
          )}

          {agruparItems(bloqueos).map((b, i) => {
            const pel = CONFIG.peluqueros.find(p => String(p.id) === String(b.peluqueroId));
            return (
              <div key={i} style={{ background:"#fff", padding:"8px 12px", borderRadius:"10px", marginBottom:"8px", display:"flex", alignItems:"center", justifyContent:"space-between", border:"1px solid #e2e8f0" }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:"10px", flex:1 }}>
                  <img src={pel?.foto} alt="" style={{ width:"28px", height:"28px", borderRadius:"50%", objectFit:"cover", flexShrink:0, marginTop:"1px" }} />
                  <div style={{ display:"flex", flexDirection:"column", gap:"0px", alignItems:"flex-start" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                      <span style={{ fontSize:"13px", fontWeight:"800", color:"#1e293b" }}>{pel?.nombre}</span>
                      <span style={{ fontSize:"12px", color:"#64748b" }}>{b.motivo}</span>
                    </div>
                    <span style={{ fontSize:"11px", color:"#94a3b8" }}>{toDMY(b.inicio)}{b.inicio !== b.fin ? ` — ${toDMY(b.fin)}` : ""}</span>
                  </div>
                </div>
                <button style={{ color:"#ef4444", background:"none", border:"none", cursor:"pointer", fontSize:"15px", padding:"4px" }} onClick={async () => { for(const id of b.ids) await borrarBloqueo(id); }}>✕</button>
              </div>
            );
          })}
        </div>

        {/* COLUMNA 3: HORARIO ESPECIAL GENERAL */}
        <div style={colStyle}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"16px", alignItems:"center" }}>
            <h4 style={{ margin:10, fontSize:"14px", fontWeight:"800", color:"#1e293b" }}>Horario especial general</h4>
            <button onClick={() => setShowHG(!showHG)} style={btnBlue}>{showHG ? "Cancelar" : "+ Añadir"}</button>
          </div>

          {showHG && (
            <div className="anim" style={{ background:"#fff", padding:"12px", borderRadius:"10px", marginBottom:"12px", border:"1px solid #cbd5e1" }}>
              <div style={{ position:"relative", marginBottom:"8px" }}>
                <label style={{fontSize:10, fontWeight:700, color:"#64748b"}}>Fecha</label>
                <button style={inputS} onClick={() => setShowHGCal(v => !v)}>{hgForm.fecha ? toDMY(hgForm.fecha) : "Seleccionar fecha..."}</button>
                {showHGCal && (
                  <div style={{ position:"absolute", zIndex:200, marginTop:"4px" }}>
                    <MiniCalPicker value={hgForm.fecha} onChange={d => { setHgForm({...hgForm, fecha:d}); setShowHGCal(false); }} festivosSet={festivosSet} bloqueosPelId={null} bloqueos={[]} />
                  </div>
                )}
              </div>
              <label style={{fontSize:10, fontWeight:700, color:"#64748b", marginBottom:"4px", display:"block"}}>Tramos horarios</label>
              {hgForm.tramos.map((t, idx) => (
                <div key={idx} style={tramoStyle}>
                  <input type="time" style={{...timeInputS, flex:1}} value={t.entrada} onChange={e => {
                    const nuevos = [...hgForm.tramos];
                    nuevos[idx] = {...nuevos[idx], entrada: e.target.value};
                    setHgForm({...hgForm, tramos: nuevos});
                  }} />
                  <span style={{fontSize:11, color:"#64748b"}}>—</span>
                  <input type="time" style={{...timeInputS, flex:1}} value={t.salida} onChange={e => {
                    const nuevos = [...hgForm.tramos];
                    nuevos[idx] = {...nuevos[idx], salida: e.target.value};
                    setHgForm({...hgForm, tramos: nuevos});
                  }} />
                  {hgForm.tramos.length > 1 && (
                    <button style={btnDelTramo} onClick={() => setHgForm({...hgForm, tramos: hgForm.tramos.filter((_,i) => i !== idx)})}>✕</button>
                  )}
                </div>
              ))}
              <button style={btnAddTramo} onClick={() => setHgForm({...hgForm, tramos: [...hgForm.tramos, {entrada:"", salida:""}]})}>+ Añadir tramo</button>
              <button style={{...btnBlue, width:"100%", padding:"10px", background:"#10b981", fontSize:"12px", marginTop:"10px"}} onClick={async () => {
                if(!hgForm.fecha || hgForm.tramos.some(t => !t.entrada || !t.salida)) return;
                const docId = `general-${hgForm.fecha}`;
                await guardarHorarioGeneral(docId, { fecha: hgForm.fecha, tramos: hgForm.tramos });
                setHgForm({fecha:"", tramos:[{entrada:"", salida:""}]});
                setTimeout(() => setShowHG(false), 300);
              }}>Guardar horario general</button>
            </div>
          )}

          {[...(horariosGenerales||[])].sort((a,b) => a.fecha.localeCompare(b.fecha)).map((h, i) => (
            <div key={i} style={{ background:"#fff", padding:"8px 12px", borderRadius:"10px", marginBottom:"8px", border:"1px solid #e2e8f0" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ display:"flex", flexDirection:"column", gap:"0px", alignItems:"flex-start" }}>
                  <span style={{ fontSize:"13px", fontWeight:"800", color:"#1e293b" }}>{toDMY(h.fecha)}</span>
                  <span style={{ fontSize:"11px", color:"#64748b" }}>
                    {(h.tramos||[]).map((t, ti) => `${t.entrada} - ${t.salida}`).reduce((acc, cur, i) => i === 0 ? [cur] : [...acc, <span key={i} style={{ margin:"0 8px", color:"#cbd5e1" }}>|</span>, cur], [])}
                  </span>
                </div>
                <button style={{ color:"#ef4444", background:"none", border:"none", cursor:"pointer", fontSize:"15px", padding:"4px" }} onClick={async () => await borrarHorarioGeneral(h.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>

        {/* COLUMNA 4: HORARIO ESPECIAL POR PELUQUERO */}
        <div style={colStyle}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"16px", alignItems:"center" }}>
            <h4 style={{ margin:10, fontSize:"14px", fontWeight:"800", color:"#1e293b" }}>Horario especial peluquero</h4>
            <button onClick={() => setShowHE(!showHE)} style={btnBlue}>{showHE ? "Cancelar" : "+ Añadir"}</button>
          </div>

          {showHE && (
            <div className="anim" style={{ background:"#fff", padding:"12px", borderRadius:"10px", marginBottom:"12px", border:"1px solid #cbd5e1" }}>
              <select style={{...inputS, marginBottom:"8px"}} value={heForm.peluqueroId} onChange={e => setHeForm({...heForm, peluqueroId:e.target.value})}>
                <option value="">¿Peluquero?</option>
                {CONFIG.peluqueros.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <div style={{ position:"relative", marginBottom:"8px" }}>
                <label style={{fontSize:10, fontWeight:700, color:"#64748b"}}>Fecha</label>
                <button style={inputS} onClick={() => setShowHECal(v => !v)}>{heForm.fecha ? toDMY(heForm.fecha) : "Seleccionar fecha..."}</button>
                {showHECal && (
                  <div style={{ position:"absolute", zIndex:200, marginTop:"4px" }}>
                    <MiniCalPicker value={heForm.fecha} onChange={d => { setHeForm({...heForm, fecha:d}); setShowHECal(false); }} festivosSet={festivosSet} bloqueosPelId={null} bloqueos={[]} />
                  </div>
                )}
              </div>
              <label style={{fontSize:10, fontWeight:700, color:"#64748b", marginBottom:"4px", display:"block"}}>Tramos horarios</label>
              {heForm.tramos.map((t, idx) => (
                <div key={idx} style={tramoStyle}>
                  <input type="time" style={{...timeInputS, flex:1}} value={t.entrada} onChange={e => {
                    const nuevos = [...heForm.tramos];
                    nuevos[idx] = {...nuevos[idx], entrada: e.target.value};
                    setHeForm({...heForm, tramos: nuevos});
                  }} />
                  <span style={{fontSize:11, color:"#64748b"}}>—</span>
                  <input type="time" style={{...timeInputS, flex:1}} value={t.salida} onChange={e => {
                    const nuevos = [...heForm.tramos];
                    nuevos[idx] = {...nuevos[idx], salida: e.target.value};
                    setHeForm({...heForm, tramos: nuevos});
                  }} />
                  {heForm.tramos.length > 1 && (
                    <button style={btnDelTramo} onClick={() => setHeForm({...heForm, tramos: heForm.tramos.filter((_,i) => i !== idx)})}>✕</button>
                  )}
                </div>
              ))}
              <button style={btnAddTramo} onClick={() => setHeForm({...heForm, tramos: [...heForm.tramos, {entrada:"", salida:""}]})}>+ Añadir tramo</button>
              <button style={{...btnBlue, width:"100%", padding:"10px", background:"#10b981", fontSize:"12px", marginTop:"10px"}} onClick={async () => {
                const pel = CONFIG.peluqueros.find(p => String(p.id) === String(heForm.peluqueroId));
                if(!pel || !heForm.fecha || heForm.tramos.some(t => !t.entrada || !t.salida)) return;
                const docId = `${pel.nombre}-${heForm.fecha}`;
                await guardarHorarioEspecial(docId, { peluqueroId: pel.id, fecha: heForm.fecha, tramos: heForm.tramos });
                setHeForm({peluqueroId:"", fecha:"", tramos:[{entrada:"", salida:""}]});
                setTimeout(() => setShowHE(false), 300);
              }}>Guardar horario peluquero</button>
            </div>
          )}

          {[...(horariosEspeciales||[])].sort((a,b) => a.fecha.localeCompare(b.fecha)).map((h, i) => {
            const pel = CONFIG.peluqueros.find(p => String(p.id) === String(h.peluqueroId));
            return (
              <div key={i} style={{ background:"#fff", padding:"8px 12px", borderRadius:"10px", marginBottom:"8px", border:"1px solid #e2e8f0" }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
                  <div style={{ display:"flex", flexDirection:"column", gap:"0px", alignItems:"flex-start" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                      <img src={pel?.foto} alt="" style={{ width:"28px", height:"28px", borderRadius:"50%", objectFit:"cover", flexShrink:0, marginTop:"1px" }} />
                      <span style={{ fontSize:"13px", fontWeight:"800", color:"#1e293b" }}>{pel?.nombre}</span>
                    </div>
                    <span style={{ fontSize:"13px", fontWeight:"800", color:"#1e293b", marginTop:"8px" }}>{toDMY(h.fecha)}</span>
                    <span style={{ fontSize:"11px", color:"#64748b", marginTop:"0px" }}>
                      {(h.tramos||[]).map((t, ti) => `${t.entrada} - ${t.salida}`).reduce((acc, cur, i) => i === 0 ? [cur] : [...acc, <span key={i} style={{ margin:"0 8px", color:"#cbd5e1" }}>|</span>, cur], [])}
                    </span>
                  </div>
                  <button style={{ color:"#ef4444", background:"none", border:"none", cursor:"pointer", fontSize:"15px", padding:"4px" }} onClick={async () => await borrarHorarioEspecial(h.id)}>✕</button>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    );
  };

  // ──────────────────────
  // TAB STATS - VERSIÓN FINAL CON SERVICIO ESTRELLA REFINADO Y EUROS AL FINAL
  // ─────────────────────────────────────────────────────────
  const TabStats = () => {
    const [periodo, setPeriodo] = useState("mes");
    const ahora = new Date();
    const inicioMes = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-01`;
    const inicioSemana = isoDate(getWeekDays()[0]);

    const FOTO_DEFAULT = "https://i.postimg.cc/WbKz7QyQ/avatar-default.png";

    const citasPeriodo = citas.filter(c => {
      if (periodo === "hoy") return c.fecha === HOY_ISO;
      if (periodo === "semana") return c.fecha >= inicioSemana && c.fecha <= HOY_ISO;
      if (periodo === "mes") return c.fecha >= inicioMes && c.fecha <= HOY_ISO;
      return true;
    });

    const completadasTotal = citasPeriodo.filter(c => c.estado === "completada");
    const ingresosTotal = completadasTotal.reduce((s, c) => s + c.precio, 0);
    const ticketMedio = completadasTotal.length > 0 ? (ingresosTotal / completadasTotal.length).toFixed(2) : 0;
    const noShowsTotal = citasPeriodo.filter(c => c.estado === "no-show").length;
    const tasaNSTotal = citasPeriodo.length > 0 ? Math.round((noShowsTotal / citasPeriodo.length) * 100) : 0;

    return (
      <div style={{ paddingBottom: 40 }}>
        {/* SELECTOR DE PERIODO */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", justifyContent: "center" }}>
          {[["hoy", "Hoy"], ["semana", "Semana"], ["mes", "Mes"], ["todo", "Histórico"]].map(([v, l]) => (
            <button 
              key={v} 
              style={{
                background: periodo === v ? A : WH, 
                color: periodo === v ? WH : TX, 
                border: `1px solid ${periodo === v ? A : CR3}`,
                borderRadius: 10, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer",
                transition: "0.2s", boxShadow: periodo === v ? "0 4px 10px rgba(0,0,0,0.1)" : "none"
              }} 
              onClick={() => setPeriodo(v)}
            >
              {l}
            </button>
          ))}
        </div>

        {/* PANEL GLOBAL */}
        <div className="admin-kpi-grid" style={{ ...as.kpiGrid, marginBottom: 25 }}>
          <div style={{ ...as.kpi, borderLeft: `4px solid ${A}` }}>
            <div style={as.kpiVal}>{ingresosTotal} €</div>
            <div style={as.kpiLbl}>Ingresos Totales</div>
          </div>
          <div style={{ ...as.kpi, borderLeft: `4px solid #10B981` }}>
            <div style={{ ...as.kpiVal, color: "#10B981" }}>{ticketMedio} €</div>
            <div style={as.kpiLbl}>Ticket Medio</div>
          </div>
          <div style={{ ...as.kpi, borderLeft: `4px solid #6366F1` }}>
            <div style={{ ...as.kpiVal, color: "#6366F1" }}>{completadasTotal.length}</div>
            <div style={as.kpiLbl}>Servicios Realizados</div>
          </div>
          <div style={{ ...as.kpi, borderLeft: `4px solid ${ER}` }}>
            <div style={{ ...as.kpiVal, color: ER }}>{tasaNSTotal}%</div>
            <div style={as.kpiLbl}>Tasa No-Show</div>
          </div>
        </div>

        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 15, color: TX }}>Rendimiento por Profesional</div>

        {/* LISTADO DE PELUQUEROS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          {CONFIG.peluqueros.map(p => {
            const mc = citasPeriodo.filter(c => c.peluqueroId === p.id);
            const comp = mc.filter(c => c.estado === "completada");
            const ing = comp.reduce((s, c) => s + c.precio, 0);
            const ns = mc.filter(c => c.estado === "no-show").length;
            const tns = mc.length > 0 ? Math.round(ns / mc.length * 100) : 0;
            
            const sc = {}; mc.forEach(c => { sc[c.servicio] = (sc[c.servicio] || 0) + 1; });
            const top = Object.entries(sc).sort((a, b) => b[1] - a[1])[0];

            return (
              <div key={p.id} style={{ ...as.card, borderTop: `5px solid ${p.color}`, position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, textAlign: "left" }}>
                  <img 
                    src={p.foto || FOTO_DEFAULT} 
                    alt={p.nombre} 
                    style={{ 
                      width: "54px", 
                      height: "54px", 
                      borderRadius: "50%", 
                      objectFit: "cover",
                      border: `3px solid ${p.color}15`,
                      padding: "2px",
                      background: WH
                    }} 
                  />
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: TX }}>{p.nombre}</div>
                    <div style={{ fontSize: 11, color: TX2, textTransform: "uppercase", letterSpacing: 1 }}>{p.especialidad}</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{ background: CR, padding: "12px", borderRadius: 10 }}>
                    <div style={{ fontSize: 10, color: TX2, marginBottom: 4 }}>FACTURADO</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: p.color }}>{ing} €</div>
                  </div>
                  <div style={{ background: CR, padding: "12px", borderRadius: 10 }}>
                    <div style={{ fontSize: 10, color: TX2, marginBottom: 4 }}>NO-SHOWS</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: tns > 15 ? ER : TX }}>{tns}%</div>
                  </div>
                </div>

                {/* BLOQUE SERVICIO ESTRELLA ACTUALIZADO */}
                <div style={{ 
                  marginTop: 12, 
                  padding: "12px", 
                  background: "#F8FAFC", 
                  borderRadius: 10, 
                  border: "1px dashed #CBD5E1",
                  textAlign: "center" // Centra el título y el contenido
                }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: TX2, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Servicio más realizado
                  </div>
                  {top ? (
                    <div style={{ fontSize: 13, fontWeight: 700, color: TX }}>
                      {top[0]} 
                      <span style={{ 
                        color: p.color, 
                        fontWeight: 400, // Menos grosor para la cantidad
                        fontSize: "12px",
                        marginLeft: "6px" 
                      }}>
                        x{top[1]}
                      </span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: TX2, fontStyle: "italic" }}>Sin actividad</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

// ──────────────────────
  // TAB CONFIG (OPINIONES EN FILA HORIZONTAL)
  // ──────────────────────
  const TabConfig = ({ valoraciones, setValoraciones, servicios, setServicios, categorias, setCategorias, isMobile, onValEliminada, onSvcEliminado, onCatEliminada }) => {
    const [editCat, setEditCat] = useState(null);
    const [showNewCat, setShowNewCat] = useState(false);
    const [newCat, setNewCat] = useState({ nombre: "", foto: "", servicioIds: [] });
    const [valBorrar, setValBorrar] = useState(null);
    const [editSvc, setEditSvc] = useState(null);
    const [newSvc, setNewSvc] = useState({ nombre: "", duracionMin: 30, precio: 0, desc: "" });
    const [showNew, setShowNew] = useState(false);

    const [showNewVal, setShowNewVal] = useState(false);
    const [newVal, setNewVal] = useState({ nombre: "", estrellas: 5, comentario: "", servicio: "" });
    const [editVal, setEditVal] = useState(null);
    const [svcBorrar, setSvcBorrar] = useState(null);
    const [catBorrar, setCatBorrar] = useState(null);

    // --- FUNCIONES SERVICIOS ---
    const guardarSvc = async () => {
      if (!editSvc.nombre) return;
      const updated = servicios.map(s => s.id === editSvc.id ? editSvc : s);
      setServicios(updated);
      await guardarServicioFB(editSvc);
      setEditSvc(null);
    };

    const addSvc = async () => {
      if (!newSvc.nombre) return;
      if (servicios.some(s => s.nombre.toLowerCase() === newSvc.nombre.toLowerCase())) {
        alert("Ya existe un servicio con ese nombre.");
        return;
      }
      const svc = { ...newSvc, id: Date.now(), precio: Number(newSvc.precio), duracionMin: Number(newSvc.duracionMin), orden: servicios.length };
      setServicios(prev => [...prev, svc]);
      await guardarServicioFB(svc);
      setNewSvc({ nombre: "", duracionMin: 30, precio: 0, desc: "" });
      setShowNew(false);
    };

    const deleteSvc = (svc) => setSvcBorrar(svc);
    const confirmarBorradoSvc = async () => {
      const copia = {...svcBorrar};
      setServicios(prev => prev.filter(s => s.id !== copia.id));
      await borrarServicioFB(copia.nombre);
      setSvcBorrar(null);
      if(onSvcEliminado) onSvcEliminado(copia);
    };
    const confirmarBorradoCat = async () => {
      const copia = {...catBorrar};
      setCategorias(prev => prev.filter(c => c.id !== copia.id));
      await borrarCategoriaFB(copia.id, copia.nombre);
      setCatBorrar(null);
      if(onCatEliminada) onCatEliminada(copia);
    };
    const reordenarCategorias = async (nuevaLista) => {
      const conOrden = nuevaLista.map((cat, idx) => ({...cat, orden: idx}));
      setCategorias(conOrden);
      for (const cat of conOrden) await guardarCategoriaFB(cat);
    };

    const reordenarServiciosEnCat = async (catId, nuevosIds) => {
      const catActual = (categorias||[]).find(c => c.id === catId);
      if (!catActual) return;
      const catActualizada = {...catActual, servicioIds: nuevosIds};
      setCategorias(prev => prev.map(c => c.id === catId ? catActualizada : c));
      await guardarCategoriaFB(catActualizada);
    };

    const reordenarValoraciones = async (nuevaLista) => {
      const conOrden = nuevaLista.map((v, idx) => ({...v, orden: idx}));
      setValoraciones(conOrden);
      for (const v of conOrden) await guardarValoracionFB(v);
    };

    // --- FUNCIONES VALORACIONES ---
    const addVal = async () => {
      if (!newVal.nombre || !newVal.comentario) return; 
      try {
        const nueva = { ...newVal, id: Date.now() };
        await guardarValoracionFB(nueva);
        setNewVal({ nombre: "", estrellas: 5, comentario: "", servicio: "" });
        setShowNewVal(false);
      } catch(e) { console.error("Error guardando valoración:", e); }
    };

    const saveEdit = async () => {
      if (!editVal || !editVal.nombre || !editVal.comentario) return;
      try {
        setValoraciones(p => p.map(v => v.id === editVal.id ? editVal : v));
        await guardarValoracionFB(editVal);
        setEditVal(null);
      } catch(e) { console.error("Error guardando valoración:", e); }
    };

    // --- ESTILOS REUTILIZABLES ---
    const cardS = { background: "#fff", borderRadius: "12px", padding: "20px", marginBottom: "16px", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" };
    const inputS = { width: "100%", padding: "10px 12px", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "13px", color: "#1e293b", outline: "none", boxSizing: "border-box" };
    const labelS = { fontSize: "11px", fontWeight: "800", color: "#64748b", marginBottom: "6px", display: "block", textTransform: "uppercase", letterSpacing: "0.5px" };
    
    const btnBlue = { background: "#1e3a8a", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "12px", fontWeight: "700", cursor: "pointer", transition: "0.2s" };
    const btnGreen = { ...btnBlue, background: "#10b981" };
    const btnCancel = { background: "#f1f5f9", color: "#475569", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "12px", fontWeight: "700", cursor: "pointer" };
    
    // Botones de acción cuadrados (32x32)
    const btnSquareEdit = { background: "#e0e7ff", color: "#4f46e5", border: "none", borderRadius: "6px", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", cursor: "pointer", padding: 0 };
    const btnSquareDel = { background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: "6px", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", cursor: "pointer", padding: 0 };

    const thS = { padding: "10px 16px", borderBottom: "2px solid #e2e8f0", fontSize: "12px", color: "#64748b", fontWeight: "800", textTransform: "uppercase", textAlign: "left" };
    const tdS = { padding: "8px 16px", borderBottom: "1px solid #f1f5f9", fontSize: "13px", color: "#334155" };

    return (
      <div style={{ width: "100%", margin: "0 auto" }}> 
        
        {/* NAVEGACIÓN DE PESTAÑAS */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "24px", flexWrap: "wrap" }}>
          {[["servicios", "Servicios"], ["categorias", "Categorías"], ["valoraciones", "Opiniones"], ["horarios", "Horarios"]].map(([v, l]) => (
            <button 
              key={v} 
              onClick={() => setConfigSubTab(v)}
              style={{
                background: configSubTab === v ? "#1e3a8a" : "#fff",
                color: configSubTab === v ? "#fff" : "#64748b",
                border: `1px solid ${configSubTab === v ? "#1e3a8a" : "#cbd5e1"}`,
                borderRadius: "8px", padding: "8px 18px", fontSize: "13px", fontWeight: "700", cursor: "pointer", transition: "0.2s"
              }}
            >
              {l}
            </button>
          ))}
        </div>

        {/* ───────────────────────────────────────────────────────── */}
        {/* TAB 1: SERVICIOS */}
        {configSubTab === "servicios" && (
          <div className="anim">
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
              <button style={btnBlue} onClick={() => setShowNew(v => !v)}>{showNew ? "Cancelar" : "+ Nuevo servicio"}</button>
            </div>

            {showNew && (
              <div style={cardS}>
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                  <div><label style={labelS}>Nombre</label><input style={inputS} value={newSvc.nombre} onChange={e => setNewSvc(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Corte clásico" /></div>
                  <div><label style={labelS}>Duración (min)</label><input style={inputS} type="number" value={newSvc.duracionMin} onChange={e => setNewSvc(f => ({ ...f, duracionMin: e.target.value }))} /></div>
                  <div><label style={labelS}>Precio (€)</label><input style={inputS} type="number" value={newSvc.precio} onChange={e => setNewSvc(f => ({ ...f, precio: e.target.value }))} /></div>
                  <div style={{ gridColumn: "1 / -1" }}><label style={labelS}>Descripción (Opcional)</label><input style={inputS} value={newSvc.desc} onChange={e => setNewSvc(f => ({ ...f, desc: e.target.value }))} placeholder="Descripción breve del servicio" /></div>
                </div>
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  <button style={btnCancel} onClick={() => setShowNew(false)}>Cancelar</button>
                  <button style={{...btnGreen, opacity: newSvc.nombre ? 1 : 0.5}} disabled={!newSvc.nombre} onClick={addSvc}>Guardar Servicio</button>
                </div>
              </div>
            )}

            <div style={{ ...cardS, padding: 0, overflow: "hidden" }}>
              <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: isMobile ? "600px" : "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead style={{ background: "#f8fafc" }}>
                  <tr>
                    <th style={thS}>Nombre</th>
                    <th style={{ ...thS, textAlign: "center" }}>Duración</th>
                    <th style={{ ...thS, textAlign: "center" }}>Precio</th>
                    <th style={thS}>Descripción</th>
                    <th style={{ ...thS, textAlign: "right" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {servicios.map(s => (
                    <tr key={s.id} style={{ transition: "0.2s" }}>
                      {editSvc?.id === s.id ? (
                        <td colSpan={5} style={{ ...tdS, padding: "16px", background: "#f8fafc" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 2fr", gap: "10px", marginBottom: "12px" }}>
                            <div>
                              <label style={{ fontSize: "10px", fontWeight: "800", color: "#64748b", display: "block", marginBottom: "4px" }}>NOMBRE</label>
                              <input style={{ ...inputS, padding: "8px 10px" }} value={editSvc.nombre} onChange={e => setEditSvc(f => ({ ...f, nombre: e.target.value }))} />
                            </div>
                            <div>
                              <label style={{ fontSize: "10px", fontWeight: "800", color: "#64748b", display: "block", marginBottom: "4px" }}>DURACIÓN (min)</label>
                              <input style={{ ...inputS, padding: "8px 10px" }} type="number" value={editSvc.duracionMin} onChange={e => setEditSvc(f => ({ ...f, duracionMin: Number(e.target.value) }))} />
                            </div>
                            <div>
                              <label style={{ fontSize: "10px", fontWeight: "800", color: "#64748b", display: "block", marginBottom: "4px" }}>PRECIO (€)</label>
                              <input style={{ ...inputS, padding: "8px 10px" }} type="number" value={editSvc.precio} onChange={e => setEditSvc(f => ({ ...f, precio: Number(e.target.value) }))} />
                            </div>
                            <div>
                              <label style={{ fontSize: "10px", fontWeight: "800", color: "#64748b", display: "block", marginBottom: "4px" }}>DESCRIPCIÓN</label>
                              <input style={{ ...inputS, padding: "8px 10px" }} value={editSvc.desc || ""} onChange={e => setEditSvc(f => ({ ...f, desc: e.target.value }))} placeholder="Descripción opcional..." />
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            <button style={{ background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "7px 16px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }} onClick={() => setEditSvc(null)}>Cancelar</button>
                            <button style={{ background: "#10b981", color: "#fff", border: "none", borderRadius: "8px", padding: "7px 16px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }} onClick={guardarSvc}>Guardar</button>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td style={{ ...tdS, fontWeight: "700", color: "#1e293b" }}>{s.nombre}</td>
                          <td style={{ ...tdS, color: "#64748b", textAlign: "center" }}>{s.duracionMin} min</td>
                          <td style={{ ...tdS, fontWeight: "700", color: "#10b981", textAlign: "center" }}>{s.precio} €</td>
                          <td style={{ ...tdS, color: "#94a3b8", fontSize: "11px" }}>{s.desc || "—"}</td>
                          <td style={{ ...tdS, textAlign: "right" }}>
                            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                              <button style={btnSquareEdit} onClick={() => setEditSvc({ ...s })}>✏️</button>
                              <button style={btnSquareDel} onClick={() => deleteSvc(s)}>🗑</button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {servicios.length === 0 && <tr><td colSpan="5" style={{ padding: "30px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>No hay servicios registrados.</td></tr>}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}


        {/* ───────────────────────────────────────────────────────── */}
        {/* TAB: CATEGORÍAS */}
        {configSubTab === "categorias" && (
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: "16px" }}>
              <button style={{ background: "#1e3a8a", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "12px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }} onClick={() => setShowNewCat(v => !v)}>{showNewCat ? "Cancelar" : "+ Nueva categoría"}</button>
            </div>

            {showNewCat && (
              <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", marginBottom: "16px", border: "1px solid #93c5fd" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", marginBottom: "6px", display: "block" }}>Nombre</label>
                    <input style={{ width: "100%", padding: "10px 12px", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box" }} value={newCat.nombre} onChange={e => setNewCat(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Coloración" />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", marginBottom: "6px", display: "block" }}>URL de la foto</label>
                    <input style={{ width: "100%", padding: "10px 12px", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box" }} value={newCat.foto} onChange={e => setNewCat(f => ({ ...f, foto: e.target.value }))} placeholder="https://..." />
                  </div>
                </div>
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", marginBottom: "8px", display: "block" }}>Servicios incluidos</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "flex-start" }}>
                    {servicios.map(s => {
                      const sel = newCat.servicioIds.includes(s.id);
                      return (
                        <button key={s.id} onClick={() => setNewCat(f => ({ ...f, servicioIds: sel ? f.servicioIds.filter(id => id !== s.id) : [...f.servicioIds, s.id] }))} style={{ padding: "6px 12px", borderRadius: "20px", border: `1px solid ${sel ? "#1e3a8a" : "#cbd5e1"}`, background: sel ? "#1e3a8a" : "#f8fafc", color: sel ? "#fff" : "#334155", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
                          {s.nombre}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  <button style={{ background: "#f1f5f9", color: "#475569", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }} onClick={() => setShowNewCat(false)}>Cancelar</button>
                  <button style={{ background: "#10b981", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }} onClick={async () => {
                    if (!newCat.nombre) return;
                    const cat = { ...newCat, id: Date.now(), orden: (categorias||[]).length };
                    setCategorias(prev => [...prev, cat]);
                    await guardarCategoriaFB(cat);
                    setNewCat({ nombre: "", foto: "", servicioIds: [] });
                    setShowNewCat(false);
                  }}>Guardar categoría</button>
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}
              onDragOver={e => e.preventDefault()}
            >
              {[...(categorias||[])].sort((a,b) => (a.orden??a.id) - (b.orden??b.id)).map((cat, idx, arr) => (
                <div
                  key={cat.id}
                  draggable={!editCat}
                  onDragStart={e => { e.dataTransfer.setData("catId", String(cat.id)); }}
                  onDrop={async e => {
                    e.preventDefault();
                    const origenId = Number(e.dataTransfer.getData("catId"));
                    if (origenId === cat.id) return;
                    const lista = [...arr];
                    const desdeIdx = lista.findIndex(c => c.id === origenId);
                    const hastaIdx = lista.findIndex(c => c.id === cat.id);
                    const nuevaLista = [...lista];
                    const [movido] = nuevaLista.splice(desdeIdx, 1);
                    nuevaLista.splice(hastaIdx, 0, movido);
                    await reordenarCategorias(nuevaLista);
                  }}
                  style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden", cursor: editCat ? "default" : "grab" }}
                >
                  {editCat?.id === cat.id ? (
                    <div style={{ padding: "20px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                        <div>
                          <label style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", marginBottom: "6px", display: "block" }}>Nombre</label>
                          <input style={{ width: "100%", padding: "10px 12px", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box" }} value={editCat.nombre} onChange={e => setEditCat(f => ({ ...f, nombre: e.target.value }))} />
                        </div>
                        <div>
                          <label style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", marginBottom: "6px", display: "block" }}>URL de la foto</label>
                          <input style={{ width: "100%", padding: "10px 12px", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box" }} value={editCat.foto} onChange={e => setEditCat(f => ({ ...f, foto: e.target.value }))} />
                        </div>
                      </div>
                      <div style={{ marginBottom: "12px" }}>
                        <label style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", marginBottom: "8px", display: "block" }}>Servicios incluidos (arrastra para reordenar)</label>
                        <div
                          style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}
                          onDragOver={e => e.preventDefault()}
                        >
                          {(editCat.servicioIds||[]).map((sid, sidx) => {
                            const svc = servicios.find(s => s.id === sid);
                            if (!svc) return null;
                            return (
                              <div
                                key={sid}
                                draggable
                                onDragStart={e => e.dataTransfer.setData("svcId", String(sid))}
                                onDrop={async e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const origenId = Number(e.dataTransfer.getData("svcId"));
                                  if (origenId === sid) return;
                                  const lista = [...(editCat.servicioIds||[])];
                                  const desdeIdx = lista.indexOf(origenId);
                                  const hastaIdx = lista.indexOf(sid);
                                  const nueva = [...lista];
                                  const [mov] = nueva.splice(desdeIdx, 1);
                                  nueva.splice(hastaIdx, 0, mov);
                                  setEditCat(f => ({...f, servicioIds: nueva}));
                                }}
                                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#f0f4ff", border: "1px solid #1e3a8a33", borderRadius: "8px", cursor: "grab" }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <span style={{ color: "#94a3b8", fontSize: "14px" }}>⠿</span>
                                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#1e293b" }}>{svc.nombre}</span>
                                  <span style={{ fontSize: "11px", color: "#64748b" }}>{svc.duracionMin} min · {svc.precio} €</span>
                                </div>
                                <button onClick={() => setEditCat(f => ({...f, servicioIds: f.servicioIds.filter(id => id !== sid)}))} style={{ background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: "6px", width: "24px", height: "24px", cursor: "pointer", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                              </div>
                            );
                          })}
                        </div>
                        <label style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", marginBottom: "6px", display: "block" }}>Añadir servicios</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                          {servicios.filter(s => !(editCat.servicioIds||[]).includes(s.id)).map(s => (
                            <button key={s.id} onClick={() => setEditCat(f => ({ ...f, servicioIds: [...(f.servicioIds||[]), s.id] }))} style={{ padding: "6px 12px", borderRadius: "20px", border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
                              + {s.nombre}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                        <button style={{ background: "#f1f5f9", color: "#475569", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }} onClick={() => setEditCat(null)}>Cancelar</button>
                        <button style={{ background: "#10b981", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }} onClick={async () => {
                          setCategorias(prev => prev.map(c => c.id === editCat.id ? editCat : c));
                          await guardarCategoriaFB(editCat);
                          setEditCat(null);
                        }}>Guardar</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                      <div style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        padding: "14px 20px",
                        minWidth: isMobile ? "max-content" : "auto",
                        gap: "0"
                      }}>
                        <span style={{ color: "#cbd5e1", fontSize: "18px", cursor: "grab", flexShrink: 0, marginRight: "10px" }}>⠿</span>
                        {cat.foto && <img src={cat.foto} style={{ width: "50px", height: "50px", borderRadius: "10px", objectFit: "cover", flexShrink: 0, marginRight: "16px" }} />}
                        <div style={{ flexShrink: 0, marginRight: "20px", width: isMobile ? "auto" : "160px" }}>
                          <div style={{ fontSize: "14px", fontWeight: "800", color: "#1e293b", whiteSpace: "nowrap" }}>{cat.nombre}</div>
                        </div>
                        <div style={{ display: "flex", flexWrap: isMobile ? "nowrap" : "wrap", gap: "4px", flex: isMobile ? "none" : 1 }}>
                          {(cat.servicioIds || []).map(sid => {
                            const svc = servicios.find(s => s.id === sid);
                            return svc ? <span key={sid} style={{ fontSize: "10px", background: "#f0f4ff", color: "#1e3a8a", padding: "2px 8px", borderRadius: "10px", fontWeight: "600", whiteSpace: "nowrap" }}>{svc.nombre}</span> : null;
                          })}
                        </div>
                        <div style={{ display: "flex", gap: "8px", flexShrink: 0, marginLeft: "20px" }}>
                          <button style={{ background: "#e0e7ff", color: "#4f46e5", border: "none", borderRadius: "6px", width: "32px", height: "32px", cursor: "pointer", fontSize: "15px" }} onClick={() => setEditCat({ ...cat })}>✏️</button>
                          <button style={{ background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: "6px", width: "32px", height: "32px", cursor: "pointer", fontSize: "15px" }} onClick={() => setCatBorrar({...cat})}>🗑</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}



        {/* ───────────────────────────────────────────────────────── */}
        {/* TAB 2: VALORACIONES */}
        {configSubTab === "valoraciones" && (
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: "16px" }}>
              <button style={{...btnBlue, whiteSpace: "nowrap", flexShrink: 0}} onClick={() => setShowNewVal(v => !v)}>{showNewVal ? "Cancelar" : "+ Nueva opinión"}</button>
            </div>

            {showNewVal && (
              <div style={{ ...cardS, border: "1px solid #93c5fd", background: "#f8fafc" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "12px" }}>
                  <div><label style={labelS}>Nombre del cliente</label><input style={inputS} value={newVal.nombre} onChange={e => setNewVal(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Laura M." /></div>
                  <div>
                    <label style={labelS}>Servicio realizado</label>
                    <select style={inputS} value={newVal.servicio} onChange={e => setNewVal(f => ({ ...f, servicio: e.target.value }))}>
                      <option value="">Seleccionar servicio...</option>
                      {servicios.map(s => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: "16px" }}>
                  <label style={labelS}>Valoración</label>
                  <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <span key={i} style={{ fontSize: "30px", cursor: "pointer", color: i <= newVal.estrellas ? "#F59E0B" : "#D1D5DB", transition: "0.2s" }} onClick={() => setNewVal(f => ({ ...f, estrellas: i }))}>★</span>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: "16px" }}>
                  <label style={labelS}>Comentario</label>
                  <textarea value={newVal.comentario} onChange={e => setNewVal(f => ({ ...f, comentario: e.target.value }))} placeholder="Escribe aquí la opinión del cliente..." style={{ ...inputS, minHeight: "90px", resize: "vertical", fontFamily: "inherit" }} />
                </div>
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  <button style={btnCancel} onClick={() => setShowNewVal(false)}>Cancelar</button>
                  <button style={{...btnGreen, opacity: (!newVal.nombre || !newVal.servicio || !newVal.comentario) ? 0.5 : 1, cursor: (!newVal.nombre || !newVal.servicio || !newVal.comentario) ? "not-allowed" : "pointer"}} onClick={addVal}>Guardar Opinión</button>
                </div>
              </div>
            )}

            <div
              style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px" }}
              onDragOver={e => e.preventDefault()}
            >
              {[...valoraciones].sort((a,b) => (a.orden??0) - (b.orden??0)).map((v, idx, arr) => (
                <div
                  key={v.id}
                  draggable={!editVal}
                  onDragStart={e => e.dataTransfer.setData("valId", String(v.id))}
                  onDrop={async e => {
                    e.preventDefault();
                    const origenId = Number(e.dataTransfer.getData("valId"));
                    if (origenId === v.id) return;
                    const lista = [...arr];
                    const desdeIdx = lista.findIndex(x => x.id === origenId);
                    const hastaIdx = lista.findIndex(x => x.id === v.id);
                    const nueva = [...lista];
                    const [mov] = nueva.splice(desdeIdx, 1);
                    nueva.splice(hastaIdx, 0, mov);
                    await reordenarValoraciones(nueva);
                  }}
                  style={{ ...cardS, padding: "0", marginBottom: 0, overflow: "hidden", cursor: editVal ? "default" : "grab" }}
                >
                  {editVal?.id === v.id ? (
                    <div style={{ ...cardS, border: "1px solid #93c5fd", background: "#f8fafc", margin: 0 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                        <div><label style={labelS}>Nombre</label><input style={inputS} value={editVal.nombre} onChange={e => setEditVal(f => ({ ...f, nombre: e.target.value }))} /></div>
                        <div>
                          <label style={labelS}>Servicio</label>
                          <select style={inputS} value={editVal.servicio} onChange={e => setEditVal(f => ({ ...f, servicio: e.target.value }))}>
                            <option value="">Seleccionar...</option>
                            {servicios.map(s => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{ marginBottom: "12px" }}>
                        <label style={labelS}>Valoración</label>
                        <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                          {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ fontSize: "30px", cursor: "pointer", color: i <= editVal.estrellas ? "#F59E0B" : "#D1D5DB" }} onClick={() => setEditVal(f => ({ ...f, estrellas: i }))}>★</span>)}
                        </div>
                      </div>
                      <div style={{ marginBottom: "16px" }}><label style={labelS}>Comentario</label><textarea value={editVal.comentario} onChange={e => setEditVal(f => ({ ...f, comentario: e.target.value }))} style={{ ...inputS, minHeight: "80px", resize: "vertical", fontFamily: "inherit" }} /></div>
                      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                        <button style={btnCancel} onClick={() => setEditVal(null)}>Cancelar</button>
                        <button style={btnGreen} onClick={saveEdit}>Guardar</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ cursor: "grab" }}>
                      {isMobile ? (
                        <div style={{ display: "flex", flexDirection: "column", padding: "16px", gap: "10px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-start" }}>
                              <span style={{ fontSize: "13px", fontWeight: "800", color: "#1e293b", textAlign: "left" }}>{v.nombre}</span>
                              <div style={{ display: "flex", gap: "2px" }}>
                                {Array.from({ length: 5 }).map((_, i) => <span key={i} style={{ fontSize: "12px", color: i < v.estrellas ? "#F59E0B" : "#D1D5DB" }}>★</span>)}
                              </div>
                              <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "600" }}>{v.servicio}</span>
                            </div>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button style={btnSquareEdit} onClick={() => setEditVal({ ...v })}>✏️</button>
                              <button style={btnSquareDel} onClick={() => setValBorrar({...v})}>🗑</button>
                            </div>
                          </div>
                          <p style={{ fontSize: "13px", color: "#475569", margin: "0 16px", fontStyle: "italic", lineHeight: "1.5", textAlign: "center", maxWidth: "280px", alignSelf: "center" }}>"{v.comentario}"</p>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", padding: "16px", gap: "12px", minHeight: "80px", position: "relative" }}>
                          <span style={{ color: "#cbd5e1", fontSize: "18px", cursor: "grab", flexShrink: 0 }}>⠿</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "160px", flexShrink: 0, alignItems: "flex-start" }}>
                            <span style={{ fontSize: "13px", fontWeight: "800", color: "#1e293b" }}>{v.nombre}</span>
                            <div style={{ display: "flex", gap: "2px" }}>
                              {Array.from({ length: 5 }).map((_, i) => <span key={i} style={{ fontSize: "12px", color: i < v.estrellas ? "#F59E0B" : "#D1D5DB" }}>★</span>)}
                            </div>
                            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "600" }}>{v.servicio}</span>
                          </div>
                          <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: "50%", textAlign: "center", pointerEvents: "none" }}>
                            <p style={{ fontSize: "13px", color: "#475569", margin: 0, fontStyle: "italic", lineHeight: "1.4" }}>"{v.comentario}"</p>
                          </div>
                          <div style={{ flex: 1 }} />
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
                            <button style={btnSquareEdit} onClick={() => setEditVal({ ...v })}>✏️</button>
                            <button style={btnSquareDel} onClick={() => setValBorrar({...v})}>🗑</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {valoraciones.length === 0 && <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8", fontSize: "14px", background: "#fff", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>No hay opiniones registradas.</div>}
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────── */}
        {/* TAB 3: HORARIOS */}
        {configSubTab === "horarios" && (
          <div className="anim" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: isMobile ? "10px" : "2%", alignItems: "start" }}>
            {CONFIG.peluqueros.map(p => (
              <div key={p.id} style={{ ...cardS, padding: 0, overflow: "hidden" }}>
                <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                
                {/* CABECERA DEL PELUQUERO */}
                <div style={{ background: "#f8fafc", padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "12px" }}>
                  <img src={p.foto} alt="" style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover", border: `2px solid ${p.color}` }} />
                  <span style={{ fontSize: "15px", fontWeight: "800", color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.5px" }}>{p.nombre}</span>
                </div>

                {/* TABLA DE HORARIOS ALINEADA */}
                <table style={{ width: "100%", minWidth: "360px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ ...thS, textAlign: "left", padding: "8px 6px 8px 10px" }}>Día</th>
                      <th style={{ ...thS, textAlign: "center", padding: "8px 6px" }}>Entrada</th>
                      <th style={{ ...thS, textAlign: "center", padding: "8px 6px" }}>Salida</th>
                      <th style={{ ...thS, textAlign: "center", padding: "8px 6px" }}>Descanso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5, 6].map(d => {
                      const h = p.horario[d];
                      return (
                        <tr key={d} style={{ transition: "0.2s" }}>
                          <td style={{ ...tdS, fontWeight: "700", color: "#334155", textAlign: "left", padding: "6px 6px 6px 10px", fontSize: "12px" }}>{DIAS_FULL[d]}</td>
                          <td style={{ ...tdS, textAlign: "center", fontWeight: h ? "600" : "400", color: h ? "#1e293b" : "#94a3b8", padding: "6px", fontSize: "12px" }}>{h ? h.entrada : "—"}</td>
                          <td style={{ ...tdS, textAlign: "center", fontWeight: h ? "600" : "400", color: h ? "#1e293b" : "#94a3b8", padding: "6px", fontSize: "12px" }}>{h ? h.salida : "—"}</td>
                          <td style={{ ...tdS, textAlign: "center", color: h?.descanso ? "#64748b" : "#94a3b8", padding: "6px", fontSize: "12px" }}>{h?.descanso ? `${h.descanso.inicio} - ${h.descanso.fin}` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            ))}
          </div>
        )}
        {svcBorrar && (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{background:"#fff",borderRadius:18,padding:"32px",width:"100%",maxWidth:400,boxShadow:"0 20px 60px rgba(0,0,0,.3)",textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:16}}>🗑</div>
              <h3 style={{fontSize:17,fontWeight:700,color:"#0D1F35",marginBottom:8}}>¿Eliminar este servicio?</h3>
              <p style={{fontSize:13,color:"#4A6080",marginBottom:6,fontWeight:700}}>{svcBorrar.nombre}</p>
              <p style={{fontSize:12,color:"#4A6080",marginBottom:24}}>{svcBorrar.duracionMin} min · {svcBorrar.precio} €</p>
              <div style={{display:"flex",gap:10}}>
                <button style={{flex:1,background:"#E0E8F2",border:"1px solid #CED9E8",borderRadius:11,padding:"12px 20px",fontSize:13,fontWeight:700,cursor:"pointer"}} onClick={() => setSvcBorrar(null)}>Cancelar</button>
                <button style={{flex:1,background:"linear-gradient(135deg,#dc2626,#b91c1c)",color:"#fff",border:"none",borderRadius:11,padding:"12px 20px",fontSize:13,fontWeight:700,cursor:"pointer"}} onClick={confirmarBorradoSvc}>Eliminar</button>
              </div>
            </div>
          </div>
        )}
        {catBorrar && (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{background:"#fff",borderRadius:18,padding:"32px",width:"100%",maxWidth:400,boxShadow:"0 20px 60px rgba(0,0,0,.3)",textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:16}}>🗑</div>
              <h3 style={{fontSize:17,fontWeight:700,color:"#0D1F35",marginBottom:8}}>¿Eliminar esta categoría?</h3>
              <p style={{fontSize:13,color:"#4A6080",marginBottom:24}}>Se eliminará <b>{catBorrar.nombre}</b> de la web y del flujo de reserva.</p>
              <div style={{display:"flex",gap:10}}>
                <button style={{flex:1,background:"#E0E8F2",border:"1px solid #CED9E8",borderRadius:11,padding:"12px 20px",fontSize:13,fontWeight:700,cursor:"pointer"}} onClick={() => setCatBorrar(null)}>Cancelar</button>
                <button style={{flex:1,background:"linear-gradient(135deg,#dc2626,#b91c1c)",color:"#fff",border:"none",borderRadius:11,padding:"12px 20px",fontSize:13,fontWeight:700,cursor:"pointer"}} onClick={confirmarBorradoCat}>Eliminar</button>
              </div>
            </div>
          </div>
        )}
        {valBorrar && (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{background:"#fff",borderRadius:18,padding:"32px",width:"100%",maxWidth:400,boxShadow:"0 20px 60px rgba(0,0,0,.3)",textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:16}}>🗑</div>
              <h3 style={{fontSize:17,fontWeight:700,color:"#0D1F35",marginBottom:8}}>¿Eliminar esta opinión?</h3>
              <p style={{fontSize:13,color:"#4A6080",marginBottom:24}}>{valBorrar.nombre} — "{valBorrar.comentario}"</p>
              <div style={{display:"flex",gap:10}}>
                <button style={{flex:1,background:"#E0E8F2",border:"1px solid #CED9E8",borderRadius:11,padding:"12px 20px",fontSize:13,fontWeight:700,cursor:"pointer"}} onClick={() => setValBorrar(null)}>Cancelar</button>
                <button style={{flex:1,background:"linear-gradient(135deg,#dc2626,#b91c1c)",color:"#fff",border:"none",borderRadius:11,padding:"12px 20px",fontSize:13,fontWeight:700,cursor:"pointer"}} onClick={async () => {
                  const copia = {...valBorrar};
                  setValoraciones(p => p.filter(x => x.id !== valBorrar.id));
                  await borrarValoracionFB(valBorrar);
                  setValBorrar(null);
                  onValEliminada(copia);
                }}>Eliminar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ──────────────────────
  // TAB COMUNICACIÓN (VISTA PREVIA ESTILO WHATSAPP)
  // ──────────────────────
  const TabComunicacion = () => {
    const msgs = [
      { icon: "✅", titulo: "Confirmación de reserva", cuando: "Inmediatamente al reservar", msg: `Hola [Nombre] 👋\nReserva confirmada en *${CONFIG.nombre}*\n\n✂️ [Servicio]\n💈 [Peluquero]\n📅 [Fecha]\n🕐 [Hora]\n💶 €[Precio]\n\nTe esperamos 😊` },
      { icon: "⏰", titulo: "Recordatorio 24h antes", cuando: "24h antes de la cita", msg: `Hola [Nombre] 👋\nMañana tienes cita en *${CONFIG.nombre}*\n\n✂️ [Servicio] con [Peluquero]\n🕐 [Hora]\n📍 ${CONFIG.direccion}\n\n¿Necesitas cancelar? Avísanos 🙏` },
      { icon: "⭐", titulo: "Mensaje post-cita", cuando: "24h después de la cita", msg: `Hola [Nombre]!\nEsperamos que hayas quedado genial 💈\n\n¿Cómo fue tu experiencia?\nTu opinión nos ayuda mucho 🙏` },
      { icon: "🔄", titulo: "Recordatorio de vuelta", cuando: "X semanas después", msg: `Hola [Nombre] 👋\n¿Toca pasar por *${CONFIG.nombre}*?\n\nReserva cuando quieras 😊\n👉 [Enlace reserva]` },
      { icon: "📊", titulo: "Resumen diario al dueño", cuando: "Cada mañana a las 8:00", msg: `*Resumen del día — ${CONFIG.nombre}*\n📅 [Fecha]\n\nCitas: [N] · Clara: [N] · Fernando: [N] · Marta: [N]\n💶 Ingresos previstos: €[Total]` },
      { icon: "🔔", titulo: "Aviso nueva reserva", cuando: "Cada vez que alguien reserva", msg: `*Nueva reserva 🎉*\n\n👤 [Cliente] · ✂️ [Servicio]\n💈 [Peluquero] · 📅 [Fecha] 🕐 [Hora]` },
    ];

    return (
      <div style={{ width: "100%", margin: "0 auto", textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: "40px", marginBottom: "16px" }}>🚧</div>
        <div style={{ fontSize: "16px", fontWeight: "700", color: TX, marginBottom: "8px" }}>Próximamente</div>
        <div style={{ fontSize: "13px", color: TX2 }}>Esta sección está en desarrollo.</div>
      </div>
    );
  };

// 1. EL ARRAY DE PESTAÑAS
  const tabs = [
    ["citas", "https://i.postimg.cc/FK40ZMS2/citas.jpg", "Citas"],
    ["clientes", "https://i.postimg.cc/TP6n9zmx/clientes.png", "Clientes"],
    ["caja", "https://i.postimg.cc/LspjTcfp/caja.webp", "Caja"],
    ["stats", "https://i.postimg.cc/vms5zJ9d/estadisticas.webp", "Estadísticas"],
    ["disponibilidad", "https://i.postimg.cc/jjjnZPvj/disponibilidad.png", "Disponibilidad"],
    ["config", "https://i.postimg.cc/0QYvSHmr/configuracion.jpg", "Configuración"],
    ["comunicacion", "https://i.postimg.cc/0Ns7fTmg/whatsapp.jpg", "WhatsApp"]
  ];

  // --- PANEL DE CONTROL DE ESPACIOS DEL MENÚ ---
  const TAB_ST = {
    // 1. DIMENSIONES DE LA BARRA GENERAL
    alturaTotal: "60px",            // Altura total del menú (El espaciador se ajustará solo a lo que pongas aquí)
    espacioLateralPantalla: "5%",   // Distancia del menú a los bordes del móvil/pantalla
    
    // 2. ESPACIOS DENTRO DE CADA PESTAÑA
    distanciaTecho: "5px",          // Distancia entre la imagen y el borde de arriba
    distanciaSuelo: "5px",          // Distancia entre el texto y la línea azul de abajo
    separacionImagenTexto: "5px",   // Separación vertical entre la imagen y la palabra
    espacioLateralBoton: "8px",     // Espacio a los lados de cada botón (para que no se peguen unos a otros)
    
    // 3. TAMAÑOS
    anchoMinimoBoton: "7%",       // Anchura mínima del botón para que no se apachurre el texto
    tamanoImagen: "20px",           // Tamaño (ancho y alto) de las imágenes
    tamanoTexto: "12px"             // Tamaño de la letra
  };

  return (
    <div style={as.root}>
      
      {/* HEADER DEL ADMIN FIJO */}
      <div 
        ref={el=>{if(el) document.documentElement.style.setProperty('--header-h',el.offsetHeight+'px')}}
        style={{ 
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
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.05)",
          boxSizing: "border-box" 
        }}
      >
        <div style={{display:"flex",alignItems:"center",gap:15}}>
          <div style={{width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center"}}>
            <img 
              src="https://i.postimg.cc/4xxWbVq0/postepelu.webp" 
              alt="Logo Peluquería" 
              style={{ width: "100%", height: "100%", objectFit: "contain" }} 
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "3px" }}>
              <span style={{fontSize: 17, fontWeight: 700, color: TX, lineHeight: 1, margin: 0}}>{CONFIG.nombre}</span>
              <span style={{fontSize: 10, fontWeight: 800, color: A, letterSpacing: "0.5px", lineHeight: 1, margin: 0}}>PANEL DE ADMINISTRADOR</span>
            </div>
            
            <span className="hide-mobile" style={{ fontSize: 13, fontWeight: 500, color: TX2, borderLeft: `1px solid ${CR3}`, paddingLeft: 15, height: "24px", display: "flex", alignItems: "center" }}>
              {fmtLarga(HOY)}
            </span>
          </div>
        </div>
        
        <div style={{ display: "flex", alignItems: "center" }}>
          <button 
            style={{
              background:CR2,
              border:`1px solid ${CR3}`,
              borderRadius:"8px",
              padding:"8px 16px",
              fontSize:"13px", 
              fontWeight: 600, 
              color:TX2,
              cursor:"pointer",
              transition: "all 0.2s ease"
            }} 
            onClick={handleLogout}
          >
            Cerrar sesión →
          </button>
        </div>
      </div>
      
      {/* MENÚ DE PESTAÑAS FIJO (Totalmente Controlable desde TAB_ST) */}
      <div style={{
        position: "fixed",
        top: "70px",
        left: 0,
        right: 0,
        height: TAB_ST.alturaTotal, 
        background: WH,
        display: "flex",
        justifyContent: isMobile ? "flex-start" : "space-between",
        alignItems: "center",
        borderBottom: `1px solid ${CR3}`,
        boxShadow: "0 4px 10px rgba(0,0,0,0.03)",
        zIndex: 1990,
        padding: `0 ${TAB_ST.espacioLateralPantalla}`, 
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        msOverflowStyle: "none"
      }}>
        {tabs.map(([id, imgUrl, label]) => (
          <div 
            key={id}
            onClick={() => setTab(id)} 
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: TAB_ST.separacionImagenTexto,
              cursor: "pointer",
              minWidth: isMobile ? "70px" : TAB_ST.anchoMinimoBoton,
              flexShrink: 0,
              height: "100%",
              paddingTop: TAB_ST.distanciaTecho,
              paddingBottom: TAB_ST.distanciaSuelo,
              paddingLeft: TAB_ST.espacioLateralBoton,
              paddingRight: TAB_ST.espacioLateralBoton,
              boxSizing: "border-box",
              borderBottom: tab === id ? `3px solid ${A}` : "3px solid transparent",
              color: tab === id ? A : TX2,
              transition: "all 0.2s ease"
            }}
          >
            <div style={{ width: TAB_ST.tamanoImagen, height: TAB_ST.tamanoImagen, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img 
                src={imgUrl} 
                alt={label} 
                style={{ width: "100%", height: "100%", objectFit: "contain", opacity: tab === id ? 1 : 0.4 }} 
              />
            </div>
            <span style={{ fontSize: TAB_ST.tamanoTexto, fontWeight: 700, whiteSpace: "nowrap", lineHeight: 1 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* NUEVO ESPACIADOR INTELIGENTE: Suma él solo 70px + la altura que le pongas al menú */}
      <div style={{ height: `calc(70px + ${TAB_ST.alturaTotal})`, width: "100%" }}></div>

      {/* CUERPO CENTRAL DEL PANEL */}
      <div className="admin-body" style={{...as.body, margin:"0 auto"}}>
        {tab==="citas"&&<TabCitas/>}
        {tab==="clientes"&&<TabClientes isMobile={isMobile} onClienteEliminado={(cliente)=>{ _clienteEliminadoTemp=cliente; setToastClienteVisible(true); if(toastClienteTimer)clearTimeout(toastClienteTimer); const t=setTimeout(()=>{setToastClienteVisible(false);_clienteEliminadoTemp=null;},6000); setToastClienteTimer(t); }}/>}
        {tab==="caja"&&<TabCaja/>}
        {tab==="stats"&&<TabStats/>}
        {tab==="disponibilidad"&&<TabDisponibilidad isMobile={isMobile} horariosEspeciales={horariosEspeciales} horariosGenerales={horariosGenerales}/>}
        {tab==="config"&&<TabConfig valoraciones={valoraciones} setValoraciones={setValoraciones} servicios={servicios} setServicios={setServicios} categorias={categorias} setCategorias={setCategorias} isMobile={isMobile} onValEliminada={(val)=>{ _valEliminadaTemp=val; setToastValVisible(true); if(toastValTimer)clearTimeout(toastValTimer); const t=setTimeout(()=>{setToastValVisible(false);_valEliminadaTemp=null;},6000); setToastValTimer(t); }} onSvcEliminado={(svc)=>{ _svcEliminadoTemp=svc; setToastSvcVisible(true); if(toastSvcTimer)clearTimeout(toastSvcTimer); const t=setTimeout(()=>{setToastSvcVisible(false);_svcEliminadoTemp=null;},6000); setToastSvcTimer(t); }} onCatEliminada={(cat)=>{ _catEliminadaTemp=cat; setToastCatVisible(true); if(toastCatTimer)clearTimeout(toastCatTimer); const t=setTimeout(()=>{setToastCatVisible(false);_catEliminadaTemp=null;},6000); setToastCatTimer(t); }}/>}
        {tab==="comunicacion"&&<TabComunicacion/>}
      </div>

      {/* NOTIFICACIONES EMERGENTES (TOASTS) */}
      {toastVisible&&(
        <div style={{position:"fixed",bottom:30,left:"50%",transform:"translateX(-50%)",background:"#1e293b",color:WH,borderRadius:12,padding:"14px 20px",display:"flex",alignItems:"center",gap:16,boxShadow:"0 8px 24px rgba(0,0,0,.3)",zIndex:200,fontSize:13,whiteSpace:"nowrap"}}>
          <span>🗑 Cita eliminada</span>
          <button style={{background:A,color:WH,border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={async()=>{ 
            if(!_citaEliminadaTemp)return; 
            const{id,...resto}=_citaEliminadaTemp; 
            await crearCita(resto);
            if(resto.clienteTel && resto.estado==="completada"){
              const docId=resto.clienteNombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/gi,"_")+"_"+resto.clienteTel;
              const ref=doc(db,"clientes",docId);
              const snap=await getDoc(ref);
              if(snap.exists()){
                const cl=snap.data();
                await updateDoc(ref,{
                  visitas:(cl.visitas||0)+1,
                  gasto:(cl.gasto||0)+resto.precio,
                  ultimaVisita:resto.fecha,
                  historial:[...(cl.historial||[]),{fecha:resto.fecha,servicio:resto.servicio,peluquero:resto.peluquero,precio:resto.precio}]
                });
              }
            }
            _citaEliminadaTemp=null; 
            setToastVisible(false); 
            if(toastTimer)clearTimeout(toastTimer); 
          }}>Deshacer</button>
        </div>
      )}
      {toastClienteVisible&&(
        <div style={{position:"fixed",bottom:30,left:"50%",transform:"translateX(-50%)",background:"#1e293b",color:WH,borderRadius:12,padding:"14px 20px",display:"flex",alignItems:"center",gap:16,boxShadow:"0 8px 24px rgba(0,0,0,.3)",zIndex:200,fontSize:13,whiteSpace:"nowrap"}}>
          <span>🗑 Cliente eliminado</span>
          <button style={{background:A,color:WH,border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={async()=>{ if(!_clienteEliminadoTemp)return; const{id,...resto}=_clienteEliminadoTemp; const docId=resto.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/gi,"_")+"_"+resto.telefono; await setDoc(doc(db,"clientes",docId),resto); _clienteEliminadoTemp=null; setToastClienteVisible(false); if(toastClienteTimer)clearTimeout(toastClienteTimer); }}>Deshacer</button>
        </div>
      )}
      {toastValVisible&&(
        <div style={{position:"fixed",bottom:30,left:"50%",transform:"translateX(-50%)",background:"#1e293b",color:WH,borderRadius:12,padding:"14px 20px",display:"flex",alignItems:"center",gap:16,boxShadow:"0 8px 24px rgba(0,0,0,.3)",zIndex:200,fontSize:13,whiteSpace:"nowrap"}}>
          <span>🗑 Opinión eliminada</span>
          <button style={{background:A,color:WH,border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={async()=>{ if(!_valEliminadaTemp)return; await guardarValoracionFB(_valEliminadaTemp); _valEliminadaTemp=null; setToastValVisible(false); if(toastValTimer)clearTimeout(toastValTimer); }}>Deshacer</button>
        </div>
      )}
      {toastSvcVisible&&(
        <div style={{position:"fixed",bottom:30,left:"50%",transform:"translateX(-50%)",background:"#1e293b",color:WH,borderRadius:12,padding:"14px 20px",display:"flex",alignItems:"center",gap:16,boxShadow:"0 8px 24px rgba(0,0,0,.3)",zIndex:200,fontSize:13,whiteSpace:"nowrap"}}>
          <span>🗑 Servicio eliminado</span>
          <button style={{background:A,color:WH,border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={async()=>{ if(!_svcEliminadoTemp)return; await guardarServicioFB(_svcEliminadoTemp); setServicios(prev=>[...prev,_svcEliminadoTemp].filter(Boolean).sort((a,b)=>a.id-b.id)); _svcEliminadoTemp=null; setToastSvcVisible(false); if(toastSvcTimer)clearTimeout(toastSvcTimer); }}>Deshacer</button>
        </div>
      )}
      {toastCatVisible&&(
        <div style={{position:"fixed",bottom:30,left:"50%",transform:"translateX(-50%)",background:"#1e293b",color:WH,borderRadius:12,padding:"14px 20px",display:"flex",alignItems:"center",gap:16,boxShadow:"0 8px 24px rgba(0,0,0,.3)",zIndex:200,fontSize:13,whiteSpace:"nowrap"}}>
          <span>🗑 Categoría eliminada</span>
          <button style={{background:A,color:WH,border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={async()=>{ if(!_catEliminadaTemp)return; await guardarCategoriaFB(_catEliminadaTemp); setCategorias(prev=>[...prev,_catEliminadaTemp].filter(Boolean).sort((a,b)=>a.id-b.id)); _catEliminadaTemp=null; setToastCatVisible(false); if(toastCatTimer)clearTimeout(toastCatTimer); }}>Deshacer</button>
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
  const [servicios,setServicios]=useState([]);
  const [categorias,setCategorias]=useState([]);
  const [horariosEspeciales,setHorariosEspeciales]=useState([]);
  const [horariosGenerales,setHorariosGenerales]=useState([]);
  const [cargando,setCargando]=useState(true);
  const [iniciado,setIniciado]=useState(false);

  // 1. NUEVOS HOOKS PARA EL CARRUSEL (Puestos aquí para evitar el error)
  const sliderRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  const [sliderAtStart, setSliderAtStart] = useState(true);
  const [sliderAtEnd, setSliderAtEnd] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile(); 
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const scrollSlider = (dir) => {
    if (sliderRef.current && sliderRef.current.children.length > 0) {
      const cardWidth = sliderRef.current.children[0].offsetWidth;
      const gap = 24; // Mismo gap que el CSS
      const cardsToScroll = isMobile ? 1 : 3; // En móvil pasa 1, en PC pasa 3
      const amount = (cardWidth + gap) * cardsToScroll; 
      sliderRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
    }
  };

  // 2. SUSCRIPCIONES FIREBASE
  useEffect(()=>{
    const u1=suscribirCitas(data=>{setCitas(data);setCargando(false);});
    const u2=suscribirValoracionesFB(setValoraciones);
    const u3=suscribirFestivos(setFestivos);
    const u4=suscribirBloqueos(setBloqueos);
    const u5=suscribirServicios(data=>{ setServicios(data); });
    const u6=suscribirCategorias(data=>{ setCategorias(data); });
    const u7=suscribirHorariosEspeciales(setHorariosEspeciales);
    const u8=suscribirHorariosGenerales(setHorariosGenerales);
      const t=setTimeout(()=>setCargando(false),5000);
      return()=>{ u1();u2();u3();u4();u5();u6();u7();u8();clearTimeout(t); };
  },[]);

  // 3. PANTALLA DE CARGA (El if debe ir DESPUÉS de todos los hooks)
  if(cargando) return(
    <div className="cliente-wrap" style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#F8FBFF",fontFamily:FONT}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:40,marginBottom:16}}>✂️</div>
        <div style={{fontSize:16,fontWeight:700,color:"#0D1F35"}}>Cargando...</div>
        <div style={{fontSize:12,color:"#4A6080",marginTop:8}}>Conectando con Firebase</div>
      </div>
    </div>
  );

  // ESTE ES EL FINAL DE TU FUNCIÓN AppData
  const sharedProps = { valoraciones, setValoraciones, citas, festivos, setFestivos, bloqueos, setBloqueos, servicios, setServicios, categorias, setCategorias, sliderRef, isMobile, scrollSlider, sliderAtStart, setSliderAtStart, sliderAtEnd, setSliderAtEnd, horariosEspeciales, setHorariosEspeciales, horariosGenerales, setHorariosGenerales };

  return (
    <Routes>
      {/* Fíjate cómo ahora le pasamos sharedProps={sharedProps} pero sin BrowserRouter */}
      <Route path="/" element={<ClientePage sharedProps={sharedProps} />} />
      <Route path="/reservar" element={<ClientePage sharedProps={sharedProps} />} />
      <Route path="/reservar/:serviceId" element={<ClientePage sharedProps={sharedProps} />} />
      <Route path="/admin" element={<AdminPage {...sharedProps} />} />
      <Route path="/login" element={<LoginPage />} />
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