// Yami Home: a light new tab with no feeds, ads or tracking. Everything it
// keeps (folders, bookmarks, background, name, search engine) stays in this
// browser's extension storage. Inside the Yami Browser the same page runs
// with localStorage instead.

const store = globalThis.chrome?.storage?.local
  ? {
      get: (k) => chrome.storage.local.get(k),
      set: (v) => chrome.storage.local.set(v),
    }
  : {
      get: async (k) => {
        const out = {};
        for (const key of [].concat(k)) {
          try {
            const v = localStorage.getItem("yami-home:" + key);
            if (v !== null) out[key] = JSON.parse(v);
          } catch {}
        }
        return out;
      },
      set: async (v) => {
        for (const [k, val] of Object.entries(v))
          try {
            localStorage.setItem("yami-home:" + k, JSON.stringify(val));
          } catch {}
      },
    };

const $ = (id) => document.getElementById(id);
let state = {
  folders: ["Favourites"],
  folder: "Favourites",
  tiles: [
    { name: "GitHub", url: "https://github.com/", folder: "Favourites" },
    { name: "YouTube", url: "https://www.youtube.com/", folder: "Favourites" },
    {
      name: "Wikipedia",
      url: "https://www.wikipedia.org/",
      folder: "Favourites",
    },
  ],
  engine: "https://duckduckgo.com/?q=",
  name: "",
  background: "",
  sendAll: false,
};

const save = () => store.set({ ...state });

function clock() {
  const now = new Date();
  $("clock").textContent = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const h = now.getHours();
  const part =
    h < 5
      ? "Good night"
      : h < 12
        ? "Good morning"
        : h < 18
          ? "Good afternoon"
          : "Good evening";
  $("greeting").textContent = state.name
    ? `${part}, ${state.name}.`
    : `${part}.`;
}

function host(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function render() {
  document.body.classList.toggle("custom", !!state.background);
  $("backdrop").style.backgroundImage = state.background
    ? `url("${state.background}")`
    : "";
  const nav = $("folders");
  nav.replaceChildren(
    ...state.folders.map((f) => {
      const b = document.createElement("button");
      b.textContent = f;
      b.className = f === state.folder ? "on" : "";
      b.onclick = () => {
        state.folder = f;
        save();
        render();
      };
      return b;
    }),
  );
  const grid = $("tiles");
  const shown = state.tiles.filter((t) => t.folder === state.folder);
  grid.replaceChildren(
    ...shown.map((t) => {
      const a = document.createElement("a");
      a.href = t.url;
      a.className = "tile";
      const mark = document.createElement("span");
      mark.className = "mark";
      mark.textContent = (t.name || host(t.url)).slice(0, 1).toUpperCase();
      const label = document.createElement("span");
      label.className = "label";
      label.textContent = t.name || host(t.url);
      const remove = document.createElement("button");
      remove.className = "remove";
      remove.setAttribute("aria-label", `Remove ${t.name}`);
      remove.textContent = "×";
      remove.onclick = (e) => {
        e.preventDefault();
        state.tiles = state.tiles.filter((x) => x !== t);
        save();
        render();
      };
      a.append(mark, label, remove);
      return a;
    }),
  );
  if (!shown.length) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "No bookmarks in this folder yet. Add some with the gear.";
    grid.append(p);
  }
  $("engine").value = state.engine;
  $("name").value = state.name;
  $("send-all").checked = !!state.sendAll;
  clock();
}

$("search").onsubmit = (e) => {
  e.preventDefault();
  const q = $("query").value.trim();
  if (!q) return;
  location.href = /^https?:\/\/\S+$/.test(q)
    ? q
    : state.engine + encodeURIComponent(q);
};
$("open-settings").onclick = () => ($("panel").hidden = false);
$("close-settings").onclick = () => ($("panel").hidden = true);
$("engine").onchange = (e) => {
  state.engine = e.target.value;
  save();
};
$("name").oninput = (e) => {
  state.name = e.target.value.trim();
  save();
  clock();
};
$("send-all").onchange = (e) => {
  state.sendAll = e.target.checked;
  save();
};
$("background").onchange = (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  // Pictures are scaled to the screen so storage stays small.
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, 2560 / img.width);
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    state.background = c.toDataURL("image/jpeg", 0.85);
    save();
    render();
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(file);
};
$("clear-background").onclick = () => {
  state.background = "";
  save();
  render();
};
$("add-folder").onclick = () => {
  const name = $("new-folder").value.trim();
  if (!name || state.folders.includes(name)) return;
  state.folders.push(name);
  state.folder = name;
  $("new-folder").value = "";
  save();
  render();
};
$("add-tile").onclick = () => {
  let url = $("tile-url").value.trim();
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    new URL(url);
  } catch {
    return;
  }
  state.tiles.push({
    name: $("tile-name").value.trim() || host(url),
    url,
    folder: state.folder,
  });
  $("tile-name").value = $("tile-url").value = "";
  save();
  render();
};
$("import").onclick = async () => {
  if (!globalThis.chrome?.bookmarks) return;
  const [root] = await chrome.bookmarks.getTree();
  const bar = root.children?.[0]?.children || [];
  const add = (nodes, folder) => {
    for (const n of nodes)
      if (n.url && /^https?:/.test(n.url))
        state.tiles.push({ name: n.title, url: n.url, folder });
      else if (n.children) {
        if (!state.folders.includes(n.title)) state.folders.push(n.title);
        add(n.children, n.title);
      }
  };
  add(bar, state.folder);
  save();
  render();
};

function linkStatus() {
  if (!globalThis.chrome?.runtime?.sendMessage) {
    $("link-status").textContent =
      "Downloads already go to Yami in the Yami Browser.";
    return;
  }
  chrome.runtime.sendMessage({ type: "yami-status" }, (r) => {
    $("link-status").textContent = r?.linked
      ? "Linked to Yami: right-click a link and choose Download with Yami."
      : "Yami is not linked. Turn on the browser link in Yami › Desk › Downloads.";
  });
}

store.get(Object.keys(state)).then((saved) => {
  state = { ...state, ...saved };
  render();
  linkStatus();
  setInterval(clock, 15000);
});
