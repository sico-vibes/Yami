using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Management;
using System.Runtime.InteropServices;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Automation;
using System.Windows.Forms;
using Microsoft.Win32;

class Host {
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 32 * 1024 * 1024 };
    static readonly object OutputLock = new object();
    static readonly HashSet<int> Keys = new HashSet<int>();
    static HookProc KeyboardProc = KeyboardHook, MouseProc = MouseHook;
    static IntPtr KeyboardHandle, MouseHandle, DictationTarget;
    static bool Voice, Dictation, Lasso;
    static bool Hotkeys = true;
    static string AbilityButton = "M1";
    static bool AbilityArmed;
    static IDataObject ClipboardBackup;
    static int[] VoiceKeys = new int[]{0x5B,0x12}, DictationKeys = new int[]{0x11,0x5B}, LassoKeys = new int[]{0x11,0x10};
    delegate IntPtr HookProc(int code, IntPtr wParam, IntPtr lParam);
    delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int id, HookProc callback, IntPtr module, uint thread);
    [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr handle);
    [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr w, IntPtr l);
    [DllImport("kernel32.dll")] static extern IntPtr GetModuleHandle(string name);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("shell32.dll")] static extern int SHQueryUserNotificationState(out int state);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("kernel32.dll")]static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")]static extern bool AttachThreadInput(uint from,uint to,bool attach);
    [DllImport("user32.dll")]static extern bool BringWindowToTop(IntPtr h);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int command);
    [DllImport("user32.dll")] static extern bool MoveWindow(IntPtr h, int x, int y, int w, int height, bool repaint);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr l);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h, System.Text.StringBuilder text, int count);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra);
    [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] static extern void mouse_event(uint flags, uint x, uint y, uint data, UIntPtr extra);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern bool SystemParametersInfo(int action, int param, string value, int flags);
    [DllImport("user32.dll")] static extern bool LockWorkStation();
    [DllImport("powrprof.dll", SetLastError=true)] static extern bool SetSuspendState(bool hibernate, bool force, bool disableWake);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    [DllImport("kernel32.dll")] static extern IntPtr CreateWaitableTimer(IntPtr attributes, bool manualReset, string name);
    [DllImport("kernel32.dll")] static extern bool SetWaitableTimer(IntPtr timer, ref long due, int period, IntPtr routine, IntPtr arg, bool resume);
    [DllImport("kernel32.dll")] static extern bool CancelWaitableTimer(IntPtr timer);
    static IntPtr WakeTimer;
    delegate void WinEventProc(IntPtr hook,uint evt,IntPtr hwnd,int obj,int child,uint thread,uint time);
    static WinEventProc ForegroundProc = ForegroundChanged;
    static IntPtr ForegroundHook;
    [DllImport("user32.dll")]static extern IntPtr SetWinEventHook(uint min,uint max,IntPtr module,WinEventProc callback,uint pid,uint tid,uint flags);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern IntPtr SendMessageTimeout(IntPtr h,uint msg,IntPtr w,string l,uint flags,uint timeout,out IntPtr result);
    [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr h, int attr, ref int value, int size);

    [STAThread] static void Main() {
        if(!SetProcessDpiAwarenessContext(new IntPtr(-4)))SetProcessDPIAware();
        WakeTimer=CreateWaitableTimer(IntPtr.Zero,true,null);
        KeyboardHandle = SetWindowsHookEx(13, KeyboardProc, GetModuleHandle(null), 0);
        MouseHandle = SetWindowsHookEx(14, MouseProc, GetModuleHandle(null), 0);
        ForegroundHook=SetWinEventHook(3,3,IntPtr.Zero,ForegroundProc,0,0,0);
        FileWheel.Install();
        var reader = new Thread(ReadLoop); reader.SetApartmentState(ApartmentState.STA); reader.IsBackground = true; reader.Start();
        Application.Run();
        FileWheel.Uninstall();
        UnhookWindowsHookEx(KeyboardHandle); UnhookWindowsHookEx(MouseHandle);
    }
    static void Send(object value) { lock(OutputLock) { Console.WriteLine(Json.Serialize(value)); Console.Out.Flush(); } }
    internal static void Emit(object value) { Send(value); }
    static void ForegroundChanged(IntPtr hook,uint evt,IntPtr h,int obj,int child,uint thread,uint time){try{uint pid;GetWindowThreadProcessId(h,out pid);var p=Process.GetProcessById((int)pid);Send(new{eventName="foreground",process=p.ProcessName,pid=(int)pid,handle=h.ToInt64()});}catch{}}
    static void ReadLoop() {
        string line;
        while((line = Console.ReadLine()) != null) {
            object id = null;
            try {
                var request = Json.Deserialize<Dictionary<string, object>>(line); id = request["id"];
                var args = request.ContainsKey("args") ? request["args"] as Dictionary<string, object> : null;
                Send(new { id=id, result=Dispatch((string)request["method"], args ?? new Dictionary<string, object>()) });
            } catch(Exception e) { Send(new { id=id, error=e.Message }); }
        }
        Environment.Exit(0);
    }
    static string Str(Dictionary<string, object> a, string key, string fallback="") { return a.ContainsKey(key) && a[key] != null ? Convert.ToString(a[key]) : fallback; }
    static int Num(Dictionary<string, object> a, string key, int fallback=0) { return a.ContainsKey(key) ? Convert.ToInt32(a[key]) : fallback; }
    static bool Flag(Dictionary<string, object> a, string key) { return a.ContainsKey(key) && Convert.ToBoolean(a[key]); }
    static bool IsDown(params int[] values) { return values.Any(v => Keys.Contains(v)); }
    static int[] ParseKeys(string value) {return value.Split('+').Select(k=>k=="Ctrl"?0x11:k=="Win"?0x5B:k=="Alt"?0x12:k=="Shift"?0x10:(int)Enum.Parse(typeof(System.Windows.Forms.Keys),k,true)).ToArray();}
    static bool Combo(int[] keys) {return keys.All(k=>k==0x11?IsDown(0xA2,0xA3,0x11):k==0x12?IsDown(0xA4,0xA5,0x12):k==0x10?IsDown(0xA0,0xA1,0x10):k==0x5B?IsDown(0x5B,0x5C):IsDown(k));}
    static bool QuickLook;
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h, System.Text.StringBuilder name, int max);
    // Quick look answers only in a File Explorer folder window.
    static bool ExplorerInFront(){var name=new System.Text.StringBuilder(64);GetClassName(GetForegroundWindow(),name,64);return name.ToString()=="CabinetWClass";}
    static IntPtr KeyboardHook(int code, IntPtr w, IntPtr l) {
        if(code >= 0) {
            int key=Marshal.ReadInt32(l); long message=w.ToInt64();
            if(message==0x100 || message==0x104) Keys.Add(key); else if(message==0x101 || message==0x105) Keys.Remove(key);
            bool ctrl=IsDown(0xA2,0xA3,0x11), win=IsDown(0x5B,0x5C), alt=IsDown(0xA4,0xA5,0x12), shift=IsDown(0xA0,0xA1,0x10);
            bool voice=Hotkeys && Combo(VoiceKeys);
            bool dictation=Hotkeys && Combo(DictationKeys) && !voice;
            bool lasso=Hotkeys && Combo(LassoKeys) && !voice && !dictation;
            if(voice!=Voice) { Voice=voice; Send(new {eventName=voice?"voice-start":"voice-stop"}); }
            if(dictation!=Dictation) { Dictation=dictation; if(dictation) DictationTarget=GetForegroundWindow(); Send(new {eventName=dictation?"dictation-start":"dictation-stop", target=DictationTarget.ToInt64()}); }
            if(lasso && !Lasso) Send(new {eventName="lasso-start"}); Lasso=lasso;
            if(key==0x1B && message==0x100) Send(new {eventName="escape"});
            if(AbilityArmed&&AbilityButton.StartsWith("K:")&&key.ToString()==AbilityButton.Substring(2)&&(message==0x100||message==0x104))Send(new{eventName="ability-click"});
            if(QuickLook&&ctrl&&!alt&&!win&&key==0x20&&message==0x100&&ExplorerInFront()){Send(new{eventName="peek"});return new IntPtr(1);}
            if(QuickAccent.OnKey(key,message,(Marshal.ReadInt32(l,8)&0x10)!=0,shift,ctrl||alt||win)) return new IntPtr(1);
            FileWheel.OnKey(key, message, Voice||Dictation||Lasso);
            if(Hotkeys&&win&&key==0x41&&message==0x100){Send(new{eventName="launcher"});return new IntPtr(1);}
        }
        return CallNextHookEx(KeyboardHandle, code, w, l);
    }
    [StructLayout(LayoutKind.Sequential)] struct MouseData { public int x,y; public uint mouseData,flags,time; public IntPtr extra; }
    static IntPtr MouseHook(int code, IntPtr w, IntPtr l) {
        if(code>=0) {
            var p=(MouseData)Marshal.PtrToStructure(l,typeof(MouseData));
            long m=w.ToInt64();
            FileWheel.OnMouse(m, p.x, p.y);
            bool hit=AbilityArmed && ((AbilityButton=="M1" && m==0x201)||(AbilityButton=="M2"&&m==0x204)||(AbilityButton=="M3"&&m==0x207));
            if(hit) Send(new {eventName="ability-click",x=p.x,y=p.y});
        }
        return CallNextHookEx(MouseHandle,code,w,l);
    }
    static object Dispatch(string method, Dictionary<string, object> a) {
        switch(method) {
            case "ping": return new {ok=true, platform=Environment.OSVersion.ToString()};
            case "configure": if(a.ContainsKey("hotkeys"))Hotkeys=Flag(a,"hotkeys");if(a.ContainsKey("abilityArmed"))AbilityArmed=Flag(a,"abilityArmed");if(a.ContainsKey("abilityButton"))AbilityButton=Str(a,"abilityButton","M1");if(a.ContainsKey("voiceShortcut"))VoiceKeys=ParseKeys(Str(a,"voiceShortcut"));if(a.ContainsKey("dictationShortcut"))DictationKeys=ParseKeys(Str(a,"dictationShortcut"));if(a.ContainsKey("circleShortcut"))LassoKeys=ParseKeys(Str(a,"circleShortcut"));if(a.ContainsKey("quickAccent"))QuickAccent.Enabled=Flag(a,"quickAccent");if(a.ContainsKey("quickLook"))QuickLook=Flag(a,"quickLook");FileWheel.Configure(a);return true;
            case "clipboardFiles": FileWheel.SetFileDrop(a.ContainsKey("paths")?a["paths"]:null); return true;
            case "wake": {if(!a.ContainsKey("at")){CancelWaitableTimer(WakeTimer);return true;}long due=DateTime.Parse(Str(a,"at"),null,System.Globalization.DateTimeStyles.RoundtripKind).ToUniversalTime().ToFileTimeUtc();return SetWaitableTimer(WakeTimer,ref due,0,IntPtr.Zero,IntPtr.Zero,true);}
            case "context": return Context();
            case "processJob.create": return ProcessJobs.Own(Convert.ToInt32(a["pid"]));
            case "processJob.close": return ProcessJobs.Close(Convert.ToInt32(a["pid"]));
            case "windows": return Windows();
            case "focus": return FocusWindow(FindWindow(Str(a,"name")));
            case "focusHandle": return FocusWindow(new IntPtr(Convert.ToInt64(a["handle"])));
            case "close": { var h=FindWindow(Str(a,"name")); return PostMessage(h,0x10,IntPtr.Zero,IntPtr.Zero); }
            case "move": { var h=FindWindow(Str(a,"name")); return MoveWindow(h,Num(a,"x"),Num(a,"y"),Num(a,"width",1000),Num(a,"height",700),true); }
            case "capture": return Capture(a);
            case "insertText": InsertText(Str(a,"text"), a.ContainsKey("target") ? new IntPtr(Convert.ToInt64(a["target"])) : DictationTarget); return true;
            case "clipboardRead": return Clipboard.ContainsText() ? Clipboard.GetText() : "";
            case "clipboardPrivate": return Clipboard.ContainsData("ExcludeClipboardContentFromMonitorProcessing");
            case "clipboardPreserve": ClipboardBackup=Clipboard.GetDataObject();return true;
            case "clipboardRestore": if(ClipboardBackup!=null)Clipboard.SetDataObject(ClipboardBackup,true);else Clipboard.Clear();return true;
            case "clipboardWrite": Clipboard.SetText(Str(a,"text")); return true;
            case "wallpaperGet": return Registry.GetValue(@"HKEY_CURRENT_USER\Control Panel\Desktop","WallPaper","");
            case "wallpaperSet": { string path=Path.GetFullPath(Str(a,"path")); if(!File.Exists(path)) throw new Exception("Wallpaper file does not exist."); if(!SystemParametersInfo(20,0,path,3)) throw new Exception("Windows could not apply this wallpaper."); return path; }
            case "controls": return Controls();
            case "audioSessions": return AudioSessions.List();
            // SPI_SETCURSORS: Windows reads the pointer values in Control Panel\Cursors again.
            case "accentFeed": return QuickAccent.Feed(((System.Collections.ArrayList)a["steps"]).ToArray());
            case "appWindows": return WindowPin.Windows((uint)Num(a,"skip"));
            case "placeWindow": return WindowPin.Place(Convert.ToInt64(a["handle"]),Num(a,"x"),Num(a,"y"),Num(a,"width"),Num(a,"height"),Flag(a,"maximized"));
            case "snap": return WindowPin.Snap(Convert.ToInt64(a["handle"]),Str(a,"layout"));
            case "topmost": return WindowPin.Toggle(Convert.ToInt64(a["handle"]));
            case "topmostState": return WindowPin.IsPinned(Convert.ToInt64(a["handle"]));
            // Newly started apps read the user environment again.
            case "envChanged": { IntPtr r; SendMessageTimeout(new IntPtr(0xffff),0x1a,IntPtr.Zero,"Environment",2,2000,out r); return true; }
            case "cursorsReload": return SystemParametersInfo(0x57,0,null,3);
            case "listeningPorts": return NetPorts.Listening(Num(a,"root"));
            case "audioOutputs": return AudioDevices.List();
            case "audioOutputSet": return AudioDevices.SetDefault(Str(a,"id"));
            case "remoteClick": return RemoteInput.Click(Convert.ToDouble(a["x"]), Convert.ToDouble(a["y"]), Str(a,"button")=="right");
            case "remoteScroll": return RemoteInput.Scroll(Num(a,"notches"));
            case "remoteKey": return RemoteInput.Press(Str(a,"key"));
            case "remoteType": return RemoteInput.Type(Str(a,"text"));
            case "audioSessionSet": return AudioSessions.Set(Num(a,"pid"), a.ContainsKey("volume") ? Num(a,"volume") : -1, a.ContainsKey("muted") ? (Flag(a,"muted") ? 1 : 0) : -1);
            case "volume": { var audio=Audio(); float value=Math.Max(0,Math.Min(100,Num(a,"value")))/100f; audio.SetMasterVolumeLevelScalar(value,Guid.Empty); return value*100; }
            case "mute": { Audio().SetMute(Flag(a,"value"),Guid.Empty); return true; }
            case "brightness": { using(var search=new ManagementObjectSearcher("root\\WMI","SELECT * FROM WmiMonitorBrightnessMethods")) foreach(ManagementObject item in search.Get()) item.InvokeMethod("WmiSetBrightness",new object[]{1,Math.Max(0,Math.Min(100,Num(a,"value")))}); return true; }
            case "theme": { int v=Flag(a,"dark")?0:1; using(var k=Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize")) {k.SetValue("AppsUseLightTheme",v);k.SetValue("SystemUsesLightTheme",v);}IntPtr result;SendMessageTimeout(new IntPtr(0xffff),0x1a,IntPtr.Zero,"ImmersiveColorSet",2,2000,out result);return true; }
            case "settings": OpenSettings(Str(a,"page")); return true;
            case "toggleSetting": return ToggleSetting(Str(a,"setting"));
            case "mediaKey": { byte key=Str(a,"action")=="next"?(byte)0xB0:Str(a,"action")=="previous"?(byte)0xB1:(byte)0xB3; keybd_event(key,0,0,UIntPtr.Zero);keybd_event(key,0,2,UIntPtr.Zero); return true; }
            case "power": { string action=Str(a,"action"); if(action=="lock")return LockWorkStation();if(action=="sleep")return SetSuspendState(false,false,false);if(action!="restart"&&action!="shutdown")throw new Exception("Unknown power action.");Process.Start(new ProcessStartInfo("shutdown.exe",(action=="restart"?"/r":"/s")+" /t 10") {CreateNoWindow=true,UseShellExecute=false});return true; }
            case "uiaRead": return ReadUI();
            case "uiaClick": return ClickUI(Str(a,"name"));
            case "click": SetCursorPos(Num(a,"x"),Num(a,"y"));mouse_event(2,0,0,0,UIntPtr.Zero);mouse_event(4,0,0,0,UIntPtr.Zero);return true;
            case "fullscreen": { int state; return SHQueryUserNotificationState(out state)==0&&(state==2||state==3||state==4); }
            case "backdrop": { int value=3;return DwmSetWindowAttribute(new IntPtr(Convert.ToInt64(a["handle"])),38,ref value,4)==0; }
            default: throw new Exception("Unknown native method: "+method);
        }
    }
    static object Context() {
        var h=GetForegroundWindow(); uint pid;GetWindowThreadProcessId(h,out pid); string process="";try{process=Process.GetProcessById((int)pid).ProcessName;}catch{}
        string selected="";bool password=false;
        try {var el=AutomationElement.FocusedElement;if(el!=null){password=el.Current.IsPassword;object pattern;if(!password&&el.TryGetCurrentPattern(TextPattern.Pattern,out pattern)){var ranges=((TextPattern)pattern).GetSelection();if(ranges.Length>0)selected=ranges[0].GetText(12000);}}}catch{}
        var title=new System.Text.StringBuilder(1024);GetWindowText(h,title,title.Capacity);
        bool bank=System.Text.RegularExpressions.Regex.IsMatch(title.ToString(),@"\b(bank|banking|chase|barclays|hsbc|lloyds|natwest|santander|revolut|monzo|wise|paypal|hdfc|icici|sbi)\b",System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        return new {handle=h.ToInt64(),process=process,selection=selected,password=password,privateWindow=bank};
    }
    static List<object> Windows() {
        var list=new List<object>();EnumWindows(delegate(IntPtr h,IntPtr l){if(IsWindowVisible(h)){var sb=new System.Text.StringBuilder(1024);GetWindowText(h,sb,sb.Capacity);if(sb.Length>0){uint pid;GetWindowThreadProcessId(h,out pid);string name="";try{name=Process.GetProcessById((int)pid).ProcessName;}catch{}list.Add(new {handle=h.ToInt64(),name=name,title=sb.ToString(),pid=pid});}}return true;},IntPtr.Zero);return list;
    }
    static IntPtr FindWindow(string name) {
        IntPtr found=IntPtr.Zero;EnumWindows(delegate(IntPtr h,IntPtr l){if(IsWindowVisible(h)){var sb=new System.Text.StringBuilder(1024);GetWindowText(h,sb,sb.Capacity);if(sb.Length>0&&sb.ToString().IndexOf(name,StringComparison.OrdinalIgnoreCase)>=0){found=h;return false;}}return true;},IntPtr.Zero);
        if(found==IntPtr.Zero)throw new Exception("No open window matches "+name);return found;
    }
    static bool FocusWindow(IntPtr h){
        if(GetForegroundWindow()==h)return true;
        uint pid,current=GetCurrentThreadId(),foreground=GetWindowThreadProcessId(GetForegroundWindow(),out pid),target=GetWindowThreadProcessId(h,out pid);
        bool attachForeground=foreground!=0&&foreground!=current,attachTarget=target!=0&&target!=current&&target!=foreground;
        try{if(attachForeground)AttachThreadInput(current,foreground,true);if(attachTarget)AttachThreadInput(current,target,true);ShowWindow(h,9);BringWindowToTop(h);SetForegroundWindow(h);}finally{if(attachTarget)AttachThreadInput(current,target,false);if(attachForeground)AttachThreadInput(current,foreground,false);}
        Thread.Sleep(80);return GetForegroundWindow()==h;
    }
    static object Capture(Dictionary<string,object> a) {
        Rectangle r=SystemInformation.VirtualScreen;
        if(a.ContainsKey("width"))r=new Rectangle(Num(a,"x"),Num(a,"y"),Math.Max(1,Num(a,"width")),Math.Max(1,Num(a,"height")));
        if(r.Width>20000||r.Height>15000)throw new Exception("Capture region is too large.");
        using(var bitmap=new Bitmap(r.Width,r.Height))using(var g=Graphics.FromImage(bitmap))using(var stream=new MemoryStream()) {g.CopyFromScreen(r.Location,Point.Empty,r.Size);bool png=Str(a,"format")=="png";bitmap.Save(stream,png?ImageFormat.Png:ImageFormat.Jpeg);return new {data=Convert.ToBase64String(stream.ToArray()),mimeType=png?"image/png":"image/jpeg",x=r.X,y=r.Y,width=r.Width,height=r.Height};}
    }
    static void InsertText(string text,IntPtr target) {
        if(string.IsNullOrWhiteSpace(text))return;
        if(target!=IntPtr.Zero&&!FocusWindow(target))throw new Exception("The original field could not be focused. Your dictation was kept in history.");
        try {var el=AutomationElement.FocusedElement;if(el!=null&&el.Current.IsPassword)throw new Exception("Dictation is unavailable in password fields.");}catch(InvalidOperationException){}
        var previous=Clipboard.GetDataObject();Clipboard.SetText(text);
        keybd_event(0x11,0,0,UIntPtr.Zero);keybd_event(0x56,0,0,UIntPtr.Zero);keybd_event(0x56,0,2,UIntPtr.Zero);keybd_event(0x11,0,2,UIntPtr.Zero);
        Thread.Sleep(250);if(previous!=null)try{Clipboard.SetDataObject(previous,true);}catch{}
    }
    static object Controls() {
        float volume=0;bool mute=false;try{var a=Audio();a.GetMasterVolumeLevelScalar(out volume);a.GetMute(out mute);}catch{}
        int brightness=-1;try{using(var s=new ManagementObjectSearcher("root\\WMI","SELECT CurrentBrightness FROM WmiMonitorBrightness"))foreach(ManagementObject m in s.Get())brightness=Convert.ToInt32(m["CurrentBrightness"]);}catch{}
        int theme=Convert.ToInt32(Registry.GetValue(@"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize","AppsUseLightTheme",1));
        return new {volume=Math.Round(volume*100),muted=mute,brightness=brightness,dark=theme==0};
    }
    static void OpenSettings(string page) {
        var allowed=new[]{"wifi","bluetooth","nightlight","sound","display","privacy-microphone","notifications","startupapps"};
        if(!allowed.Contains(page))throw new Exception("Unknown settings page.");Process.Start("ms-settings:"+(page=="wifi"?"network-wifi":page));
    }
    static object ToggleSetting(string setting) {
        if(setting!="wifi"&&setting!="bluetooth"&&setting!="nightlight")throw new Exception("Unknown setting.");
        OpenSettings(setting);
        for(int attempt=0;attempt<25;attempt++) { Thread.Sleep(200);try{
            var window=AutomationElement.FromHandle(GetForegroundWindow());
            var toggles=window.FindAll(TreeScope.Descendants,new PropertyCondition(AutomationElement.IsTogglePatternAvailableProperty,true));
            foreach(AutomationElement e in toggles){object p;if(e.Current.IsEnabled&&e.TryGetCurrentPattern(TogglePattern.Pattern,out p)&&e.Current.Name.IndexOf(setting=="wifi"?"Wi-Fi":setting=="bluetooth"?"Bluetooth":"Night light",StringComparison.OrdinalIgnoreCase)>=0){((TogglePattern)p).Toggle();return true;}}
            if(setting=="nightlight")foreach(string label in new[]{"Turn on now","Turn off now"}){var e=window.FindFirst(TreeScope.Descendants,new PropertyCondition(AutomationElement.NameProperty,label));object p;if(e!=null&&e.TryGetCurrentPattern(InvokePattern.Pattern,out p)){((InvokePattern)p).Invoke();return true;}}
        }catch{}}
        throw new Exception("Windows opened the setting, but its toggle was not exposed. Change it in the Settings window.");
    }
    static object ReadUI() {
        var result=new List<object>();var window=AutomationElement.FromHandle(GetForegroundWindow());
        var nodes=window.FindAll(TreeScope.Descendants,Condition.TrueCondition);
        for(int i=0;i<Math.Min(nodes.Count,350);i++)try{var n=nodes[i];if(!n.Current.IsOffscreen&&!n.Current.IsPassword&&!string.IsNullOrWhiteSpace(n.Current.Name))result.Add(new {name=n.Current.Name,type=n.Current.ControlType.ProgrammaticName});}catch{}
        return result;
    }
    static bool ClickUI(string name) {
        var root=AutomationElement.FromHandle(GetForegroundWindow());var all=root.FindAll(TreeScope.Descendants,new PropertyCondition(AutomationElement.NameProperty,name));
        foreach(AutomationElement n in all){if(n.Current.IsOffscreen||!n.Current.IsEnabled)continue;object p;if(n.TryGetCurrentPattern(InvokePattern.Pattern,out p)){((InvokePattern)p).Invoke();return true;}if(n.TryGetCurrentPattern(SelectionItemPattern.Pattern,out p)){((SelectionItemPattern)p).Select();return true;}if(n.TryGetCurrentPattern(TogglePattern.Pattern,out p)){((TogglePattern)p).Toggle();return true;}}
        throw new Exception("No accessible control named '"+name+"' can be activated.");
    }
    static IAudioEndpointVolume Audio() {
        var enumerator=(IMMDeviceEnumerator)new MMDeviceEnumerator();IMMDevice device;Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0,1,out device));object endpoint;Guid iid=typeof(IAudioEndpointVolume).GUID;Marshal.ThrowExceptionForHR(device.Activate(ref iid,23,IntPtr.Zero,out endpoint));return(IAudioEndpointVolume)endpoint;
    }
    [ComImport,Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]class MMDeviceEnumerator{}
    [ComImport,Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface IMMDeviceEnumerator {int EnumAudioEndpoints(int a,int b,out IntPtr c);int GetDefaultAudioEndpoint(int flow,int role,out IMMDevice device);}
    [ComImport,Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface IMMDevice {int Activate(ref Guid id,int cls,IntPtr parameters,[MarshalAs(UnmanagedType.IUnknown)]out object value);}
    [ComImport,Guid("5CDF2C82-841E-4546-9722-0CF74078229A"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface IAudioEndpointVolume {
        int RegisterControlChangeNotify(IntPtr p);int UnregisterControlChangeNotify(IntPtr p);int GetChannelCount(out uint n);int SetMasterVolumeLevel(float v,Guid g);int SetMasterVolumeLevelScalar(float v,Guid g);int GetMasterVolumeLevel(out float v);int GetMasterVolumeLevelScalar(out float v);int SetChannelVolumeLevel(uint n,float v,Guid g);int SetChannelVolumeLevelScalar(uint n,float v,Guid g);int GetChannelVolumeLevel(uint n,out float v);int GetChannelVolumeLevelScalar(uint n,out float v);int SetMute([MarshalAs(UnmanagedType.Bool)]bool mute,Guid g);int GetMute([MarshalAs(UnmanagedType.Bool)]out bool mute);
    }
}
