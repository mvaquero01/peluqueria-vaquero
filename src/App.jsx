import { useState, useMemo, useEffect, useRef } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ── Inyectar estilos de animación y responsive ──────────────────
const STYLE = document.createElement("style");
STYLE.textContent = `
  @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
  .anim { animation: fadeUp 0.5s ease both; }
  .anim-fade { animation: fadeIn 0.4s ease both; }
  @media (max-width: 640px) {
    .admin-kpi-grid { grid-template-columns: repeat(2,1fr) !important; }
    .admin-two-col  { grid-template-columns: 1fr !important; }
    .admin-table-wrap { overflow-x: auto; }
    .admin-body { padding: 12px 10px !important; }
    .hide-mobile { display: none !important; }
    .admin-card-mobile { display: flex; flex-direction: column; gap: 6px; }
  }
`;
document.head.appendChild(STYLE);

// ═══════════════════════════════════════════════════════════════
// CONFIG — Solo cambia esto para cada peluquería
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
    {id:1,  nombre:"Corte de cabello",    duracionMin:30,  precio:15, emoji:"✂️"},
    {id:2,  nombre:"Corte + Barba",       duracionMin:50,  precio:22, emoji:"🪒"},
    {id:3,  nombre:"Arreglo de barba",    duracionMin:20,  precio:10, emoji:"🧔"},
    {id:4,  nombre:"Fade / Degradado",    duracionMin:40,  precio:18, emoji:"💈"},
    {id:5,  nombre:"Coloración completa", duracionMin:90,  precio:45, emoji:"🎨"},
    {id:6,  nombre:"Mechas / Highlights", duracionMin:120, precio:65, emoji:"✨"},
    {id:7,  nombre:"Alisado keratina",    duracionMin:150, precio:80, emoji:"💆"},
    {id:8,  nombre:"Lavado + Secado",     duracionMin:25,  precio:8,  emoji:"🚿"},
    {id:9,  nombre:"Tratamiento capilar", duracionMin:45,  precio:25, emoji:"🌿"},
    {id:10, nombre:"Diseño de cejas",     duracionMin:20,  precio:12, emoji:"👁️"},
  ],

  peluqueros: [
    { id:1, nombre:"Carlos", especialidad:"Corte clásico & Barba", emoji:"✂️", color:"#E63946", password:"carlos123",
      horario:{
        1:{entrada:"09:00",salida:"18:00",descanso:{inicio:"14:00",fin:"15:00"}},
        2:{entrada:"09:00",salida:"18:00",descanso:{inicio:"14:00",fin:"15:00"}},
        3:{entrada:"09:00",salida:"18:00",descanso:{inicio:"14:00",fin:"15:00"}},
        4:{entrada:"09:00",salida:"18:00",descanso:{inicio:"14:00",fin:"15:00"}},
        5:{entrada:"09:00",salida:"18:00",descanso:{inicio:"14:00",fin:"15:00"}},
      }},
    { id:2, nombre:"Miguel", especialidad:"Fade & Degradados", emoji:"🪒", color:"#2A9D8F", password:"miguel123",
      horario:{
        1:{entrada:"12:00",salida:"20:00",descanso:{inicio:"16:00",fin:"17:00"}},
        2:{entrada:"12:00",salida:"20:00",descanso:{inicio:"16:00",fin:"17:00"}},
        3:{entrada:"12:00",salida:"20:00",descanso:{inicio:"16:00",fin:"17:00"}},
        4:{entrada:"12:00",salida:"20:00",descanso:{inicio:"16:00",fin:"17:00"}},
        5:{entrada:"12:00",salida:"20:30",descanso:null},
        6:{entrada:"09:00",salida:"15:00",descanso:null},
      }},
    { id:3, nombre:"Andrés", especialidad:"Coloración & Tendencias", emoji:"🎨", color:"#E9C46A", password:"andres123",
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
const normalize = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();

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

function generarSlots(hp,durMin){
  const slots=[]; let cur=toMin(hp.entrada);
  const fin=toMin(hp.salida)-durMin;
  while(cur<=fin){
    const finSlot=cur+durMin;
    if(hp.descanso){const dI=toMin(hp.descanso.inicio),dF=toMin(hp.descanso.fin);if(cur<dF&&finSlot>dI){cur=dF;continue;}}
    slots.push(toStr(cur)); cur+=15;
  }
  return slots;
}

// Semana empieza LUNES
function getWeekDays(offset=0){
  const hoy=new Date(), dow=hoy.getDay();
  const mon=new Date(hoy);
  mon.setDate(hoy.getDate()-(dow===0?6:dow-1)+offset*7);
  return Array.from({length:6},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d;});
}

function getDias(){
  const dias=[],hoy=new Date();
  for(let i=1;i<=21;i++){const d=new Date(hoy);d.setDate(hoy.getDate()+i);if(CONFIG.horarioGeneral[d.getDay()])dias.push(d);}
  return dias;
}

// Genera 3 semanas completas Lun-Dom empezando desde el lunes de la semana siguiente (o actual)
function getCalendarWeeks(){
  const hoy=new Date(); hoy.setHours(0,0,0,0);
  const dow=hoy.getDay(); // 0=dom, 1=lun...
  const lunes=new Date(hoy);
  // Ir al lunes de esta semana
  lunes.setDate(hoy.getDate()-(dow===0?6:dow-1));
  // Si ya estamos a mitad de semana, empezar desde la semana siguiente
  // En cualquier caso mostramos 3 semanas completas desde el lunes actual
  const semanas=[];
  for(let s=0;s<3;s++){
    const semana=[];
    for(let d=0;d<7;d++){
      const dia=new Date(lunes);
      dia.setDate(lunes.getDate()+s*7+d);
      semana.push(dia);
    }
    semanas.push(semana);
  }
  return semanas;
}

const isoDate = d => d.toISOString().split("T")[0];
const fmtLarga = d => `${DIAS_FULL[d.getDay()]} ${d.getDate()} de ${MESES_ES[d.getMonth()]}`;
const haceNSemanas = n => { const d=new Date(); d.setDate(d.getDate()-n*7); return isoDate(d); };
const HOY=new Date(), HOY_ISO=isoDate(HOY);

// ═══════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════
const semana=getWeekDays();
const CITAS_INIT=[
  {id:1, clienteNombre:"María García",    clienteTel:"611111111", servicio:"Corte de cabello",    servicioId:1,  peluqueroId:1, peluquero:"Carlos", fecha:HOY_ISO,            hora:"09:30", precio:15, estado:"completada", nota:""},
  {id:2, clienteNombre:"Juan López",      clienteTel:"622222222", servicio:"Fade / Degradado",    servicioId:4,  peluqueroId:2, peluquero:"Miguel", fecha:HOY_ISO,            hora:"12:30", precio:18, estado:"completada", nota:"Siempre el mismo fade"},
  {id:3, clienteNombre:"Sofía Martín",    clienteTel:"633333333", servicio:"Coloración completa", servicioId:5,  peluqueroId:3, peluquero:"Andrés", fecha:HOY_ISO,            hora:"10:30", precio:45, estado:"pendiente",  nota:""},
  {id:4, clienteNombre:"Pedro Ruiz",      clienteTel:"644444444", servicio:"Corte de cabello",    servicioId:1,  peluqueroId:1, peluquero:"Carlos", fecha:HOY_ISO,            hora:"11:00", precio:15, estado:"pendiente",  nota:""},
  {id:5, clienteNombre:"Laura Sánchez",   clienteTel:"655555555", servicio:"Mechas / Highlights", servicioId:6,  peluqueroId:3, peluquero:"Andrés", fecha:HOY_ISO,            hora:"11:00", precio:65, estado:"pendiente",  nota:"Mechas balayage"},
  {id:6, clienteNombre:"Carlos Fdez.",    clienteTel:"666666666", servicio:"Arreglo de barba",    servicioId:3,  peluqueroId:2, peluquero:"Miguel", fecha:HOY_ISO,            hora:"13:00", precio:10, estado:"no-show",    nota:""},
  {id:7, clienteNombre:"Ana Torres",      clienteTel:"677777777", servicio:"Tratamiento capilar", servicioId:9,  peluqueroId:3, peluquero:"Andrés", fecha:HOY_ISO,            hora:"14:30", precio:25, estado:"pendiente",  nota:""},
  {id:8, clienteNombre:"Rubén Díaz",      clienteTel:"688888888", servicio:"Corte + Barba",       servicioId:2,  peluqueroId:1, peluquero:"Carlos", fecha:HOY_ISO,            hora:"16:00", precio:22, estado:"pendiente",  nota:""},
  {id:9, clienteNombre:"Isabel Rey",      clienteTel:"691111111", servicio:"Corte de cabello",    servicioId:1,  peluqueroId:1, peluquero:"Carlos", fecha:isoDate(semana[1]), hora:"10:00", precio:15, estado:"pendiente",  nota:""},
  {id:10,clienteNombre:"Marcos Gil",      clienteTel:"692222222", servicio:"Corte + Barba",       servicioId:2,  peluqueroId:2, peluquero:"Miguel", fecha:isoDate(semana[1]), hora:"13:00", precio:22, estado:"pendiente",  nota:""},
  {id:11,clienteNombre:"Elena Vega",      clienteTel:"693333333", servicio:"Alisado keratina",    servicioId:7,  peluqueroId:3, peluquero:"Andrés", fecha:isoDate(semana[2]), hora:"09:30", precio:80, estado:"pendiente",  nota:""},
  {id:12,clienteNombre:"Roberto Cas.",    clienteTel:"694444444", servicio:"Fade / Degradado",    servicioId:4,  peluqueroId:2, peluquero:"Miguel", fecha:isoDate(semana[3]), hora:"12:30", precio:18, estado:"pendiente",  nota:""},
  {id:13,clienteNombre:"Carmen Lara",     clienteTel:"695555555", servicio:"Mechas / Highlights", servicioId:6,  peluqueroId:3, peluquero:"Andrés", fecha:isoDate(semana[4]), hora:"10:00", precio:65, estado:"pendiente",  nota:""},
  {id:14,clienteNombre:"David Mora",      clienteTel:"696666666", servicio:"Corte de cabello",    servicioId:1,  peluqueroId:1, peluquero:"Carlos", fecha:isoDate(semana[5]), hora:"09:30", precio:15, estado:"pendiente",  nota:""},
];

const CLIENTES_INIT=[
  {id:1,nombre:"María García",  telefono:"611111111",visitas:12,gasto:280,ultimaVisita:HOY_ISO,         nota:"Alérgica al amoniaco. Prefiere a Carlos.",historial:[{fecha:HOY_ISO,servicio:"Corte de cabello",peluquero:"Carlos",precio:15},{fecha:haceNSemanas(4),servicio:"Corte de cabello",peluquero:"Carlos",precio:15}]},
  {id:2,nombre:"Juan López",    telefono:"622222222",visitas:8, gasto:160,ultimaVisita:HOY_ISO,         nota:"",historial:[{fecha:HOY_ISO,servicio:"Fade / Degradado",peluquero:"Miguel",precio:18}]},
  {id:3,nombre:"Sofía Martín",  telefono:"633333333",visitas:5, gasto:230,ultimaVisita:HOY_ISO,         nota:"Le gusta el tono castaño cálido.",historial:[{fecha:HOY_ISO,servicio:"Coloración completa",peluquero:"Andrés",precio:45}]},
  {id:4,nombre:"Laura Sánchez", telefono:"655555555",visitas:7, gasto:510,ultimaVisita:HOY_ISO,         nota:"Mechas cada 6 semanas.",historial:[{fecha:HOY_ISO,servicio:"Mechas / Highlights",peluquero:"Andrés",precio:65}]},
  {id:5,nombre:"Ana Torres",    telefono:"677777777",visitas:15,gasto:390,ultimaVisita:haceNSemanas(1), nota:"Cliente VIP. Muy puntual.",historial:[{fecha:haceNSemanas(1),servicio:"Tratamiento capilar",peluquero:"Andrés",precio:25}]},
  {id:6,nombre:"Roberto Díaz",  telefono:"688888888",visitas:3, gasto:45, ultimaVisita:haceNSemanas(6), nota:"",historial:[{fecha:haceNSemanas(6),servicio:"Corte de cabello",peluquero:"Carlos",precio:15}]},
  {id:7,nombre:"Carmen López",  telefono:"699999999",visitas:2, gasto:30, ultimaVisita:haceNSemanas(9), nota:"",historial:[{fecha:haceNSemanas(9),servicio:"Lavado + Secado",peluquero:"Andrés",precio:8}]},
  {id:8,nombre:"Pedro Ruiz",    telefono:"644444444",visitas:3, gasto:45, ultimaVisita:haceNSemanas(2), nota:"",historial:[]},
];

const FESTIVOS_INIT=[
  {id:1,fecha:"2026-04-02",motivo:"Jueves Santo"},
  {id:2,fecha:"2026-04-03",motivo:"Viernes Santo"},
  {id:3,fecha:"2026-05-01",motivo:"Día del Trabajo"},
  {id:4,fecha:"2026-12-25",motivo:"Navidad"},
];
const BLOQUEOS_INIT=[
  {id:1,peluqueroId:2,tipo:"dia",  desde:"2026-04-10",hasta:"2026-04-10",motivo:"Médico"},
  {id:2,peluqueroId:3,tipo:"semana",desde:"2026-07-07",hasta:"2026-07-11",motivo:"Vacaciones"},
];

const VALORACIONES_INIT=[
  {id:1,nombre:"Laura M.",      estrellas:5,comentario:"Carlos es increíble, siempre me deja el pelo perfecto. Llevo años viniendo y nunca me ha fallado.",servicio:"Corte de cabello"},
  {id:2,nombre:"Javier R.",     estrellas:5,comentario:"Miguel hace los mejores degradados de Barcelona. El local es muy cómodo y el trato es excelente.",servicio:"Fade / Degradado"},
  {id:3,nombre:"Marta S.",      estrellas:5,comentario:"Andrés es un artista con el color. Le conté lo que quería y el resultado fue exactamente lo que imaginaba.",servicio:"Mechas / Highlights"},
];

const STATS_INGRESOS=[
  {semana:"S1 Feb",actual:420,anterior:380},{semana:"S2 Feb",actual:580,anterior:490},
  {semana:"S3 Feb",actual:510,anterior:520},{semana:"S4 Feb",actual:690,anterior:610},
  {semana:"S1 Mar",actual:740,anterior:690},{semana:"S2 Mar",actual:620,anterior:580},
  {semana:"S3 Mar",actual:810,anterior:620},
];
const STATS_DIAS=[{dia:"Lun",citas:8},{dia:"Mar",citas:11},{dia:"Mié",citas:9},{dia:"Jue",citas:13},{dia:"Vie",citas:16},{dia:"Sáb",citas:14}];
const STATS_SERVICIOS=[{nombre:"Corte",c:38},{nombre:"Fade",c:24},{nombre:"Corte+Barba",c:19},{nombre:"Coloración",c:14},{nombre:"Barba",c:18},{nombre:"Mechas",c:9}];

// ── Cargar librerías de exportación ────────────────────────────
(()=>{
  const scripts=[
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  ];
  scripts.forEach(src=>{
    if(!document.querySelector(`script[src="${src}"]`)){
      const s=document.createElement("script"); s.src=src; document.head.appendChild(s);
    }
  });
})();
// ═══════════════════════════════════════════════════════════════
(()=>{const l=document.createElement("link");l.rel="stylesheet";l.href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap";document.head.appendChild(l);})();
const FONT="'Plus Jakarta Sans', sans-serif";

// ═══════════════════════════════════════════════════════════════
// THEME — Azul marino
// ═══════════════════════════════════════════════════════════════
const A="#1B4F8A";
const CR="#F0F4F9",CR2="#E0E8F2",CR3="#CED9E8";
const WH="#F8FBFF",TX="#0D1F35",TX2="#4A6080";
const OK="#16a34a",ER="#dc2626";

// ═══════════════════════════════════════════════════════════════
// SMALL COMPONENTS
// ═══════════════════════════════════════════════════════════════
const Bdg=({children,color=A,small})=>(
  <span style={{background:color+"18",color,border:`1px solid ${color}33`,borderRadius:20,padding:small?"2px 7px":"3px 10px",fontSize:small?10:11,fontWeight:700,whiteSpace:"nowrap"}}>{children}</span>
);
const EstBdg=({e})=>{
  const m={completada:[OK,"Completada ✓"],pendiente:[A,"Pendiente"],"no-show":[ER,"No show ✗"]};
  const [c,l]=m[e]||[TX2,e]; return <Bdg color={c}>{l}</Bdg>;
};
const Divider=()=><div style={{height:1,background:CR2,margin:"12px 0"}}/>;
const Lbl=({children})=><div style={{fontSize:11,color:TX2,textTransform:"uppercase",letterSpacing:1,marginBottom:5,fontWeight:700}}>{children}</div>;
const Inp=({style,...p})=><input style={{width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,padding:"10px 13px",fontSize:13,color:TX,outline:"none",boxSizing:"border-box",fontFamily:"inherit",...style}} {...p}/>;
const Sel=({style,...p})=><select style={{width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,padding:"10px 13px",fontSize:13,color:TX,outline:"none",boxSizing:"border-box",fontFamily:"inherit",...style}} {...p}/>;
const Btn=({ok=true,sm,style,children,...p})=>(
  <button style={{background:ok?`linear-gradient(135deg,${A},#133A6A)`:CR2,color:ok?WH:TX2,border:ok?"none":`1px solid ${CR3}`,borderRadius:sm?8:11,padding:sm?"7px 14px":"12px 20px",fontSize:sm?12:13,fontWeight:700,cursor:ok?"pointer":"not-allowed",letterSpacing:0.5,boxShadow:ok?`0 3px 12px ${A}33`:"none",...style}} {...p}>{children}</button>
);

// ═══════════════════════════════════════════════════════════════
// CALENDARIO VISUAL — componente de cuadrícula horaria
// ═══════════════════════════════════════════════════════════════
const PX_MIN = 1.4; // píxeles por minuto
const HORA_APERTURA_GLOBAL = 9 * 60;  // 9:00 en minutos
const HORA_CIERRE_GLOBAL   = 20 * 60 + 30; // 20:30
const TOTAL_MIN = HORA_CIERRE_GLOBAL - HORA_APERTURA_GLOBAL;
const GRID_HEIGHT = TOTAL_MIN * PX_MIN;
const HORA_LABELS = Array.from({length:12},(_,i)=>i+9); // 9..20

function CalendarioGrid({dias, citas, peluqueroFiltroId}){
  return(
    <div style={{display:"flex",overflowX:"auto",overflowY:"auto",maxHeight:600,background:WH,border:`1px solid ${CR3}`,borderRadius:13}}>
      {/* Eje de horas */}
      <div style={{width:44,flexShrink:0,position:"relative",height:GRID_HEIGHT+20,borderRight:`1px solid ${CR3}`,background:CR}}>
        <div style={{height:32,borderBottom:`1px solid ${CR3}`}}/> {/* cabecera vacía */}
        <div style={{position:"relative",height:GRID_HEIGHT}}>
          {HORA_LABELS.map(h=>(
            <div key={h} style={{position:"absolute",top:(h*60-HORA_APERTURA_GLOBAL)*PX_MIN-7,left:0,right:0,textAlign:"right",paddingRight:6,fontSize:9,color:TX2,fontWeight:600}}>
              {h}:00
            </div>
          ))}
        </div>
      </div>

      {/* Columnas por día */}
      {dias.map((d,i)=>{
        const iso=isoDate(d);
        const esHoy=iso===HOY_ISO;
        const hGen=CONFIG.horarioGeneral[d.getDay()];
        const citasDia=citas
          .filter(c=>c.fecha===iso&&(!peluqueroFiltroId||c.peluqueroId===peluqueroFiltroId))
          .sort((a,b)=>a.hora.localeCompare(b.hora));

        // Rangos de horario por peluquero para fondo
        const pelEnEsteDia=CONFIG.peluqueros.filter(p=>!!p.horario[d.getDay()]);

        return(
          <div key={i} style={{flex:1,minWidth:90,borderRight:`1px solid ${CR3}`,display:"flex",flexDirection:"column"}}>
            {/* Cabecera del día */}
            <div style={{height:32,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",borderBottom:`1px solid ${CR3}`,background:esHoy?`${A}12`:CR,flexShrink:0}}>
              <span style={{fontSize:9,fontWeight:700,color:esHoy?A:TX2,textTransform:"uppercase",letterSpacing:0.5}}>{DIAS_ES[d.getDay()]}</span>
              <span style={{fontSize:13,fontWeight:700,color:esHoy?A:TX}}>{d.getDate()} {MESES_ES[d.getMonth()]}</span>
            </div>

            {/* Cuerpo con la cuadrícula */}
            <div style={{position:"relative",height:GRID_HEIGHT,flexShrink:0}}>

              {/* Líneas de hora */}
              {HORA_LABELS.map(h=>(
                <div key={h} style={{position:"absolute",top:(h*60-HORA_APERTURA_GLOBAL)*PX_MIN,left:0,right:0,borderTop:`1px solid ${h%2===0?CR3:CR2}`,zIndex:0}}/>
              ))}

              {/* Zona fuera del horario general (peluquería cerrada) */}
              {!hGen&&(
                <div style={{position:"absolute",inset:0,background:"repeating-linear-gradient(45deg,#F5F0E8,#F5F0E8 4px,#EDE6D9 4px,#EDE6D9 8px)",zIndex:1,opacity:0.6}}/>
              )}

              {/* Zonas de descanso por peluquero (sombreado sutil) */}
              {hGen&&pelEnEsteDia.map(p=>{
                const hp=p.horario[d.getDay()];
                if(!hp?.descanso)return null;
                const top=(toMin(hp.descanso.inicio)-HORA_APERTURA_GLOBAL)*PX_MIN;
                const height=(toMin(hp.descanso.fin)-toMin(hp.descanso.inicio))*PX_MIN;
                return(
                  <div key={p.id} style={{position:"absolute",left:0,right:0,top,height,background:p.color+"0A",zIndex:1,borderTop:`1px dashed ${p.color}33`,borderBottom:`1px dashed ${p.color}33`}}/>
                );
              })}

              {/* Bloques de citas */}
              {citasDia.map((c,ci)=>{
                const svc=CONFIG.servicios.find(s=>s.id===c.servicioId)||{duracionMin:30};
                const pel=CONFIG.peluqueros.find(p=>p.id===c.peluqueroId);
                const colorPel=pel?.color||A;
                const startMin=toMin(c.hora)-HORA_APERTURA_GLOBAL;
                const durMin=svc.duracionMin;
                const top=startMin*PX_MIN;
                const height=Math.max(durMin*PX_MIN-2,18);

                // Si hay varios peluqueros en el mismo día sin filtro, desplazar horizontalmente
                const pelIdx=peluqueroFiltroId?0:CONFIG.peluqueros.findIndex(p=>p.id===c.peluqueroId);
                const totalPel=peluqueroFiltroId?1:CONFIG.peluqueros.length;
                const colW=100/totalPel;
                const left=`calc(${pelIdx*colW}% + 1px)`;
                const width=`calc(${colW}% - 2px)`;

                return(
                  <div key={c.id} style={{
                    position:"absolute",top,left,width,height,
                    background:`${colorPel}22`,
                    border:`1.5px solid ${colorPel}99`,
                    borderLeft:`3px solid ${colorPel}`,
                    borderRadius:4,
                    padding:"2px 4px",
                    overflow:"hidden",
                    zIndex:2,
                    boxSizing:"border-box",
                    cursor:"default",
                  }}>
                    <div style={{fontSize:9,fontWeight:700,color:colorPel,lineHeight:1.3}}>{c.hora}</div>
                    {height>20&&<div style={{fontSize:9,color:TX,fontWeight:600,lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.clienteNombre.split(" ")[0]}</div>}
                    {height>34&&<div style={{fontSize:8,color:TX2,lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.servicio}</div>}
                    {height>48&&<div style={{fontSize:8,color:colorPel,fontWeight:600}}>{pel?.nombre}</div>}
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

// Leyenda de colores peluqueros
function LeyendaPeluqueros(){
  return(
    <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:10}}>
      {CONFIG.peluqueros.map(p=>(
        <div key={p.id} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:TX}}>
          <div style={{width:10,height:10,borderRadius:2,background:p.color,flexShrink:0}}/>
          {p.emoji} {p.nombre}
        </div>
      ))}
    </div>
  );
}

// Navegación de semana
function NavSemana({offset,onChange,weekDays}){
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
      <button style={{background:CR2,border:`1px solid ${CR3}`,borderRadius:7,padding:"5px 12px",fontSize:12,cursor:"pointer",color:TX}} onClick={()=>onChange(o=>o-1)}>← Anterior</button>
      <span style={{fontSize:12,fontWeight:700,color:TX}}>
        {weekDays[0].getDate()} {MESES_ES[weekDays[0].getMonth()]} – {weekDays[5].getDate()} {MESES_ES[weekDays[5].getMonth()]}
      </span>
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
function ClienteApp({onAdmin, valoraciones}){
  const [paso,setPaso]=useState(0);
  const [catAbierta,setCatAbierta]=useState(null);
  const [selServicio,setSelServicio]=useState(null);
  const [selPeluquero,setSelPeluquero]=useState(null);
  const [selDia,setSelDia]=useState(null);
  const [selHora,setSelHora]=useState(null);
  const [form,setForm]=useState({nombre:"",telefono:""});
  const dias=getDias();

  const slots=useMemo(()=>{
    if(!selPeluquero||!selDia||!selServicio)return[];
    const hp=selPeluquero.horario[selDia.getDay()];
    return hp?generarSlots(hp,selServicio.duracionMin):[];
  },[selPeluquero,selDia,selServicio]);

  const reset=()=>{setPaso(0);setCatAbierta(null);setSelServicio(null);setSelPeluquero(null);setSelDia(null);setSelHora(null);setForm({nombre:"",telefono:""});};
  const waMsgCliente=`Hola ${form.nombre} 👋%0AReserva confirmada en *${CONFIG.nombre}*%0A%0A✂️ ${selServicio?.nombre}%0A💈 ${selPeluquero?.nombre}%0A📅 ${selDia?fmtLarga(selDia):""}%0A🕐 ${selHora}%0A💶 €${selServicio?.precio}%0A%0ATe esperamos 😊`;

  const horarioResumido=()=>{
    const g={};
    Object.entries(CONFIG.horarioGeneral).forEach(([d,h])=>{const k=`${h.apertura}–${h.cierre}`;if(!g[k])g[k]=[];g[k].push(Number(d));});
    return Object.entries(g).map(([h,ds])=>({horas:h,rango:ds.map(d=>DIAS_ES[d]).join(", ")}));
  };

  const cs={
    root:{fontFamily:FONT,background:CR,minHeight:"100vh",color:TX},
    header:{background:WH,borderBottom:`1px solid ${CR3}`,padding:"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10,boxShadow:"0 1px 8px rgba(0,0,0,0.05)"},
    logoBox:{width:34,height:34,background:`linear-gradient(135deg,${A},#133A6A)`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16},
    hero:{background:`linear-gradient(160deg,#0D1F35 0%,#1B3A5C 55%,#142D48 100%)`,padding:"48px 20px 36px",textAlign:"center",position:"relative",overflow:"hidden"},
    heroGlow:{position:"absolute",top:-60,left:"50%",transform:"translateX(-50%)",width:300,height:300,background:`radial-gradient(circle,${A}22 0%,transparent 70%)`,pointerEvents:"none"},
    btnPpal:{background:`linear-gradient(135deg,${A},#133A6A)`,color:WH,border:"none",borderRadius:12,padding:"15px 40px",fontSize:15,fontWeight:700,cursor:"pointer",letterSpacing:1,boxShadow:`0 6px 24px ${A}55`},
    section:{padding:"18px",maxWidth:500,margin:"0 auto"},
    sTitle:{fontSize:11,color:A,letterSpacing:3,textTransform:"uppercase",marginBottom:14,fontWeight:700},
    cat:{background:WH,border:`1px solid ${CR3}`,borderRadius:13,marginBottom:8,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"},
    catHeader:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",cursor:"pointer"},
    catLeft:{display:"flex",alignItems:"center",gap:10},
    catIcon:{width:38,height:38,background:CR2,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18},
    svcRow:(sel)=>({display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 16px 11px 64px",cursor:"pointer",background:sel?`${A}08`:CR,borderTop:`1px solid ${CR2}`,transition:"background 0.15s"}),
    diasGrid:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5,marginBottom:18},
    diaBtn:(a,dis)=>({background:dis?CR:a?`linear-gradient(135deg,${A},#133A6A)`:WH,border:`1px solid ${dis?CR3:a?A:CR3}`,borderRadius:9,padding:"7px 3px",cursor:dis?"not-allowed":"pointer",textAlign:"center",opacity:dis?0.4:1,boxShadow:a?`0 2px 8px ${A}44`:"none"}),
    horasGrid:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7},
    horaBtn:(a)=>({background:a?`linear-gradient(135deg,${A},#133A6A)`:WH,border:`1px solid ${a?A:CR3}`,borderRadius:8,padding:"10px 0",cursor:"pointer",textAlign:"center",fontSize:13,color:a?WH:TX,fontWeight:a?700:400,boxShadow:a?`0 2px 8px ${A}44`:"none"}),
    card:(sel)=>({background:sel?`${A}0D`:WH,border:`1px solid ${sel?A:CR3}`,borderRadius:13,padding:"13px 16px",marginBottom:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 1px 4px rgba(0,0,0,0.04)",transition:"all 0.15s"}),
    cardLeft:{display:"flex",alignItems:"center",gap:12},
    cardEmoji:{width:42,height:42,background:CR2,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18},
    resBox:{background:WH,border:`1px solid ${CR3}`,borderRadius:13,padding:"16px",marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"},
    resFila:(last)=>({display:"flex",justifyContent:"space-between",alignItems:"center",paddingBottom:last?0:9,marginBottom:last?0:9,borderBottom:last?"none":`1px solid ${CR2}`}),
    inp:{width:"100%",background:WH,border:`1px solid ${CR3}`,borderRadius:10,padding:"12px 14px",fontSize:14,color:TX,marginBottom:8,outline:"none",boxSizing:"border-box",fontFamily:"inherit"},
    btnSig:(ok)=>({width:"100%",background:ok?`linear-gradient(135deg,${A},#133A6A)`:CR2,color:ok?WH:TX2,border:ok?"none":`1px solid ${CR3}`,borderRadius:12,padding:"14px",fontSize:14,fontWeight:700,cursor:ok?"pointer":"not-allowed",marginTop:18,letterSpacing:0.5,boxShadow:ok?`0 4px 16px ${A}44`:"none"}),
    backBtn:{background:"transparent",border:"none",color:TX2,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",gap:5,marginBottom:14,padding:0},
    progreso:{background:WH,borderBottom:`1px solid ${CR3}`,padding:"10px 18px",display:"flex",gap:4,alignItems:"center",justifyContent:"center"},
    prog:(d,a)=>({height:4,flex:1,maxWidth:55,borderRadius:2,background:d?A:a?A+"66":CR3}),
    successBox:{textAlign:"center",padding:"50px 20px"},
    successIcon:{width:72,height:72,background:`linear-gradient(135deg,${A},#133A6A)`,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,margin:"0 auto 20px",boxShadow:`0 8px 32px ${A}44`},
    infoBar:{display:"flex",background:WH,borderBottom:`1px solid ${CR3}`},
    infoItem:{flex:1,textAlign:"center",padding:"13px 6px",borderRight:`1px solid ${CR3}`},
    cancelPolicy:{background:`${A}0A`,border:`1px solid ${A}22`,borderRadius:10,padding:"10px 14px",fontSize:12,color:TX2,marginBottom:12},
  };

  if(paso===0) return(
    <div style={cs.root}>
      <div style={cs.header}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,background:`linear-gradient(135deg,${A},#133A6A)`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>✂️</div>
          <span style={{fontSize:17,fontWeight:700,color:TX,fontFamily:FONT}}>{CONFIG.nombre}</span>
        </div>
        <button style={{background:"transparent",border:"none",color:CR3,cursor:"pointer",fontSize:13,padding:0}} onClick={onAdmin}>⚙</button>
      </div>
      <div className="anim" style={{...cs.hero,animationDelay:"0s"}}>
        <div style={cs.heroGlow}/>
        <div style={{fontSize:48,marginBottom:10}}>💈</div>
        <h1 style={{fontSize:32,fontWeight:700,color:WH,marginBottom:6,letterSpacing:1}}>{CONFIG.nombre}</h1>
        <p style={{fontSize:15,color:"#7AADD4",marginBottom:4,fontStyle:"italic"}}>"{CONFIG.slogan}"</p>
        <p style={{fontSize:12,color:"#4A7AAA",marginBottom:28}}>📍 {CONFIG.direccion} · 📞 {CONFIG.telefono}</p>
        <button style={cs.btnPpal} onClick={()=>setPaso(1)}>RESERVAR CITA</button>
      </div>
      <div className="anim" style={{...cs.infoBar,animationDelay:"0.1s"}}>
        {[["⭐","4.9","valoración"],["✂️",CONFIG.peluqueros.length,"profesionales"],["💼",CONFIG.servicios.length,"servicios"],["🕐","24/7","reservas"]].map(([ic,v,l],i)=>(
          <div key={i} style={cs.infoItem}><div style={{fontSize:18}}>{ic}</div><div style={{fontSize:14,fontWeight:700,color:A}}>{v}</div><div style={{fontSize:10,color:TX2}}>{l}</div></div>
        ))}
      </div>
      <div className="anim" style={{padding:"0 18px",marginTop:18,animationDelay:"0.2s"}}>
        <div style={{background:WH,border:`1px solid ${CR3}`,borderRadius:14,padding:"16px",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <span style={{fontSize:12,fontWeight:700,color:TX,letterSpacing:1,textTransform:"uppercase"}}>Horario</span>
            <Bdg color={CONFIG.horarioGeneral[HOY.getDay()]?OK:ER}>{CONFIG.horarioGeneral[HOY.getDay()]?"Abierto hoy":"Cerrado hoy"}</Bdg>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
            {horarioResumido().map(({rango,horas},i)=>(
              <div key={i} style={{background:`${A}12`,border:`1px solid ${A}33`,borderRadius:20,padding:"5px 12px",fontSize:12}}>
                <span style={{fontWeight:700,color:TX}}>{rango}</span>
                <span style={{color:TX2,marginLeft:5}}>{horas}</span>
              </div>
            ))}
            <div style={{background:CR2,border:`1px solid ${CR3}`,borderRadius:20,padding:"5px 12px",fontSize:12,color:TX2}}>Dom — Cerrado</div>
          </div>
        </div>
      </div>
      <div className="anim" style={{...cs.section,animationDelay:"0.3s"}}>
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
                <span style={{color:TX2,fontSize:18,transition:"transform 0.2s",transform:abierta?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
              </div>
              {abierta&&svcs.map(s=>(
                <div key={s.id} style={{...cs.svcRow(false),cursor:"default"}}>
                  <div><span style={{fontSize:13,color:TX,fontWeight:600}}>{s.nombre}</span><span style={{fontSize:11,color:TX2,marginLeft:8}}>⏱ {s.duracionMin} min</span></div>
                  <span style={{fontSize:14,fontWeight:700,color:A}}>€{s.precio}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div className="anim" style={{...cs.section,animationDelay:"0.4s"}}>
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
      {/* VALORACIONES */}
      {valoraciones.length>0&&(
        <div className="anim" style={{...cs.section,paddingTop:0,animationDelay:"0.5s"}}>
          <div style={cs.sTitle}>✦ Opiniones</div>
          {valoraciones.map(v=>(
            <div key={v.id} style={{background:WH,border:`1px solid ${CR3}`,borderRadius:13,padding:"14px 16px",marginBottom:8,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:TX}}>{v.nombre}</div>
                  <div style={{fontSize:11,color:TX2}}>{v.servicio}</div>
                </div>
                <div style={{display:"flex",gap:1}}>{Array.from({length:5}).map((_,i)=><span key={i} style={{fontSize:13,color:i<v.estrellas?"#F59E0B":"#D1D5DB"}}>★</span>)}</div>
              </div>
              <p style={{fontSize:12,color:TX2,margin:0,lineHeight:1.6,fontStyle:"italic"}}>"{v.comentario}"</p>
            </div>
          ))}
        </div>
      )}
      <div style={{height:20}}/>
    </div>
  );

  return(
    <div style={cs.root}>
      <div style={cs.header}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={cs.logoBox}>✂️</div>
          <span style={{fontSize:17,fontWeight:700,color:TX}}>{CONFIG.nombre}</span>
        </div>
      </div>
      {paso>=1&&paso<=4&&<div style={cs.progreso}>{[1,2,3,4].map(p=><div key={p} style={cs.prog(paso>p,paso===p)}/>)}<span style={{fontSize:10,color:TX2,marginLeft:8}}>Paso {paso} de 4</span></div>}

      {paso===1&&(
        <div style={cs.section}>
          <button style={cs.backBtn} onClick={()=>setPaso(0)}>← Inicio</button>
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
                  <span style={{color:TX2,fontSize:18,transition:"transform 0.2s",transform:abierta?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
                </div>
                {abierta&&svcs.map(s=>(
                  <div key={s.id} style={cs.svcRow(selServicio?.id===s.id)} onClick={()=>setSelServicio(s)}>
                    <div><span style={{fontSize:13,color:TX,fontWeight:600}}>{s.nombre}</span><span style={{fontSize:11,color:TX2,marginLeft:8}}>⏱ {s.duracionMin} min</span></div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:14,fontWeight:700,color:A}}>€{s.precio}</span>{selServicio?.id===s.id&&<span style={{color:A}}>✓</span>}</div>
                  </div>
                ))}
              </div>
            );
          })}
          <button style={cs.btnSig(!!selServicio)} disabled={!selServicio} onClick={()=>selServicio&&setPaso(2)}>CONTINUAR →</button>
        </div>
      )}

      {paso===2&&(
        <div style={cs.section}>
          <button style={cs.backBtn} onClick={()=>{setPaso(1);setSelPeluquero(null);}}>← Cambiar servicio</button>
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
          <button style={cs.btnSig(!!selPeluquero)} disabled={!selPeluquero} onClick={()=>selPeluquero&&setPaso(3)}>CONTINUAR →</button>
        </div>
      )}

      {paso===3&&(
        <div style={cs.section}>
          <button style={cs.backBtn} onClick={()=>{setPaso(2);setSelDia(null);setSelHora(null);}}>← Cambiar profesional</button>
          <div style={cs.sTitle}>✦ Elige fecha y hora</div>
          <div style={{background:CR2,borderRadius:10,padding:"9px 14px",marginBottom:16,fontSize:12,color:TX2}}>{selPeluquero?.emoji} {selPeluquero?.nombre} · {selServicio?.nombre} · <span style={{color:A,fontWeight:700}}>€{selServicio?.precio}</span></div>
          {/* Cabecera días de la semana */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:4}}>
            {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map(d=>(
              <div key={d} style={{textAlign:"center",fontSize:9,fontWeight:700,color:d==="Dom"?ER+"99":TX2,textTransform:"uppercase",letterSpacing:0.5,padding:"3px 0"}}>{d}</div>
            ))}
          </div>
          {/* Semanas */}
          {getCalendarWeeks().map((semana,si)=>(
            <div key={si} style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:4}}>
              {semana.map((d,di)=>{
                const hoy2=new Date(); hoy2.setHours(0,0,0,0);
                const esPasado=d<=hoy2;
                const esDom=d.getDay()===0;
                const abiertoPelu=!!selPeluquero?.horario[d.getDay()];
                const abiertoGen=!!CONFIG.horarioGeneral[d.getDay()];
                const disp=!esPasado&&!esDom&&abiertoPelu&&abiertoGen;
                const a=selDia?.toDateString()===d.toDateString();
                return(
                  <button key={di} style={{
                    background:a?`linear-gradient(135deg,${A},#8B6508)`:esDom||esPasado?"transparent":disp?WH:CR,
                    border:`1px solid ${a?A:esDom||esPasado?"transparent":disp?CR3:CR3}`,
                    borderRadius:9,padding:"6px 2px",cursor:disp?"pointer":"default",
                    textAlign:"center",opacity:esPasado?0.25:1,
                    boxShadow:a?`0 2px 8px ${A}44`:"none",
                  }} disabled={!disp} onClick={()=>{if(disp){setSelDia(d);setSelHora(null);}}}>
                    <span style={{fontSize:12,fontWeight:700,color:a?WH:esDom?ER+"88":disp?TX:TX2,display:"block"}}>{d.getDate()}</span>
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
          <button style={cs.btnSig(!!(selDia&&selHora))} disabled={!selDia||!selHora} onClick={()=>selDia&&selHora&&setPaso(4)}>CONTINUAR →</button>
        </div>
      )}

      {paso===4&&(
        <div style={cs.section}>
          <button style={cs.backBtn} onClick={()=>setPaso(3)}>← Cambiar fecha</button>
          <div style={cs.sTitle}>✦ Confirmar reserva</div>
          <div style={cs.resBox}>
            {[["Servicio",selServicio?.nombre],["Duración",`${selServicio?.duracionMin} min`],["Profesional",`${selPeluquero?.emoji} ${selPeluquero?.nombre}`],["Fecha",selDia?fmtLarga(selDia):""],["Hora",selHora]].map(([l,v],i,arr)=>(
              <div key={i} style={cs.resFila(i===arr.length-1)}><span style={{fontSize:11,color:TX2,textTransform:"uppercase",letterSpacing:1}}>{l}</span><span style={{fontSize:13,color:TX,fontWeight:700,textAlign:"right"}}>{v}</span></div>
            ))}
          </div>
          <div style={{...cs.resBox,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:13,color:TX2}}>Total</span><span style={{fontSize:26,fontWeight:700,color:A}}>€{selServicio?.precio}</span></div>
          <input style={cs.inp} placeholder="Tu nombre completo" value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})}/>
          <input style={cs.inp} placeholder="Tu WhatsApp (recibirás confirmación)" value={form.telefono} onChange={e=>setForm({...form,telefono:e.target.value})}/>
          <button style={cs.btnSig(!!(form.nombre&&form.telefono))} disabled={!form.nombre||!form.telefono} onClick={()=>form.nombre&&form.telefono&&setPaso(5)}>CONFIRMAR RESERVA ✓</button>
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
      <div style={{background:WH,borderBottom:`1px solid ${CR3}`,padding:"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 1px 6px rgba(0,0,0,0.05)"}}>
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
  const [user,setUser]=useState(""),  [pass,setPass]=useState(""),  [error,setError]=useState(false);
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
        <div style={{marginBottom:12}}><Lbl>Usuario</Lbl><Inp value={user} onChange={e=>setUser(e.target.value)} placeholder="admin · carlos · miguel..."/></div>
        <div style={{marginBottom:20}}><Lbl>Contraseña</Lbl><Inp type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder="••••••"/></div>
        <Btn ok style={{width:"100%"}} onClick={handleLogin}>ENTRAR</Btn>
        <button style={{width:"100%",background:"none",border:"none",color:TX2,cursor:"pointer",fontSize:12,marginTop:14}} onClick={onBack}>← Volver a la web</button>
        <div style={{marginTop:16,background:CR,borderRadius:8,padding:"10px",fontSize:11,color:TX2,textAlign:"center"}}>Demo: <strong>admin</strong> / admin123 · <strong>carlos</strong> / carlos123</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ADMIN PANEL
// ═══════════════════════════════════════════════════════════════
function AdminPanel({onLogout, valoraciones, setValoraciones}){
  const [tab,setTab]=useState("citas");
  const [citas,setCitas]=useState(CITAS_INIT);
  const [clientes,setClientes]=useState(CLIENTES_INIT);
  const [festivos,setFestivos]=useState(FESTIVOS_INIT);
  const [bloqueos,setBloqueos]=useState(BLOQUEOS_INIT);
  const [servicios,setServicios]=useState(CONFIG.servicios);
  // Estado de citas elevado aquí para que no se reinicie al cambiar estado de una cita
  const [vistaCitas,setVistaCitas]=useState("semana");
  const [weekOffsetCitas,setWeekOffsetCitas]=useState(0);
  const [pelFiltroCitas,setPelFiltroCitas]=useState(null);

  const as={
    root:{minHeight:"100vh",background:"#E4EBF2",fontFamily:FONT,color:TX},
    header:{background:WH,borderBottom:`1px solid ${CR3}`,padding:"11px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"},
    tabBar:{display:"flex",background:WH,borderBottom:`1px solid ${CR3}`,overflowX:"auto",padding:"0 12px"},
    tabBtn:(a)=>({padding:"11px 14px",fontSize:12,fontWeight:a?700:400,color:a?A:TX2,borderBottom:a?`2px solid ${A}`:"2px solid transparent",cursor:"pointer",background:"none",border:"none",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:5}),
    body:{padding:"18px",maxWidth:1100,margin:"0 auto"},
    card:{background:WH,border:`1px solid ${CR3}`,borderRadius:14,padding:"18px",marginBottom:14,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"},
    cardTitle:{fontSize:11,fontWeight:700,color:TX2,textTransform:"uppercase",letterSpacing:1.5,marginBottom:14},
    kpiGrid:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16},
    kpi:{background:WH,border:`1px solid ${CR3}`,borderRadius:12,padding:"14px",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"},
    kpiVal:{fontSize:24,fontWeight:700,color:A,marginBottom:2},
    kpiLbl:{fontSize:10,color:TX2,textTransform:"uppercase",letterSpacing:1},
    table:{width:"100%",borderCollapse:"collapse"},
    th:{textAlign:"left",fontSize:10,color:TX2,textTransform:"uppercase",letterSpacing:1,padding:"7px 10px",borderBottom:`1px solid ${CR2}`,background:CR},
    td:{padding:"10px 10px",fontSize:12,color:TX,borderBottom:`1px solid ${CR2}`},
    actBtn:(c)=>({background:c+"15",border:`1px solid ${c}33`,color:c,borderRadius:6,padding:"4px 9px",fontSize:11,fontWeight:700,cursor:"pointer",marginRight:4}),
    twoCol:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14},
    chartH:{height:180,marginTop:8},
    row:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${CR2}`},
  };

  // ── TAB CITAS ─────────────────────────────────────────────
  const TabCitas=()=>{
    const vista=vistaCitas, setVista=setVistaCitas;
    const weekOffset=weekOffsetCitas, setWeekOffset=setWeekOffsetCitas;
    const pelFiltro=pelFiltroCitas, setPelFiltro=setPelFiltroCitas;
    const [showManual,setShowManual]=useState(false);
    const [editNota,setEditNota]=useState(null);
    const [notaVal,setNotaVal]=useState("");
    const [manForm,setManForm]=useState({nombre:"",telefono:"",servicioId:"",peluqueroId:"",fecha:"",hora:"",nota:""});
    const [clienteRec,setClienteRec]=useState(null);

    const weekDays=getWeekDays(weekOffset);
    // ── Buscador global con filtros ──
    const [busqCita,setBusqCita]=useState("");
    const [filtFecha,setFiltFecha]=useState("hoy"); // hoy | semana | rango | todas
    const [filtDesde,setFiltDesde]=useState("");
    const [filtHasta,setFiltHasta]=useState("");
    const [filtPel,setFiltPel]=useState("todas");
    const [filtEstado,setFiltEstado]=useState("todos");
    const [mostrarBuscador,setMostrarBuscador]=useState(false);

    const citasHoy=citas.filter(c=>c.fecha===HOY_ISO).sort((a,b)=>a.hora.localeCompare(b.hora));

    const citasFiltradas=useMemo(()=>{
      let res=[...citas];
      // Filtro de fecha
      if(filtFecha==="hoy") res=res.filter(c=>c.fecha===HOY_ISO);
      else if(filtFecha==="semana") res=res.filter(c=>weekDays.some(d=>isoDate(d)===c.fecha));
      else if(filtFecha==="rango"&&filtDesde) res=res.filter(c=>c.fecha>=filtDesde&&(!filtHasta||c.fecha<=filtHasta));
      // Filtro peluquero
      if(filtPel!=="todas") res=res.filter(c=>c.peluqueroId===Number(filtPel));
      // Filtro estado
      if(filtEstado!=="todos") res=res.filter(c=>c.estado===filtEstado);
      // Filtro texto
      if(busqCita) res=res.filter(c=>similitud(busqCita,c.clienteNombre)>40||normalize(c.clienteNombre).includes(normalize(busqCita)));
      return res.sort((a,b)=>a.fecha===b.fecha?a.hora.localeCompare(b.hora):a.fecha.localeCompare(b.fecha));
    },[citas,busqCita,filtFecha,filtDesde,filtHasta,filtPel,filtEstado,weekDays]);

    const hayFiltros=busqCita||filtFecha!=="hoy"||filtPel!=="todas"||filtEstado!=="todos";

    const ingrHoy=citasHoy.filter(c=>c.estado==="completada").reduce((s,c)=>s+c.precio,0);
    const pendHoy=citasHoy.filter(c=>c.estado==="pendiente").length;
    const noShowHoy=citasHoy.filter(c=>c.estado==="no-show").length;

    const cambiarEstado=(id,estado)=>setCitas(prev=>prev.map(c=>c.id===id?{...c,estado}:c));
    const guardarNota=(id)=>{setCitas(prev=>prev.map(c=>c.id===id?{...c,nota:notaVal}:c));setEditNota(null);};

    const buscarCliente=(tel)=>{
      const found=clientes.find(c=>c.telefono===tel.replace(/\s/g,""));
      setClienteRec(found||null);
      if(found) setManForm(f=>({...f,nombre:found.nombre}));
    };

    const slotsManuales=useMemo(()=>{
      if(!manForm.peluqueroId||!manForm.fecha||!manForm.servicioId)return[];
      const pel=CONFIG.peluqueros.find(p=>p.id===Number(manForm.peluqueroId));
      const svc=servicios.find(s=>s.id===Number(manForm.servicioId));
      const fecha=new Date(manForm.fecha+"T12:00:00");
      const hp=pel?.horario[fecha.getDay()];
      return hp?generarSlots(hp,svc?.duracionMin||30):[];
    },[manForm.peluqueroId,manForm.fecha,manForm.servicioId]);

    const crearCitaManual=()=>{
      if(!manForm.nombre||!manForm.servicioId||!manForm.peluqueroId||!manForm.fecha||!manForm.hora)return;
      const svc=servicios.find(s=>s.id===Number(manForm.servicioId));
      const pel=CONFIG.peluqueros.find(p=>p.id===Number(manForm.peluqueroId));
      const nueva={id:Date.now(),clienteNombre:manForm.nombre,clienteTel:manForm.telefono,servicio:svc.nombre,servicioId:svc.id,peluqueroId:pel.id,peluquero:pel.nombre,fecha:manForm.fecha,hora:manForm.hora,precio:svc.precio,estado:"pendiente",nota:manForm.nota};
      setCitas(prev=>[...prev,nueva]);
      if(manForm.telefono){
        const exist=clientes.find(c=>c.telefono===manForm.telefono);
        if(!exist) setClientes(prev=>[...prev,{id:Date.now(),nombre:manForm.nombre,telefono:manForm.telefono,visitas:1,gasto:svc.precio,ultimaVisita:manForm.fecha,nota:"",historial:[{fecha:manForm.fecha,servicio:svc.nombre,peluquero:pel.nombre,precio:svc.precio}]}]);
      }
      setShowManual(false);
      setManForm({nombre:"",telefono:"",servicioId:"",peluqueroId:"",fecha:"",hora:"",nota:""});
      setClienteRec(null);
    };

    return(
      <div>
        <div className="admin-kpi-grid" style={as.kpiGrid}>
          {[["€"+ingrHoy,"Ingresos hoy"],[citasHoy.length,"Citas hoy"],[pendHoy,"Pendientes"],[noShowHoy,"No shows"]].map(([v,l],i)=>(
            <div key={i} style={as.kpi}><div style={as.kpiVal}>{v}</div><div style={as.kpiLbl}>{l}</div></div>
          ))}
        </div>

        {/* Controles de vista */}
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
          {[["hoy","📋 Tabla hoy"],["semana","📅 Semana"],["peluquero","✂️ Por peluquero"]].map(([v,l])=>(
            <button key={v} style={{background:vista===v?A:CR2,color:vista===v?WH:TX,border:`1px solid ${vista===v?A:CR3}`,borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={()=>setVista(v)}>{l}</button>
          ))}
          <button style={{marginLeft:"auto",background:`linear-gradient(135deg,${A},#133A6A)`,color:WH,border:"none",borderRadius:8,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={()=>setShowManual(true)}>+ Nueva cita</button>
        </div>

        {/* MODAL NUEVA CITA */}
        {showManual&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{background:WH,borderRadius:18,padding:"28px",width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                <h3 style={{fontSize:16,fontWeight:700,color:TX,margin:0}}>Nueva cita manual</h3>
                <button style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:TX2}} onClick={()=>setShowManual(false)}>✕</button>
              </div>
              <div style={{marginBottom:10}}><Lbl>Teléfono (busca cliente)</Lbl><Inp value={manForm.telefono} onChange={e=>{setManForm(f=>({...f,telefono:e.target.value}));buscarCliente(e.target.value);}} placeholder="Ej: 666 111 222"/>{clienteRec&&<div style={{background:`${OK}12`,border:`1px solid ${OK}33`,borderRadius:8,padding:"8px 12px",marginTop:6,fontSize:12,color:TX}}>✓ Cliente encontrado: <strong>{clienteRec.nombre}</strong> · {clienteRec.visitas} visitas</div>}</div>
              <div style={{marginBottom:10}}><Lbl>Nombre</Lbl><Inp value={manForm.nombre} onChange={e=>setManForm(f=>({...f,nombre:e.target.value}))} placeholder="Nombre del cliente"/></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <div><Lbl>Servicio</Lbl><Sel value={manForm.servicioId} onChange={e=>setManForm(f=>({...f,servicioId:e.target.value,hora:""}))}>
                  <option value="">Elige servicio</option>
                  {servicios.map(s=><option key={s.id} value={s.id}>{s.nombre} — €{s.precio}</option>)}
                </Sel></div>
                <div><Lbl>Peluquero</Lbl><Sel value={manForm.peluqueroId} onChange={e=>setManForm(f=>({...f,peluqueroId:e.target.value,hora:""}))}>
                  <option value="">Elige peluquero</option>
                  {CONFIG.peluqueros.map(p=><option key={p.id} value={p.id}>{p.emoji} {p.nombre}</option>)}
                </Sel></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <div><Lbl>Fecha</Lbl><Inp type="date" value={manForm.fecha} onChange={e=>setManForm(f=>({...f,fecha:e.target.value,hora:""}))}/></div>
                <div><Lbl>Hora</Lbl><Sel value={manForm.hora} onChange={e=>setManForm(f=>({...f,hora:e.target.value}))} disabled={slotsManuales.length===0}>
                  <option value="">{slotsManuales.length===0?"Elige fecha y servicio":"Elige hora"}</option>
                  {slotsManuales.map(h=><option key={h} value={h}>{h}</option>)}
                </Sel></div>
              </div>
              <div style={{marginBottom:16}}><Lbl>Nota (opcional)</Lbl><Inp value={manForm.nota} onChange={e=>setManForm(f=>({...f,nota:e.target.value}))} placeholder="Observaciones..."/></div>
              <div style={{display:"flex",gap:8}}><Btn ok={false} onClick={()=>setShowManual(false)}>Cancelar</Btn><Btn ok={!!(manForm.nombre&&manForm.servicioId&&manForm.peluqueroId&&manForm.fecha&&manForm.hora)} onClick={crearCitaManual} style={{flex:1}}>Confirmar cita →</Btn></div>
            </div>
          </div>
        )}

        {/* Resultados del buscador cuando hay filtros activos */}
        {hayFiltros&&(
          <div style={as.card}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:700,color:A}}>{citasFiltradas.length} resultado{citasFiltradas.length!==1?"s":""}</div>
              <div style={{fontSize:11,color:TX2}}>{busqCita&&`"${busqCita}" · `}{filtFecha==="hoy"?"Hoy":filtFecha==="semana"?"Esta semana":filtFecha==="todas"?"Todas las fechas":`${filtDesde||""}${filtHasta?` → ${filtHasta}`:""}`}{filtPel!=="todas"?` · ${CONFIG.peluqueros.find(p=>p.id===Number(filtPel))?.nombre}`:""}{ filtEstado!=="todos"?` · ${filtEstado}`:""}</div>
            </div>
            {citasFiltradas.length===0?<div style={{fontSize:13,color:TX2,fontStyle:"italic",padding:"10px 0"}}>No se encontraron citas con estos filtros</div>:(
              <div className="admin-table-wrap">
              <table style={as.table}>
                <thead><tr>{["Fecha","Hora","Cliente","Servicio","Profesional","Precio","Estado","Acc."].map(h=><th key={h} style={as.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {citasFiltradas.map(c=>(
                    <tr key={c.id}>
                      <td style={{...as.td,fontSize:11,color:TX2}}>{c.fecha===HOY_ISO?"Hoy":c.fecha}</td>
                      <td style={{...as.td,fontWeight:700,color:A}}>{c.hora}</td>
                      <td style={as.td}>{c.clienteNombre}</td>
                      <td style={as.td}>{c.servicio}</td>
                      <td style={as.td}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:"50%",background:CONFIG.peluqueros.find(p=>p.id===c.peluqueroId)?.color||A,flexShrink:0}}/>{c.peluquero}</span></td>
                      <td style={{...as.td,fontWeight:700}}>€{c.precio}</td>
                      <td style={as.td}><EstBdg e={c.estado}/></td>
                      <td style={as.td}>
                        {c.estado==="pendiente"&&<><button style={as.actBtn(OK)} onClick={()=>cambiarEstado(c.id,"completada")}>✓</button><button style={as.actBtn(ER)} onClick={()=>cambiarEstado(c.id,"no-show")}>✗</button></>}
                        {c.estado!=="pendiente"&&<button style={as.actBtn(TX2)} onClick={()=>cambiarEstado(c.id,"pendiente")}>↩</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {/* Vista normal (solo cuando no hay búsqueda activa) */}
        {vista==="hoy"&&(
          <div style={as.card}>
            {/* Buscador con filtros — solo en vista tabla */}
            <div style={{background:CR,border:`1px solid ${hayFiltros?A:CR3}`,borderRadius:10,padding:"10px 12px",marginBottom:14,boxShadow:hayFiltros?`0 2px 8px ${A}22`:"none"}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:mostrarBuscador||hayFiltros?10:0}}>
                <Inp style={{flex:1,marginBottom:0,padding:"7px 12px",fontSize:12}} value={busqCita} onChange={e=>{setBusqCita(e.target.value);if(!mostrarBuscador)setMostrarBuscador(true);}} placeholder="🔍 Buscar por nombre de cliente..."/>
                <button style={{background:mostrarBuscador?`${A}15`:WH,border:`1px solid ${mostrarBuscador?A:CR3}`,borderRadius:8,padding:"7px 12px",fontSize:11,fontWeight:700,cursor:"pointer",color:mostrarBuscador?A:TX2,whiteSpace:"nowrap"}} onClick={()=>setMostrarBuscador(v=>!v)}>
                  {mostrarBuscador?"▲ Filtros":"▼ Filtros"}{hayFiltros?" ●":""}
                </button>
                {hayFiltros&&<button style={{background:ER+"15",border:`1px solid ${ER}33`,borderRadius:8,padding:"7px 10px",fontSize:11,fontWeight:700,cursor:"pointer",color:ER}} onClick={()=>{setBusqCita("");setFiltFecha("hoy");setFiltDesde("");setFiltHasta("");setFiltPel("todas");setFiltEstado("todos");setMostrarBuscador(false);}}>✕</button>}
              </div>
              {(mostrarBuscador||hayFiltros)&&(
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:7}}>
                  <div>
                    <Lbl>Fecha</Lbl>
                    <Sel style={{padding:"6px 9px",fontSize:11}} value={filtFecha} onChange={e=>setFiltFecha(e.target.value)}>
                      <option value="hoy">Hoy</option>
                      <option value="semana">Esta semana</option>
                      <option value="todas">Todas</option>
                      <option value="rango">Rango</option>
                    </Sel>
                  </div>
                  {filtFecha==="rango"&&<>
                    <div><Lbl>Desde</Lbl><Inp type="date" style={{padding:"6px 9px",fontSize:11}} value={filtDesde} onChange={e=>setFiltDesde(e.target.value)}/></div>
                    <div><Lbl>Hasta</Lbl><Inp type="date" style={{padding:"6px 9px",fontSize:11}} value={filtHasta} onChange={e=>setFiltHasta(e.target.value)}/></div>
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
              )}
            </div>
            {/* Resultados */}
            {hayFiltros?(
              <>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:700,color:A}}>{citasFiltradas.length} resultado{citasFiltradas.length!==1?"s":""}</div>
                  <div style={{fontSize:10,color:TX2}}>{filtFecha==="hoy"?"Hoy":filtFecha==="semana"?"Esta semana":filtFecha==="todas"?"Todas":""}{filtPel!=="todas"?` · ${CONFIG.peluqueros.find(p=>p.id===Number(filtPel))?.nombre}`:""}{ filtEstado!=="todos"?` · ${filtEstado}`:""}</div>
                </div>
                {citasFiltradas.length===0?<div style={{fontSize:13,color:TX2,fontStyle:"italic"}}>No se encontraron citas</div>:(
                  <div className="admin-table-wrap">
                  <table style={as.table}>
                    <thead><tr>{["Fecha","Hora","Cliente","Servicio","Profesional","€","Estado","Acc."].map(h=><th key={h} style={as.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {citasFiltradas.map(c=>(
                        <tr key={c.id}>
                          <td style={{...as.td,fontSize:11,color:TX2}}>{c.fecha===HOY_ISO?"Hoy":c.fecha}</td>
                          <td style={{...as.td,fontWeight:700,color:A}}>{c.hora}</td>
                          <td style={as.td}>{c.clienteNombre}</td>
                          <td style={as.td}>{c.servicio}</td>
                          <td style={as.td}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:"50%",background:CONFIG.peluqueros.find(p=>p.id===c.peluqueroId)?.color||A,flexShrink:0}}/>{c.peluquero}</span></td>
                          <td style={{...as.td,fontWeight:700}}>€{c.precio}</td>
                          <td style={as.td}><EstBdg e={c.estado}/></td>
                          <td style={as.td}>
                            {c.estado==="pendiente"&&<><button style={as.actBtn(OK)} onClick={()=>cambiarEstado(c.id,"completada")}>✓</button><button style={as.actBtn(ER)} onClick={()=>cambiarEstado(c.id,"no-show")}>✗</button></>}
                            {c.estado!=="pendiente"&&<button style={as.actBtn(TX2)} onClick={()=>cambiarEstado(c.id,"pendiente")}>↩</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </>
            ):(
              /* Sin filtros: tabla normal de hoy */
              <>
                <div style={{fontSize:11,fontWeight:700,color:TX2,textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>Citas de hoy — {fmtLarga(HOY)}</div>
            {citasHoy.length===0?<div style={{fontSize:13,color:TX2,fontStyle:"italic"}}>No hay citas para hoy</div>:(
              <div className="admin-table-wrap">
              <table style={as.table}>
                <thead><tr>{["Hora","Cliente","Servicio","Profesional","Precio","Estado","Nota","Acc."].map(h=><th key={h} style={as.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {citasHoy.map(c=>(
                    <tr key={c.id}>
                      <td style={{...as.td,fontWeight:700,color:A}}>{c.hora}</td>
                      <td style={as.td}>{c.clienteNombre}<div style={{fontSize:10,color:TX2}}>{c.clienteTel}</div></td>
                      <td style={as.td}>{c.servicio}</td>
                      <td style={as.td}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:"50%",background:CONFIG.peluqueros.find(p=>p.id===c.peluqueroId)?.color||A,flexShrink:0}}/>{c.peluquero}</span></td>
                      <td style={{...as.td,fontWeight:700}}>€{c.precio}</td>
                      <td style={as.td}><EstBdg e={c.estado}/></td>
                      <td style={as.td}>
                        {editNota===c.id?(
                          <div style={{display:"flex",gap:4}}><Inp style={{padding:"4px 8px",fontSize:11}} value={notaVal} onChange={e=>setNotaVal(e.target.value)}/><button style={as.actBtn(OK)} onClick={()=>guardarNota(c.id)}>✓</button></div>
                        ):(
                          <span style={{fontSize:11,color:c.nota?TX:TX2,cursor:"pointer",fontStyle:c.nota?"normal":"italic"}} onClick={()=>{setEditNota(c.id);setNotaVal(c.nota||"");}}>{c.nota||"+ nota"}</span>
                        )}
                      </td>
                      <td style={as.td}>
                        {c.estado==="pendiente"&&<><button style={as.actBtn(OK)} onClick={()=>cambiarEstado(c.id,"completada")}>✓</button><button style={as.actBtn(ER)} onClick={()=>cambiarEstado(c.id,"no-show")}>✗</button></>}
                        {c.estado!=="pendiente"&&<button style={as.actBtn(TX2)} onClick={()=>cambiarEstado(c.id,"pendiente")}>↩</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
              </>
            )}
          </div>
        )}

        {/* VISTA SEMANA — CALENDARIO VISUAL */}
        {vista==="semana"&&(
          <div style={as.card}>
            <NavSemana offset={weekOffset} onChange={setWeekOffset} weekDays={weekDays}/>
            <LeyendaPeluqueros/>
            <CalendarioGrid dias={weekDays} citas={citas} peluqueroFiltroId={null}/>
          </div>
        )}

        {/* VISTA POR PELUQUERO — CALENDARIO VISUAL FILTRADO */}
        {vista==="peluquero"&&(
          <div>
            <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
              {CONFIG.peluqueros.map(p=>(
                <button key={p.id} style={{background:pelFiltro===p.id?p.color:CR2,color:pelFiltro===p.id?WH:TX,border:`1px solid ${pelFiltro===p.id?p.color:CR3}`,borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}} onClick={()=>setPelFiltro(pelFiltro===p.id?null:p.id)}>
                  {p.emoji} {p.nombre}
                  {pelFiltro===p.id&&<span style={{fontSize:10}}>✓</span>}
                </button>
              ))}
            </div>
            <div style={as.card}>
              <NavSemana offset={weekOffset} onChange={setWeekOffset} weekDays={weekDays}/>
              {pelFiltro&&(
                <div style={{marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:10,height:10,borderRadius:2,background:CONFIG.peluqueros.find(p=>p.id===pelFiltro)?.color}}/>
                  <span style={{fontSize:12,fontWeight:700,color:TX}}>{CONFIG.peluqueros.find(p=>p.id===pelFiltro)?.nombre}</span>
                </div>
              )}
              {!pelFiltro&&<LeyendaPeluqueros/>}
              <CalendarioGrid dias={weekDays} citas={citas} peluqueroFiltroId={pelFiltro}/>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── TAB CLIENTES ──────────────────────────────────────────
  const TabClientes=()=>{
    const [busq,setBusq]=useState("");
    const [inactivos,setInactivos]=useState(false);
    const [clienteSel,setClienteSel]=useState(null);
    const [editNota,setEditNota]=useState(false);
    const [notaVal,setNotaVal]=useState("");
    const semMil=CONFIG.semanasSinVisita*7*24*60*60*1000;

    const clientesFiltrados=useMemo(()=>{
      let lista=clientes;
      if(inactivos){const lim=new Date(Date.now()-semMil);lista=lista.filter(c=>new Date(c.ultimaVisita)<lim);}
      if(!busq)return lista.sort((a,b)=>a.nombre.localeCompare(b.nombre));
      return lista.map(c=>({...c,score:similitud(busq,c.nombre)})).filter(c=>c.score>35).sort((a,b)=>b.score-a.score);
    },[busq,inactivos,clientes]);

    const guardarNota=()=>{setClientes(prev=>prev.map(c=>c.id===clienteSel.id?{...c,nota:notaVal}:c));setEditNota(false);setClienteSel(prev=>({...prev,nota:notaVal}));};

    return(
      <div>
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
          <Inp style={{flex:1,minWidth:200,marginBottom:0}} value={busq} onChange={e=>setBusq(e.target.value)} placeholder="🔍  Buscar por nombre (fuzzy)..."/>
          <button style={{background:inactivos?A:CR2,color:inactivos?WH:TX,border:`1px solid ${inactivos?A:CR3}`,borderRadius:8,padding:"9px 14px",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}} onClick={()=>setInactivos(v=>!v)}>{inactivos?"✓ ":""}{`+${CONFIG.semanasSinVisita}sem sin visita`}</button>
        </div>
        <div style={{fontSize:11,color:TX2,marginBottom:10}}>{clientesFiltrados.length} cliente{clientesFiltrados.length!==1?"s":""}</div>
        <div style={as.twoCol}>
          <div>
            {clientesFiltrados.map(c=>(
              <div key={c.id} style={{background:clienteSel?.id===c.id?`${A}0D`:WH,border:`1px solid ${clienteSel?.id===c.id?A:CR3}`,borderRadius:12,padding:"13px 15px",marginBottom:8,cursor:"pointer",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}} onClick={()=>{setClienteSel(c);setEditNota(false);}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div><div style={{fontSize:13,fontWeight:700,color:TX,marginBottom:2}}>{c.nombre}</div><div style={{fontSize:11,color:TX2}}>📞 {c.telefono}</div><div style={{fontSize:11,color:TX2}}>Última: {c.ultimaVisita}</div></div>
                  <div style={{textAlign:"right"}}><div style={{fontSize:15,fontWeight:700,color:A}}>€{c.gasto}</div><div style={{fontSize:10,color:TX2}}>{c.visitas} visitas</div>{busq&&c.score&&<div style={{marginTop:4}}><Bdg small color={c.score>=90?OK:c.score>=70?A:"#d97706"}>{c.score}% similar</Bdg></div>}</div>
                </div>
              </div>
            ))}
            {clientesFiltrados.length===0&&<div style={{textAlign:"center",padding:"30px",color:TX2,fontSize:13,background:WH,borderRadius:12,border:`1px solid ${CR3}`}}>No se encontraron clientes</div>}
          </div>
          {clienteSel&&(
            <div style={as.card}>
              <div style={{fontSize:15,fontWeight:700,color:TX,marginBottom:4}}>{clienteSel.nombre}</div>
              <div style={{fontSize:12,color:TX2,marginBottom:14}}>📞 {clienteSel.telefono}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
                {[["€"+clienteSel.gasto,"Total gastado"],[clienteSel.visitas,"Visitas"],["€"+Math.round(clienteSel.gasto/Math.max(clienteSel.visitas,1)),"Gasto medio"]].map(([v,l])=>(
                  <div key={l} style={{background:CR,borderRadius:9,padding:"10px",textAlign:"center"}}><div style={{fontSize:17,fontWeight:700,color:A}}>{v}</div><div style={{fontSize:10,color:TX2}}>{l}</div></div>
                ))}
              </div>
              <Divider/>
              <div style={{fontSize:11,fontWeight:700,color:TX2,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Nota del cliente</div>
              {editNota?(
                <div><Inp value={notaVal} onChange={e=>setNotaVal(e.target.value)} placeholder="Añade una nota..."/><div style={{display:"flex",gap:6,marginTop:6}}><Btn ok={false} sm onClick={()=>setEditNota(false)}>Cancelar</Btn><Btn sm onClick={guardarNota}>Guardar</Btn></div></div>
              ):(
                <div style={{background:CR,borderRadius:8,padding:"10px 12px",fontSize:13,color:clienteSel.nota?TX:TX2,fontStyle:clienteSel.nota?"normal":"italic",cursor:"pointer"}} onClick={()=>{setEditNota(true);setNotaVal(clienteSel.nota||"");}}>
                  {clienteSel.nota||"Sin notas. Pulsa para añadir..."}
                </div>
              )}
              <Divider/>
              <div style={{fontSize:11,fontWeight:700,color:TX2,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Historial</div>
              {clienteSel.historial.length===0?<div style={{fontSize:12,color:TX2,fontStyle:"italic"}}>Sin historial</div>:
                clienteSel.historial.map((h,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${CR2}`,fontSize:12}}>
                    <div><span style={{color:TX2,marginRight:8}}>{h.fecha}</span><span style={{color:TX}}>{h.servicio}</span></div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{color:TX2,fontSize:11}}>{h.peluquero}</span><span style={{fontWeight:700,color:A}}>€{h.precio}</span></div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── TAB CAJA ──────────────────────────────────────────────
  const TabCaja=()=>{
    const ingHoy=citas.filter(c=>c.fecha===HOY_ISO&&c.estado==="completada").reduce((s,c)=>s+c.precio,0);
    const noShows=citas.filter(c=>c.fecha===HOY_ISO&&c.estado==="no-show").length;
    const totalHoy=citas.filter(c=>c.fecha===HOY_ISO).length;
    const tasaNS=totalHoy>0?Math.round(noShows/totalHoy*100):0;
    const ingSemana=ingHoy*4.8|0, ingMes=ingHoy*19|0, ingMesAnt=ingHoy*18|0;
    const [showPDF,setShowPDF]=useState(false);

    const exportarExcel=()=>{
      try{
        const XLSX=window.XLSX;
        if(!XLSX){alert("Cargando exportador, inténtalo en unos segundos...");return;}
        const datos=[
          ["RESUMEN DE CAJA — "+CONFIG.nombre],
          ["Fecha de exportación:", new Date().toLocaleDateString("es-ES")],
          [],
          ["INGRESOS"],
          ["Hoy","Esta semana","Este mes","Mes anterior"],
          [`€${ingHoy}`,`€${ingSemana}`,`€${ingMes}`,`€${ingMesAnt}`],
          [],
          ["POR PELUQUERO","Citas","Ingresos"],
          ...CONFIG.peluqueros.map(p=>{
            const total=citas.filter(c=>c.peluqueroId===p.id&&c.estado==="completada").reduce((s,c)=>s+c.precio,0);
            const nc=citas.filter(c=>c.peluqueroId===p.id).length;
            return[p.nombre,nc,`€${total}`];
          }),
          [],
          ["CITAS DEL DÍA","Peluquero","Servicio","Estado","Precio"],
          ...citas.filter(c=>c.fecha===HOY_ISO).map(c=>[c.clienteNombre,c.peluquero,c.servicio,c.estado,`€${c.precio}`]),
          [],
          ["RESUMEN",""],
          ["Total citas hoy",totalHoy],
          ["Completadas",citas.filter(c=>c.fecha===HOY_ISO&&c.estado==="completada").length],
          ["No shows",noShows],
          ["Tasa no-show",tasaNS+"%"],
        ];
        const ws=XLSX.utils.aoa_to_sheet(datos);
        const wb=XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb,ws,"Caja");
        XLSX.writeFile(wb,`caja-${CONFIG.nombre.replace(/\s/g,"-")}-${HOY_ISO}.xlsx`);
      }catch(e){alert("Error al exportar Excel: "+e.message);}
    };

    return(
      <div>
        {/* MODAL VISTA PREVIA PDF */}
        {showPDF&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{background:WH,borderRadius:18,width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>
              {/* Cabecera del PDF */}
              <div style={{background:`linear-gradient(135deg,#0D1F35,#1B3A5C)`,padding:"20px 24px",borderRadius:"18px 18px 0 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:WH}}>{CONFIG.nombre}</div>
                  <div style={{fontSize:11,color:"#7AADD4",marginTop:2}}>Resumen de caja — {new Date().toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
                </div>
                <button style={{background:"none",border:"none",color:"#7AADD4",fontSize:20,cursor:"pointer"}} onClick={()=>setShowPDF(false)}>✕</button>
              </div>
              <div style={{padding:"20px 24px"}}>
                {/* Ingresos */}
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:10,fontWeight:700,color:A,textTransform:"uppercase",letterSpacing:2,marginBottom:10}}>Ingresos</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
                    {[["Hoy",`€${ingHoy}`],["Esta semana",`€${ingSemana}`],["Este mes",`€${ingMes}`],["Mes anterior",`€${ingMesAnt}`]].map(([l,v])=>(
                      <div key={l} style={{background:CR,borderRadius:8,padding:"10px 12px"}}>
                        <div style={{fontSize:18,fontWeight:700,color:A}}>{v}</div>
                        <div style={{fontSize:10,color:TX2,textTransform:"uppercase",letterSpacing:1}}>{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Por peluquero */}
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:10,fontWeight:700,color:A,textTransform:"uppercase",letterSpacing:2,marginBottom:10}}>Por peluquero</div>
                  {CONFIG.peluqueros.map(p=>{
                    const t=citas.filter(c=>c.peluqueroId===p.id&&c.estado==="completada").reduce((s,c)=>s+c.precio,0);
                    const nc=citas.filter(c=>c.peluqueroId===p.id).length;
                    return(
                      <div key={p.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${CR2}`}}>
                        <span style={{fontSize:13,display:"flex",alignItems:"center",gap:8}}><span style={{width:8,height:8,borderRadius:2,background:p.color}}/>{p.nombre}<span style={{fontSize:11,color:TX2}}>{nc} citas</span></span>
                        <span style={{fontSize:14,fontWeight:700,color:A}}>€{t}</span>
                      </div>
                    );
                  })}
                </div>
                {/* Citas del día */}
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:10,fontWeight:700,color:A,textTransform:"uppercase",letterSpacing:2,marginBottom:10}}>Citas de hoy</div>
                  {citas.filter(c=>c.fecha===HOY_ISO).sort((a,b)=>a.hora.localeCompare(b.hora)).map(c=>(
                    <div key={c.id} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${CR2}`,fontSize:12}}>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <span style={{fontWeight:700,color:A}}>{c.hora}</span>
                        <span style={{color:TX}}>{c.clienteNombre}</span>
                        <span style={{color:TX2,fontSize:11}}>{c.peluquero}</span>
                      </div>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <EstBdg e={c.estado}/>
                        <span style={{fontWeight:700,color:c.estado==="completada"?A:TX2}}>€{c.precio}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Resumen */}
                <div style={{background:CR,borderRadius:10,padding:"12px 14px",marginBottom:20}}>
                  <div style={{fontSize:10,fontWeight:700,color:A,textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>Resumen del día</div>
                  {[["Total citas",totalHoy],["Completadas",citas.filter(c=>c.fecha===HOY_ISO&&c.estado==="completada").length],["No shows",noShows],["Tasa no-show",tasaNS+"%"]].map(([l,v])=>(
                    <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:12}}>
                      <span style={{color:TX2}}>{l}</span><span style={{fontWeight:700,color:TX}}>{v}</span>
                    </div>
                  ))}
                </div>
                <button onClick={()=>window.print()} style={{width:"100%",background:`linear-gradient(135deg,${A},#133A6A)`,color:WH,border:"none",borderRadius:10,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                  🖨️ Imprimir / Guardar como PDF
                </button>
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
          <div style={as.cardTitle}>Evolución ingresos — actual vs anterior</div>
          <div style={as.chartH}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={STATS_INGRESOS}>
                <XAxis dataKey="semana" tick={{fontSize:9,fill:TX2}}/><YAxis tick={{fontSize:9,fill:TX2}}/>
                <Tooltip formatter={v=>`€${v}`} contentStyle={{background:WH,border:`1px solid ${CR3}`,borderRadius:8,fontSize:11}}/>
                <Line type="monotone" dataKey="actual" stroke={A} strokeWidth={2.5} dot={{fill:A,r:3}} name="Este año"/>
                <Line type="monotone" dataKey="anterior" stroke={CR3} strokeWidth={2} strokeDasharray="4 4" dot={false} name="Año anterior"/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="admin-two-col" style={as.twoCol}>
          <div style={as.card}>
            <div style={as.cardTitle}>Por peluquero</div>
            {CONFIG.peluqueros.map(p=>{
              const total=citas.filter(c=>c.peluqueroId===p.id&&c.estado==="completada").reduce((s,c)=>s+c.precio,0);
              const nc=citas.filter(c=>c.peluqueroId===p.id).length;
              return(<div key={p.id} style={as.row}><span style={{fontSize:13,display:"flex",alignItems:"center",gap:6}}><span style={{width:8,height:8,borderRadius:2,background:p.color}}/>{p.nombre}<span style={{fontSize:11,color:TX2}}>{nc} citas</span></span><span style={{fontSize:14,fontWeight:700,color:A}}>€{total}</span></div>);
            })}
          </div>
          <div style={as.card}>
            <div style={as.cardTitle}>Servicios más solicitados</div>
            <div style={{height:160}}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={STATS_SERVICIOS} layout="vertical">
                  <XAxis type="number" tick={{fontSize:9,fill:TX2}}/><YAxis dataKey="nombre" type="category" tick={{fontSize:10,fill:TX}} width={80}/>
                  <Tooltip contentStyle={{background:WH,border:`1px solid ${CR3}`,borderRadius:8,fontSize:11}}/>
                  <Bar dataKey="c" fill={A} radius={[0,4,4,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="admin-two-col" style={as.twoCol}>
          <div style={as.card}>
            <div style={as.cardTitle}>Citas por día de la semana</div>
            <div style={as.chartH}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={STATS_DIAS}><XAxis dataKey="dia" tick={{fontSize:10,fill:TX2}}/><YAxis tick={{fontSize:9,fill:TX2}}/>
                  <Tooltip contentStyle={{background:WH,border:`1px solid ${CR3}`,borderRadius:8,fontSize:11}}/>
                  <Bar dataKey="citas" radius={[4,4,0,0]}>{STATS_DIAS.map((_,i)=><Cell key={i} fill={i===4?A:A+"77"}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={as.card}>
            <div style={as.cardTitle}>Resumen del día</div>
            {[["Citas totales",totalHoy],["Completadas",citas.filter(c=>c.fecha===HOY_ISO&&c.estado==="completada").length],["Pendientes",citas.filter(c=>c.fecha===HOY_ISO&&c.estado==="pendiente").length],["No shows",noShows],["Tasa no-show",tasaNS+"%"]].map(([l,v])=>(
              <div key={l} style={as.row}><span style={{fontSize:13,color:TX}}>{l}</span><span style={{fontSize:14,fontWeight:700,color:A}}>{v}</span></div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── TAB DISPONIBILIDAD ────────────────────────────────────
  const TabDisponibilidad=()=>{
    const [showFF,setShowFF]=useState(false), [showBF,setShowBF]=useState(false);
    const [festForm,setFestForm]=useState({fecha:"",motivo:""});
    const [bloqForm,setBloqForm]=useState({peluqueroId:"",tipo:"dia",desde:"",hasta:"",motivo:""});
    const addF=()=>{if(!festForm.fecha||!festForm.motivo)return;setFestivos(p=>[...p,{id:Date.now(),...festForm}]);setFestForm({fecha:"",motivo:""});setShowFF(false);};
    const addB=()=>{if(!bloqForm.peluqueroId||!bloqForm.desde||!bloqForm.motivo)return;setBloqueos(p=>[...p,{id:Date.now(),...bloqForm,hasta:bloqForm.tipo==="dia"?bloqForm.desde:bloqForm.hasta}]);setBloqForm({peluqueroId:"",tipo:"dia",desde:"",hasta:"",motivo:""});setShowBF(false);};
    return(
      <div style={as.twoCol}>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><h3 style={{fontSize:13,fontWeight:700,color:TX,margin:0}}>🗓️ Días festivos — Peluquería cerrada</h3><Btn sm onClick={()=>setShowFF(v=>!v)}>+ Añadir</Btn></div>
          {showFF&&(<div style={{...as.card,marginBottom:12}}><div style={{marginBottom:8}}><Lbl>Fecha</Lbl><Inp type="date" value={festForm.fecha} onChange={e=>setFestForm(f=>({...f,fecha:e.target.value}))}/></div><div style={{marginBottom:10}}><Lbl>Motivo</Lbl><Inp value={festForm.motivo} onChange={e=>setFestForm(f=>({...f,motivo:e.target.value}))} placeholder="Ej: Navidad"/></div><div style={{display:"flex",gap:6}}><Btn ok={false} sm onClick={()=>setShowFF(false)}>Cancelar</Btn><Btn sm onClick={addF}>Guardar</Btn></div></div>)}
          {festivos.sort((a,b)=>a.fecha.localeCompare(b.fecha)).map(f=>(
            <div key={f.id} style={{...as.card,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",marginBottom:8}}><div><div style={{fontSize:13,fontWeight:700,color:TX}}>{f.motivo}</div><div style={{fontSize:11,color:TX2}}>{f.fecha}</div></div><button style={as.actBtn(ER)} onClick={()=>setFestivos(p=>p.filter(x=>x.id!==f.id))}>Quitar</button></div>
          ))}
        </div>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><h3 style={{fontSize:13,fontWeight:700,color:TX,margin:0}}>✂️ Bloqueos por peluquero</h3><Btn sm onClick={()=>setShowBF(v=>!v)}>+ Añadir</Btn></div>
          {showBF&&(<div style={{...as.card,marginBottom:12}}>
            <div style={{marginBottom:8}}><Lbl>Peluquero</Lbl><Sel value={bloqForm.peluqueroId} onChange={e=>setBloqForm(f=>({...f,peluqueroId:e.target.value}))}><option value="">Elige</option>{CONFIG.peluqueros.map(p=><option key={p.id} value={p.id}>{p.emoji} {p.nombre}</option>)}</Sel></div>
            <div style={{marginBottom:8}}><Lbl>Tipo</Lbl><Sel value={bloqForm.tipo} onChange={e=>setBloqForm(f=>({...f,tipo:e.target.value}))}><option value="dia">Día suelto</option><option value="semana">Rango de días</option></Sel></div>
            <div style={{display:"grid",gridTemplateColumns:bloqForm.tipo==="semana"?"1fr 1fr":"1fr",gap:8,marginBottom:8}}>
              <div><Lbl>{bloqForm.tipo==="semana"?"Fecha inicio":"Fecha"}</Lbl><Inp type="date" value={bloqForm.desde} onChange={e=>setBloqForm(f=>({...f,desde:e.target.value}))}/></div>
              {bloqForm.tipo==="semana"&&<div><Lbl>Fecha fin</Lbl><Inp type="date" value={bloqForm.hasta} onChange={e=>setBloqForm(f=>({...f,hasta:e.target.value}))}/></div>}
            </div>
            <div style={{marginBottom:10}}><Lbl>Motivo</Lbl><Inp value={bloqForm.motivo} onChange={e=>setBloqForm(f=>({...f,motivo:e.target.value}))} placeholder="Ej: Vacaciones, médico..."/></div>
            <div style={{display:"flex",gap:6}}><Btn ok={false} sm onClick={()=>setShowBF(false)}>Cancelar</Btn><Btn sm onClick={addB}>Guardar</Btn></div>
          </div>)}
          {bloqueos.map(b=>{
            const pel=CONFIG.peluqueros.find(p=>p.id===Number(b.peluqueroId));
            return(<div key={b.id} style={{...as.card,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",marginBottom:8}}><div><div style={{fontSize:13,fontWeight:700,color:TX}}>{pel?.emoji} {pel?.nombre} — {b.motivo}</div><div style={{fontSize:11,color:TX2}}>{b.tipo==="dia"?b.desde:`${b.desde} → ${b.hasta}`}</div></div><button style={as.actBtn(ER)} onClick={()=>setBloqueos(p=>p.filter(x=>x.id!==b.id))}>Quitar</button></div>);
          })}
        </div>
      </div>
    );
  };

  // ── TAB CONFIG ────────────────────────────────────────────
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
            {showNew&&(<div style={{...as.card,marginBottom:12}}><div style={{fontSize:12,fontWeight:700,color:TX,marginBottom:12}}>Nuevo servicio</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}><div><Lbl>Nombre</Lbl><Inp value={newSvc.nombre} onChange={e=>setNewSvc(f=>({...f,nombre:e.target.value}))} placeholder="Nombre"/></div><div><Lbl>Emoji</Lbl><Inp value={newSvc.emoji} onChange={e=>setNewSvc(f=>({...f,emoji:e.target.value}))}/></div><div><Lbl>Duración (min)</Lbl><Inp type="number" value={newSvc.duracionMin} onChange={e=>setNewSvc(f=>({...f,duracionMin:e.target.value}))}/></div><div><Lbl>Precio (€)</Lbl><Inp type="number" value={newSvc.precio} onChange={e=>setNewSvc(f=>({...f,precio:e.target.value}))}/></div></div><div style={{display:"flex",gap:6}}><Btn ok={false} sm onClick={()=>setShowNew(false)}>Cancelar</Btn><Btn sm onClick={addSvc}>Añadir</Btn></div></div>)}
            <div style={as.card}>
              <table style={as.table}>
                <thead><tr>{["Emoji","Nombre","Duración","Precio","Acciones"].map(h=><th key={h} style={as.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {servicios.map(s=>(
                    <tr key={s.id}>
                      {editSvc?.id===s.id?(<>
                        <td style={as.td}><Inp style={{width:50,padding:"4px 8px"}} value={editSvc.emoji} onChange={e=>setEditSvc(f=>({...f,emoji:e.target.value}))}/></td>
                        <td style={as.td}><Inp style={{padding:"4px 8px"}} value={editSvc.nombre} onChange={e=>setEditSvc(f=>({...f,nombre:e.target.value}))}/></td>
                        <td style={as.td}><Inp style={{width:70,padding:"4px 8px"}} type="number" value={editSvc.duracionMin} onChange={e=>setEditSvc(f=>({...f,duracionMin:Number(e.target.value)}))}/></td>
                        <td style={as.td}><Inp style={{width:70,padding:"4px 8px"}} type="number" value={editSvc.precio} onChange={e=>setEditSvc(f=>({...f,precio:Number(e.target.value)}))}/></td>
                        <td style={as.td}><button style={as.actBtn(OK)} onClick={guardarSvc}>✓</button><button style={as.actBtn(TX2)} onClick={()=>setEditSvc(null)}>✕</button></td>
                      </>):(<>
                        <td style={as.td}>{s.emoji}</td>
                        <td style={{...as.td,fontWeight:600}}>{s.nombre}</td>
                        <td style={as.td}>{s.duracionMin} min</td>
                        <td style={{...as.td,fontWeight:700,color:A}}>€{s.precio}</td>
                        <td style={as.td}><button style={as.actBtn(A)} onClick={()=>setEditSvc({...s})}>✏️</button><button style={as.actBtn(ER)} onClick={()=>setServicios(p=>p.filter(x=>x.id!==s.id))}>🗑</button></td>
                      </>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {subTab==="valoraciones"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontSize:12,color:TX2}}>Estas opiniones se muestran en la web al cliente</div>
              <Btn sm onClick={()=>setShowNewVal(v=>!v)}>+ Añadir opinión</Btn>
            </div>
            {showNewVal&&(
              <div style={{...as.card,marginBottom:14,border:`1px solid ${A}44`}}>
                <div style={{fontSize:12,fontWeight:700,color:TX,marginBottom:14}}>Nueva opinión</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                  <div><Lbl>Nombre del cliente</Lbl><Inp value={newVal.nombre} onChange={e=>setNewVal(f=>({...f,nombre:e.target.value}))} placeholder="Ej: Laura M."/></div>
                  <div><Lbl>Servicio</Lbl><Inp value={newVal.servicio} onChange={e=>setNewVal(f=>({...f,servicio:e.target.value}))} placeholder="Ej: Corte de cabello"/></div>
                </div>
                <div style={{marginBottom:10}}>
                  <Lbl>Valoración</Lbl>
                  <div style={{display:"flex",gap:4}}>{[1,2,3,4,5].map(i=><span key={i} style={{fontSize:22,cursor:"pointer",color:i<=newVal.estrellas?"#F59E0B":"#D1D5DB"}} onClick={()=>setNewVal(f=>({...f,estrellas:i}))}>★</span>)}</div>
                </div>
                <div style={{marginBottom:14}}><Lbl>Comentario</Lbl><textarea value={newVal.comentario} onChange={e=>setNewVal(f=>({...f,comentario:e.target.value}))} placeholder="Escribe el comentario del cliente..." style={{width:"100%",background:CR,border:`1px solid ${CR3}`,borderRadius:9,padding:"10px 13px",fontSize:13,color:TX,outline:"none",boxSizing:"border-box",fontFamily:FONT,minHeight:80,resize:"vertical"}}/></div>
                <div style={{display:"flex",gap:8}}><Btn ok={false} sm onClick={()=>setShowNewVal(false)}>Cancelar</Btn><Btn sm onClick={addVal}>Guardar opinión</Btn></div>
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
                    <div style={{marginBottom:10}}><Lbl>Valoración</Lbl>
                      <div style={{display:"flex",gap:4}}>{[1,2,3,4,5].map(i=><span key={i} style={{fontSize:22,cursor:"pointer",color:i<=editVal.estrellas?"#F59E0B":"#D1D5DB"}} onClick={()=>setEditVal(f=>({...f,estrellas:i}))}>★</span>)}</div>
                    </div>
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
                    <div style={{display:"flex",gap:6,marginLeft:12,flexShrink:0}}>
                      <button style={as.actBtn(A)} onClick={()=>setEditVal({...v})}>✏️</button>
                      <button style={as.actBtn(ER)} onClick={()=>setValoraciones(p=>p.filter(x=>x.id!==v.id))}>🗑</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {valoraciones.length===0&&<div style={{textAlign:"center",padding:"30px",color:TX2,fontSize:13,background:WH,borderRadius:12,border:`1px solid ${CR3}`,fontStyle:"italic"}}>No hay opiniones. Añade la primera.</div>}
          </div>
        )}
          <div style={as.card}>
            <div style={as.cardTitle}>Niveles de acceso</div>
            <div style={{background:CR,borderRadius:10,padding:"12px 14px",marginBottom:14,fontSize:12,color:TX2}}>🔐 <strong>Dueño:</strong> Acceso completo · Usuario: <code style={{background:CR2,padding:"1px 6px",borderRadius:4}}>{CONFIG.adminUser}</code></div>
            {CONFIG.peluqueros.map(p=>(
              <div key={p.id} style={as.row}>
                <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:20}}>{p.emoji}</span><div><div style={{fontSize:13,fontWeight:700,color:TX}}>{p.nombre}</div><div style={{fontSize:11,color:TX2}}>Usuario: <code style={{background:CR2,padding:"1px 6px",borderRadius:4}}>{normalize(p.nombre)}</code></div></div></div>
                <Bdg color={TX2}>Solo mi agenda</Bdg>
              </div>
            ))}
          </div>
        ){"}"}
        {subTab==="horarios"&&(
          <div>
            {CONFIG.peluqueros.map(p=>(
              <div key={p.id} style={{...as.card,marginBottom:12}}>
                <div style={{fontSize:13,fontWeight:700,color:TX,marginBottom:12,display:"flex",alignItems:"center",gap:8}}><span style={{width:10,height:10,borderRadius:2,background:p.color}}/>{p.emoji} {p.nombre}</div>
                <table style={as.table}>
                  <thead><tr>{["Día","Entrada","Salida","Descanso"].map(h=><th key={h} style={as.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {[1,2,3,4,5,6].map(d=>{
                      const h=p.horario[d];
                      return(<tr key={d}><td style={{...as.td,fontWeight:700}}>{DIAS_FULL[d]}</td><td style={as.td}>{h?h.entrada:<span style={{color:TX2}}>—</span>}</td><td style={as.td}>{h?h.salida:<span style={{color:TX2}}>—</span>}</td><td style={as.td}>{h?.descanso?`${h.descanso.inicio}–${h.descanso.fin}`:<span style={{color:TX2}}>—</span>}</td></tr>);
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── TAB COMUNICACION ──────────────────────────────────────
  const TabComunicacion=()=>{
    const msgs=[
      {icon:"✅",titulo:"Confirmación de reserva",cuando:"Inmediatamente al reservar",msg:`Hola [Nombre] 👋\nReserva confirmada en *${CONFIG.nombre}*\n\n✂️ [Servicio]\n💈 [Peluquero]\n📅 [Fecha]\n🕐 [Hora]\n💶 €[Precio]\n\nTe esperamos 😊`},
      {icon:"⏰",titulo:"Recordatorio 24h antes",cuando:"24h antes de la cita",msg:`Hola [Nombre] 👋\nMañana tienes cita en *${CONFIG.nombre}*\n\n✂️ [Servicio] con [Peluquero]\n🕐 [Hora]\n📍 ${CONFIG.direccion}\n\n¿Necesitas cancelar? Avísanos 🙏`},
      {icon:"⭐",titulo:"Mensaje post-cita",cuando:"24h después de la cita",msg:`Hola [Nombre]!\nEsperamos que hayas quedado genial 💈\n\n¿Cómo fue tu experiencia en *${CONFIG.nombre}*?\nTu opinión nos ayuda mucho 🙏`},
      {icon:"🔄",titulo:"Recordatorio de vuelta",cuando:"X semanas después",msg:`Hola [Nombre] 👋\n¿Toca pasar por *${CONFIG.nombre}*?\n\nReserva cuando quieras 😊\n👉 [Enlace reserva]`},
      {icon:"📊",titulo:"Resumen diario al dueño",cuando:"Cada mañana a las 8:00",msg:`*Resumen del día — ${CONFIG.nombre}*\n📅 [Fecha]\n\nCitas: [N] · Carlos: [N] · Miguel: [N] · Andrés: [N]\n💶 Ingresos previstos: €[Total]`},
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

  const tabs=[["citas","📅","Citas"],["clientes","👥","Clientes"],["caja","💰","Caja"],["disponibilidad","🗓️","Disponibilidad"],["config","⚙️","Config"],["comunicacion","💬","WhatsApp"]];
  const tabComp={citas:<TabCitas/>,clientes:<TabClientes/>,caja:<TabCaja/>,disponibilidad:<TabDisponibilidad/>,config:<TabConfig/>,comunicacion:<TabComunicacion/>};

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
      <div style={as.body}>{tabComp[tab]}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════
export default function App(){
  const [vista,setVista]=useState("cliente");
  const [peluqueroActivo,setPeluqueroActivo]=useState(null);
  const [citas]=useState(CITAS_INIT);
  const [valoraciones,setValoraciones]=useState(VALORACIONES_INIT);
  if(vista==="login") return <LoginAdmin onLoginDueno={()=>setVista("admin")} onLoginPeluquero={(p)=>{setPeluqueroActivo(p);setVista("peluquero");}} onBack={()=>setVista("cliente")}/>;
  if(vista==="admin") return <AdminPanel onLogout={()=>setVista("cliente")} valoraciones={valoraciones} setValoraciones={setValoraciones}/>;
  if(vista==="peluquero") return <PeluqueroView peluquero={peluqueroActivo} citas={citas} onLogout={()=>setVista("cliente")}/>;
  return <ClienteApp onAdmin={()=>setVista("login")} valoraciones={valoraciones}/>;
}
