using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

// Which TCP ports a process and everything it started listen on, for the
// terminal's port finder: the listener table (GetExtendedTcpTable) joined
// with a process snapshot (Toolhelp). Read once per request.
static class NetPorts
{
    [DllImport("iphlpapi.dll", SetLastError = true)]
    static extern uint GetExtendedTcpTable(IntPtr table, ref int size, bool sort, int family, int tableClass, uint reserved);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint pid);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    static extern bool Process32FirstW(IntPtr snapshot, ref ProcessEntry entry);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    static extern bool Process32NextW(IntPtr snapshot, ref ProcessEntry entry);
    [DllImport("kernel32.dll")]
    static extern bool CloseHandle(IntPtr handle);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct ProcessEntry
    {
        public uint Size, Usage, ProcessId;
        public IntPtr DefaultHeapId;
        public uint ModuleId, Threads, ParentProcessId;
        public int PriorityClassBase;
        public uint Flags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string ExeFile;
    }

    const int AF_INET = 2, AF_INET6 = 23, TCP_TABLE_OWNER_PID_LISTENER = 3;

    /** Each listening port of root and its descendants: port, pid, name, address. */
    public static object Listening(int root)
    {
        var parent = new Dictionary<int, int>();
        var name = new Dictionary<int, string>();
        IntPtr snap = CreateToolhelp32Snapshot(2, 0);
        if (snap != new IntPtr(-1))
        {
            var e = new ProcessEntry();
            e.Size = (uint)Marshal.SizeOf(typeof(ProcessEntry));
            for (bool ok = Process32FirstW(snap, ref e); ok; ok = Process32NextW(snap, ref e))
            {
                parent[(int)e.ProcessId] = (int)e.ParentProcessId;
                name[(int)e.ProcessId] = e.ExeFile;
            }
            CloseHandle(snap);
        }
        var found = new List<object>();
        var seen = new HashSet<string>();
        foreach (int family in new[] { AF_INET, AF_INET6 })
        {
            int size = 0;
            GetExtendedTcpTable(IntPtr.Zero, ref size, true, family, TCP_TABLE_OWNER_PID_LISTENER, 0);
            if (size <= 0) continue;
            IntPtr table = Marshal.AllocHGlobal(size);
            try
            {
                if (GetExtendedTcpTable(table, ref size, true, family, TCP_TABLE_OWNER_PID_LISTENER, 0) != 0) continue;
                int rows = Marshal.ReadInt32(table);
                // IPv4 rows: state, local addr, local port, remote addr, remote port, pid (24 bytes).
                // IPv6 rows: local addr (16), scope, port, remote addr (16), scope, port, state, pid (56 bytes).
                int rowSize = family == AF_INET ? 24 : 56;
                for (int i = 0; i < rows; i++)
                {
                    IntPtr row = new IntPtr(table.ToInt64() + 4 + i * rowSize);
                    int port, pid;
                    string address;
                    if (family == AF_INET)
                    {
                        var ip = BitConverter.GetBytes(Marshal.ReadInt32(row, 4));
                        address = ip[0] + "." + ip[1] + "." + ip[2] + "." + ip[3];
                        port = PortOf(Marshal.ReadInt32(row, 8));
                        pid = Marshal.ReadInt32(row, 20);
                    }
                    else
                    {
                        var ip = new byte[16];
                        Marshal.Copy(row, ip, 0, 16);
                        address = new System.Net.IPAddress(ip).ToString();
                        port = PortOf(Marshal.ReadInt32(row, 20));
                        pid = Marshal.ReadInt32(row, 52);
                    }
                    if (!Within(pid, root, parent)) continue;
                    if (!seen.Add(port + "/" + pid)) continue;
                    string exe;
                    found.Add(new { port = port, pid = pid, address = address, name = name.TryGetValue(pid, out exe) ? exe : "" });
                }
            }
            finally { Marshal.FreeHGlobal(table); }
        }
        return found;
    }

    static int PortOf(int raw) { return ((raw & 0xff) << 8) | ((raw >> 8) & 0xff); }

    /** True when pid is root or started, at any depth, by root. */
    static bool Within(int pid, int root, Dictionary<int, int> parent)
    {
        for (int step = 0; step < 64 && pid > 4; step++)
        {
            if (pid == root) return true;
            int up;
            if (!parent.TryGetValue(pid, out up) || up == pid) return false;
            pid = up;
        }
        return false;
    }
}
