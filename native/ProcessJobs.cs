using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
static class ProcessJobs {
  static readonly Dictionary<int,IntPtr> jobs=new Dictionary<int,IntPtr>();
  public static bool Own(int pid) {
    if(pid<=0)throw new Exception("Invalid owned process.");
    if(jobs.ContainsKey(pid))return true;
    IntPtr process=OpenProcess(0x100|1,false,pid);if(process==IntPtr.Zero)throw new System.ComponentModel.Win32Exception();
    IntPtr job=CreateJobObject(IntPtr.Zero,null);var limits=new Limits();limits.basic.flags=0x2000;
    IntPtr buffer=Marshal.AllocHGlobal(Marshal.SizeOf(limits));
    try { Marshal.StructureToPtr(limits,buffer,false);if(!SetInformationJobObject(job,9,buffer,(uint)Marshal.SizeOf(limits))||!AssignProcessToJobObject(job,process))throw new System.ComponentModel.Win32Exception();jobs[pid]=job;job=IntPtr.Zero;return true; }
    finally { Marshal.FreeHGlobal(buffer);CloseHandle(process);if(job!=IntPtr.Zero)CloseHandle(job); }
  }
  public static bool Close(int pid) { IntPtr handle;if(jobs.TryGetValue(pid,out handle)){jobs.Remove(pid);CloseHandle(handle);}return true; }
  [StructLayout(LayoutKind.Sequential)] struct Basic { public long processTime,jobTime;public uint flags;public UIntPtr min,max;public uint active;public UIntPtr affinity;public uint priority,scheduling; }
  [StructLayout(LayoutKind.Sequential)] struct Counters { public ulong a,b,c,d,e,f; }
  [StructLayout(LayoutKind.Sequential)] struct Limits { public Basic basic;public Counters counters;public UIntPtr processMemory,jobMemory,peakProcess,peakJob; }
  [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,int pid);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attrs,string name);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int info,IntPtr data,uint size);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
}
