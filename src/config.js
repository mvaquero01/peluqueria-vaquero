// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
export const CONFIG = {
  nombre:"PELUQUERÍA VAQUERO",
  slogan:"El detalle marca la diferencia",
  direccion:"Av. Diagonal 647, Barcelona",
  telefono:"711 212 526",
  whatsapp:"34711212526",
  color:"#B8860B",
  adminUser:"admin",
  adminPass:"admin123",
  semanasSinVisita:5,
  googleMapsUrl:"https://www.google.com/maps/search/?api=1&query=Av.+Diagonal+647+Barcelona",
  categorias:[
    {id:1,nombre:"Corte",       emoji:"✂️",servicioIds:[1,4]},
    {id:2,nombre:"Barba",       emoji:"🪒",servicioIds:[2,3]},
    {id:3,nombre:"Color",       emoji:"🎨",servicioIds:[5,6,7]},
    {id:4,nombre:"Tratamientos",emoji:"💆",servicioIds:[8,9]},
    {id:5,nombre:"Extras",      emoji:"✨",servicioIds:[10]},
  ],
  horarioGeneral:{
    1:{apertura:"09:00",cierre:"20:00"},2:{apertura:"09:00",cierre:"20:00"},
    3:{apertura:"09:00",cierre:"20:00"},4:{apertura:"09:00",cierre:"20:00"},
    5:{apertura:"09:00",cierre:"20:30"},6:{apertura:"09:00",cierre:"15:00"},
  },
  serviciosDefault:[
    {id:1, nombre:"Corte de cabello",   desc:"Lavado, corte personalizado y secado a tu estilo",            duracionMin:30, precio:15,emoji:"✂️"},
    {id:2, nombre:"Corte + Barba",      desc:"Corte completo más arreglo y perfilado de barba",             duracionMin:50, precio:22,emoji:"🪒"},
    {id:3, nombre:"Arreglo de barba",   desc:"Perfilado, recorte y afeitado con cuchilla caliente",         duracionMin:20, precio:10,emoji:"🧔"},
    {id:4, nombre:"Fade / Degradado",   desc:"Degradado progresivo con máquina y acabado a tijera",         duracionMin:40, precio:18,emoji:"💈"},
    {id:5, nombre:"Coloración completa",desc:"Tinte de raíz a puntas con producto profesional",             duracionMin:90, precio:45,emoji:"🎨"},
    {id:6, nombre:"Mechas / Highlights",desc:"Mechas balayage o californiana para un look natural",         duracionMin:120,precio:65,emoji:"✨"},
    {id:7, nombre:"Alisado keratina",   desc:"Alisado duradero que elimina el frizz hasta 4 meses",         duracionMin:150,precio:80,emoji:"💆"},
    {id:8, nombre:"Lavado + Secado",    desc:"Lavado con mascarilla nutritiva y secado profesional",         duracionMin:25, precio:8, emoji:"🚿"},
    {id:9, nombre:"Tratamiento capilar",desc:"Tratamiento hidratante o reparador según el tipo de cabello", duracionMin:45, precio:25,emoji:"🌿"},
    {id:10,nombre:"Diseño de cejas",    desc:"Depilación, perfilado y diseño adaptado a tu rostro",         duracionMin:20, precio:12,emoji:"👁️"},
  ],
  peluqueros:[
    {id:1,nombre:"Clara",   especialidad:"Corte clásico & Barba",    emoji:"✂️",color:"#E63946",password:"clara123",
     horario:{1:{entrada:"09:00",salida:"18:00",descanso:{inicio:"14:00",fin:"15:00"}},2:{entrada:"09:00",salida:"18:00",descanso:{inicio:"14:00",fin:"15:00"}},3:{entrada:"09:00",salida:"18:00",descanso:{inicio:"14:00",fin:"15:00"}},4:{entrada:"09:00",salida:"18:00",descanso:{inicio:"14:00",fin:"15:00"}},5:{entrada:"09:00",salida:"18:00",descanso:{inicio:"14:00",fin:"15:00"}}}},
    {id:2,nombre:"Fernando",especialidad:"Fade & Degradados",         emoji:"🪒",color:"#2A9D8F",password:"fernando123",
     horario:{1:{entrada:"12:00",salida:"20:00",descanso:{inicio:"16:00",fin:"17:00"}},2:{entrada:"12:00",salida:"20:00",descanso:{inicio:"16:00",fin:"17:00"}},3:{entrada:"12:00",salida:"20:00",descanso:{inicio:"16:00",fin:"17:00"}},4:{entrada:"12:00",salida:"20:00",descanso:{inicio:"16:00",fin:"17:00"}},5:{entrada:"12:00",salida:"20:30",descanso:null},6:{entrada:"09:00",salida:"15:00",descanso:null}}},
    {id:3,nombre:"Marta",   especialidad:"Coloración & Tendencias",  emoji:"🎨",color:"#E9C46A",password:"marta123",
     horario:{2:{entrada:"09:00",salida:"17:00",descanso:{inicio:"13:30",fin:"14:30"}},3:{entrada:"09:00",salida:"17:00",descanso:{inicio:"13:30",fin:"14:30"}},4:{entrada:"09:00",salida:"17:00",descanso:{inicio:"13:30",fin:"14:30"}},5:{entrada:"09:00",salida:"20:30",descanso:{inicio:"14:00",fin:"15:00"}},6:{entrada:"09:00",salida:"15:00",descanso:null}}},
  ],
};