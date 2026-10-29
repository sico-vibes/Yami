using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

// A program's display name and icon for Yami's dock. The name is the exe's
// own description ("Google Chrome" rather than "chrome"). The icon is the
// one its window shows, which also covers apps installed from the Store,
// whose files Electron cannot read an icon from.
static class AppInfo
{
    [DllImport("user32.dll")] static extern IntPtr SendMessageTimeoutW(IntPtr h, uint msg, IntPtr w, IntPtr l, uint flags, uint timeout, out IntPtr result);
    [DllImport("user32.dll", EntryPoint = "GetClassLongPtrW")] static extern IntPtr GetClassLongPtr(IntPtr h, int index);
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);

    public static object Read(string exe, long handle)
    {
        string name = "";
        try
        {
            var v = FileVersionInfo.GetVersionInfo(exe);
            name = (v.FileDescription ?? "").Trim();
            if (name.Length == 0) name = (v.ProductName ?? "").Trim();
            // Some programs describe themselves by their file name.
            if (name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) name = name.Substring(0, name.Length - 4);
        }
        catch { }
        string icon = "";
        var h = new IntPtr(handle);
        if (handle != 0 && IsWindow(h)) icon = Png(WindowIcon(h));
        return new { name = name, icon = icon };
    }

    static IntPtr WindowIcon(IntPtr h)
    {
        IntPtr icon;
        // WM_GETICON, ICON_BIG then ICON_SMALL2; SMTO_ABORTIFHUNG, 100 ms.
        foreach (var size in new[] { 1, 2 })
            if (SendMessageTimeoutW(h, 0x7F, new IntPtr(size), IntPtr.Zero, 0x2, 100, out icon) != IntPtr.Zero && icon != IntPtr.Zero)
                return icon;
        icon = GetClassLongPtr(h, -14); // GCLP_HICON
        return icon != IntPtr.Zero ? icon : GetClassLongPtr(h, -34); // GCLP_HICONSM
    }

    static string Png(IntPtr hicon)
    {
        if (hicon == IntPtr.Zero) return "";
        try
        {
            // FromHandle does not own the icon, so disposing leaves it alone.
            using (var ic = Icon.FromHandle(hicon))
            using (var bmp = ic.ToBitmap())
            using (var ms = new MemoryStream())
            {
                bmp.Save(ms, ImageFormat.Png);
                return "data:image/png;base64," + Convert.ToBase64String(ms.ToArray());
            }
        }
        catch { return ""; }
    }
}
