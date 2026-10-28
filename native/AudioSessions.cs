using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;

// Per-app volume: the default output device's Core Audio sessions, one per
// app that is playing or has played sound. Methods are declared in vtable
// order; only the ones Yami calls are used.
static class AudioSessions {
    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class DeviceEnumerator {}
    [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IDevices { int EnumAudioEndpoints(int flow, int mask, out IntPtr devices); int GetDefaultAudioEndpoint(int flow, int role, out IDevice device); }
    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IDevice { int Activate(ref Guid id, int context, IntPtr parameters, [MarshalAs(UnmanagedType.IUnknown)] out object value); }
    [ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface ISessionManager2 {
        int GetAudioSessionControl(IntPtr group, int flags, out IntPtr control);
        int GetSimpleAudioVolume(IntPtr group, int flags, out IntPtr volume);
        int GetSessionEnumerator(out ISessionEnumerator sessions);
    }
    [ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface ISessionEnumerator { int GetCount(out int count); int GetSession(int index, out ISessionControl2 session); }
    [ComImport, Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface ISessionControl2 {
        int GetState(out int state);
        int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string name);
        int SetDisplayName(string name, ref Guid context);
        int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string path);
        int SetIconPath(string path, ref Guid context);
        int GetGroupingParam(out Guid group);
        int SetGroupingParam(ref Guid group, ref Guid context);
        int RegisterAudioSessionNotification(IntPtr client);
        int UnregisterAudioSessionNotification(IntPtr client);
        int GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
        int GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
        int GetProcessId(out uint pid);
        [PreserveSig] int IsSystemSoundsSession();
    }
    [ComImport, Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface ISimpleVolume {
        int SetMasterVolume(float level, ref Guid context);
        int GetMasterVolume(out float level);
        int SetMute(bool mute, ref Guid context);
        int GetMute(out bool mute);
    }

    static IEnumerable<ISessionControl2> Sessions() {
        var devices = (IDevices)new DeviceEnumerator();
        IDevice device;
        Marshal.ThrowExceptionForHR(devices.GetDefaultAudioEndpoint(0, 1, out device));
        object manager;
        Guid iid = typeof(ISessionManager2).GUID;
        Marshal.ThrowExceptionForHR(device.Activate(ref iid, 23, IntPtr.Zero, out manager));
        ISessionEnumerator list;
        Marshal.ThrowExceptionForHR(((ISessionManager2)manager).GetSessionEnumerator(out list));
        int count;
        list.GetCount(out count);
        for (int i = 0; i < count; i++) {
            ISessionControl2 session;
            if (list.GetSession(i, out session) == 0 && session != null) yield return session;
        }
    }

    static string AppName(uint pid, string display) {
        try {
            var p = Process.GetProcessById((int)pid);
            var desc = p.MainModule != null ? p.MainModule.FileVersionInfo.FileDescription : null;
            return !string.IsNullOrEmpty(desc) ? desc : p.ProcessName;
        } catch { return string.IsNullOrEmpty(display) ? "App " + pid : display; }
    }

    /** Apps with an audio session on the default output, with volume 0-100. */
    public static List<Dictionary<string, object>> List() {
        var apps = new List<Dictionary<string, object>>();
        var seen = new HashSet<uint>();
        foreach (var session in Sessions()) {
            uint pid; int state; string display;
            session.GetProcessId(out pid);
            session.GetState(out state);
            session.GetDisplayName(out display);
            // State 2 means the session has expired; skip it and system sounds.
            if (pid == 0 || state == 2 || session.IsSystemSoundsSession() == 0 || !seen.Add(pid)) continue;
            var volume = (ISimpleVolume)session;
            float level; bool mute;
            volume.GetMasterVolume(out level);
            volume.GetMute(out mute);
            apps.Add(new Dictionary<string, object> {
                {"pid", (int)pid}, {"name", AppName(pid, display)},
                {"volume", (int)Math.Round(level * 100)}, {"muted", mute}, {"active", state == 1}
            });
        }
        return apps;
    }

    /** Sets one app's volume (0-100) or mute; returns the new list. */
    public static List<Dictionary<string, object>> Set(int pid, int volume, int mute) {
        bool found = false;
        foreach (var session in Sessions()) {
            uint id; session.GetProcessId(out id);
            if (id != pid) continue;
            var simple = (ISimpleVolume)session;
            Guid context = Guid.Empty;
            if (volume >= 0) simple.SetMasterVolume(Math.Max(0, Math.Min(100, volume)) / 100f, ref context);
            if (mute >= 0) simple.SetMute(mute == 1, ref context);
            found = true;
        }
        if (!found) throw new Exception("That app is no longer playing sound.");
        return List();
    }
}
