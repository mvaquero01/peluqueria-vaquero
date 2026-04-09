import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDxc3hkR-Bc86uWdNCxleGbiFfku3JCA0Y",
  authDomain: "peluqueria-vaquero-c3e53.firebaseapp.com",
  projectId: "peluqueria-vaquero-c3e53",
  storageBucket: "peluqueria-vaquero-c3e53.firebasestorage.app",
  messagingSenderId: "316425507808",
  appId: "1:316425507808:web:b42c5e68955e5904b69185"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);