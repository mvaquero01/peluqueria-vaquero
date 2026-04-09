import { db } from "./firebase.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, setDoc
} from "firebase/firestore";

// ── CITAS ──────────────────────────────────────
export const suscribirCitas = (callback) => {
  const q = query(collection(db, "citas"), orderBy("fecha"), orderBy("hora"));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
};

export const crearCita = (cita) => addDoc(collection(db, "citas"), cita);

export const actualizarCita = (id, datos) =>
  updateDoc(doc(db, "citas", id), datos);

export const borrarCita = (id) => deleteDoc(doc(db, "citas", id));

// ── CLIENTES ───────────────────────────────────
export const suscribirClientes = (callback) => {
  return onSnapshot(collection(db, "clientes"), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
};

export const crearCliente = (cliente) =>
  addDoc(collection(db, "clientes"), cliente);

export const actualizarCliente = (id, datos) =>
  updateDoc(doc(db, "clientes", id), datos);

// ── VALORACIONES ───────────────────────────────
export const suscribirValoraciones = (callback) => {
  return onSnapshot(collection(db, "valoraciones"), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
};

export const crearValoracion = (val) =>
  addDoc(collection(db, "valoraciones"), val);

export const actualizarValoracion = (id, datos) =>
  updateDoc(doc(db, "valoraciones", id), datos);

export const borrarValoracion = (id) =>
  deleteDoc(doc(db, "valoraciones", id));

// ── CONFIG ─────────────────────────────────────
export const suscribirConfig = (callback) => {
  return onSnapshot(doc(db, "config", "general"), snap => {
    if (snap.exists()) callback(snap.data());
  });
};

export const guardarConfig = (datos) =>
  setDoc(doc(db, "config", "general"), datos, { merge: true });