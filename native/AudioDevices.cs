using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

// Output devices for the Controls card: the active speakers and headphones,
// which one is the default, and switching the default. Listing uses the
// documented Core Audio API. Windows has no documented call to change the
// default device; this uses IPolicyConfig, the undocumented interface the
// Sound control panel itself uses (as EarTrumpet and SoundSwitch do).
static class AudioDevices {
    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class DeviceEnumerator {}
    [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IDevices {
        int EnumAudioEndpoints(int flow, int mask, out IDeviceCollection devices);
        int GetDefaultAudioEndpoint(int flow, int role, out IDevice device);
    }
    [ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IDeviceCollection { int GetCount(out int count); int Item(int index, out IDevice device); }
    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IDevice {
        int Activate(ref Guid id, int context, IntPtr parameters, [MarshalAs(UnmanagedType.IUnknown)] out object value);
        int OpenPropertyStore(int access, out IPropertyStore store);
        int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
    }
    [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPropertyStore {
        int GetCount(out int count);
        int GetAt(int index, out PropertyKey key);
        int GetValue(ref PropertyKey key, out PropVariant value);
    }
    [StructLayout(LayoutKind.Sequential)] struct PropertyKey { public Guid fmtid; public int pid; }
    [StructLayout(LayoutKind.Explicit)] struct PropVariant {
        [FieldOffset(0)] public short vt;
        [FieldOffset(8)] public IntPtr pointer;
    }
    // Vtable order matters: only SetDefaultEndpoint is called.
    [ComImport, Guid("F8679F50-850A-41CF-9C72-430F290290C8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPolicyConfig {
        int GetMixFormat(); int GetDeviceFormat(); int ResetDeviceFormat(); int SetDeviceFormat();
        int GetProcessingPeriod(); int SetProcessingPeriod(); int GetShareMode(); int SetShareMode();
        int GetPropertyValue(); int SetPropertyValue();
        int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)] string id, int role);
        int SetEndpointVisibility();
    }
    [ComImport, Guid("870AF99C-171D-4F9E-AF0D-E63DF40C2BC9")] class PolicyConfigClient {}

    static string Name(IDevice device) {
        IPropertyStore store; device.OpenPropertyStore(0, out store);
        // PKEY_Device_FriendlyName
        var key = new PropertyKey { fmtid = new Guid("A45C254E-DF1C-4EFD-8020-67D146A850E0"), pid = 14 };
        PropVariant value; store.GetValue(ref key, out value);
        return value.vt == 31 ? Marshal.PtrToStringUni(value.pointer) : "Output device";
    }

    public static object List() {
        var enumerator = (IDevices)new DeviceEnumerator();
        IDevice current; string defaultId = "";
        if (enumerator.GetDefaultAudioEndpoint(0, 1, out current) == 0) current.GetId(out defaultId);
        IDeviceCollection all; enumerator.EnumAudioEndpoints(0, 1, out all);
        int count; all.GetCount(out count);
        var list = new List<object>();
        for (int i = 0; i < count; i++) {
            IDevice device; all.Item(i, out device);
            string id; device.GetId(out id);
            list.Add(new { id = id, name = Name(device), isDefault = id == defaultId });
        }
        return list;
    }

    /** Makes `id` the default output for every role (console, multimedia, calls). */
    public static object SetDefault(string id) {
        var enumerator = (IDevices)new DeviceEnumerator();
        IDeviceCollection all; enumerator.EnumAudioEndpoints(0, 1, out all);
        int count; all.GetCount(out count);
        bool known = false;
        for (int i = 0; i < count && !known; i++) {
            IDevice device; all.Item(i, out device);
            string each; device.GetId(out each);
            known = each == id;
        }
        if (!known) throw new Exception("That output device is not connected.");
        var policy = (IPolicyConfig)new PolicyConfigClient();
        for (int role = 0; role < 3; role++) Marshal.ThrowExceptionForHR(policy.SetDefaultEndpoint(id, role));
        return List();
    }
}
