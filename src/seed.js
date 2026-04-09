import { db } from "./firebase.js";
import { collection, addDoc, setDoc, doc } from "firebase/firestore";

const CITAS = [
  { clienteNombre:"María García", clienteTel:"611111111", servicio:"Corte de cabello", servicioId:1, peluqueroId:1, peluquero:"Clara", fecha:"2026-03-27", hora:"09:30", precio:15, estado:"completada", nota:"" },
  { clienteNombre:"Juan López", clienteTel:"622222222", servicio:"Fade / Degradado", servicioId:4, peluqueroId:2, peluquero:"Fernando", fecha:"2026-03-27", hora:"12:30", precio:18, estado:"pendiente", nota:"Siempre el mismo fade" },
  { clienteNombre:"Sofía Martín", clienteTel:"633333333", servicio:"Coloración completa", servicioId:5, peluqueroId:3, peluquero:"Marta", fecha:"2026-03-27", hora:"10:30", precio:45, estado:"pendiente", nota:"" },
];

const CLIENTES = [
  { nombre:"María García", telefono:"611111111", visitas:12, gasto:280, ultimaVisita:"2026-03-27", nota:"Alérgica al amoniaco. Prefiere a Clara.", historial:[] },
  { nombre:"Juan López", telefono:"622222222", visitas:8, gasto:160, ultimaVisita:"2026-03-27", nota:"", historial:[] },
  { nombre:"Sofía Martín", telefono:"633333333", visitas:5, gasto:230, ultimaVisita:"2026-03-27", nota:"Le gusta el tono castaño cálido.", historial:[] },
];

const VALORACIONES = [
  { nombre:"Laura M.", estrellas:5, comentario:"Clara es increíble, siempre me deja el pelo perfecto.", servicio:"Corte de cabello" },
  { nombre:"Javier R.", estrellas:5, comentario:"Fernando hace los mejores degradados de Barcelona.", servicio:"Fade / Degradado" },
  { nombre:"Marta S.", estrellas:5, comentario:"Marta es un artista con el color.", servicio:"Mechas / Highlights" },
];

export const seedDatabase = async () => {
  try {
    console.log("Iniciando carga de datos...");
    for (const cita of CITAS) await addDoc(collection(db, "citas"), cita);
    console.log("✅ Citas cargadas");
    for (const cliente of CLIENTES) await addDoc(collection(db, "clientes"), cliente);
    console.log("✅ Clientes cargados");
    for (const val of VALORACIONES) await addDoc(collection(db, "valoraciones"), val);
    console.log("✅ Valoraciones cargadas");
    await setDoc(doc(db, "config", "general"), { inicializado: true });
    console.log("✅ Todo listo");
    return true;
  } catch (e) {
    console.error("Error:", e);
    return false;
  }
};