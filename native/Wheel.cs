using System;
using System.Collections;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.Runtime.InteropServices;
using System.Windows.Forms;

// Drag wheel for the File Wheel feature.
// Keep DragSlop and TapMs identical to src/wheel/gesture.ts.
// A modifier opens the wheel only when it is released quickly during a drag.
// Holding Shift, Ctrl, or Alt still belongs to Windows' move/copy/link drag.
static class FileWheel {
    const int DragSlop = 12;
    const int TapMs = 350;
    const int HotkeyId = 0x594D;
    const uint ModNorepeat = 0x4000;
    static bool Enabled = true;
    static int ConvertFamily = 0x10, ToolsFamily = 0x11, ActionsFamily = 0x12;
    static string HotkeyText = "Ctrl+Alt+Y";
    static bool LeftDown, Dragging, HotkeyOk;
    static int StartX, StartY, LastX, LastY;
    static string OpenMode;
    static readonly Dictionary<int, Down> Held = new Dictionary<int, Down>();
    static WheelPump Pump;

    class Down { public long At; public int Count; }

    public static void Install() {
        Pump = new WheelPump();
        IntPtr handle = Pump.Handle;
        if (handle == IntPtr.Zero) return;
        ApplyHotkey();
    }

    public static void Uninstall() {
        if (Pump != null) UnregisterHotKey(Pump.Handle, HotkeyId);
        HotkeyOk = false;
    }

    public static void Configure(Dictionary<string, object> args) {
        if (args.ContainsKey("fileWheelEnabled")) Enabled = Convert.ToBoolean(args["fileWheelEnabled"]);
        if (args.ContainsKey("fileWheelConvert")) ConvertFamily = FamilyName(Convert.ToString(args["fileWheelConvert"]));
        if (args.ContainsKey("fileWheelTools")) ToolsFamily = FamilyName(Convert.ToString(args["fileWheelTools"]));
        if (args.ContainsKey("fileWheelActions")) ActionsFamily = FamilyName(Convert.ToString(args["fileWheelActions"]));
        if (args.ContainsKey("fileWheelHotkey") && args["fileWheelHotkey"] != null)
            HotkeyText = Convert.ToString(args["fileWheelHotkey"]);
        if (Pump == null) return;
        if (Pump.InvokeRequired) Pump.BeginInvoke(new MethodInvoker(ApplyHotkey));
        else ApplyHotkey();
    }

    public static void OnMouse(long message, int x, int y) {
        LastX = x;
        LastY = y;
        if (!Enabled) return;
        if (message == 0x201) {
            LeftDown = true;
            Dragging = false;
            StartX = x;
            StartY = y;
        } else if (message == 0x200 && LeftDown && !Dragging) {
            int dx = x - StartX, dy = y - StartY;
            if (dx * dx + dy * dy >= DragSlop * DragSlop) Dragging = true;
        } else if (message == 0x202) {
            LeftDown = false;
            Dragging = false;
            Held.Clear();
            if (OpenMode != null) Host.Emit(new { eventName = "file-wheel", action = "release", mode = OpenMode, x = x, y = y });
        }
    }

    public static void OnKey(int key, long message, bool suppressed) {
        if (!Enabled || suppressed) return;
        int family = Family(key);
        bool down = message == 0x100 || message == 0x104;
        bool up = message == 0x101 || message == 0x105;
        if (key == 0x1B && down && OpenMode != null) {
            OpenMode = null;
            Held.Clear();
            Host.Emit(new { eventName = "file-wheel", action = "close" });
            return;
        }
        if (family == 0) return;
        if (down) {
            Down row;
            if (!Held.TryGetValue(family, out row)) Held[family] = new Down { At = Now(), Count = 1 };
            else row.Count += 1;
            return;
        }
        if (!up) return;
        Down held;
        if (!Held.TryGetValue(family, out held)) return;
        held.Count -= 1;
        if (held.Count > 0) return;
        Held.Remove(family);
        if (!LeftDown || !Dragging) return;
        if (Now() - held.At > TapMs) return;
        string mode = ModeFor(family);
        if (mode == null) return;
        string action = OpenMode == null ? "open" : "swap";
        OpenMode = mode;
        Host.Emit(new { eventName = "file-wheel", action = action, mode = mode, x = LastX, y = LastY });
    }

    public static void OnHotkey() {
        if (!Enabled) return;
        POINT point;
        GetCursorPos(out point);
        Host.Emit(new { eventName = "file-wheel", action = "hotkey", x = point.X, y = point.Y });
    }

    public static void SetFileDrop(object raw) {
        StringCollection files = new StringCollection();
        foreach (string path in AsStrings(raw)) files.Add(path);
        if (files.Count == 0) throw new Exception("Choose a file to copy.");
        Clipboard.SetFileDropList(files);
    }

    static void ApplyHotkey() {
        if (Pump == null) return;
        UnregisterHotKey(Pump.Handle, HotkeyId);
        uint mods, vk;
        bool parsed = ParseHotkey(HotkeyText, out mods, out vk);
        bool ok = parsed && Enabled && RegisterHotKey(Pump.Handle, HotkeyId, mods | ModNorepeat, vk);
        if (ok == HotkeyOk) return;
        HotkeyOk = ok;
        if (!ok) Host.Emit(new { eventName = "file-wheel", action = "hotkey-unavailable" });
    }

    static string ModeFor(int family) {
        if (family == ConvertFamily) return "convert";
        if (family == ToolsFamily) return "tools";
        if (family == ActionsFamily) return "actions";
        return null;
    }

    static int Family(int key) {
        if (key == 0x10 || key == 0xA0 || key == 0xA1) return 0x10;
        if (key == 0x11 || key == 0xA2 || key == 0xA3) return 0x11;
        if (key == 0x12 || key == 0xA4 || key == 0xA5) return 0x12;
        return 0;
    }

    static int FamilyName(string name) {
        if (name == "Ctrl") return 0x11;
        if (name == "Alt") return 0x12;
        return 0x10;
    }

    static bool ParseHotkey(string value, out uint mods, out uint vk) {
        mods = 0;
        vk = 0;
        if (string.IsNullOrWhiteSpace(value)) return false;
        foreach (string part in value.Split('+')) {
            string token = part.Trim();
            if (token == "Ctrl") mods |= 2;
            else if (token == "Alt") mods |= 1;
            else if (token == "Shift") mods |= 4;
            else if (token == "Win") mods |= 8;
            else {
                try { vk = (uint)(int)Enum.Parse(typeof(Keys), token, true); }
                catch { return false; }
            }
        }
        return vk != 0;
    }

    static List<string> AsStrings(object raw) {
        List<string> list = new List<string>();
        if (raw is string) list.Add((string)raw);
        else if (raw is object[]) {
            foreach (object item in (object[])raw) if (item != null) list.Add(Convert.ToString(item));
        }
        else if (raw is ArrayList) {
            foreach (object item in (ArrayList)raw) if (item != null) list.Add(Convert.ToString(item));
        }
        return list;
    }

    static long Now() { return DateTime.UtcNow.Ticks / 10000; }

    [DllImport("user32.dll")] static extern bool RegisterHotKey(IntPtr handle, int id, uint mods, uint key);
    [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr handle, int id);
    [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT point);
    [StructLayout(LayoutKind.Sequential)] struct POINT { public int X; public int Y; }

    class WheelPump : Form {
        public WheelPump() {
            ShowInTaskbar = false;
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.Manual;
            Location = new System.Drawing.Point(-32000, -32000);
            Size = new System.Drawing.Size(1, 1);
            Opacity = 0;
        }
        protected override void WndProc(ref Message message) {
            if (message.Msg == 0x0312) OnHotkey();
            base.WndProc(ref message);
        }
    }
}
