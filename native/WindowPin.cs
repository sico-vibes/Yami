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

    public static bool IsPinned(long handle)
    {
        var h = new IntPtr(handle);
        return handle != 0 && IsWindow(h) && (GetWindowLongPtr(h, GWL_EXSTYLE).ToInt64() & WS_EX_TOPMOST) != 0;
    }
}
