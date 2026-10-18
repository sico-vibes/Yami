using System;
using System.IO;
using System.IO.Pipes;
using System.Security.Principal;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;
using System.Collections.Generic;
using System.Text;
using System.Diagnostics;

// A short-lived relay. No implicit permission grant; unavailable Yami leaves the CLI in control.
class HookRelay {
  [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct PROCESSENTRY { public uint size,usage,pid; public IntPtr heap; public uint module,threads,parent; public int priority; public uint flags; [MarshalAs(UnmanagedType.ByValTStr,SizeConst=260)] public string name; }
  [DllImport("kernel32.dll")] static extern IntPtr CreateToolhelp32Snapshot(uint flags,uint pid);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern bool Process32First(IntPtr snapshot,ref PROCESSENTRY entry);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern bool Process32Next(IntPtr snapshot,ref PROCESSENTRY entry);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetNamedPipeServerProcessId(IntPtr h,out uint pid);
  [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access,bool inherit,uint pid);
  [DllImport("advapi32.dll",SetLastError=true)] static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  static void Main(string[] args) {
    string agent=args.Length>0?args[0]:"claude", eventName=args.Length>1?args[1]:"", config=args.Length>2?args[2]:"";
    bool permission=eventName=="PermissionRequest" || eventName=="permissionRequest";
    try {
      var serializer=new JavaScriptSerializer { MaxJsonLength=1048576 };
      var settings=serializer.Deserialize<Dictionary<string,object>>(File.ReadAllText(config));
      string input=Console.In.ReadToEnd(); if(input.Length>900000)return;
      var payload=String.IsNullOrWhiteSpace(input)?new Dictionary<string,object>():serializer.Deserialize<Dictionary<string,object>>(input);
      if(eventName=="PreToolUse" && payload.ContainsKey("tool_name") && Convert.ToString(payload["tool_name"])=="AskUserQuestion")return;
      if(eventName=="Question")eventName="PreToolUse";
      payload["yami_agent"]=agent; payload["token"]=settings["token"];
      long target=SessionWindow();if(target!=0)payload["yami_window"]=target;
      if(!String.IsNullOrEmpty(eventName))payload["hook_event_name"]=eventName;
      if(!payload.ContainsKey("cwd"))payload["cwd"]=Environment.CurrentDirectory;
      using(var pipe=new NamedPipeClientStream(".",Convert.ToString(settings["pipe"]),PipeDirection.InOut,PipeOptions.Asynchronous)) {
        pipe.Connect(300);
        uint pid; if(!GetNamedPipeServerProcessId(pipe.SafePipeHandle.DangerousGetHandle(),out pid))return;
        IntPtr process=OpenProcess(0x1000,false,pid), token=IntPtr.Zero;
        try { if(process==IntPtr.Zero || !OpenProcessToken(process,8,out token))return; using(var identity=new WindowsIdentity(token))if(identity.User.Value!=WindowsIdentity.GetCurrent().User.Value)return; }
        finally { if(token!=IntPtr.Zero)CloseHandle(token);if(process!=IntPtr.Zero)CloseHandle(process); }
        byte[] bytes=Encoding.UTF8.GetBytes(serializer.Serialize(payload)+"\n"); pipe.Write(bytes,0,bytes.Length); pipe.Flush();
        using(var reader=new StreamReader(pipe)) {
          var read=reader.ReadLineAsync();
          bool ask=payload.ContainsKey("tool_name") && Convert.ToString(payload["tool_name"])=="AskUserQuestion";
          if(!read.Wait(permission||ask?110000:1200))return;
          string reply=read.Result;
          if(!String.IsNullOrWhiteSpace(reply) && reply!="{}")Console.WriteLine(reply);
          else if(agent=="copilot" && permission)Console.WriteLine("{\"permissionDecision\":\"ask\"}");
        }
      }
    } catch { if(agent=="copilot" && permission)Console.WriteLine("{\"permissionDecision\":\"ask\"}"); }
  }
  static long SessionWindow() {
    IntPtr snapshot=CreateToolhelp32Snapshot(2,0);if(snapshot==new IntPtr(-1))return 0;
    try {
      var parents=new Dictionary<uint,uint>();var entry=new PROCESSENTRY{size=(uint)Marshal.SizeOf(typeof(PROCESSENTRY))};
      if(Process32First(snapshot,ref entry))do{parents[entry.pid]=entry.parent;}while(Process32Next(snapshot,ref entry));
      uint pid=(uint)Process.GetCurrentProcess().Id;
      for(int depth=0;depth<12&&parents.ContainsKey(pid);depth++){
        pid=parents[pid];try{using(var process=Process.GetProcessById((int)pid)){if(process.ProcessName.Equals("explorer",StringComparison.OrdinalIgnoreCase))break;if(process.MainWindowHandle!=IntPtr.Zero)return process.MainWindowHandle.ToInt64();}}catch{}
      }
      return 0;
    } finally { CloseHandle(snapshot); }
  }
}
