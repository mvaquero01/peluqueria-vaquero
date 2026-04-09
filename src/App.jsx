import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { db } from "./firebase.js";
import { seedDatabase } from "./seed.js";
import {
  suscribirCitas, suscribirClientes, suscribirValoraciones,
  crearCita, actualizarCita, crearCliente, actualizarCliente,
  crearValoracion, actualizarValoracion, borrarValoracion
} from "./db.js";

// ── También necesitamos funciones para festivos y bloqueos en Firebase ──
// Si no las tienes en db.js, las añadimos aquí usando Firebase directamente
import { collection, onSnapshot, addDoc, deleteDoc, doc, setDoc, query, where, getDocs, updateDoc, getDoc } from "firebase/firestore";

const STYLE = document.createElement("style");
STYLE.textContent = `
  @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
  .anim { animation: fadeUp 0.5s ease both; }
  .anim-fade { animation: fadeIn 0.4s ease both; }
  * { box-sizing: border-box; margin:0; padding:0; }
  html, body { margin:0; padding:0; background: #F8FBFF; width:100%; }
  #root { background: #F8FBFF; }

  /* ── Responsive layout ── */
  .cliente-root { 
    width: 100%; 
    min-height: 100vh;
    background: #F0F4F9;
    display: flex;
    justify-content: center;
  }
  .cliente-inner {
    width: 100%;
    max-width: 560px;
    min-height: 100vh;
    background: #F8FBFF;
    box-shadow: 0 0 60px rgba(0,0,0,0.10);
  }
  @media (min-width: 900px) {
    .cliente-inner { max-width: 680px; }
  }
  @media (min-width: 1200px) {
    .cliente-inner { max-width: 760px; }
  }

  /* ── Admin responsive ── */
  @media (max-width: 640px) {
    .admin-kpi-grid { grid-template-columns: repeat(2,1fr) !important; }
    .admin-two-col  { grid-template-columns: 1fr !important; }
    .admin-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .admin-body { padding: 10px 8px !important; }
    .hide-mobile { display: none !important; }
  }

  /* ── Calendario admin: cabeceras de días ── */
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
  }
  .cal-day-col {
    flex: 1;
    min-width: 130px;
    border-right: 1px solid #CED9E8;
    display: flex;
    flex-direction: column;
  }

  /* ── Mini calendario picker ── */
  .mini-cal { user-select: none; }
  .mini-cal-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 2px; }
  .mini-cal-cell {
    aspect-ratio: 1;
    display: flex; align-items: center; justify-content: center;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    font-weight: 500;
  }
  .mini-cal-cell:hover:not([disabled]) { background: #E0E8F2; }
  .mini-cal-cell[disabled] { opacity: 0.3; cursor: default; }
  .mini-cal-cell.selected { background: linear-gradient(135deg,#1B4F8A,#133A6A) !important; color: #fff !important; font-weight: 700; }
  .mini-cal-cell.today { outline: 2px solid #1B4F8A; outline-offset: -2px; }
  .mini-cal-cell.festivo { color: #dc2626; opacity: 0.4; cursor: default; }

  /* ── WhatsApp FAB ── */
  .wa-fab {
    position: fixed; bottom: 24px; right: 20px;
    width: 54px; height: 54px;
    background: #25D366;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 16px rgba(37,211,102,0.55);
    z-index: 50;
    text-decoration: none;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .wa-fab:hover { transform: scale(1.1); box-shadow: 0 6px 24px rgba(37,211,102,0.7); }
`;
document.head.appendChild(STYLE);

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════
const CONFIG = {
  nombre: "Peluquería Vaquero",
  slogan: "El detalle marca la diferencia",
  direccion: "Av. Diagonal 647, Barcelona",
  telefono: "999 123 456",
  whatsapp: "34999123456",
  color: "#B8860B",
  adminUser: "admin",
  adminPass: "admin123",
  semanasSinVisita: 5,
  googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=Av.+Diagonal+647+Barcelona",

  categorias: [
    { id:1, nombre:"Corte",        emoji:"✂️", servicioIds:[1,4] },
    { id:2, nombre:"Barba",        emoji:"🪒", servicioIds:[2,3] },
    { id:3, nombre:"Color",        emoji:"🎨", servicioIds:[5,6,7] },
    { id:4, nombre:"Tratamientos", emoji:"💆", servicioIds:[8,9] },
    { id:5, nombre:"Extras",       emoji:"✨", servicioIds:[10] },
  ],

  horarioGeneral: {
    1:{apertura:"09:00",cierre:"20:00"}, 2:{apertura:"09:00",cierre:"20:00"},
    3:{apertura:"09:00",cierre:"20:00"}, 4:{apertura:"09:00",cierre:"20:00"},
    5:{apertura:"09:00",cierre:"20:30"}, 6:{apertura:"09:00",cierre:"15:00"},
  },

  servicios: [
    {id:1,  nombre:"Corte de cabello",    desc:"Lavado, corte personalizado y secado a tu estilo",              duracionMin:30,  precio:15, emoji:"✂️"},
    {id:2,  nombre:"Corte + Barba",       desc:"Corte completo más arreglo y perfilado de barba",               duracionMin:50,  precio:22, emoji:"🪒"},
    {id:3,  nombre:"Arreglo de barba",    desc:"Perfilado, recorte y afeitado con cuchilla caliente",           duracionMin:20,  precio:10, emoji:"🧔"},
    {id:4,  nombre:"Fade / Degradado",    desc:"Degradado progresivo con máquina y acabado a tijera",           duracionMin:40,  precio:18, emoji:"💈"},
    {id:5,  nombre:"Coloración completa", desc:"Tinte de raíz a puntas con producto profesional",               duracionMin:90,  precio:45, emoji:"🎨"},
    {id:6,  nombre:"Mechas / Highlights", desc:"Mechas balayage o californiana para un look natural",           duracionMin:120, precio:65, emoji:"✨"},
    {id:7,  nombre:"Alisado keratina",    desc:"Alisado duradero que elimina el frizz hasta 4 meses",           duracionMin:150, precio:80, emoji:"💆"},
    {id:8,  nombre:"Lavado + Secado",     desc:"Lavado con mascarilla nutritiva y secado profesional",          duracionMin:25,  precio:8,  emoji:"🚿"},
    {id:9,  nombre:"Tratamiento capilar", desc:"Tratamiento hidratante o reparador según el tipo de cabello",   duracionMin:45,  precio:25, emoji:"🌿"},
    {id:10, nombre:"Diseño de cejas",     desc:"Depilación, perfilado y diseño adaptado a tu rostro",           duracionMin:20,  precio:12, emoji:"👁️"},
  ],

  peluqueros: [
    { id:1, nombre:"Clara", especialidad:"Corte clásico & Barba", emoji:"✂️", color:"#E63946", password:"clara123",
      horario:{
        1:{entrada:"09:00",salida:"18:00",descanso:{inicio:"14:00",fin:"15:00"}},
        2:{entrada:"09:00",salida:"18:00",descanso:{inicio:"14:00",fin:"15:00"}},
        3:{entrada:"09:00",salida:"18:00",descanso:{inicio:"14:00",fin:"15:00"}},
        4:{entrada:"09:00",salida:"18:00",descanso:{inicio:"14:00",fin:"15:00"}},
        5:{entrada:"09:00",salida:"18:00",descanso:{inicio:"14:00",fin:"15:00"}},
      }},
    { id:2, nombre:"Fernando", especialidad:"Fade & Degradados", emoji:"🪒", color:"#2A9D8F", password:"fernando123",
      horario:{
        1:{entrada:"12:00",salida:"20:00",descanso:{inicio:"16:00",fin:"17:00"}},
        2:{entrada:"12:00",salida:"20:00",descanso:{inicio:"16:00",fin:"17:00"}},
        3:{entrada:"12:00",salida:"20:00",descanso:{inicio:"16:00",fin:"17:00"}},
        4:{entrada:"12:00",salida:"20:00",descanso:{inicio:"16:00",fin:"17:00"}},
        5:{entrada:"12:00",salida:"20:30",descanso:null},
        6:{entrada:"09:00",salida:"15:00",descanso:null},
      }},
    { id:3, nombre:"Marta", especialidad:"Coloración & Tendencias", emoji:"🎨", color:"#E9C46A", password:"marta123",
      horario:{
        2:{entrada:"09:00",salida:"17:00",descanso:{inicio:"13:30",fin:"14:30"}},
        3:{entrada:"09:00",salida:"17:00",descanso:{inicio:"13:30",fin:"14:30"}},
        4:{entrada:"09:00",salida:"17:00",descanso:{inicio:"13:30",fin:"14:30"}},
        5:{entrada:"09:00",salida:"20:30",descanso:{inicio:"14:00",fin:"15:00"}},
        6:{entrada:"09:00",salida:"15:00",descanso:null},
      }},
  ],
};

// ═══════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════
const toMin = h => { const [hh,mm]=h.split(":").map(Number); return hh*60+mm; };
const toStr = m => `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
const DIAS_ES   = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const DIAS_FULL = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const MESES_ES  = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const MESES_FULL= ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const normalize = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();

// Fecha local sin desfase UTC
const isoDate = d => {
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), dd=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
};
const fmtLarga = d => `${DIAS_FULL[d.getDay()]} ${d.getDate()} de ${MESES_ES[d.getMonth()]}`;
const haceNSemanas = n => { const d=new Date(); d.setDate(d.getDate()-n*7); return isoDate(d); };
const HOY = new Date(); HOY.setHours(0,0,0,0);
const HOY_ISO = isoDate(HOY);
let _citaEliminadaTemp = null;
let _clienteEliminadoTemp = null;

function levenshtein(a,b){
  const m=a.length,n=b.length;
  const dp=Array.from({length:m+1},(_,i)=>Array.from({length:n+1},(_,j)=>i===0?j:j===0?i:0));
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++)
    dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  return dp[m][n];
}
function similitud(query,nombre){
  const q=normalize(query),n=normalize(nombre);
  if(!q)return 100; if(q===n)return 100;
  if(n.startsWith(q)||q.startsWith(n))return 95;
  if(n.includes(q)||q.includes(n))return 88;
  return Math.max(0,Math.round((1-levenshtein(q,n)/Math.max(q.length,n.length))*100));
}

function generarSlots(hp, durMin){
  const slots=[]; let cur=toMin(hp.entrada);
  const fin=toMin(hp.salida)-durMin;
  while(cur<=fin){
    const finSlot=cur+durMin;
    if(hp.descanso){
      const dI=toMin(hp.descanso.inicio),dF=toMin(hp.descanso.fin);
      if(cur<dF&&finSlot>dI){cur=dF;continue;}
    }
    slots.push(toStr(cur)); cur+=15;
  }
  return slots;
}

function filtrarSlotsOcupados(slots, durMin, citasDelDia){
  return slots.filter(slot=>{
    const sI=toMin(slot), sF=sI+durMin;
    return !citasDelDia.some(c=>{
      const svc=CONFIG.servicios.find(s=>s.id===c.servicioId)||{duracionMin:30};
      const cI=toMin(c.hora), cF=cI+svc.duracionMin;
      return sI<cF && sF>cI;
    });
  });
}

// ── Comprueba si un peluquero está bloqueado en una fecha ──
function peluqueroEstaBloquedado(pelId, fechaISO, bloqueos){
  return bloqueos.some(b=>{
    if(Number(b.peluqueroId)!==pelId) return false;
    return fechaISO>=b.desde && fechaISO<=b.hasta;
  });
}

function getWeekDays(offset=0){
  const hoy=new Date(); hoy.setHours(0,0,0,0);
  const dow=hoy.getDay();
  const mon=new Date(hoy);
  mon.setDate(hoy.getDate()-(dow===0?6:dow-1)+offset*7);
  return Array.from({length:6},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d;});
}

function getCalendarWeeks(){
  const hoy=new Date(); hoy.setHours(0,0,0,0);
  const dow=hoy.getDay();
  const lunes=new Date(hoy);
  lunes.setDate(hoy.getDate()-(dow===0?6:dow-1));
  const semanas=[];
  for(let s=0;s<3;s++){
    const sem=[];
    for(let d=0;d<7;d++){
      const dia=new Date(lunes); dia.setDate(lunes.getDate()+s*7+d); sem.push(dia);
    }
    semanas.push(sem);
  }
  return semanas;
}

// ═══════════════════════════════════════════════════════════════
// FIREBASE helpers para festivos y bloqueos
// ═══════════════════════════════════════════════════════════════
function suscribirFestivos(cb){
  return onSnapshot(collection(db,"festivos"), snap=>{
    cb(snap.docs.map(d=>({...d.data(), id:d.id})));
  });
}
async function crearFestivo(data){ await addDoc(collection(db,"festivos"),data); }
async function borrarFestivo(id){ await deleteDoc(doc(db,"festivos",id)); }

function suscribirBloqueos(cb){
  return onSnapshot(collection(db,"bloqueos"), snap=>{
    cb(snap.docs.map(d=>({...d.data(), id:d.id})));
  });
}
async function crearBloqueo(data){ await addDoc(collection(db,"bloqueos"),data); }
async function borrarBloqueo(id){ await deleteDoc(doc(db,"bloqueos",id)); }
async function borrarCita(id){
  // Obtener datos de la cita antes de borrarla
  const citaSnap = await getDoc(doc(db,"citas",id));
  if(citaSnap.exists()){
    const cita = citaSnap.data();
    // Buscar cliente por teléfono
    if(cita.clienteTel){
      const q = query(collection(db,"clientes"), where("telefono","==",cita.clienteTel));
      const clienteSnap = await getDocs(q);
      if(!clienteSnap.empty){
        const clienteDoc = clienteSnap.docs[0];
        const cliente = clienteDoc.data();
        const nuevoHistorial = (cliente.historial||[]).filter(h=>!(h.fecha===cita.fecha&&h.servicio===cita.servicio&&h.peluquero===cita.peluquero));
        const nuevasVisitas = Math.max((cliente.visitas||1)-1, 0);
        const nuevoGasto = Math.max((cliente.gasto||0)-cita.precio, 0);
        if(nuevasVisitas===0){
          await deleteDoc(doc(db,"clientes",clienteDoc.id));
        } else {
          const ultimaVisita = nuevoHistorial.length>0 ? nuevoHistorial[nuevoHistorial.length-1].fecha : '';
          await updateDoc(doc(db,"clientes",clienteDoc.id),{
            visitas: nuevasVisitas,
            gasto: nuevoGasto,
            historial: nuevoHistorial,
            ultimaVisita
          });
        }
      }
    }
  }
  await deleteDoc(doc(db,"citas",id));
}
async function crearOActualizarCliente(datos){
  const q=query(collection(db,"clientes"),where("telefono","==",datos.telefono));
  const snap=await getDocs(q);
  if(!snap.empty){
    const docExist=snap.docs[0];
    const actual=docExist.data();
    await updateDoc(doc(db,"clientes",docExist.id),{
      visitas:(actual.visitas||0)+1,
      gasto:(actual.gasto||0)+datos.gasto,
      ultimaVisita:datos.ultimaVisita,
      historial:[...(actual.historial||[]),...datos.historial]
    });
  } else {
    await addDoc(collection(db,"clientes"),datos);
  }
}

// ═══════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════
const semana=getWeekDays();
const CITAS_INIT=[
  {id:"c1", clienteNombre:"María García",    clienteTel:"611111111", servicio:"Corte de cabello",    servicioId:1,  peluqueroId:1, peluquero:"Clara", fecha:HOY_ISO,            hora:"09:30", precio:15, estado:"completada", nota:""},
  {id:"c2", clienteNombre:"Juan López",      clienteTel:"622222222", servicio:"Fade / Degradado",    servicioId:4,  peluqueroId:2, peluquero:"Fernando", fecha:HOY_ISO,            hora:"12:30", precio:18, estado:"completada", nota:""},
  {id:"c3", clienteNombre:"Sofía Martín",    clienteTel:"633333333", servicio:"Coloración completa", servicioId:5,  peluqueroId:3, peluquero:"Marta", fecha:HOY_ISO,            hora:"10:30", precio:45, estado:"pendiente",  nota:""},
  {id:"c4", clienteNombre:"Pedro Ruiz",      clienteTel:"644444444", servicio:"Corte de cabello",    servicioId:1,  peluqueroId:1, peluquero:"Clara", fecha:HOY_ISO,            hora:"11:00", precio:15, estado:"pendiente",  nota:""},
  {id:"c5", clienteNombre:"Laura Sánchez",   clienteTel:"655555555", servicio:"Mechas / Highlights", servicioId:6,  peluqueroId:3, peluquero:"Marta", fecha:HOY_ISO,            hora:"11:00", precio:65, estado:"pendiente",  nota:""},
  {id:"c6", clienteNombre:"Carlos Fdez.",    clienteTel:"666666666", servicio:"Arreglo de barba",    servicioId:3,  peluqueroId:2, peluquero:"Fernando", fecha:HOY_ISO,            hora:"13:00", precio:10, estado:"no-show",    nota:""},
  {id:"c7", clienteNombre:"Ana Torres",      clienteTel:"677777777", servicio:"Tratamiento capilar", servicioId:9,  peluqueroId:3, peluquero:"Marta", fecha:HOY_ISO,            hora:"14:30", precio:25, estado:"pendiente",  nota:""},
  {id:"c8", clienteNombre:"Rubén Díaz",      clienteTel:"688888888", servicio:"Corte + Barba",       servicioId:2,  peluqueroId:1, peluquero:"Clara", fecha:HOY_ISO,            hora:"16:00", precio:22, estado:"pendiente",  nota:""},
  {id:"c9", clienteNombre:"Isabel Rey",      clienteTel:"691111111", servicio:"Corte de cabello",    servicioId:1,  peluqueroId:1, peluquero:"Clara", fecha:isoDate(semana[1]), hora:"10:00", precio:15, estado:"pendiente",  nota:""},
  {id:"c10",clienteNombre:"Marcos Gil",      clienteTel:"692222222", servicio:"Corte + Barba",       servicioId:2,  peluqueroId:2, peluquero:"Fernando", fecha:isoDate(semana[1]), hora:"13:00", precio:22, estado:"pendiente",  nota:""},
  {id:"c11",clienteNombre:"Elena Vega",      clienteTel:"693333333", servicio:"Alisado keratina",    servicioId:7,  peluqueroId:3, peluquero:"Marta", fecha:isoDate(semana[2]), hora:"09:30", precio:80, estado:"pendiente",  nota:""},
  {id:"c12",clienteNombre:"Roberto Cas.",    clienteTel:"694444444", servicio:"Fade / Degradado",    servicioId:4,  peluqueroId:2, peluquero:"Fernando", fecha:isoDate(semana[3]), hora:"12:30", precio:18, estado:"pendiente",  nota:""},
  {id:"c13",clienteNombre:"Carmen Lara",     clienteTel:"695555555", servicio:"Mechas / Highlights", servicioId:6,  peluqueroId:3, peluquero:"Marta", fecha:isoDate(semana[4]), hora:"10:00", precio:65, estado:"pendiente",  nota:""},
  {id:"c14",clienteNombre:"David Mora",      clienteTel:"696666666", servicio:"Corte de cabello",    servicioId:1,  peluqueroId:1, peluquero:"Clara", fecha:isoDate(semana[5]), hora:"09:30", precio:15, estado:"pendiente",  nota:""},
];
const CLIENTES_INIT=[
  {nombre:"María García",  telefono:"611111111",visitas:12,gasto:280,ultimaVisita:HOY_ISO,         nota:"Alérgica al amoniaco. Prefiere a Clara.",historial:[{fecha:HOY_ISO,servicio:"Corte de cabello",peluquero:"Clara",precio:15}]},
  {nombre:"Juan López",    telefono:"622222222",visitas:8, gasto:160,ultimaVisita:HOY_ISO,         nota:"",historial:[]},
  {nombre:"Sofía Martín",  telefono:"633333333",visitas:5, gasto:230,ultimaVisita:HOY_ISO,         nota:"Le gusta el tono castaño cálido.",historial:[]},
  {nombre:"Laura Sánchez", telefono:"655555555",visitas:7, gasto:510,ultimaVisita:HOY_ISO,         nota:"Mechas cada 6 semanas.",historial:[]},
  {nombre:"Ana Torres",    telefono:"677777777",visitas:15,gasto:390,ultimaVisita:haceNSemanas(1), nota:"Cliente VIP. Muy puntual.",historial:[]},
  {nombre:"Roberto Díaz",  telefono:"688888888",visitas:3, gasto:45, ultimaVisita:haceNSemanas(6), nota:"",historial:[]},
  {nombre:"Carmen López",  telefono:"699999999",visitas:2, gasto:30, ultimaVisita:haceNSemanas(9), nota:"",historial:[]},
  {nombre:"Pedro Ruiz",    telefono:"644444444",visitas:3, gasto:45, ultimaVisita:haceNSemanas(2), nota:"",historial:[]},
];
const FESTIVOS_INIT=[
  {fecha:"2026-04-02",motivo:"Jueves Santo"},
  {fecha:"2026-04-03",motivo:"Viernes Santo"},
  {fecha:"2026-05-01",motivo:"Día del Trabajo"},
  {fecha:"2026-12-25",motivo:"Navidad"},
];
const BLOQUEOS_INIT=[
  {peluqueroId:2,tipo:"dia",  desde:"2026-04-10",hasta:"2026-04-10",motivo:"Médico"},
  {peluqueroId:3,tipo:"semana",desde:"2026-07-07",hasta:"2026-07-11",motivo:"Vacaciones"},
];
const VALORACIONES_INIT=[
  {nombre:"Laura M.",  estrellas:5,comentario:"Clara es increíble, siempre me deja el pelo perfecto.",servicio:"Corte de cabello"},
  {nombre:"Javier R.", estrellas:5,comentario:"Fernando hace los mejores degradados de Barcelona.",servicio:"Fade / Degradado"},
  {nombre:"Marta S.",  estrellas:5,comentario:"Marta es un artista con el color.",servicio:"Mechas / Highlights"},
];
const STATS_INGRESOS=[
  {semana:"S1 Feb",actual:420,anterior:380},{semana:"S2 Feb",actual:580,anterior:490},
  {semana:"S3 Feb",actual:510,anterior:520},{semana:"S4 Feb",actual:690,anterior:610},
  {semana:"S1 Mar",actual:740,anterior:690},{semana:"S2 Mar",actual:620,anterior:580},
  {semana:"S3 Mar",actual:810,anterior:620},
];
const STATS_DIAS=[{dia:"Lun",citas:8},{dia:"Mar",citas:11},{dia:"Mié",citas:9},{dia:"Jue",citas:13},{dia:"Vie",citas:16},{dia:"Sáb",citas:14}];
const STATS_SERVICIOS=[{nombre:"Corte",c:38},{nombre:"Fade",c:24},{nombre:"Corte+Barba",c:19},{nombre:"Coloración",c:14},{nombre:"Barba",c:18},{nombre:"Mechas",c:9}];

(()=>{
  ["https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js","https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"].forEach(src=>{
    if(!document.querySelector(`script[src="${src}"]`)){const s=document.createElement("script");s.src=src;document.head.appendChild(s);}
  });
  const l=document.createElement("link");l.rel="stylesheet";l.href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap";document.head.appendChild(l);
})();
const FONT="'Plus Jakarta Sans', sans-serif";

const A="#1B4F8A", CR="#F0F4F9", CR2="#E0E8F2", CR3="#CED9E8";
const WH="#F8FBFF", TX="#0D1F35", TX2="#4A6080";
const OK="#16a34a", ER="#dc2626";

// ── Small components ──
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
  <button style={{background:ok?`linear-gradient(135deg,${A},#133A6A)`:CR2,color:ok?WH:TX2,border:ok?"none":`1px solid ${CR3}`,borderRadius:sm?8:11,padding:sm?"7px 14px":"12px 20px",fontSize:sm?12:13,fontWeight:700,cursor:ok?"pointer":"not-allowed",letterSpacing:0.5,boxShadow:ok?`0 3px 12px ${A}33`:"none",...style}} {...p}>{children}</button>
);

// ── Logo WhatsApp SVG ──
const WhatsAppIcon=()=>(
  <svg viewBox="0 0 32 32" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 3C8.82 3 3 8.82 3 16c0 2.3.61 4.46 1.68 6.33L3 29l6.84-1.64A13 13 0 0 0 16 29c7.18 0 13-5.82 13-13S23.18 3 16 3z" fill="#fff"/>
    <path d="M21.9 18.8c-.3-.15-1.77-.87-2.04-.97-.28-.1-.48-.15-.68.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.68-1.63-.93-2.23-.24-.58-.49-.5-.68-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.79.37-.27.3-1.03 1.01-1.03 2.46 0 1.45 1.06 2.85 1.2 3.05.15.2 2.08 3.17 5.04 4.45.7.3 1.25.49 1.68.62.7.22 1.34.19 1.85.12.56-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.19-.57-.34z" fill="#25D366"/>
  </svg>
);

// ═══════════════════════════════════════════════════════════════
// MINI CALENDAR PICKER (para modal admin)
// ═══════════════════════════════════════════════════════════════
function MiniCalPicker({value, onChange, festivosSet, bloqueosPelId, bloqueos}){
  const today=new Date(); today.setHours(0,0,0,0);
  const [nav,setNav]=useState(()=>{
    if(value){const d=new Date(value+"T12:00:00");return{y:d.getFullYear(),m:d.getMonth()};}
    return{y:today.getFullYear(),m:today.getMonth()};
  });

  const firstDay=new Date(nav.y,nav.m,1);
  const startDow=firstDay.getDay(); // 0=dom
  const offset=startDow===0?6:startDow-1; // lunes=0
  const daysInMonth=new Date(nav.y,nav.m+1,0).getDate();

  const prevMonth=()=>setNav(n=>n.m===0?{y:n.y-1,m:11}:{y:n.y,m:n.m-1});
  const nextMonth=()=>setNav(n=>n.m===11?{y:n.y+1,m:0}:{y:n.y,m:n.m+1});

  const cells=[];
  for(let i=0;i<offset;i++) cells.push(null);
  for(let d=1;d<=daysInMonth;d++) cells.push(new Date(nav.y,nav.m,d));

  return(
    <div className="mini-cal" style={{background:WH,border:`1px solid ${CR3}`,borderRadius:12,padding:"12px",minWidth:260}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <button style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:TX2,padding:"2px 8px"}} onClick={prevMonth}>‹</button>
        <span style={{fontSize:13,fontWeight:700,color:TX}}>{MESES_FULL[nav.m]} {nav.y}</span>
        <button style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:TX2,padding:"2px 8px"}} onClick={nextMonth}>›</button>
      </div>
      <div className="mini-cal-grid" style={{marginBottom:4}}>
        {["Lu","Ma","Mi","Ju","Vi","Sá","Do"].map(d=>(
          <div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:TX2,padding:"3px 0"}}>{d}</div>
        ))}
      </div>
      <div className="mini-cal-grid">
        {cells.map((d,i)=>{
          if(!d) return <div key={i}/>;
          const iso=isoDate(d);
          const isPast=d<today;
          const isDom=d.getDay()===0;
          const isFest=festivosSet.has(iso);
          const noBloq=bloqueosPelId?peluqueroEstaBloquedado(bloqueosPelId,iso,bloqueos):false;
          const noHorario=!CONFIG.horarioGeneral[d.getDay()];
          // si hay peluquero seleccionado, también verificar su horario
          const noHorarioPel=bloqueosPelId?(()=>{const p=CONFIG.peluqueros.find(x=>x.id===bloqueosPelId);return p?!p.horario[d.getDay()]:false;})():false;
          const disabled=isPast||isDom||isFest||noBloq||noHorario||noHorarioPel;
          const sel=value===iso;
          const isToday=iso===HOY_ISO;
          let cls="mini-cal-cell";
          if(sel) cls+=" selected";
          else if(isFest||isDom) cls+=" festivo";
          else if(isToday) cls+=" today";
          return(
            <div key={i} className={cls} style={{color:disabled&&!sel?"#aaa":undefined,background:disabled&&!sel?"transparent":undefined}}
              onClick={()=>!disabled&&onChange(iso)}>
              {d.getDate()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CALENDARIO VISUAL ADMIN
// ═══════════════════════════════════════════════════════════════
const PX_MIN=1.4;
const HORA_APE=9*60, HORA_CIE=20*60+30;
const TOTAL_MIN=HORA_CIE-HORA_APE;
const GRID_H=TOTAL_MIN*PX_MIN;
const HORA_LABELS=Array.from({length:12},(_,i)=>i+9);

function CalendarioGrid({dias,citas,peluqueroFiltroId}){
  return(
    <div style={{display:"flex",overflowX:"auto",overflowY:"auto",maxHeight:600,background:WH,border:`1px solid ${CR3}`,borderRadius:13}}>
      {/* Eje horas */}
      <div style={{width:44,flexShrink:0,position:"relative",height:GRID_H+52,borderRight:`1px solid ${CR3}`,background:CR}}>
        <div style={{height:52,borderBottom:`1px solid ${CR3}`}}/>
        <div style={{position:"relative",height:GRID_H}}>
          {HORA_LABELS.map(h=>(
            <div key={h} style={{position:"absolute",top:(h*60-HORA_APE)*PX_MIN-7,left:0,right:0,textAlign:"right",paddingRight:6,fontSize:9,color:TX2,fontWeight:600}}>{h}:00</div>
          ))}
        </div>
      </div>
      {/* Columnas por día — minWidth aumentado para que los textos no se corten */}
      {dias.map((d,i)=>{
        const iso=isoDate(d);
        const esHoy=iso===HOY_ISO;
        const hGen=CONFIG.horarioGeneral[d.getDay()];
        const citasDia=citas.filter(c=>c.fecha===iso&&(!peluqueroFiltroId||c.peluqueroId===peluqueroFiltroId)).sort((a,b)=>a.hora.localeCompare(b.hora));
        const pelEnEsteDia=CONFIG.peluqueros.filter(p=>!!p.horario[d.getDay()]);
        return(
          <div key={i} className="cal-day-col">
            {/* Cabecera */}
            <div className="cal-day-header" style={{background:esHoy?`${A}30`:CR}}>
              <span style={{fontSize:9,fontWeight:700,color:esHoy?A:TX2,textTransform:"uppercase",letterSpacing:0.5,whiteSpace:"nowrap"}}>{DIAS_ES[d.getDay()]}</span>
              <span style={{fontSize:12,fontWeight:700,color:esHoy?A:TX,whiteSpace:"nowrap"}}>{d.getDate()} {MESES_ES[d.getMonth()]}</span>
            </div>
            {/* Cuerpo */}
            <div style={{position:"relative",height:GRID_H,flexShrink:0}}>
              {HORA_LABELS.map(h=>(
                <div key={h} style={{position:"absolute",top:(h*60-HORA_APE)*PX_MIN,left:0,right:0,borderTop:`1px solid ${h%2===0?CR3:CR2}`,zIndex:0}}/>
              ))}
              {!hGen&&<div style={{position:"absolute",inset:0,background:"repeating-linear-gradient(45deg,#F5F0E8,#F5F0E8 4px,#EDE6D9 4px,#EDE6D9 8px)",zIndex:1,opacity:0.6}}/>}
              {hGen&&pelEnEsteDia.map(p=>{
                const hp=p.horario[d.getDay()];
                if(!hp?.descanso)return null;
                const top=(toMin(hp.descanso.inicio)-HORA_APE)*PX_MIN;
                const height=(toMin(hp.descanso.fin)-toMin(hp.descanso.inicio))*PX_MIN;
                return <div key={p.id} style={{position:"absolute",left:0,right:0,top,height,background:p.color+"0A",zIndex:1,borderTop:`1px dashed ${p.color}33`,borderBottom:`1px dashed ${p.color}33`}}/>;
              })}
              {citasDia.map(c=>{
                const svc=CONFIG.servicios.find(s=>s.id===c.servicioId)||{duracionMin:30};
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

// ═══════════════════════════════════════════════════════════════
// CLIENTE APP
// ═══════════════════════════════════════════════════════════════
function ClienteApp({onAdmin, valoraciones, citas, festivos, bloqueos}){
  const [paso,setPaso]=useState(0);
  const [catAbierta,setCatAbierta]=useState(null);
  const [selServicio,setSelServicio]=useState(null);
  const [selPeluquero,setSelPeluquero]=useState(null);
  const [selDia,setSelDia]=useState(null);
  const [selHora,setSelHora]=useState(null);
  const [form,setForm]=useState({nombre:"",telefono:""});

  const festivosSet=useMemo(()=>new Set(festivos.map(f=>f.fecha)),[festivos]);

  const slots=useMemo(()=>{
    if(!selPeluquero||!selDia||!selServicio)return[];
    const hp=selPeluquero.horario[selDia.getDay()];
    if(!hp)return[];
    const todos=generarSlots(hp,selServicio.duracionMin);
    const citasDelDia=citas.filter(c=>c.fecha===isoDate(selDia)&&c.peluqueroId===selPeluquero.id&&c.estado!=="no-show");
    const disponibles=filtrarSlotsOcupados(todos,selServicio.duracionMin,citasDelDia);
    if(isoDate(selDia)===HOY_ISO){
      const ahora=new Date();
      const minAhora=ahora.getHours()*60+ahora.getMinutes()+15;
      return disponibles.filter(h=>toMin(h)>minAhora);
    }
    return disponibles;
  },[selPeluquero,selDia,selServicio,citas]);

  const scrollTop=()=>window.scrollTo({top:0,behavior:"smooth"});
  const irAPaso=n=>{scrollTop();setPaso(n);};
  const reset=()=>{scrollTop();setPaso(0);setCatAbierta(null);setSelServicio(null);setSelPeluquero(null);setSelDia(null);setSelHora(null);setForm({nombre:"",telefono:""});};

  const confirmarReserva=async()=>{
    if(!form.nombre||!form.telefono)return;
    await crearCita({
      clienteNombre:form.nombre,clienteTel:form.telefono,
      servicio:selServicio.nombre,servicioId:selServicio.id,
      peluqueroId:selPeluquero.id,peluquero:selPeluquero.nombre,
      fecha:isoDate(selDia),hora:selHora,
      precio:selServicio.precio,estado:"pendiente",nota:""
    });
    await crearOActualizarCliente({
      nombre:form.nombre,telefono:form.telefono,
      visitas:1,gasto:selServicio.precio,
      ultimaVisita:isoDate(selDia),nota:"",
      historial:[{fecha:isoDate(selDia),servicio:selServicio.nombre,peluquero:selPeluquero.nombre,precio:selServicio.precio}]
    });
    irAPaso(5);
  };

  const waMsgCliente=`Hola ${form.nombre} 👋%0AReserva confirmada en *${CONFIG.nombre}*%0A%0A✂️ ${selServicio?.nombre}%0A💈 ${selPeluquero?.nombre}%0A📅 ${selDia?fmtLarga(selDia):""}%0A🕐 ${selHora}%0A💶 €${selServicio?.precio}%0A%0ATe esperamos 😊`;

  const horarioResumido=()=>{
    const g={};
    Object.entries(CONFIG.horarioGeneral).forEach(([d,h])=>{const k=`${h.apertura}–${h.cierre}`;if(!g[k])g[k]=[];g[k].push(Number(d));});
    return Object.entries(g).map(([h,ds])=>({horas:h,rango:ds.map(d=>DIAS_ES[d]).join(", ")}));
  };

  const cs={
    header:{background:WH,borderBottom:`1px solid ${CR3}`,padding:"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10,boxShadow:"0 1px 8px rgba(0,0,0,0.05)"},
    hero:{background:`linear-gradient(160deg,#0D1F35 0%,#1B3A5C 55%,#142D48 100%)`,padding:"48px 20px 36px",textAlign:"center",position:"relative",overflow:"hidden"},
    heroGlow:{position:"absolute",top:-60,left:"50%",transform:"translateX(-50%)",width:300,height:300,background:`radial-gradient(circle,${A}22 0%,transparent 70%)`,pointerEvents:"none"},
    btnPpal:{background:`linear-gradient(135deg,${A},#133A6A)`,color:WH,border:"none",borderRadius:12,padding:"15px 40px",fontSize:15,fontWeight:700,cursor:"pointer",letterSpacing:1,boxShadow:`0 6px 24px ${A}55`},
    section:{padding:"18px"},
    sTitle:{fontSize:11,color:A,letterSpacing:3,textTransform:"uppercase",marginBottom:14,fontWeight:700},
    cat:{background:WH,border:`1px solid ${CR3}`,borderRadius:13,marginBottom:8,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"},
    catHeader:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",cursor:"pointer"},
    catLeft:{display:"flex",alignItems:"center",gap:10},
    catIcon:{width:38,height:38,background:CR2,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18},
    svcRow:sel=>({display:"flex",flexDirection:"column",alignItems:"flex-start",gap:2,padding:"11px 16px 11px 64px",cursor:"pointer",background:sel?`${A}08`:CR,borderTop:`1px solid ${CR2}`,transition:"background 0.15s"}),
    horasGrid:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7},
    horaBtn:a=>({background:a?`linear-gradient(135deg,${A},#133A6A)`:WH,border:`1px solid ${a?A:CR3}`,borderRadius:8,padding:"10px 0",cursor:"pointer",textAlign:"center",fontSize:13,color:a?WH:TX,fontWeight:a?700:400}),
    card:sel=>({background:sel?`${A}0D`:WH,border:`1px solid ${sel?A:CR3}`,borderRadius:13,padding:"13px 16px",marginBottom:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}),
    cardLeft:{display:"flex",alignItems:"center",gap:12},
    cardEmoji:{width:42,height:42,background:CR2,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18},
    resBox:{background:WH,border:`1px solid ${CR3}`,borderRadius:13,padding:"16px",marginBottom:12},
    resFila:last=>({display:"flex",justifyContent:"space-between",alignItems:"center",paddingBottom:last?0:9,marginBottom:last?0:9,borderBottom:last?"none":`1px solid ${CR2}`}),
    inp:{width:"100%",background:WH,border:`1px solid ${CR3}`,borderRadius:10,padding:"12px 14px",fontSize:14,color:TX,marginBottom:8,outline:"none",boxSizing:"border-box",fontFamily:"inherit"},
    btnSig:ok=>({width:"100%",background:ok?`linear-gradient(135deg,${A},#133A6A)`:CR2,color:ok?WH:TX2,border:ok?"none":`1px solid ${CR3}`,borderRadius:12,padding:"14px",fontSize:14,fontWeight:700,cursor:ok?"pointer":"not-allowed",marginTop:18,letterSpacing:0.5}),
    backBtn:{background:"transparent",border:"none",color:TX2,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",gap:5,marginBottom:14,padding:0},
    progreso:{background:WH,borderBottom:`1px solid ${CR3}`,padding:"10px 18px",display:"flex",gap:4,alignItems:"center",justifyContent:"center"},
    prog:(d,a)=>({height:4,flex:1,maxWidth:55,borderRadius:2,background:d?A:a?A+"66":CR3}),
    successBox:{textAlign:"center",padding:"50px 20px"},
    successIcon:{width:72,height:72,background:`linear-gradient(135deg,${A},#133A6A)`,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,margin:"0 auto 20px"},
    infoBar:{display:"flex",background:WH,borderBottom:`1px solid ${CR3}`},
    infoItem:{flex:1,textAlign:"center",padding:"13px 6px",borderRight:`1px solid ${CR3}`},
  };

  if(paso===0) return(
    <div style={{fontFamily:FONT,background:WH,minHeight:"100vh",color:TX}}>
      <div>
        <div style={{width:"100%",minHeight:"100vh",background:WH}}>
          <div style={cs.header}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:34,height:34,background:`linear-gradient(135deg,${A},#133A6A)`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>✂️</div>
              <span style={{fontSize:17,fontWeight:700,color:TX}}>{CONFIG.nombre}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <button style={{background:`linear-gradient(135deg,${A},#133A6A)`,color:WH,border:"none",borderRadius:9,padding:"9px 22px",fontSize:13,fontWeight:700,cursor:"pointer",letterSpacing:1}} onClick={()=>irAPaso(1)}>RESERVAR</button>
              <button style={{background:"transparent",border:"none",color:CR3,cursor:"pointer",fontSize:13,padding:0}} onClick={onAdmin}>⚙</button>
            </div>
          </div>

          {/* WhatsApp FAB con logo oficial */}
          <a href={`https://wa.me/${CONFIG.whatsapp}?text=Hola, me gustaría pedir más información`} target="_blank" rel="noreferrer" className="wa-fab">
            <WhatsAppIcon/>
          </a>

          <div className="anim" style={cs.hero}>
            <div style={cs.heroGlow}/>
            <div style={{fontSize:48,marginBottom:10}}>💈</div>
            <h1 style={{fontSize:32,fontWeight:700,color:WH,marginBottom:6,letterSpacing:1}}>{CONFIG.nombre}</h1>
            <p style={{fontSize:15,color:"#7AADD4",marginBottom:4,fontStyle:"italic"}}>"{CONFIG.slogan}"</p>
            <p style={{fontSize:12,color:"#4A7AAA",marginBottom:28}}>📍 {CONFIG.direccion} · 📞 {CONFIG.telefono}</p>
            <button style={cs.btnPpal} onClick={()=>irAPaso(1)}>RESERVAR CITA</button>
          </div>

          <div style={cs.infoBar}>
            {[["⭐","4.9","valoración"],["✂️",CONFIG.peluqueros.length,"profesionales"],["💼",CONFIG.servicios.length,"servicios"],["🕐","24/7","reservas"]].map(([ic,v,l],i)=>(
              <div key={i} style={cs.infoItem}><div style={{fontSize:18}}>{ic}</div><div style={{fontSize:14,fontWeight:700,color:A}}>{v}</div><div style={{fontSize:10,color:TX2}}>{l}</div></div>
            ))}
          </div>

          <div style={{padding:"0 18px",marginTop:18}}>
            <div style={{background:WH,border:`1px solid ${CR3}`,borderRadius:14,padding:"16px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <span style={{fontSize:12,fontWeight:700,color:TX,letterSpacing:1,textTransform:"uppercase"}}>Horario</span>
                <Bdg color={CONFIG.horarioGeneral[HOY.getDay()]?OK:ER}>{CONFIG.horarioGeneral[HOY.getDay()]?"Abierto hoy":"Cerrado hoy"}</Bdg>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                {horarioResumido().map(({rango,horas},i)=>(
                  <div key={i} style={{background:`${A}12`,border:`1px solid ${A}33`,borderRadius:20,padding:"5px 12px",fontSize:12}}>
                    <span style={{fontWeight:700,color:TX}}>{rango}</span><span style={{color:TX2,marginLeft:5}}>{horas}</span>
                  </div>
                ))}
                <div style={{background:CR2,border:`1px solid ${CR3}`,borderRadius:20,padding:"5px 12px",fontSize:12,color:TX2}}>Dom — Cerrado</div>
              </div>
            </div>
          </div>

          <div className="anim" style={cs.section}>
            <div style={cs.sTitle}>✦ Servicios</div>
            {CONFIG.categorias.map(cat=>{
              const svcs=CONFIG.servicios.filter(s=>cat.servicioIds.includes(s.id));
              const abierta=catAbierta===cat.id;
              return(
                <div key={cat.id} style={cs.cat}>
                  <div style={cs.catHeader} onClick={()=>setCatAbierta(abierta?null:cat.id)}>
                    <div style={cs.catLeft}>
                      <div style={cs.catIcon}>{cat.emoji}</div>
                      <div><div style={{fontSize:14,fontWeight:700,color:TX}}>{cat.nombre}</div><div style={{fontSize:11,color:TX2}}>{svcs.length} servicio{svcs.length>1?"s":""} · desde €{Math.min(...svcs.map(s=>s.precio))}</div></div>
                    </div>
                    <span style={{color:TX2,fontSize:18,transform:abierta?"rotate(180deg)":"rotate(0deg)",transition:"0.2s"}}>▾</span>
                  </div>
                  {abierta&&svcs.map(s=>(
                    <div key={s.id} style={{...cs.svcRow(false),cursor:"default"}}>
                      <div style={{display:"flex",justifyContent:"space-between",width:"100%",alignItems:"center"}}>
                        <div><span style={{fontSize:13,color:TX,fontWeight:600}}>{s.nombre}</span><span style={{fontSize:11,color:TX2,marginLeft:8}}>⏱ {s.duracionMin} min</span></div>
                        <span style={{fontSize:14,fontWeight:700,color:A}}>€{s.precio}</span>
                      </div>
                      {s.desc&&<div style={{fontSize:11,color:TX2,marginTop:2}}>{s.desc}</div>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <div style={cs.section}>
            <div style={cs.sTitle}>✦ El equipo</div>
            {CONFIG.peluqueros.map(p=>(
              <div key={p.id} style={{...cs.card(false),cursor:"default"}}>
                <div style={cs.cardLeft}>
                  <div style={cs.cardEmoji}>{p.emoji}</div>
                  <div><div style={{fontSize:14,fontWeight:700,color:TX}}>{p.nombre}</div><div style={{fontSize:11,color:TX2}}>{p.especialidad}</div></div>
                </div>
                <div style={{width:10,height:10,borderRadius:"50%",background:p.color}}/>
              </div>
            ))}
          </div>

          {valoraciones.length>0&&(
            <div style={{...cs.section,paddingTop:0}}>
              <div style={cs.sTitle}>✦ Opiniones</div>
              {valoraciones.map(v=>(
                <div key={v.id} style={{background:WH,border:`1px solid ${CR3}`,borderRadius:13,padding:"14px 16px",marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                    <div><div style={{fontSize:13,fontWeight:700,color:TX}}>{v.nombre}</div><div style={{fontSize:11,color:TX2}}>{v.servicio}</div></div>
                    <div style={{display:"flex",gap:1}}>{Array.from({length:5}).map((_,i)=><span key={i} style={{fontSize:13,color:i<v.estrellas?"#F59E0B":"#D1D5DB"}}>★</span>)}</div>
                  </div>
                  <p style={{fontSize:12,color:TX2,margin:0,lineHeight:1.6,fontStyle:"italic"}}>"{v.comentario}"</p>
                </div>
              ))}
            </div>
          )}

          <div style={{...cs.section,paddingTop:0}}>
            <div style={cs.sTitle}>✦ Cómo llegar</div>
            <div style={{background:WH,border:`1px solid ${CR3}`,borderRadius:14,overflow:"hidden"}}>
              <iframe src={`https://maps.google.com/maps?q=${encodeURIComponent(CONFIG.direccion)}&output=embed`} width="100%" height="200" style={{border:0,display:"block"}} allowFullScreen loading="lazy" title="Mapa"/>
              <div style={{padding:"14px 16px"}}>
                <div style={{fontSize:13,fontWeight:700,color:TX,marginBottom:4}}>📍 {CONFIG.direccion}</div>
                <div style={{fontSize:12,color:TX2,marginBottom:12}}>📞 {CONFIG.telefono}</div>
                <a href={CONFIG.googleMapsUrl} target="_blank" rel="noreferrer" style={{display:"block",background:`linear-gradient(135deg,${A},#133A6A)`,color:WH,borderRadius:10,padding:"11px",textAlign:"center",fontSize:13,fontWeight:700,textDecoration:"none"}}>🗺️ Cómo llegar — Abrir GPS</a>
              </div>
            </div>
          </div>
          <div style={{height:80}}/>
        </div>
      </div>
    </div>
  );

  // Pasos 1–5
  return(
    <div style={{fontFamily:FONT,background:WH,minHeight:"100vh",color:TX}}>
      <div>
        <div style={{width:"100%",minHeight:"100vh",background:WH}}>
          <div style={cs.header}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:34,height:34,background:`linear-gradient(135deg,${A},#133A6A)`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>✂️</div>
              <span style={{fontSize:17,fontWeight:700,color:TX}}>{CONFIG.nombre}</span>
            </div>
          </div>

          {paso>=1&&paso<=4&&(
            <div style={cs.progreso}>
              {[1,2,3,4].map(p=><div key={p} style={cs.prog(paso>p,paso===p)}/>)}
              <span style={{fontSize:10,color:TX2,marginLeft:8}}>Paso {paso} de 4</span>
            </div>
          )}

          {paso===1&&(
            <div style={cs.section}>
              <button style={cs.backBtn} onClick={reset}>← Inicio</button>
              <div style={cs.sTitle}>✦ ¿Qué servicio necesitas?</div>
              {CONFIG.categorias.map(cat=>{
                const svcs=CONFIG.servicios.filter(s=>cat.servicioIds.includes(s.id));
                const abierta=catAbierta===cat.id;
                return(
                  <div key={cat.id} style={cs.cat}>
                    <div style={cs.catHeader} onClick={()=>setCatAbierta(abierta?null:cat.id)}>
                      <div style={cs.catLeft}>
                        <div style={cs.catIcon}>{cat.emoji}</div>
                        <div><div style={{fontSize:14,fontWeight:700,color:TX}}>{cat.nombre}</div><div style={{fontSize:11,color:TX2}}>{svcs.length} servicio{svcs.length>1?"s":""}</div></div>
                      </div>
                      <span style={{color:TX2,fontSize:18,transform:abierta?"rotate(180deg)":"rotate(0deg)",transition:"0.2s"}}>▾</span>
                    </div>
                    {abierta&&svcs.map(s=>(
                      <div key={s.id} style={cs.svcRow(selServicio?.id===s.id)} onClick={()=>setSelServicio(s)}>
                        <div style={{display:"flex",justifyContent:"space-between",width:"100%",alignItems:"center"}}>
                          <div><span style={{fontSize:13,color:TX,fontWeight:600}}>{s.nombre}</span><span style={{fontSize:11,color:TX2,marginLeft:8}}>⏱ {s.duracionMin} min</span></div>
                          <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:14,fontWeight:700,color:A}}>€{s.precio}</span>{selServicio?.id===s.id&&<span style={{color:A}}>✓</span>}</div>
                        </div>
                        {s.desc&&<div style={{fontSize:11,color:TX2,marginTop:2}}>{s.desc}</div>}
                      </div>
                    ))}
                  </div>
                );
              })}
              <button style={cs.btnSig(!!selServicio)} disabled={!selServicio} onClick={()=>selServicio&&irAPaso(2)}>CONTINUAR →</button>
            </div>
          )}

          {paso===2&&(
            <div style={cs.section}>
              <button style={cs.backBtn} onClick={()=>{irAPaso(1);setSelPeluquero(null);}}>← Cambiar servicio</button>
              <div style={cs.sTitle}>✦ Elige tu profesional</div>
              <div style={{background:CR2,borderRadius:10,padding:"9px 14px",marginBottom:14,fontSize:12,color:TX2}}>{selServicio?.emoji} {selServicio?.nombre} · ⏱ {selServicio?.duracionMin} min · <span style={{color:A,fontWeight:700}}>€{selServicio?.precio}</span></div>
              {CONFIG.peluqueros.map(p=>(
                <div key={p.id} style={cs.card(selPeluquero?.id===p.id)} onClick={()=>setSelPeluquero(p)}>
                  <div style={cs.cardLeft}>
                    <div style={cs.cardEmoji}>{p.emoji}</div>
                    <div><div style={{fontSize:14,fontWeight:700,color:TX}}>{p.nombre}</div><div style={{fontSize:11,color:TX2}}>{p.especialidad}</div></div>
                  </div>
                  {selPeluquero?.id===p.id?<span style={{color:A,fontSize:18}}>✓</span>:<div style={{width:10,height:10,borderRadius:"50%",background:p.color}}/>}
                </div>
              ))}
              <button style={cs.btnSig(!!selPeluquero)} disabled={!selPeluquero} onClick={()=>selPeluquero&&irAPaso(3)}>CONTINUAR →</button>
            </div>
          )}

          {paso===3&&(
            <div style={cs.section}>
              <button style={cs.backBtn} onClick={()=>{irAPaso(2);setSelDia(null);setSelHora(null);}}>← Cambiar profesional</button>
              <div style={cs.sTitle}>✦ Elige fecha y hora</div>
              <div style={{background:CR2,borderRadius:10,padding:"9px 14px",marginBottom:16,fontSize:12,color:TX2}}>{selPeluquero?.emoji} {selPeluquero?.nombre} · {selServicio?.nombre} · <span style={{color:A,fontWeight:700}}>€{selServicio?.precio}</span></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:4}}>
                {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map(d=>(
                  <div key={d} style={{textAlign:"center",fontSize:9,fontWeight:700,color:d==="Dom"?ER+"99":TX2,textTransform:"uppercase",letterSpacing:0.5,padding:"3px 0"}}>{d}</div>
                ))}
              </div>
              {getCalendarWeeks().map((sem,si)=>(
                <div key={si} style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:4}}>
                  {sem.map((d,di)=>{
                    const dISO=isoDate(d);
                    const esPasado=d<HOY;
                    const esDom=d.getDay()===0;
                    const esFest=festivosSet.has(dISO);
                    // FIX: verificar horario individual del peluquero
                    const abiertoPelu=!!selPeluquero?.horario[d.getDay()];
                    const abiertoGen=!!CONFIG.horarioGeneral[d.getDay()];
                    // FIX: verificar bloqueos individuales del peluquero
                    const estaBloqueado=selPeluquero?peluqueroEstaBloquedado(selPeluquero.id,dISO,bloqueos):false;
                    const disp=!esPasado&&!esDom&&!esFest&&abiertoPelu&&abiertoGen&&!estaBloqueado;
                    const a=selDia?.toDateString()===d.toDateString();
                    return(
                      <button key={di} style={{
                        background:a?`linear-gradient(135deg,${A},#133A6A)`:disp?WH:CR,
                        border:`1px solid ${a?A:esDom||esPasado||esFest||estaBloqueado?"transparent":disp?CR3:CR3}`,
                        borderRadius:9,padding:"6px 2px",cursor:disp?"pointer":"default",
                        textAlign:"center",opacity:esPasado?0.25:esFest||estaBloqueado?0.35:1,
                      }} disabled={!disp} onClick={()=>{if(disp){setSelDia(d);setSelHora(null);}}}>
                        <span style={{fontSize:12,fontWeight:700,color:a?WH:esDom?ER+"88":esFest||estaBloqueado?ER+"66":disp?TX:TX2,display:"block"}}>{d.getDate()}</span>
                        <span style={{fontSize:8,color:a?"#FFE4A0":TX2,display:"block"}}>{MESES_ES[d.getMonth()]}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
              {selDia&&(<>
                <div style={{height:16}}/>
                <div style={{...cs.sTitle,marginTop:4}}>Horas disponibles — {fmtLarga(selDia)}</div>
                {slots.length>0?(
                  <div style={cs.horasGrid}>{slots.map(h=><button key={h} style={cs.horaBtn(selHora===h)} onClick={()=>setSelHora(h)}>{h}</button>)}</div>
                ):<div style={{textAlign:"center",padding:"20px",color:TX2,fontSize:13,background:CR2,borderRadius:12}}>Sin disponibilidad este día</div>}
              </>)}
              <button style={cs.btnSig(!!(selDia&&selHora))} disabled={!selDia||!selHora} onClick={()=>selDia&&selHora&&irAPaso(4)}>CONTINUAR →</button>
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
              <button style={cs.btnSig(!!(form.nombre&&form.telefono))} disabled={!form.nombre||!form.telefono} onClick={confirmarReserva}>CONFIRMAR RESERVA ✓</button>
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
              <button style={{...cs.btnSig(true),maxWidth:340,margin:"0 auto",display:"block"}} onClick={reset}>VOLVER AL INICIO</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VISTA PELUQUERO
// ═══════════════════════════════════════════════════════════════
function PeluqueroView({peluquero,citas,onLogout}){
  const [weekOffset,setWeekOffset]=useState(0);
  const weekDays=getWeekDays(weekOffset);
  const misCitas=citas.filter(c=>c.peluqueroId===peluquero.id);
  return(
    <div style={{minHeight:"100vh",background:CR,fontFamily:FONT,color:TX}}>
      <div style={{background:WH,borderBottom:`1px solid ${CR3}`,padding:"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,background:`linear-gradient(135deg,${peluquero.color},${peluquero.color}88)`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{peluquero.emoji}</div>
          <div><div style={{fontSize:15,fontWeight:700}}>{peluquero.nombre} — Mi agenda</div><div style={{fontSize:11,color:TX2}}>{CONFIG.nombre}</div></div>
        </div>
        <button style={{background:CR2,border:`1px solid ${CR3}`,borderRadius:8,padding:"6px 14px",fontSize:12,color:TX2,cursor:"pointer"}} onClick={onLogout}>Salir →</button>
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

// ═══════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════
function LoginAdmin({onLoginDueno,onLoginPeluquero,onBack}){
  const [user,setUser]=useState(""), [pass,setPass]=useState(""), [error,setError]=useState(false);
  const handleLogin=()=>{
    if(user===CONFIG.adminUser&&pass===CONFIG.adminPass){onLoginDueno();return;}
    const pel=CONFIG.peluqueros.find(x=>normalize(x.nombre)===normalize(user)&&x.password===pass);
    if(pel){onLoginPeluquero(pel);return;}
    setError(true); setTimeout(()=>setError(false),2500);
  };
  return(
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg,#0D1F35 0%,#1B3A5C 60%,#0D1F35 100%)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:FONT}}>
      <div style={{background:WH,borderRadius:20,padding:"40px 36px",width:"100%",maxWidth:360,boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>
        <div style={{width:56,height:56,background:`linear-gradient(135deg,${A},#133A6A)`,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto 20px"}}>🔐</div>
        <h2 style={{textAlign:"center",fontSize:22,fontWeight:700,color:TX,marginBottom:4}}>Acceso privado</h2>
        <p style={{textAlign:"center",fontSize:13,color:TX2,marginBottom:24}}>{CONFIG.nombre}</p>
        {error&&<div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:8,padding:"10px 14px",fontSize:13,color:ER,textAlign:"center",marginBottom:14}}>Usuario o contraseña incorrectos</div>}
        <div style={{marginBottom:12}}><Lbl>Usuario</Lbl><Inp value={user} onChange={e=>setUser(e.target.value)} placeholder="admin · clara · fernando..."/></div>
        <div style={{marginBottom:20}}><Lbl>Contraseña</Lbl><Inp type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder="••••••"/></div>
        <Btn ok style={{width:"100%"}} onClick={handleLogin}>ENTRAR</Btn>
        <button style={{width:"100%",background:"none",border:"none",color:TX2,cursor:"pointer",fontSize:12,marginTop:14}} onClick={onBack}>← Volver a la web</button>
        <div style={{marginTop:16,background:CR,borderRadius:8,padding:"10px",fontSize:11,color:TX2,textAlign:"center"}}>Demo: <strong>admin</strong> / admin123 · <strong>clara</strong> / clara123</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ADMIN PANEL
// ═══════════════════════════════════════════════════════════════
function AdminPanel({onLogout, valoraciones, setValoraciones, festivos, setFestivos, bloqueos, setBloqueos}){
  const [tab,setTab]=useState("citas");
  const [toastVisible,setToastVisible]=useState(false);
  const [toastTimer,setToastTimer]=useState(null);
  const [toastClienteVisible,setToastClienteVisible]=useState(false);
  const [toastClienteTimer,setToastClienteTimer]=useState(null);
  const [clienteSel,setClienteSel]=useState(null);
  const busqCitaRef = useRef(null);
  const [citas,setCitas]=useState([]);
  const [clientes,setClientes]=useState([]);
  const [servicios,setServicios]=useState(CONFIG.servicios);

  // Filtros elevados para no perderse al cambiar estado de cita
  const [vistaCitas,setVistaCitas]=useState("hoy");
  const [weekOffsetCitas,setWeekOffsetCitas]=useState(0);
  const [pelFiltroCitas,setPelFiltroCitas]=useState(null);
  const [filtFecha,setFiltFecha]=useState("hoy");
  const [filtDesde,setFiltDesde]=useState("");
  const [filtHasta,setFiltHasta]=useState("");
  const [filtPel,setFiltPel]=useState("todas");
  const [filtEstado,setFiltEstado]=useState("todos");
  const [mostrarBuscador,setMostrarBuscador]=useState(false);

  useEffect(()=>{
    const u1=suscribirCitas(setCitas);
    const u2=suscribirClientes(setClientes);
    return()=>{u1();u2();};
  },[]);

  // FIX: persistir cambio de estado en Firebase
  const cambiarEstado=useCallback(async(id,estado)=>{
    setCitas(prev=>prev.map(c=>c.id===id?{...c,estado}:c));
    try{
      await actualizarCita(id,{estado});
      if(estado==="no-show"){
        const citaSnap=await getDoc(doc(db,"citas",id));
        if(citaSnap.exists()){
          const cita=citaSnap.data();
          if(cita.clienteTel){
            const q=query(collection(db,"clientes"),where("telefono","==",cita.clienteTel));
            const clienteSnap=await getDocs(q);
            if(!clienteSnap.empty){
              const clienteDoc=clienteSnap.docs[0];
              const cliente=clienteDoc.data();
              await updateDoc(doc(db,"clientes",clienteDoc.id),{
                visitas:Math.max((cliente.visitas||1)-1,0),
                gasto:Math.max((cliente.gasto||0)-cita.precio,0),
                noShows:(cliente.noShows||0)+1
              });
            }
          }
        }
      }
      if(estado==="pendiente"){
        // Si vuelve a pendiente desde no-show, restaurar visitas y gasto
        const citaSnap=await getDoc(doc(db,"citas",id));
        if(citaSnap.exists()){
          const cita=citaSnap.data();
          if(cita.clienteTel){
            const q=query(collection(db,"clientes"),where("telefono","==",cita.clienteTel));
            const clienteSnap=await getDocs(q);
            if(!clienteSnap.empty){
              const clienteDoc=clienteSnap.docs[0];
              const cliente=clienteDoc.data();
              await updateDoc(doc(db,"clientes",clienteDoc.id),{
                visitas:(cliente.visitas||0)+1,
                gasto:(cliente.gasto||0)+cita.precio,
                noShows:Math.max((cliente.noShows||0)-1,0)
              });
            }
          }
        }
      }
    }catch(e){ console.error("Error actualizando cita",e); }
  },[]);

  const festivosSet=useMemo(()=>new Set(festivos.map(f=>f.fecha)),[festivos]);

  const as={
    root:{minHeight:"100vh",background:CR,fontFamily:FONT,color:TX},
    header:{background:WH,borderBottom:`1px solid ${CR3}`,padding:"11px 18px",display:"flex",alignItems:"center",justifyContent:"space-between"},
    tabBar:{display:"flex",background:WH,borderBottom:`1px solid ${CR3}`,overflowX:"auto",padding:"0 12px"},
    tabBtn:a=>({padding:"11px 14px",fontSize:12,fontWeight:a?700:400,color:a?A:TX2,borderBottom:a?`2px solid ${A}`:"2px solid transparent",cursor:"pointer",background:"none",border:"none",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:5}),
    body:{padding:"18px",maxWidth:1100,margin:"0 auto"},
    card:{background:WH,border:`1px solid ${CR3}`,borderRadius:14,padding:"18px",marginBottom:14,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"},
    cardTitle:{fontSize:11,fontWeight:700,color:TX2,textTransform:"uppercase",letterSpacing:1.5,marginBottom:14},
    kpiGrid:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16},
    kpi:{background:WH,border:`1px solid ${CR3}`,borderRadius:12,padding:"14px"},
    kpiVal:{fontSize:24,fontWeight:700,color:A,marginBottom:2},
    kpiLbl:{fontSize:10,color:TX2,textTransform:"uppercase",letterSpacing:1},
    table:{width:"100%",borderCollapse:"collapse"},
    th:{textAlign:"left",fontSize:10,color:TX2,textTransform:"uppercase",letterSpacing:1,padding:"7px 10px",borderBottom:`1px solid ${CR2}`,background:CR},
    td:{padding:"10px 10px",fontSize:12,color:TX,borderBottom:`1px solid ${CR2}`},
    actBtn:c=>({background:c+"15",border:`1px solid ${c}33`,color:c,borderRadius:6,padding:"4px 9px",fontSize:11,fontWeight:700,cursor:"pointer",marginRight:4}),
    twoCol:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14},
    chartH:{height:180,marginTop:8},
    row:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${CR2}`},
  };

  // ── TAB CITAS ──
  const TabCitas=()=>{
    const vista=vistaCitas, setVista=setVistaCitas;
    const weekOffset=weekOffsetCitas, setWeekOffset=setWeekOffsetCitas;
    const pelFiltro=pelFiltroCitas, setPelFiltro=setPelFiltroCitas;
    const [showManual,setShowManual]=useState(false);
    const [editNota,setEditNota]=useState(null);
    const [notaVal,setNotaVal]=useState("");
    const [manForm,setManForm]=useState({nombre:"",telefono:"",servicioId:"",peluqueroId:"",fecha:"",hora:"",nota:""});
    const [clienteRec,setClienteRec]=useState(null);
    // Mostrar/ocultar mini calendario en modal
    const [showCalPicker,setShowCalPicker]=useState(false);
    const [showFiltDesdeCalPicker,setShowFiltDesdeCalPicker]=useState(false);
    const [showFiltHastaCalPicker,setShowFiltHastaCalPicker]=useState(false);
    const [busqCita,setBusqCita]=useState("");
    const inputRef=useRef(null);
    const weekDays=getWeekDays(weekOffset);

    const citasHoy=citas.filter(c=>c.fecha===HOY_ISO).sort((a,b)=>a.hora.localeCompare(b.hora));
    const citasFiltradas=useMemo(()=>{
      let res=[...citas];
      if(filtFecha==="hoy") res=res.filter(c=>c.fecha===HOY_ISO);
      else if(filtFecha==="semana") res=res.filter(c=>weekDays.some(d=>isoDate(d)===c.fecha));
      else if(filtFecha==="fecha"&&filtDesde) res=res.filter(c=>c.fecha===filtDesde);
      else if(filtFecha==="rango"&&filtDesde) res=res.filter(c=>c.fecha>=filtDesde&&(!filtHasta||c.fecha<=filtHasta));
      if(filtPel!=="todas") res=res.filter(c=>c.peluqueroId===Number(filtPel));
      if(filtEstado!=="todos") res=res.filter(c=>c.estado===filtEstado);
      if(busqCita){
        const q=normalize(busqCita);
        res=res.filter(c=>{
          const n=normalize(c.clienteNombre);
          return n.includes(q)||c.clienteTel?.includes(busqCita)||similitud(busqCita,c.clienteNombre)>60;
        });
      }
      return res.sort((a,b)=>a.fecha===b.fecha?a.hora.localeCompare(b.hora):a.fecha.localeCompare(b.fecha));
    },[citas,busqCita,filtFecha,filtDesde,filtHasta,filtPel,filtEstado,weekDays]);

    const hayFiltros=busqCita||filtFecha!=="hoy"||filtPel!=="todas"||filtEstado!=="todos";
    const ingrHoy=citasHoy.filter(c=>c.estado==="completada").reduce((s,c)=>s+c.precio,0);
    const pendHoy=citasHoy.filter(c=>c.estado==="pendiente").length;
    const noShowHoy=citasHoy.filter(c=>c.estado==="no-show").length;

    const guardarNota=async(id)=>{
      setCitas(prev=>prev.map(c=>c.id===id?{...c,nota:notaVal}:c));
      try{ await actualizarCita(id,{nota:notaVal}); }catch(e){}
      setEditNota(null);
    };

    const buscarCliente=tel=>{
      const found=clientes.find(c=>c.telefono===tel.replace(/\s/g,""));
      setClienteRec(found||null);
      if(found) setManForm(f=>({...f,nombre:found.nombre}));
    };

    // FIX: slots manuales respetan festivos, bloqueos y horario individual del peluquero
    const slotsManuales=useMemo(()=>{
      if(!manForm.peluqueroId||!manForm.fecha||!manForm.servicioId)return[];
      // Verificar festivo
      if(festivosSet.has(manForm.fecha))return[];
      const pel=CONFIG.peluqueros.find(p=>p.id===Number(manForm.peluqueroId));
      if(!pel)return[];
      // Verificar bloqueo del peluquero
      if(peluqueroEstaBloquedado(pel.id,manForm.fecha,bloqueos))return[];
      const fecha=new Date(manForm.fecha+"T12:00:00");
      const hp=pel.horario[fecha.getDay()];
      // FIX: usar horario individual del peluquero, no solo general
      if(!hp)return[];
      const svc=servicios.find(s=>s.id===Number(manForm.servicioId));
      if(!svc)return[];
      const todos=generarSlots(hp,svc.duracionMin);
      const citasDelDia=citas.filter(c=>c.fecha===manForm.fecha&&c.peluqueroId===pel.id&&c.estado!=="no-show");
      const disponibles=filtrarSlotsOcupados(todos,svc.duracionMin,citasDelDia);
      if(manForm.fecha===HOY_ISO){
        const ahora=new Date();
        const minAhora=ahora.getHours()*60+ahora.getMinutes()+15;
        return disponibles.filter(h=>toMin(h)>minAhora);
      }
      return disponibles;
    },[manForm.peluqueroId,manForm.fecha,manForm.servicioId,citas,bloqueos,festivosSet]);

    const crearCitaManual=async()=>{
      if(!manForm.nombre||!manForm.servicioId||!manForm.peluqueroId||!manForm.fecha||!manForm.hora)return;
      const svc=servicios.find(s=>s.id===Number(manForm.servicioId));
      const pel=CONFIG.peluqueros.find(p=>p.id===Number(manForm.peluqueroId));
      await crearCita({
        clienteNombre:manForm.nombre,clienteTel:manForm.telefono,
        servicio:svc.nombre,servicioId:svc.id,
        peluqueroId:pel.id,peluquero:pel.nombre,
        fecha:manForm.fecha,hora:manForm.hora,
        precio:svc.precio,estado:"pendiente",nota:manForm.nota
      });
      if(manForm.telefono){
        await crearOActualizarCliente({nombre:manForm.nombre,telefono:manForm.telefono,visitas:1,gasto:svc.precio,ultimaVisita:manForm.fecha,nota:"",historial:[{fecha:manForm.fecha,servicio:svc.nombre,peluquero:pel.nombre,precio:svc.precio}]});
      }
      setShowManual(false);
      setManForm({nombre:"",telefono:"",servicioId:"",peluqueroId:"",fecha:"",hora:"",nota:""});
      setClienteRec(null);
    };

    const [menuAbierto,setMenuAbierto]=useState(null);
    const [ultimaAccion,setUltimaAccion]=useState(null);
    const [citaEditando,setCitaEditando]=useState(null);
    const [citaBorrar,setCitaBorrar]=useState(null);
    const [showEditCalPicker,setShowEditCalPicker]=useState(false);

    const mostrarToast=(cita)=>{
      _citaEliminadaTemp=cita;
      setToastVisible(true);
      if(toastTimer) clearTimeout(toastTimer);
      const t=setTimeout(()=>{setToastVisible(false);_citaEliminadaTemp=null;},6000);
      setToastTimer(t);
    };

    const deshacerBorrado=async()=>{
      if(!_citaEliminadaTemp) return;
      const {id,...resto}=_citaEliminadaTemp;
      await crearCita(resto);
      _citaEliminadaTemp=null;
      setToastVisible(false);
      if(toastTimer) clearTimeout(toastTimer);
    };

    const confirmarBorrado=async()=>{
      const cita={...citaBorrar};
      await borrarCita(cita.id);
      setCitaBorrar(null);
      mostrarToast(cita);
    };

    const AccionesCita=({c})=>(
      <td style={{...as.td,position:"relative"}}>
        {c.estado==="pendiente"&&<><button style={as.actBtn(OK)} onClick={()=>cambiarEstado(c.id,"completada")}>✓</button><button style={as.actBtn(ER)} onClick={()=>cambiarEstado(c.id,"no-show")}>✗</button></>}
        {c.estado!=="pendiente"&&<button style={as.actBtn(TX2)} onClick={()=>cambiarEstado(c.id,"pendiente")}>↩</button>}
        <button style={as.actBtn(TX2)} onClick={()=>setMenuAbierto(menuAbierto===c.id?null:c.id)}>•••</button>
        {menuAbierto===c.id&&(
          <div style={{position:"absolute",right:0,top:"100%",background:WH,border:`1px solid ${CR3}`,borderRadius:10,boxShadow:"0 4px 16px rgba(0,0,0,0.12)",zIndex:50,minWidth:140,overflow:"hidden"}}>
            <button style={{display:"block",width:"100%",padding:"10px 16px",fontSize:12,fontWeight:600,color:TX,background:"none",border:"none",cursor:"pointer",textAlign:"left"}}
              onClick={()=>{setCitaEditando({...c});setMenuAbierto(null);}}>✏️ Editar cita</button>
            <button style={{display:"block",width:"100%",padding:"10px 16px",fontSize:12,fontWeight:600,color:ER,background:"none",border:"none",cursor:"pointer",textAlign:"left"}}
              onClick={()=>{setCitaBorrar({...c});setMenuAbierto(null);}}>🗑 Eliminar</button>
          </div>
        )}
      </td>
    );

    return(
      <div>
        <div className="admin-kpi-grid" style={as.kpiGrid}>
          {[["€"+ingrHoy,"Ingresos hoy"],[citasHoy.length,"Citas hoy"],[pendHoy,"Pendientes"],[noShowHoy,"No shows"]].map(([v,l],i)=>(
            <div key={i} style={as.kpi}><div style={as.kpiVal}>{v}</div><div style={as.kpiLbl}>{l}</div></div>
          ))}
        </div>
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
          {[["hoy","📋 Tabla hoy"],["semana","📅 Semana"],["peluquero","✂️ Por peluquero"]].map(([v,l])=>(
            <button key={v} style={{background:vista===v?A:CR2,color:vista===v?WH:TX,border:`1px solid ${vista===v?A:CR3}`,borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={()=>setVista(v)}>{l}</button>
          ))}
          <button style={{marginLeft:"auto",background:`linear-gradient(135deg,${A},#133A6A)`,color:WH,border:"none",borderRadius:8,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={()=>setShowManual(true)}>+ Nueva cita</button>
        </div>

        {/* MODAL NUEVA CITA con mini calendario */}
        {showManual&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{background:WH,borderRadius:18,padding:"28px",width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                <h3 style={{fontSize:16,fontWeight:700,color:TX}}>Nueva cita manual</h3>
                <button style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:TX2}} onClick={()=>setShowManual(false)}>✕</button>
              </div>
              <div style={{marginBottom:10}}><Lbl>Teléfono</Lbl><Inp value={manForm.telefono} onChange={e=>{setManForm(f=>({...f,telefono:e.target.value}));buscarCliente(e.target.value);}} placeholder="Ej: 666 111 222"/>{clienteRec&&<div style={{background:`${OK}12`,border:`1px solid ${OK}33`,borderRadius:8,padding:"8px 12px",marginTop:6,fontSize:12,color:TX}}>✓ {clienteRec.nombre} · {clienteRec.visitas} visitas</div>}</div>
              <div style={{marginBottom:10}}><Lbl>Nombre</Lbl><Inp value={manForm.nombre} onChange={e=>setManForm(f=>({...f,nombre:e.target.value}))} placeholder="Nombre del cliente"/></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <div><Lbl>Servicio</Lbl><Sel value={manForm.servicioId} onChange={e=>setManForm(f=>({...f,servicioId:e.target.value,hora:""}))}>
                  <option value="">Elige servicio</option>
                  {servicios.map(s=><option key={s.id} value={s.id}>{s.nombre} — €{s.precio}</option>)}
                </Sel></div>
                <div><Lbl>Peluquero</Lbl><Sel value={manForm.peluqueroId} onChange={e=>setManForm(f=>({...f,peluqueroId:e.target.value,hora:"",fecha:""}))}>
                  <option value="">Elige peluquero</option>
                  {CONFIG.peluqueros.map(p=><option key={p.id} value={p.id}>{p.emoji} {p.nombre}</option>)}
                </Sel></div>
              </div>

              {/* FIX: selector de fecha con mini calendario visual */}
              <div style={{marginBottom:10}}>
                <Lbl>Fecha</Lbl>
                <div style={{position:"relative"}}>
                  <button style={{width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,padding:"10px 13px",fontSize:13,color:manForm.fecha?TX:TX2,outline:"none",textAlign:"left",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"space-between"}}
                    onClick={()=>setShowCalPicker(v=>!v)}>
                    <span>{manForm.fecha||"Seleccionar fecha..."}</span>
                    <span style={{fontSize:16}}>📅</span>
                  </button>
                  {showCalPicker&&(
                    <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:200}}>
                      <MiniCalPicker
                        value={manForm.fecha}
                        onChange={iso=>{setManForm(f=>({...f,fecha:iso,hora:""}));setShowCalPicker(false);}}
                        festivosSet={festivosSet}
                        bloqueosPelId={manForm.peluqueroId?Number(manForm.peluqueroId):null}
                        bloqueos={bloqueos}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div style={{marginBottom:10}}>
                <Lbl>Hora</Lbl>
                <Sel value={manForm.hora} onChange={e=>setManForm(f=>({...f,hora:e.target.value}))} disabled={slotsManuales.length===0}>
                  <option value="">{slotsManuales.length===0?"Elige servicio, peluquero y fecha":"Elige hora"}</option>
                  {slotsManuales.map(h=><option key={h} value={h}>{h}</option>)}
                </Sel>
              </div>
              <div style={{marginBottom:16}}><Lbl>Nota (opcional)</Lbl><Inp value={manForm.nota} onChange={e=>setManForm(f=>({...f,nota:e.target.value}))} placeholder="Observaciones..."/></div>
              <div style={{display:"flex",gap:8}}>
                <Btn ok={false} onClick={()=>setShowManual(false)}>Cancelar</Btn>
                <Btn ok={!!(manForm.nombre&&manForm.servicioId&&manForm.peluqueroId&&manForm.fecha&&manForm.hora)} onClick={crearCitaManual} style={{flex:1}}>Confirmar cita →</Btn>
              </div>
            </div>
          </div>
        )}

        {citaEditando&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{background:WH,borderRadius:18,padding:"28px",width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                <h3 style={{fontSize:16,fontWeight:700,color:TX}}>Editar cita</h3>
                <button style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:TX2}} onClick={()=>{setCitaEditando(null);setShowEditCalPicker(false);}}>✕</button>
              </div>
              <div style={{marginBottom:10}}><Lbl>Cliente</Lbl><Inp value={citaEditando.clienteNombre} onChange={e=>setCitaEditando(f=>({...f,clienteNombre:e.target.value}))}/></div>
              <div style={{marginBottom:10}}><Lbl>Teléfono</Lbl><Inp value={citaEditando.clienteTel} onChange={e=>setCitaEditando(f=>({...f,clienteTel:e.target.value}))}/></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <div style={{position:"relative"}}>
                  <Lbl>Fecha</Lbl>
                  <button style={{width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,padding:"10px 13px",fontSize:13,color:citaEditando.fecha?TX:TX2,textAlign:"left",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"space-between",boxSizing:"border-box",outline:"none"}}
                    onClick={()=>setShowEditCalPicker(v=>!v)}>
                    <span>{citaEditando.fecha||"Seleccionar..."}</span><span>📅</span>
                  </button>
                  {showEditCalPicker&&(
                    <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:200}}>
                      <MiniCalPicker
                        value={citaEditando.fecha}
                        onChange={iso=>{setCitaEditando(f=>({...f,fecha:iso}));setShowEditCalPicker(false);}}
                        festivosSet={festivosSet}
                        bloqueosPelId={citaEditando.peluqueroId}
                        bloqueos={bloqueos}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <Lbl>Hora</Lbl>
                  <Inp type="time" value={citaEditando.hora} onChange={e=>setCitaEditando(f=>({...f,hora:e.target.value}))}/>
                </div>
              </div>
              <div style={{marginBottom:10}}><Lbl>Estado</Lbl>
                <Sel value={citaEditando.estado} onChange={e=>setCitaEditando(f=>({...f,estado:e.target.value}))}>
                  <option value="pendiente">Pendiente</option>
                  <option value="completada">Completada</option>
                  <option value="no-show">No show</option>
                </Sel>
              </div>
              <div style={{marginBottom:16}}><Lbl>Nota</Lbl><Inp value={citaEditando.nota||""} onChange={e=>setCitaEditando(f=>({...f,nota:e.target.value}))}/></div>
              <div style={{display:"flex",gap:8}}>
                <Btn ok={false} onClick={()=>{setCitaEditando(null);setShowEditCalPicker(false);}}>Cancelar</Btn>
                <Btn style={{flex:1}} onClick={async()=>{await actualizarCita(citaEditando.id,citaEditando);setCitas(prev=>prev.map(c=>c.id===citaEditando.id?citaEditando:c));setCitaEditando(null);setShowEditCalPicker(false);}}>Guardar cambios</Btn>
              </div>
            </div>
          </div>
        )}

        {citaBorrar&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{background:WH,borderRadius:18,padding:"32px",width:"100%",maxWidth:400,boxShadow:"0 20px 60px rgba(0,0,0,0.3)",textAlign:"center"}}>
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

        {vista==="hoy"&&(
          <div style={as.card}>
            <div style={{background:CR,border:`1px solid ${hayFiltros?A:CR3}`,borderRadius:10,padding:"10px 12px",marginBottom:14}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:mostrarBuscador||hayFiltros?10:0}}>
                <Inp inputRef={inputRef} style={{flex:1,marginBottom:0,padding:"7px 12px",fontSize:12}} defaultValue={busqCita} onChange={e=>setBusqCita(e.target.value)} placeholder="🔍 Buscar por nombre o teléfono..."/>
                <button style={{background:mostrarBuscador?`${A}15`:WH,border:`1px solid ${mostrarBuscador?A:CR3}`,borderRadius:8,padding:"7px 12px",fontSize:11,fontWeight:700,cursor:"pointer",color:mostrarBuscador?A:TX2,whiteSpace:"nowrap"}} onClick={()=>setMostrarBuscador(v=>!v)}>
                  {mostrarBuscador?"▲ Filtros":"▼ Filtros"}{hayFiltros?" ●":""}
                </button>
                {hayFiltros&&<button style={{background:ER+"15",border:`1px solid ${ER}33`,borderRadius:8,padding:"7px 10px",fontSize:11,fontWeight:700,cursor:"pointer",color:ER}} onClick={()=>{setBusqCita("");setFiltFecha("hoy");setFiltDesde("");setFiltHasta("");setFiltPel("todas");setFiltEstado("todos");setMostrarBuscador(false);}}>✕</button>}
              </div>
              {(mostrarBuscador||hayFiltros)&&(
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:7}}>
                  <div><Lbl>Fecha</Lbl><Sel style={{padding:"6px 9px",fontSize:11}} value={filtFecha} onChange={e=>setFiltFecha(e.target.value)}><option value="todas">Todas</option><option value="hoy">Hoy</option><option value="semana">Esta semana</option><option value="fecha">Fecha concreta</option><option value="rango">Rango</option></Sel></div>
                  {filtFecha==="fecha"&&(
                    <div style={{position:"relative"}}>
                      <Lbl>Fecha</Lbl>
                      <button style={{width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,padding:"6px 9px",fontSize:11,color:filtDesde?TX:TX2,textAlign:"left",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"space-between",boxSizing:"border-box",outline:"none"}}
                        onClick={()=>setShowFiltDesdeCalPicker(v=>!v)}>
                        <span>{filtDesde||"Seleccionar..."}</span><span>📅</span>
                      </button>
                      {showFiltDesdeCalPicker&&(
                        <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:200}}>
                          <MiniCalPicker value={filtDesde} onChange={iso=>{setFiltDesde(iso);setShowFiltDesdeCalPicker(false);}} festivosSet={festivosSet} bloqueosPelId={null} bloqueos={[]}/>
                        </div>
                      )}
                    </div>
                  )}
                  {filtFecha==="rango"&&(
                    <>
                      <div style={{position:"relative"}}>
                        <Lbl>Desde</Lbl>
                        <button style={{width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,padding:"6px 9px",fontSize:11,color:filtDesde?TX:TX2,textAlign:"left",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"space-between",boxSizing:"border-box",outline:"none"}}
                          onClick={()=>setShowFiltDesdeCalPicker(v=>!v)}>
                          <span>{filtDesde||"Desde..."}</span><span>📅</span>
                        </button>
                        {showFiltDesdeCalPicker&&(
                          <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:200}}>
                            <MiniCalPicker value={filtDesde} onChange={iso=>{setFiltDesde(iso);setShowFiltDesdeCalPicker(false);}} festivosSet={festivosSet} bloqueosPelId={null} bloqueos={[]}/>
                          </div>
                        )}
                      </div>
                      <div style={{position:"relative"}}>
                        <Lbl>Hasta</Lbl>
                        <button style={{width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,padding:"6px 9px",fontSize:11,color:filtHasta?TX:TX2,textAlign:"left",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"space-between",boxSizing:"border-box",outline:"none"}}
                          onClick={()=>setShowFiltHastaCalPicker(v=>!v)}>
                          <span>{filtHasta||"Hasta..."}</span><span>📅</span>
                        </button>
                        {showFiltHastaCalPicker&&(
                          <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:200}}>
                            <MiniCalPicker value={filtHasta} onChange={iso=>{setFiltHasta(iso);setShowFiltHastaCalPicker(false);}} festivosSet={festivosSet} bloqueosPelId={null} bloqueos={[]}/>
                          </div>
                        )}
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
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:700,color:A}}>{citasFiltradas.length} resultado{citasFiltradas.length!==1?"s":""}</div>
                </div>
                {citasFiltradas.length===0?<div style={{fontSize:13,color:TX2,fontStyle:"italic"}}>No se encontraron citas</div>:(
                  <div className="admin-table-wrap"><table style={as.table}>
                    <thead><tr>{["Fecha","Hora","Cliente","Servicio","Prof.","€","Estado","Acc."].map(h=><th key={h} style={as.th}>{h}</th>)}</tr></thead>
                    <tbody>{citasFiltradas.map(c=>(
                      <tr key={c.id}>
                        <td style={{...as.td,fontSize:11,color:TX2}}>{c.fecha===HOY_ISO?"Hoy":c.fecha}</td>
                        <td style={{...as.td,fontWeight:700,color:A}}>{c.hora}</td>
                        <td style={as.td}>{c.clienteNombre}</td>
                        <td style={as.td}>{c.servicio}</td>
                        <td style={as.td}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:"50%",background:CONFIG.peluqueros.find(p=>p.id===c.peluqueroId)?.color||A,flexShrink:0}}/>{c.peluquero}</span></td>
                        <td style={{...as.td,fontWeight:700}}>€{c.precio}</td>
                        <td style={as.td}><EstBdg e={c.estado}/></td>
                        <AccionesCita c={c}/>
                      </tr>
                    ))}</tbody>
                  </table></div>
                )}
              </>
            ):(
              <>
                <div style={{fontSize:11,fontWeight:700,color:TX2,textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>Citas de hoy — {fmtLarga(HOY)}</div>
                {citasHoy.length===0?<div style={{fontSize:13,color:TX2,fontStyle:"italic"}}>No hay citas para hoy</div>:(
                  <div className="admin-table-wrap"><table style={as.table}>
                    <thead><tr>{["Hora","Cliente","Servicio","Profesional","Precio","Estado","Nota","Acc."].map(h=><th key={h} style={as.th}>{h}</th>)}</tr></thead>
                    <tbody>{citasHoy.map(c=>(
                      <tr key={c.id}>
                        <td style={{...as.td,fontWeight:700,color:A}}>{c.hora}</td>
                        <td style={as.td}>{c.clienteNombre}<div style={{fontSize:10,color:TX2}}>{c.clienteTel}</div></td>
                        <td style={as.td}>{c.servicio}</td>
                        <td style={as.td}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:"50%",background:CONFIG.peluqueros.find(p=>p.id===c.peluqueroId)?.color||A,flexShrink:0}}/>{c.peluquero}</span></td>
                        <td style={{...as.td,fontWeight:700}}>€{c.precio}</td>
                        <td style={as.td}><EstBdg e={c.estado}/></td>
                        <td style={as.td}>{editNota===c.id?(<div style={{display:"flex",gap:4}}><Inp style={{padding:"4px 8px",fontSize:11}} value={notaVal} onChange={e=>setNotaVal(e.target.value)}/><button style={as.actBtn(OK)} onClick={()=>guardarNota(c.id)}>✓</button></div>):(<span style={{fontSize:11,color:c.nota?TX:TX2,cursor:"pointer",fontStyle:c.nota?"normal":"italic"}} onClick={()=>{setEditNota(c.id);setNotaVal(c.nota||"");}}>{c.nota||"+ nota"}</span>)}</td>
                        <AccionesCita c={c}/>
                      </tr>
                    ))}</tbody>
                  </table></div>
                )}
              </>
            )}
          </div>
        )}

        {vista==="semana"&&(
          <div style={as.card}>
            <NavSemana offset={weekOffset} onChange={setWeekOffset} weekDays={weekDays}/>
            <LeyendaPeluqueros/>
            <CalendarioGrid dias={weekDays} citas={citas} peluqueroFiltroId={null}/>
          </div>
        )}

        {vista==="peluquero"&&(
          <div>
            <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
              {CONFIG.peluqueros.map(p=>(
                <button key={p.id} style={{background:pelFiltro===p.id?p.color:CR2,color:pelFiltro===p.id?WH:TX,border:`1px solid ${pelFiltro===p.id?p.color:CR3}`,borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}} onClick={()=>setPelFiltro(pelFiltro===p.id?null:p.id)}>
                  {p.emoji} {p.nombre}{pelFiltro===p.id&&<span style={{fontSize:10}}>✓</span>}
                </button>
              ))}
            </div>
            <div style={as.card}>
              <NavSemana offset={weekOffset} onChange={setWeekOffset} weekDays={weekDays}/>
              {pelFiltro&&<div style={{marginBottom:8,display:"flex",alignItems:"center",gap:8}}><div style={{width:10,height:10,borderRadius:2,background:CONFIG.peluqueros.find(p=>p.id===pelFiltro)?.color}}/><span style={{fontSize:12,fontWeight:700,color:TX}}>{CONFIG.peluqueros.find(p=>p.id===pelFiltro)?.nombre}</span></div>}
              {!pelFiltro&&<LeyendaPeluqueros/>}
              <CalendarioGrid dias={weekDays} citas={citas} peluqueroFiltroId={pelFiltro}/>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── TAB CLIENTES ──
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
      if(!busq)return lista.sort((a,b)=>a.nombre.localeCompare(b.nombre));
      return lista.map(c=>({...c,score:c.telefono?.includes(busq)?90:similitud(busq,c.nombre)})).filter(c=>c.score>=60).sort((a,b)=>b.score-a.score);
    },[busq,inactivos,clientes]);
    const guardarNota=async()=>{
      setClientes(prev=>prev.map(c=>c.id===clienteSel.id?{...c,nota:notaVal}:c));
      setClienteSel(prev=>({...prev,nota:notaVal}));
      setEditNota(false);
      try{ await actualizarCliente(clienteSel.id,{nota:notaVal}); }catch(e){ console.error("Error guardando nota",e); }
    };
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
              <div key={c.id} style={{background:clienteSel?.id===c.id?`${A}0D`:WH,border:`1px solid ${clienteSel?.id===c.id?A:CR3}`,borderRadius:12,padding:"13px 15px",marginBottom:8,cursor:"pointer",position:"relative"}} onClick={()=>{setClienteSel(c);setEditNota(false);}}>
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
                <button style={{background:ER+"15",border:`1px solid ${ER}33`,color:ER,borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}
                  onClick={()=>setClienteBorrar(clienteSel)}>🗑 Eliminar</button>
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
                <div style={{background:CR,borderRadius:8,padding:"10px 12px",fontSize:13,color:clienteSel.nota?TX:TX2,fontStyle:clienteSel.nota?"normal":"italic",cursor:"pointer"}} onClick={()=>{setEditNota(true);setNotaVal(clienteSel.nota||"");}}>
                  {clienteSel.nota||"Sin notas. Pulsa para añadir..."}
                </div>
              )}
              <Divider/>
              <div style={{fontSize:11,fontWeight:700,color:TX2,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Historial</div>
              {(clienteSel.historial||[]).length===0?<div style={{fontSize:12,color:TX2,fontStyle:"italic"}}>Sin historial</div>:
                (clienteSel.historial||[]).map((h,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${CR2}`,fontSize:12}}>
                    <div><span style={{color:TX2,marginRight:8}}>{h.fecha}</span><span style={{color:TX}}>{h.servicio}</span></div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{color:TX2,fontSize:11}}>{h.peluquero}</span><span style={{fontWeight:700,color:A}}>€{h.precio}</span></div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
        {clienteBorrar&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{background:WH,borderRadius:18,padding:"32px",width:"100%",maxWidth:400,boxShadow:"0 20px 60px rgba(0,0,0,0.3)",textAlign:"center"}}>
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
                  if(toastClienteTimer) clearTimeout(toastClienteTimer);
                  const t=setTimeout(()=>{setToastClienteVisible(false);_clienteEliminadoTemp=null;},6000);
                  setToastClienteTimer(t);
                }}>Eliminar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── TAB CAJA ──
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
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
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
        <div style={as.card}>
          <div style={as.cardTitle}>Evolución ingresos</div>
          <div style={as.chartH}><ResponsiveContainer width="100%" height="100%"><LineChart data={STATS_INGRESOS}><XAxis dataKey="semana" tick={{fontSize:9,fill:TX2}}/><YAxis tick={{fontSize:9,fill:TX2}}/><Tooltip formatter={v=>`€${v}`} contentStyle={{background:WH,border:`1px solid ${CR3}`,borderRadius:8,fontSize:11}}/><Line type="monotone" dataKey="actual" stroke={A} strokeWidth={2.5} dot={{fill:A,r:3}}/><Line type="monotone" dataKey="anterior" stroke={CR3} strokeWidth={2} strokeDasharray="4 4" dot={false}/></LineChart></ResponsiveContainer></div>
        </div>
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

  // ── TAB DISPONIBILIDAD ── (festivos y bloqueos ahora van a Firebase)
  const TabDisponibilidad=()=>{
  const [showFF,setShowFF]=useState(false), [showBF,setShowBF]=useState(false);
  const [festForm,setFestForm]=useState({fecha:"",motivo:""});
  const [bloqForm,setBloqForm]=useState({peluqueroId:"",tipo:"dia",desde:"",hasta:"",motivo:""});
  const [showFestCalPicker,setShowFestCalPicker]=useState(false);
  const [showBloqDesdeCalPicker,setShowBloqDesdeCalPicker]=useState(false);
  const [showBloqHastaCalPicker,setShowBloqHastaCalPicker]=useState(false);

  const addF=async()=>{
    if(!festForm.fecha||!festForm.motivo)return;
    await crearFestivo(festForm);
    setFestForm({fecha:"",motivo:""});setShowFF(false);
  };
  const delF=async(id)=>{ await borrarFestivo(id); };
  const addB=async()=>{
    if(!bloqForm.peluqueroId||!bloqForm.desde||!bloqForm.motivo)return;
    await crearBloqueo({...bloqForm,hasta:bloqForm.tipo==="dia"?bloqForm.desde:bloqForm.hasta});
    setBloqForm({peluqueroId:"",tipo:"dia",desde:"",hasta:"",motivo:""});setShowBF(false);
  };
  const delB=async(id)=>{ await borrarBloqueo(id); };

  return(
    <div style={as.twoCol}>
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <h3 style={{fontSize:13,fontWeight:700,color:TX,margin:0}}>🗓️ Días festivos</h3>
          <Btn sm onClick={()=>setShowFF(v=>!v)}>+ Añadir</Btn>
        </div>
        {showFF&&(
          <div style={{...as.card,marginBottom:12}}>
            <div style={{marginBottom:8,position:"relative"}}>
              <Lbl>Fecha</Lbl>
              <button style={{width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,padding:"10px 13px",fontSize:13,color:festForm.fecha?TX:TX2,textAlign:"left",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"space-between",boxSizing:"border-box",outline:"none"}}
                onClick={()=>setShowFestCalPicker(v=>!v)}>
                <span>{festForm.fecha||"Seleccionar fecha..."}</span>
                <span>📅</span>
              </button>
              {showFestCalPicker&&(
                <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:200}}>
                  <MiniCalPicker
                    value={festForm.fecha}
                    onChange={iso=>{setFestForm(f=>({...f,fecha:iso}));setShowFestCalPicker(false);}}
                    festivosSet={festivosSet}
                    bloqueosPelId={null}
                    bloqueos={[]}
                  />
                </div>
              )}
            </div>
            <div style={{marginBottom:10}}>
              <Lbl>Motivo</Lbl>
              <Inp value={festForm.motivo} onChange={e=>setFestForm(f=>({...f,motivo:e.target.value}))} placeholder="Ej: Navidad"/>
            </div>
            <div style={{display:"flex",gap:6}}>
              <Btn ok={false} sm onClick={()=>{setShowFF(false);setShowFestCalPicker(false);}}>Cancelar</Btn>
              <Btn sm onClick={addF}>Guardar</Btn>
            </div>
          </div>
        )}
        {festivos.sort((a,b)=>a.fecha.localeCompare(b.fecha)).map(f=>(
          <div key={f.id} style={{...as.card,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",marginBottom:8}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:TX}}>{f.motivo}</div>
              <div style={{fontSize:11,color:TX2}}>{f.fecha}</div>
            </div>
            <button style={as.actBtn(ER)} onClick={()=>delF(f.id)}>Quitar</button>
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
            <div style={{marginBottom:8}}>
              <Lbl>Peluquero</Lbl>
              <Sel value={bloqForm.peluqueroId} onChange={e=>setBloqForm(f=>({...f,peluqueroId:e.target.value}))}>
                <option value="">Elige</option>
                {CONFIG.peluqueros.map(p=><option key={p.id} value={p.id}>{p.emoji} {p.nombre}</option>)}
              </Sel>
            </div>
            <div style={{marginBottom:8}}>
              <Lbl>Tipo</Lbl>
              <Sel value={bloqForm.tipo} onChange={e=>setBloqForm(f=>({...f,tipo:e.target.value}))}>
                <option value="dia">Día suelto</option>
                <option value="semana">Rango de días</option>
              </Sel>
            </div>
            <div style={{display:"grid",gridTemplateColumns:bloqForm.tipo==="semana"?"1fr 1fr":"1fr",gap:8,marginBottom:8}}>
              <div style={{position:"relative"}}>
                <Lbl>{bloqForm.tipo==="semana"?"Fecha inicio":"Fecha"}</Lbl>
                <button style={{width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,padding:"10px 13px",fontSize:13,color:bloqForm.desde?TX:TX2,textAlign:"left",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"space-between",boxSizing:"border-box",outline:"none"}}
                  onClick={()=>setShowBloqDesdeCalPicker(v=>!v)}>
                  <span>{bloqForm.desde||"Fecha..."}</span><span>📅</span>
                </button>
                {showBloqDesdeCalPicker&&(
                  <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:200}}>
                    <MiniCalPicker
                      value={bloqForm.desde}
                      onChange={iso=>{setBloqForm(f=>({...f,desde:iso}));setShowBloqDesdeCalPicker(false);}}
                      festivosSet={festivosSet}
                      bloqueosPelId={bloqForm.peluqueroId?Number(bloqForm.peluqueroId):null}
                      bloqueos={bloqueos}
                    />
                  </div>
                )}
              </div>
              {bloqForm.tipo==="semana"&&(
                <div style={{position:"relative"}}>
                  <Lbl>Fecha fin</Lbl>
                  <button style={{width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,padding:"10px 13px",fontSize:13,color:bloqForm.hasta?TX:TX2,textAlign:"left",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"space-between",boxSizing:"border-box",outline:"none"}}
                    onClick={()=>setShowBloqHastaCalPicker(v=>!v)}>
                    <span>{bloqForm.hasta||"Fecha..."}</span><span>📅</span>
                  </button>
                  {showBloqHastaCalPicker&&(
                    <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:200}}>
                      <MiniCalPicker
                        value={bloqForm.hasta}
                        onChange={iso=>{setBloqForm(f=>({...f,hasta:iso}));setShowBloqHastaCalPicker(false);}}
                        festivosSet={festivosSet}
                        bloqueosPelId={bloqForm.peluqueroId?Number(bloqForm.peluqueroId):null}
                        bloqueos={bloqueos}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{marginBottom:10}}>
              <Lbl>Motivo</Lbl>
              <Inp value={bloqForm.motivo} onChange={e=>setBloqForm(f=>({...f,motivo:e.target.value}))} placeholder="Ej: Vacaciones"/>
            </div>
            <div style={{display:"flex",gap:6}}>
              <Btn ok={false} sm onClick={()=>setShowBF(false)}>Cancelar</Btn>
              <Btn sm onClick={addB}>Guardar</Btn>
            </div>
          </div>
        )}
        {bloqueos.map(b=>{
          const pel=CONFIG.peluqueros.find(p=>p.id===Number(b.peluqueroId));
          return(
            <div key={b.id} style={{...as.card,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",marginBottom:8}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:TX}}>{pel?.emoji} {pel?.nombre} — {b.motivo}</div>
                <div style={{fontSize:11,color:TX2}}>{b.tipo==="dia"?b.desde:`${b.desde} → ${b.hasta}`}</div>
              </div>
              <button style={as.actBtn(ER)} onClick={()=>delB(b.id)}>Quitar</button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

  // ── TAB CONFIG ──
  const TabConfig=()=>{
    const [subTab,setSubTab]=useState("servicios");
    const [editSvc,setEditSvc]=useState(null);
    const [newSvc,setNewSvc]=useState({nombre:"",duracionMin:30,precio:0,emoji:"✂️"});
    const [showNew,setShowNew]=useState(false);
    const [showNewVal,setShowNewVal]=useState(false);
    const [newVal,setNewVal]=useState({nombre:"",estrellas:5,comentario:"",servicio:""});
    const [editVal,setEditVal]=useState(null);
    const guardarSvc=()=>{if(!editSvc.nombre)return;setServicios(prev=>prev.map(s=>s.id===editSvc.id?editSvc:s));setEditSvc(null);};
    const addSvc=()=>{if(!newSvc.nombre)return;setServicios(prev=>[...prev,{...newSvc,id:Date.now(),precio:Number(newSvc.precio),duracionMin:Number(newSvc.duracionMin)}]);setNewSvc({nombre:"",duracionMin:30,precio:0,emoji:"✂️"});setShowNew(false);};
    const addVal=()=>{if(!newVal.nombre||!newVal.comentario)return;setValoraciones(p=>[...p,{...newVal,id:Date.now()}]);setNewVal({nombre:"",estrellas:5,comentario:"",servicio:""});setShowNewVal(false);};
    const saveEdit=()=>{if(!editVal)return;setValoraciones(p=>p.map(v=>v.id===editVal.id?editVal:v));setEditVal(null);};
    return(
      <div>
        <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
          {[["servicios","Servicios"],["valoraciones","Opiniones"],["accesos","Accesos"],["horarios","Horarios"]].map(([v,l])=>(
            <button key={v} style={{background:subTab===v?A:CR2,color:subTab===v?WH:TX,border:`1px solid ${subTab===v?A:CR3}`,borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={()=>setSubTab(v)}>{l}</button>
          ))}
        </div>
        {subTab==="servicios"&&(
          <div>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}><Btn sm onClick={()=>setShowNew(v=>!v)}>+ Nuevo servicio</Btn></div>
            {showNew&&(<div style={{...as.card,marginBottom:12}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}><div><Lbl>Nombre</Lbl><Inp value={newSvc.nombre} onChange={e=>setNewSvc(f=>({...f,nombre:e.target.value}))} placeholder="Nombre"/></div><div><Lbl>Emoji</Lbl><Inp value={newSvc.emoji} onChange={e=>setNewSvc(f=>({...f,emoji:e.target.value}))}/></div><div><Lbl>Duración (min)</Lbl><Inp type="number" value={newSvc.duracionMin} onChange={e=>setNewSvc(f=>({...f,duracionMin:e.target.value}))}/></div><div><Lbl>Precio (€)</Lbl><Inp type="number" value={newSvc.precio} onChange={e=>setNewSvc(f=>({...f,precio:e.target.value}))}/></div></div><div style={{display:"flex",gap:6}}><Btn ok={false} sm onClick={()=>setShowNew(false)}>Cancelar</Btn><Btn sm onClick={addSvc}>Añadir</Btn></div></div>)}
            <div style={as.card}><table style={as.table}><thead><tr>{["Emoji","Nombre","Duración","Precio","Acciones"].map(h=><th key={h} style={as.th}>{h}</th>)}</tr></thead><tbody>{servicios.map(s=>(<tr key={s.id}>{editSvc?.id===s.id?(<><td style={as.td}><Inp style={{width:50,padding:"4px 8px"}} value={editSvc.emoji} onChange={e=>setEditSvc(f=>({...f,emoji:e.target.value}))}/></td><td style={as.td}><Inp style={{padding:"4px 8px"}} value={editSvc.nombre} onChange={e=>setEditSvc(f=>({...f,nombre:e.target.value}))}/></td><td style={as.td}><Inp style={{width:70,padding:"4px 8px"}} type="number" value={editSvc.duracionMin} onChange={e=>setEditSvc(f=>({...f,duracionMin:Number(e.target.value)}))}/></td><td style={as.td}><Inp style={{width:70,padding:"4px 8px"}} type="number" value={editSvc.precio} onChange={e=>setEditSvc(f=>({...f,precio:Number(e.target.value)}))}/></td><td style={as.td}><button style={as.actBtn(OK)} onClick={guardarSvc}>✓</button><button style={as.actBtn(TX2)} onClick={()=>setEditSvc(null)}>✕</button></td></>):(<><td style={as.td}>{s.emoji}</td><td style={{...as.td,fontWeight:600}}>{s.nombre}</td><td style={as.td}>{s.duracionMin} min</td><td style={{...as.td,fontWeight:700,color:A}}>€{s.precio}</td><td style={as.td}><button style={as.actBtn(A)} onClick={()=>setEditSvc({...s})}>✏️</button><button style={as.actBtn(ER)} onClick={()=>setServicios(p=>p.filter(x=>x.id!==s.id))}>🗑</button></td></>)}</tr>))}</tbody></table></div>
          </div>
        )}
        {subTab==="valoraciones"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontSize:12,color:TX2}}>Opiniones visibles en la web</div><Btn sm onClick={()=>setShowNewVal(v=>!v)}>+ Añadir</Btn>
            </div>
            {showNewVal&&(<div style={{...as.card,marginBottom:14,border:`1px solid ${A}44`}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}><div><Lbl>Nombre</Lbl><Inp value={newVal.nombre} onChange={e=>setNewVal(f=>({...f,nombre:e.target.value}))} placeholder="Ej: Laura M."/></div><div><Lbl>Servicio</Lbl><Inp value={newVal.servicio} onChange={e=>setNewVal(f=>({...f,servicio:e.target.value}))} placeholder="Ej: Corte"/></div></div><div style={{marginBottom:10}}><Lbl>Valoración</Lbl><div style={{display:"flex",gap:4}}>{[1,2,3,4,5].map(i=><span key={i} style={{fontSize:22,cursor:"pointer",color:i<=newVal.estrellas?"#F59E0B":"#D1D5DB"}} onClick={()=>setNewVal(f=>({...f,estrellas:i}))}>★</span>)}</div></div><div style={{marginBottom:14}}><Lbl>Comentario</Lbl><textarea value={newVal.comentario} onChange={e=>setNewVal(f=>({...f,comentario:e.target.value}))} style={{width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,padding:"10px 13px",fontSize:13,color:TX,outline:"none",boxSizing:"border-box",fontFamily:FONT,minHeight:80,resize:"vertical"}}/></div><div style={{display:"flex",gap:8}}><Btn ok={false} sm onClick={()=>setShowNewVal(false)}>Cancelar</Btn><Btn sm onClick={addVal}>Guardar</Btn></div></div>)}
            {valoraciones.map(v=>(<div key={v.id} style={{...as.card,marginBottom:10}}>{editVal?.id===v.id?(<div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}><div><Lbl>Nombre</Lbl><Inp value={editVal.nombre} onChange={e=>setEditVal(f=>({...f,nombre:e.target.value}))}/></div><div><Lbl>Servicio</Lbl><Inp value={editVal.servicio} onChange={e=>setEditVal(f=>({...f,servicio:e.target.value}))}/></div></div><div style={{marginBottom:10}}><Lbl>Valoración</Lbl><div style={{display:"flex",gap:4}}>{[1,2,3,4,5].map(i=><span key={i} style={{fontSize:22,cursor:"pointer",color:i<=editVal.estrellas?"#F59E0B":"#D1D5DB"}} onClick={()=>setEditVal(f=>({...f,estrellas:i}))}>★</span>)}</div></div><div style={{marginBottom:12}}><Lbl>Comentario</Lbl><textarea value={editVal.comentario} onChange={e=>setEditVal(f=>({...f,comentario:e.target.value}))} style={{width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,padding:"10px 13px",fontSize:13,color:TX,outline:"none",boxSizing:"border-box",fontFamily:FONT,minHeight:70,resize:"vertical"}}/></div><div style={{display:"flex",gap:8}}><Btn ok={false} sm onClick={()=>setEditVal(null)}>Cancelar</Btn><Btn sm onClick={saveEdit}>Guardar</Btn></div></div>):(<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}><span style={{fontSize:13,fontWeight:700,color:TX}}>{v.nombre}</span><div style={{display:"flex",gap:1}}>{Array.from({length:5}).map((_,i)=><span key={i} style={{fontSize:12,color:i<v.estrellas?"#F59E0B":"#D1D5DB"}}>★</span>)}</div><span style={{fontSize:11,color:TX2}}>{v.servicio}</span></div><p style={{fontSize:12,color:TX2,margin:0,fontStyle:"italic"}}>"{v.comentario}"</p></div><div style={{display:"flex",gap:6,marginLeft:12}}><button style={as.actBtn(A)} onClick={()=>setEditVal({...v})}>✏️</button><button style={as.actBtn(ER)} onClick={()=>setValoraciones(p=>p.filter(x=>x.id!==v.id))}>🗑</button></div></div>)}</div>))}
            {valoraciones.length===0&&<div style={{textAlign:"center",padding:"30px",color:TX2,fontSize:13,background:WH,borderRadius:12,border:`1px solid ${CR3}`,fontStyle:"italic"}}>No hay opiniones.</div>}
          </div>
        )}
        {subTab==="accesos"&&(
          <div style={as.card}>
            <div style={as.cardTitle}>Niveles de acceso</div>
            <div style={{background:CR,borderRadius:10,padding:"12px 14px",marginBottom:14,fontSize:12,color:TX2}}>🔐 <strong>Dueño:</strong> Acceso completo · Usuario: <code style={{background:CR2,padding:"1px 6px",borderRadius:4}}>{CONFIG.adminUser}</code></div>
            {CONFIG.peluqueros.map(p=>(<div key={p.id} style={as.row}><div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:20}}>{p.emoji}</span><div><div style={{fontSize:13,fontWeight:700,color:TX}}>{p.nombre}</div><div style={{fontSize:11,color:TX2}}>Usuario: <code style={{background:CR2,padding:"1px 6px",borderRadius:4}}>{normalize(p.nombre)}</code></div></div></div><Bdg color={TX2}>Solo mi agenda</Bdg></div>))}
          </div>
        )}
        {subTab==="horarios"&&(
          <div>{CONFIG.peluqueros.map(p=>(<div key={p.id} style={{...as.card,marginBottom:12}}><div style={{fontSize:13,fontWeight:700,color:TX,marginBottom:12,display:"flex",alignItems:"center",gap:8}}><span style={{width:10,height:10,borderRadius:2,background:p.color}}/>{p.emoji} {p.nombre}</div><table style={as.table}><thead><tr>{["Día","Entrada","Salida","Descanso"].map(h=><th key={h} style={as.th}>{h}</th>)}</tr></thead><tbody>{[1,2,3,4,5,6].map(d=>{const h=p.horario[d];return(<tr key={d}><td style={{...as.td,fontWeight:700}}>{DIAS_FULL[d]}</td><td style={as.td}>{h?h.entrada:<span style={{color:TX2}}>—</span>}</td><td style={as.td}>{h?h.salida:<span style={{color:TX2}}>—</span>}</td><td style={as.td}>{h?.descanso?`${h.descanso.inicio}–${h.descanso.fin}`:<span style={{color:TX2}}>—</span>}</td></tr>);})}</tbody></table></div>))}</div>
        )}
      </div>
    );
  };

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
          const misCitas=citasPeriodo.filter(c=>c.peluqueroId===p.id);
          const completadas=misCitas.filter(c=>c.estado==="completada");
          const ingresos=completadas.reduce((s,c)=>s+c.precio,0);
          const noShows=misCitas.filter(c=>c.estado==="no-show").length;
          const tasaNS=misCitas.length>0?Math.round(noShows/misCitas.length*100):0;
          const serviciosCount={};
          misCitas.forEach(c=>{serviciosCount[c.servicio]=(serviciosCount[c.servicio]||0)+1;});
          const topServicio=Object.entries(serviciosCount).sort((a,b)=>b[1]-a[1])[0];
          return(
            <div key={p.id} style={{...as.card,marginBottom:14,borderLeft:`4px solid ${p.color}`}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                <span style={{fontSize:24}}>{p.emoji}</span>
                <div><div style={{fontSize:15,fontWeight:700,color:TX}}>{p.nombre}</div><div style={{fontSize:12,color:TX2}}>{p.especialidad}</div></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
                {[
                  [misCitas.length,"Citas totales"],
                  [completadas.length,"Completadas"],
                  [`€${ingresos}`,"Ingresos"],
                  [`${tasaNS}%`,"No shows"],
                ].map(([v,l])=>(
                  <div key={l} style={{background:CR,borderRadius:9,padding:"10px",textAlign:"center"}}>
                    <div style={{fontSize:17,fontWeight:700,color:p.color}}>{v}</div>
                    <div style={{fontSize:10,color:TX2,textTransform:"uppercase",letterSpacing:0.5}}>{l}</div>
                  </div>
                ))}
              </div>
              {topServicio&&(
                <div style={{background:`${p.color}10`,border:`1px solid ${p.color}30`,borderRadius:8,padding:"8px 12px",fontSize:12}}>
                  <span style={{color:TX2}}>Servicio más popular: </span>
                  <span style={{fontWeight:700,color:p.color}}>{topServicio[0]}</span>
                  <span style={{color:TX2}}> ({topServicio[1]} veces)</span>
                </div>
              )}
              {!topServicio&&<div style={{fontSize:12,color:TX2,fontStyle:"italic"}}>Sin citas en este período</div>}
            </div>
          );
        })}
      </div>
    );
  };

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

  return(
    <div style={as.root}>
      <div style={as.header}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,background:`linear-gradient(135deg,${A},#133A6A)`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>✂️</div>
          <div><div style={{fontSize:15,fontWeight:700,color:TX}}>{CONFIG.nombre} — Panel de gestión</div><div style={{fontSize:11,color:TX2}}>{fmtLarga(HOY)}</div></div>
        </div>
        <button style={{background:CR2,border:`1px solid ${CR3}`,borderRadius:8,padding:"6px 14px",fontSize:12,color:TX2,cursor:"pointer"}} onClick={onLogout}>Cerrar sesión →</button>
      </div>
      <div style={as.tabBar}>{tabs.map(([id,ic,l])=><button key={id} style={as.tabBtn(tab===id)} onClick={()=>setTab(id)}>{ic} {l}</button>)}</div>
      <div className="admin-body" style={as.body}>
        {tab==="citas"&&<TabCitas/>}
        {tab==="clientes"&&<TabClientes/>}
        {tab==="caja"&&<TabCaja/>}
        {tab==="stats"&&<TabStats/>}
        {tab==="disponibilidad"&&<TabDisponibilidad/>}
        {tab==="config"&&<TabConfig/>}
        {tab==="comunicacion"&&<TabComunicacion/>}
      </div>
      {toastVisible&&(
        <div style={{position:"fixed",bottom:30,left:"50%",transform:"translateX(-50%)",background:"#1e293b",color:WH,borderRadius:12,padding:"14px 20px",display:"flex",alignItems:"center",gap:16,boxShadow:"0 8px 24px rgba(0,0,0,0.3)",zIndex:200,fontSize:13,whiteSpace:"nowrap"}}>
          <span>🗑 Cita eliminada</span>
          <button style={{background:A,color:WH,border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={async()=>{if(!_citaEliminadaTemp)return;const{id,...resto}=_citaEliminadaTemp;await crearCita(resto);_citaEliminadaTemp=null;setToastVisible(false);if(toastTimer)clearTimeout(toastTimer);}}>Deshacer</button>
        </div>
      )}
      {toastClienteVisible&&(
        <div style={{position:"fixed",bottom:30,left:"50%",transform:"translateX(-50%)",background:"#1e293b",color:WH,borderRadius:12,padding:"14px 20px",display:"flex",alignItems:"center",gap:16,boxShadow:"0 8px 24px rgba(0,0,0,0.3)",zIndex:200,fontSize:13,whiteSpace:"nowrap"}}>
          <span>🗑 Cliente eliminado</span>
          <button style={{background:A,color:WH,border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={async()=>{if(!_clienteEliminadoTemp)return;const{id,...resto}=_clienteEliminadoTemp;await addDoc(collection(db,"clientes"),resto);_clienteEliminadoTemp=null;setToastClienteVisible(false);if(toastClienteTimer)clearTimeout(toastClienteTimer);}}>Deshacer</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ROOT — festivos y bloqueos se suscriben a Firebase aquí
// ═══════════════════════════════════════════════════════════════
export default function App(){
  const [vista,setVista]=useState("cliente");
  const [peluqueroActivo,setPeluqueroActivo]=useState(null);
  const [citas,setCitas]=useState([]);
  const [clientes,setClientes]=useState([]);
  const [valoraciones,setValoraciones]=useState([]);
  const [festivos,setFestivos]=useState([]);
  const [bloqueos,setBloqueos]=useState([]);
  const [cargando,setCargando]=useState(true);
  const [iniciado,setIniciado]=useState(false);

  useEffect(()=>{
    const u1=suscribirCitas(data=>{setCitas(data);setCargando(false);});
    const u2=suscribirClientes(setClientes);
    const u3=suscribirValoraciones(setValoraciones);
    const u4=suscribirFestivos(setFestivos);
    const u5=suscribirBloqueos(setBloqueos);
    const t=setTimeout(()=>setCargando(false),5000);
    return()=>{u1();u2();u3();u4();u5();clearTimeout(t);};
  },[]);

  useEffect(()=>{
    if(!cargando&&citas.length===0&&!iniciado){
      setIniciado(true);
      seedDatabase().then(()=>console.log("Seed OK"));
    }
  },[cargando,citas,iniciado]);

  if(cargando) return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#F0F4F9",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:40,marginBottom:16}}>✂️</div>
        <div style={{fontSize:16,fontWeight:700,color:"#0D1F35"}}>Cargando...</div>
        <div style={{fontSize:12,color:"#4A6080",marginTop:8}}>Conectando con Firebase</div>
      </div>
    </div>
  );

  if(vista==="login") return <LoginAdmin onLoginDueno={()=>setVista("admin")} onLoginPeluquero={p=>{setPeluqueroActivo(p);setVista("peluquero");}} onBack={()=>setVista("cliente")}/>;
  if(vista==="admin") return <AdminPanel onLogout={()=>setVista("cliente")} valoraciones={valoraciones} setValoraciones={setValoraciones} festivos={festivos} setFestivos={setFestivos} bloqueos={bloqueos} setBloqueos={setBloqueos}/>;
  if(vista==="peluquero") return <PeluqueroView peluquero={peluqueroActivo} citas={citas} onLogout={()=>setVista("cliente")}/>;
  return <ClienteApp onAdmin={()=>setVista("login")} valoraciones={valoraciones} citas={citas} festivos={festivos} bloqueos={bloqueos}/>;
}