using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;

// Accent characters (the idea of PowerToys Quick Accent), off unless
// switched on: hold a letter for 0.3 seconds, press Space, move with Space
// or the arrows, release the letter. The letters already typed are erased
// and the chosen character is typed instead. Esc cancels. Typing quickly
// never triggers it, because the letter must already be held for 0.3 s.
static class QuickAccent
{
    public static bool Enabled;
    // The desktop check types with injected keys; real use ignores them.
    static readonly bool Test = Environment.GetEnvironmentVariable("YAMI_ACCENT_TEST") == "1";
    static readonly Dictionary<int, string> Table = new Dictionary<int, string>
    {
        { 0x41, "àáâäãåæāą" }, { 0x43, "çćč" }, { 0x44, "ðď" }, { 0x45, "éèêëēęě€" },
        { 0x47, "ğ" }, { 0x49, "íìîïī" }, { 0x4C, "łľ" }, { 0x4E, "ñńň" },
        { 0x4F, "óòôöõøœō" }, { 0x52, "ř" }, { 0x53, "ßśš" }, { 0x54, "ťţ" },
        { 0x55, "úùûüūů" }, { 0x59, "ýÿ" }, { 0x5A, "žźż" },
    };
    static int letter = -1, typed, index, downAt;
    public static string LastTyped = "";
    static bool active, upper;

    [StructLayout(LayoutKind.Sequential)]
    struct Input { public uint Type; public KeyInput Key; public long Pad; }
    [StructLayout(LayoutKind.Sequential)]
    struct KeyInput { public ushort Vk, Scan; public uint Flags, Time; public IntPtr Extra; }
    [DllImport("user32.dll")] static extern uint SendInput(uint count, Input[] inputs, int size);

    static string Choices() { string s = Table[letter]; return upper ? s.ToUpperInvariant() : s; }

    /**
     * Test only: runs key steps (virtual key, up, pause in ms) through the
     * same logic, as real keys, and returns what it would type.
     */
    public static object Feed(object[] steps)
    {
        if (!Test) throw new Exception("Only for the desktop check.");
        LastTyped = "";
        var consumed = new List<bool>();
        foreach (Dictionary<string, object> step in steps)
        {
            int vk = Convert.ToInt32(step["vk"]);
            bool up = Convert.ToBoolean(step["up"]);
            consumed.Add(OnKey(vk, up ? 0x101 : 0x100, false, false, false));
            Thread.Sleep(Convert.ToInt32(step["wait"]));
        }
        return new { typed = LastTyped, consumed = consumed };
    }

    /** True when the key is consumed here. Injected keys are ignored. */
    public static bool OnKey(int vk, long message, bool injected, bool shift, bool modifiers)
    {
        if (!Enabled || (injected && !Test)) return false;
        // Yami's own typed character (VK_PACKET) and erasing keys pass through.
        if (vk == 0xE7 || (injected && vk == 0x08)) return false;
        bool down = message == 0x100 || message == 0x104, up = message == 0x101 || message == 0x105;
        if (active)
        {
            int count = Choices().Length;
            if (down && (vk == 0x20 || vk == 0x27)) { index = (index + 1) % count; Show(); return true; }
            if (down && vk == 0x25) { index = (index + count - 1) % count; Show(); return true; }
            if (down && vk == 0x1B) { Finish(false); return true; }
            if (down && vk == letter) return true; // the held letter repeating
            if (up && vk == letter) { Finish(true); return true; }
            if (up && (vk == 0x20 || vk == 0x25 || vk == 0x27 || vk == 0x1B)) return true;
            return false;
        }
        if (down && vk == letter) { typed++; return false; }
        if (down && Table.ContainsKey(vk) && !modifiers) { letter = vk; typed = 1; upper = shift; downAt = Environment.TickCount; return false; }
        if (up && vk == letter) { letter = -1; return false; }
        if (down && vk == 0x20 && letter >= 0 && !modifiers && Environment.TickCount - downAt >= 300)
        {
            active = true;
            index = 0;
            Show();
            return true;
        }
        if (down && vk != 0x10 && vk != 0xA0 && vk != 0xA1) letter = -1;
        return false;
    }

    static void Show()
    {
        Host.Emit(new { eventName = "accent", open = true, choices = Choices(), index = index });
    }

    static void Finish(bool type)
    {
        string chosen = Choices().Substring(index, 1);
        int erase = typed;
        active = false;
        letter = -1;
        Host.Emit(new { eventName = "accent", open = false });
        if (!type) return;
        // The desktop check reads what would be typed instead of typing it.
        if (Test) { LastTyped = new string('\b', erase) + chosen; return; }
        // Typed after the hook returns, so the injected keys do not re-enter it.
        ThreadPool.QueueUserWorkItem(delegate
        {
            var inputs = new List<Input>();
            for (int i = 0; i < erase; i++)
            {
                inputs.Add(new Input { Type = 1, Key = new KeyInput { Vk = 0x08 } });
                inputs.Add(new Input { Type = 1, Key = new KeyInput { Vk = 0x08, Flags = 2 } });
            }
            inputs.Add(new Input { Type = 1, Key = new KeyInput { Scan = chosen[0], Flags = 4 } });
            inputs.Add(new Input { Type = 1, Key = new KeyInput { Scan = chosen[0], Flags = 4 | 2 } });
            SendInput((uint)inputs.Count, inputs.ToArray(), Marshal.SizeOf(typeof(Input)));
        });
    }
}
