const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
app
  .whenReady()
  .then(async () => {
    const win = new BrowserWindow({
      show: false,
      width: 256,
      height: 256,
      webPreferences: { sandbox: true },
    });
    const svg = fs.readFileSync("public/spirit.svg", "utf8");
    await win.loadURL("data:text/html,<html><body></body></html>");
    const data = await win.webContents.executeJavaScript(
      `(async()=>{const im=new Image();im.src=${JSON.stringify("data:image/svg+xml;base64," + Buffer.from(svg).toString("base64"))};await im.decode();const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d');const bg=ctx.createLinearGradient(0,0,0,256);bg.addColorStop(0,'#232838');bg.addColorStop(1,'#0c0e15');ctx.fillStyle=bg;ctx.beginPath();ctx.roundRect(8,8,240,240,56);ctx.fill();ctx.drawImage(im,22,22,212,212);return c.toDataURL('image/png').split(',')[1];})()`,
    );
    const png = Buffer.from(data, "base64");
    fs.writeFileSync("public/yami-icon.png", png);
    const header = Buffer.alloc(22);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(1, 4);
    header.writeUInt16LE(1, 10);
    header.writeUInt16LE(32, 12);
    header.writeUInt32LE(png.length, 14);
    header.writeUInt32LE(22, 18);
    fs.writeFileSync("public/yami.ico", Buffer.concat([header, png]));
    win.destroy();
    app.quit();
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
