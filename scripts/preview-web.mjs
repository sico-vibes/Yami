import { createServer } from "vite";
// YAMI_PREVIEW_PORT moves the preview when 5174 is taken by another app.
const port = Number(process.env.YAMI_PREVIEW_PORT) || 5174;
const server = await createServer({
  define: { "import.meta.env.VITE_YAMI_PREVIEW": JSON.stringify("true") },
  server: { host: "127.0.0.1", port, strictPort: true },
});
await server.listen();
console.log("Yami UI preview — demo data only; no Windows or provider access.");
server.printUrls();
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await server.close();
    process.exit(0);
  });
