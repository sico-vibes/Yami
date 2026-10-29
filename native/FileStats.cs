using System;
using System.Collections.Generic;
using System.IO;

// Measures folders for Tune's Cleanup: total size and count of the files
// under each folder, read from the directory listing itself, so no file is
// opened. Links and junctions are not followed.
// Usage: Yami.FileStats.exe <olderThanMinutes> <skipName or -> <folder>...
// Prints {"bytes":N,"files":N} on one line.
static class FileStats
{
    const int MaxFiles = 300000;

    static int Main(string[] args)
    {
        if (args.Length < 3) { Console.Error.Write("Usage: Yami.FileStats.exe minutes skip folder..."); return 2; }
        double minutes;
        if (!double.TryParse(args[0], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out minutes)) minutes = 0;
        DateTime cutoff = minutes > 0 ? DateTime.UtcNow.AddMinutes(-minutes) : DateTime.MaxValue;
        string skip = args[1] == "-" ? null : args[1];
        var stack = new Stack<DirectoryInfo>();
        for (int i = 2; i < args.Length; i++)
            if (Directory.Exists(args[i])) stack.Push(new DirectoryInfo(args[i]));
        // Eight readers share one stack of folders; a big temp folder has
        // tens of thousands, and one reader waits on the disk for each.
        long bytes = 0, files = 0;
        int busy = 0;
        object gate = new object();
        var threads = new System.Threading.Thread[8];
        for (int t = 0; t < threads.Length; t++)
        {
            threads[t] = new System.Threading.Thread(delegate ()
            {
                long myBytes = 0, myFiles = 0;
                for (;;)
                {
                    DirectoryInfo dir = null;
                    lock (gate)
                    {
                        while (stack.Count == 0 && busy > 0) System.Threading.Monitor.Wait(gate);
                        if (stack.Count == 0 || files + myFiles >= MaxFiles) { System.Threading.Monitor.PulseAll(gate); break; }
                        dir = stack.Pop();
                        busy++;
                    }
                    var found = new List<DirectoryInfo>();
                    try
                    {
                        foreach (FileSystemInfo item in dir.EnumerateFileSystemInfos())
                        {
                            if ((item.Attributes & FileAttributes.ReparsePoint) != 0) continue;
                            var sub = item as DirectoryInfo;
                            if (sub != null) { found.Add(sub); continue; }
                            var file = item as FileInfo;
                            if (file == null) continue;
                            if (skip != null && string.Equals(file.Name, skip, StringComparison.OrdinalIgnoreCase)) continue;
                            if (file.LastWriteTimeUtc > cutoff) continue;
                            myBytes += file.Length;
                            myFiles++;
                        }
                    }
                    catch { }
                    lock (gate)
                    {
                        foreach (var sub in found) stack.Push(sub);
                        busy--;
                        files += myFiles; bytes += myBytes; myFiles = 0; myBytes = 0;
                        System.Threading.Monitor.PulseAll(gate);
                    }
                }
            });
            threads[t].Start();
        }
        foreach (var thread in threads) thread.Join();
        if (files > MaxFiles) files = MaxFiles;
        Console.Write("{\"bytes\":" + bytes + ",\"files\":" + files + "}");
        return 0;
    }
}
