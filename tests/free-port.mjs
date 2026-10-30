import net from "node:net";

// A local port the OS says is free. A random port can land in a range
// Windows reserves (as on CI machines) and fail with EACCES.
export const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
