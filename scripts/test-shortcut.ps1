param([ValidateSet('press','release')][string]$Action)
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class YamiVerificationKeys {
 [DllImport("user32.dll")] public static extern void keybd_event(byte key,byte scan,uint flags,UIntPtr extra);
}
'@
if($Action -eq 'press') {
 [YamiVerificationKeys]::keybd_event(0x11,0,0,[UIntPtr]::Zero)
 [YamiVerificationKeys]::keybd_event(0x5B,0,0,[UIntPtr]::Zero)
} else {
 [YamiVerificationKeys]::keybd_event(0x5B,0,2,[UIntPtr]::Zero)
 [YamiVerificationKeys]::keybd_event(0x11,0,2,[UIntPtr]::Zero)
}
