export default {
  plugins: {
    "@tailwindcss/postcss": {}, // <--- Aquí es donde estaba el fallo, ahora tiene el nombre nuevo
    autoprefixer: {},
  },
}