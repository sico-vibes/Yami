using System;
using System.Runtime.InteropServices;
using System.Text;

// Always on top for another app's window (the idea of PowerToys Always on
// Top): toggles WS_EX_TOPMOST and, on Windows 11, tints the window's own
// border lavender while it is pinned, so no overlay window is needed.
static class WindowPin
{
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] static extern IntPtr GetWindowLongPtr(IntPtr h, int index);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowTextW(IntPtr h, StringBuilder text, int max);
    [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr h, int attribute, ref uint value, int size);

    const int GWL_EXSTYLE = -20;
    const long WS_EX_TOPMOST = 0x8;
    const int DWMWA_BORDER_COLOR = 34;
    const uint DWMWA_COLOR_DEFAULT = 0xFFFFFFFF;
    // COLORREF is 0x00BBGGRR: Yami's lavender glow, #BCAAFF.
    const uint Lavender = 0x00FFAABC;

    public static object Toggle(long handle)
    {
        var h = new IntPtr(handle);
        if (handle == 0 || !IsWindow(h)) throw new Exception("That window is closed. Click the window to pin, then try again.");
        bool pin = (GetWindowLongPtr(h, GWL_EXSTYLE).ToInt64() & WS_EX_TOPMOST) == 0;
        // SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE
        if (!SetWindowPos(h, new IntPtr(pin ? -1 : -2), 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010))
            throw new Exception("Windows did not let Yami pin that window.");
        uint color = pin ? Lavender : DWMWA_COLOR_DEFAULT;
        DwmSetWindowAttribute(h, DWMWA_BORDER_COLOR, ref color, 4);
        var title = new StringBuilder(256);
        GetWindowTextW(h, title, title.Capacity);
        return new { pinned = pin, title = title.ToString() };
    }

    [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr h, uint flags);
    [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int command);
    [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
    [StructLayout(LayoutKind.Sequential)] struct Rect { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] struct MonitorInfo { public int Size; public Rect Monitor, Work; public uint Flags; }

    /**
     * Snaps a window to part of its monitor's work area (the screen minus the
     * taskbar): halves, quarters, thirds, centred, or maximised.
     */
    public static object Snap(long handle, string layout)
    {
        var h = new IntPtr(handle);
        if (handle == 0 || !IsWindow(h)) throw new Exception("That window is closed. Click the window to arrange, then try again.");
        if (layout == "maximize") { ShowWindow(h, 3); return new { layout = layout }; }
        var info = new MonitorInfo(); info.Size = Marshal.SizeOf(typeof(MonitorInfo));
        if (!GetMonitorInfo(MonitorFromWindow(h, 2), ref info)) throw new Exception("Windows did not say which screen that window is on.");
        int x = info.Work.Left, y = info.Work.Top, w = info.Work.Right - x, ht = info.Work.Bottom - y;
        int hw = w / 2, hh = ht / 2, tw = w / 3;
        int[] r;
        switch (layout)
        {
            case "left": r = new[] { x, y, hw, ht }; break;
            case "right": r = new[] { x + hw, y, w - hw, ht }; break;
            case "top": r = new[] { x, y, w, hh }; break;
            case "bottom": r = new[] { x, y + hh, w, ht - hh }; break;
            case "top-left": r = new[] { x, y, hw, hh }; break;
            case "top-right": r = new[] { x + hw, y, w - hw, hh }; break;
            case "bottom-left": r = new[] { x, y + hh, hw, ht - hh }; break;
            case "bottom-right": r = new[] { x + hw, y + hh, w - hw, ht - hh }; break;
            case "left-third": r = new[] { x, y, tw, ht }; break;
            case "center-third": r = new[] { x + tw, y, tw, ht }; break;
            case "right-third": r = new[] { x + 2 * tw, y, w - 2 * tw, ht }; break;
            case "left-two-thirds": r = new[] { x, y, 2 * tw, ht }; break;
            case "right-two-thirds": r = new[] { x + tw, y, w - tw, ht }; break;
            case "center": r = new[] { x + w / 6, y + ht / 8, w * 2 / 3, ht * 3 / 4 }; break;
            default: throw new Exception("Unknown layout.");
        }
        // A maximised or minimised window is restored first, or it ignores the move.
        if (IsZoomed(h) || IsIconic(h)) ShowWindow(h, 9);
        // SWP_NOZORDER | SWP_NOACTIVATE
        if (!SetWindowPos(h, IntPtr.Zero, r[0], r[1], r[2], r[3], 0x0004 | 0x0010))
            throw new Exception("Windows did not let Yami move that window.");
        return new { layout = layout, x = r[0], y = r[1], width = r[2], height = r[3] };
    }

    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc proc, IntPtr l);
    delegate bool EnumProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out Rect r);
    [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int attribute, out int value, int size);
    [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool QueryFullProcessImageNameW(IntPtr p, uint flags, StringBuilder name, ref uint size);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);

    static string ExePath(uint pid)
    {
        IntPtr p = OpenProcess(0x1000, false, pid); // PROCESS_QUERY_LIMITED_INFORMATION
        if (p == IntPtr.Zero) return "";
        try { var b = new StringBuilder(1024); uint n = (uint)b.Capacity; return QueryFullProcessImageNameW(p, 0, b, ref n) ? b.ToString() : ""; }
        finally { CloseHandle(p); }
    }

    /**
     * The app windows a person would call open: visible, titled, top-level,
     * not cloaked (other virtual desktops, hidden UWP frames), with the
     * program that owns each and where it sits.
     */
    public static object Windows(uint skipPid)
    {
        var list = new System.Collections.Generic.List<object>();
        EnumWindows(delegate (IntPtr h, IntPtr l)
        {
            if (!IsWindowVisible(h) || GetWindow(h, 4) != IntPtr.Zero) return true; // GW_OWNER
            int cloaked; if (DwmGetWindowAttribute(h, 14, out cloaked, 4) == 0 && cloaked != 0) return true;
            var title = new StringBuilder(256); GetWindowTextW(h, title, title.Capacity);
            if (title.Length == 0) return true;
            uint pid; GetWindowThreadProcessId(h, out pid);
            if (pid == skipPid) return true;
            string exe = ExePath(pid);
            if (exe.Length == 0) return true;
            Rect r; GetWindowRect(h, out r);
            list.Add(new { handle = h.ToInt64(), exe = exe, title = title.ToString(), maximized = IsZoomed(h), x = r.Left, y = r.Top, width = r.Right - r.Left, height = r.Bottom - r.Top });
            return true;
        }, IntPtr.Zero);
        return list;
    }

    /** Puts a window back where it was saved. */
    public static bool Place(long handle, int x, int y, int width, int height, bool maximized)
    {
        var h = new IntPtr(handle);
        if (!IsWindow(h)) return false;
        if (IsZoomed(h) || IsIconic(h)) ShowWindow(h, 9);
        SetWindowPos(h, IntPtr.Zero, x, y, Math.Max(120, width), Math.Max(80, height), 0x0004 | 0x0010);
        if (maximized) ShowWindow(h, 3);
        return true;
    }

    public static bool IsPinned(long handle)
    {
        var h = new IntPtr(handle);
        return handle != 0 && IsWindow(h) && (GetWindowLongPtr(h, GWL_EXSTYLE).ToInt64() & WS_EX_TOPMOST) != 0;
    }
}
