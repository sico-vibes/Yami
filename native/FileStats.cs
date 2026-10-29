using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

// Measures folders for Tune: total size and count of the files under each
// folder, read from the directory listing itself, so no file is opened.
// Links and junctions are not followed.
// Usage: Yami.FileStats.exe <olderThanMinutes> <skipName or -> <folder>...
//   prints {"bytes":N,"files":N}
// Usage: Yami.FileStats.exe --children <folder>
//   prints {"items":[{"name":..,"dir":true,"bytes":N,"files":N,"capped":false}]}
//   for the disk-space map: each entry of the folder with its total size.
static class FileStats
{
    const long MaxFiles = 300000;
    const long MaxChildFiles = 2000000;

    static int Main(string[] args)
    {
        if (args.Length == 2 && args[0] == "--children") return Children(args[1]);
        if (args.Length < 3) { Console.Error.Write("Usage: Yami.FileStats.exe minutes skip folder..."); return 2; }
        double minutes;
        if (!double.TryParse(args[0], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out minutes)) minutes = 0;
        DateTime cutoff = minutes > 0 ? DateTime.UtcNow.AddMinutes(-minutes) : DateTime.MaxValue;
        string skip = args[1] == "-" ? null : args[1];
        var roots = new List<DirectoryInfo>();
        for (int i = 2; i < args.Length; i++)
            if (Directory.Exists(args[i])) roots.Add(new DirectoryInfo(args[i]));
        long[] total = Measure(roots, cutoff, skip, MaxFiles);
        Console.Write("{\"bytes\":" + total[0] + ",\"files\":" + total[1] + "}");
        return 0;
    }

    static int Children(string folder)
    {
        var root = new DirectoryInfo(folder);
        if (!root.Exists) { Console.Error.Write("That folder does not exist."); return 3; }
        var json = new StringBuilder("{\"items\":[");
        bool first = true;
        IEnumerable<FileSystemInfo> entries;
        try { entries = root.EnumerateFileSystemInfos(); }
        catch (Exception e) { Console.Error.Write(e.Message); return 4; }
        var items = new List<FileSystemInfo>();
        var dirs = new List<DirectoryInfo>();
        foreach (FileSystemInfo item in entries)
        {
            if ((item.Attributes & FileAttributes.ReparsePoint) != 0) continue;
            items.Add(item);
            if (item is DirectoryInfo) dirs.Add((DirectoryInfo)item);
        }
        // One walk for all folders, so the readers never wait on a small one.
        long[,] sizes = MeasureEach(dirs, MaxChildFiles);
        int d = 0;
        foreach (FileSystemInfo item in items)
        {
            bool dir = item is DirectoryInfo, capped = false;
            long bytes, files;
            if (dir) { bytes = sizes[d, 0]; files = sizes[d, 1]; capped = sizes[d, 2] != 0; d++; }
            else { bytes = ((FileInfo)item).Length; files = 1; }
            if (!first) json.Append(',');
            first = false;
            json.Append("{\"name\":").Append(Quote(item.Name))
                .Append(",\"dir\":").Append(dir ? "true" : "false")
                .Append(",\"bytes\":").Append(bytes)
                .Append(",\"files\":").Append(files)
                .Append(",\"capped\":").Append(capped ? "true" : "false").Append('}');
        }
        Console.OutputEncoding = Encoding.UTF8;
        Console.Write(json.Append("]}").ToString());
        return 0;
    }

    static string Quote(string s)
    {
        var b = new StringBuilder("\"");
        foreach (char c in s)
        {
            if (c == '"' || c == '\\') b.Append('\\').Append(c);
            else if (c < 0x20 || c > 0x7e) b.Append("\\u").Append(((int)c).ToString("x4"));
            else b.Append(c);
        }
        return b.Append('"').ToString();
    }

    static long[] Measure(List<DirectoryInfo> roots, DateTime cutoff, string skip, long max)
    {
        long[,] each = Walk(roots, cutoff, skip, max, true);
        return new long[] { each[0, 0], each[0, 1] };
    }

    /** Totals per root: bytes, files, and 1 when the count reached max. */
    static long[,] MeasureEach(List<DirectoryInfo> roots, long max)
    {
        return Walk(roots, DateTime.MaxValue, null, max, false);
    }

    /**
     * Eight readers share one stack of folders; one reader alone waits on the
     * disk for each. With together, every root adds to slot 0.
     */
    static long[,] Walk(List<DirectoryInfo> roots, DateTime cutoff, string skip, long max, bool together)
    {
        int slots = together ? 1 : Math.Max(1, roots.Count);
        var sums = new long[slots, 3];
        var stack = new Stack<KeyValuePair<DirectoryInfo, int>>();
        for (int r = 0; r < roots.Count; r++) stack.Push(new KeyValuePair<DirectoryInfo, int>(roots[r], together ? 0 : r));
        long all = 0;
        int busy = 0;
        object gate = new object();
        var threads = new System.Threading.Thread[8];
        for (int t = 0; t < threads.Length; t++)
        {
            threads[t] = new System.Threading.Thread(delegate ()
            {
                for (;;)
                {
                    KeyValuePair<DirectoryInfo, int> next;
                    lock (gate)
                    {
                        while (stack.Count == 0 && busy > 0) System.Threading.Monitor.Wait(gate);
                        if (stack.Count == 0) { System.Threading.Monitor.PulseAll(gate); break; }
                        next = stack.Pop();
                        // A slot at its limit stops growing; the others go on.
                        if (sums[next.Value, 1] >= max || all >= max * 4) { sums[next.Value, 2] = 1; continue; }
                        busy++;
                    }
                    long myBytes = 0, myFiles = 0;
                    var found = new List<DirectoryInfo>();
                    try
                    {
                        foreach (FileSystemInfo item in next.Key.EnumerateFileSystemInfos())
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
                        foreach (var sub in found) stack.Push(new KeyValuePair<DirectoryInfo, int>(sub, next.Value));
                        busy--;
                        sums[next.Value, 0] += myBytes;
                        sums[next.Value, 1] += myFiles;
                        all += myFiles;
                        System.Threading.Monitor.PulseAll(gate);
                    }
                }
            });
            threads[t].Start();
        }
        foreach (var thread in threads) thread.Join();
        for (int k = 0; k < slots; k++) if (sums[k, 1] > max) { sums[k, 1] = max; sums[k, 2] = 1; }
        return sums;
    }
}
