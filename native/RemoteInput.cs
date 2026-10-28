using System;
using System.Runtime.InteropServices;

// Input from Yami Remote's screen view: a tap, a scroll, or one key from a
// short fixed list. Positions arrive as fractions of the primary screen and
// are sent as absolute coordinates, so display scaling does not matter.
// Text is typed with Unicode key events, so the clipboard is not touched.
static class RemoteInput {
    [StructLayout(LayoutKind.Sequential)] struct MouseInput { public int dx, dy, data, flags, time; public IntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] struct KeyInput { public short vk, scan; public int flags, time; public IntPtr extra; }
    [StructLayout(LayoutKind.Explicit)] struct Input {
        [FieldOffset(0)] public int type;
        [FieldOffset(8)] public MouseInput mouse;
        [FieldOffset(8)] public KeyInput key;
    }
    [DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint count, Input[] inputs, int size);

    const int MOVE = 0x0001, LEFTDOWN = 0x0002, LEFTUP = 0x0004, RIGHTDOWN = 0x0008, RIGHTUP = 0x0010, WHEEL = 0x0800, ABSOLUTE = 0x8000;
    const int KEYUP = 0x0002, UNICODE = 0x0004;

    static void Send(params Input[] inputs) {
        if (SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(Input))) != inputs.Length)
            throw new Exception("Windows did not accept the input (a window running as administrator may be in front).");
    }
    static Input Mouse(int flags, int x = 0, int y = 0, int data = 0) {
        var i = new Input { type = 0 };
        i.mouse = new MouseInput { dx = x, dy = y, flags = flags, data = data };
        return i;
    }
    static Input Key(short vk, short scan, int flags) {
        var i = new Input { type = 1 };
        i.key = new KeyInput { vk = vk, scan = scan, flags = flags };
        return i;
    }
    static int Scale(double fraction) { return (int)Math.Round(Math.Max(0, Math.Min(1, fraction)) * 65535); }

    public static object Click(double x, double y, bool right) {
        int ax = Scale(x), ay = Scale(y);
        Send(Mouse(MOVE | ABSOLUTE, ax, ay),
            Mouse((right ? RIGHTDOWN : LEFTDOWN) | ABSOLUTE, ax, ay),
            Mouse((right ? RIGHTUP : LEFTUP) | ABSOLUTE, ax, ay));
        return true;
    }
    public static object Scroll(int notches) {
        Send(Mouse(WHEEL, 0, 0, Math.Max(-10, Math.Min(10, notches)) * 120));
        return true;
    }
    public static object Press(string name) {
        short vk;
        switch (name) {
            case "enter": vk = 0x0D; break;
            case "backspace": vk = 0x08; break;
            case "tab": vk = 0x09; break;
            case "escape": vk = 0x1B; break;
            case "space": vk = 0x20; break;
            case "left": vk = 0x25; break;
            case "up": vk = 0x26; break;
            case "right": vk = 0x27; break;
            case "down": vk = 0x28; break;
            default: throw new Exception("Unknown key.");
        }
        Send(Key(vk, 0, 0), Key(vk, 0, KEYUP));
        return true;
    }
    public static object Type(string text) {
        if (string.IsNullOrEmpty(text) || text.Length > 2000) throw new Exception("Type up to 2,000 characters.");
        var inputs = new Input[text.Length * 2];
        for (int i = 0; i < text.Length; i++) {
            inputs[i * 2] = Key(0, (short)text[i], UNICODE);
            inputs[i * 2 + 1] = Key(0, (short)text[i], UNICODE | KEYUP);
        }
        Send(inputs);
        return true;
    }
}
