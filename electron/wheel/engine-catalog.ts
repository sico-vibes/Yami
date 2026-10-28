export type EngineId =
  | "ffmpeg"
  | "magick"
  | "sevenZip"
  | "sevenExtra"
  | "exiftool"
  | "needle"
  | "whistle";
export type EngineSpec = {
  id: EngineId;
  version: string;
  license: string;
  url: string;
  sha256: string;
  /** "file" is a single data file kept under its `exe` name, like a model. */
  format: "zip" | "7z" | "exe" | "file";
  exe: string;
  source: string;
};

/**
 * Hashes checked 2026-10-18 against the publisher's own checksum or a download
 * from the publisher's site. A mismatch refuses to run the file.
 * The ffmpeg URL is Gyan's "latest release" alias. It is pinned to the 9.0.2
 * hash, so a newer upload fails closed until this pin is updated.
 */
export const engines: EngineSpec[] = [
  {
    id: "ffmpeg",
    version: "9.0.2",
    license: "GPL-3.0-only (Gyan static essentials build)",
    url: "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
    sha256: "60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba",
    format: "zip",
    exe: "ffmpeg.exe",
    source:
      "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip.sha256",
  },
  {
    id: "magick",
    version: "7.1.2-34",
    license: "ImageMagick License",
    url: "https://github.com/ImageMagick/ImageMagick/releases/download/7.1.2-34/ImageMagick-7.1.2-34-portable-Q16-HDRI-x64.7z",
    sha256: "8dcfd3644b7fc20a92aeedeb4798024e5947f25f4d7c0c313c883fbca3d723e6",
    format: "7z",
    exe: "magick.exe",
    source: "https://github.com/ImageMagick/ImageMagick/releases/tag/7.1.2-34",
  },
  {
    id: "sevenZip",
    version: "26.04",
    license: "GNU LGPL (7-Zip). The RAR decoder has additional unRAR terms.",
    url: "https://www.7-zip.org/a/7zr.exe",
    sha256: "256feca8e274e5da655e2a284fabafd9f554365eb164862089dacd4e8276d282",
    format: "exe",
    exe: "7zr.exe",
    source: "https://www.7-zip.org/a/7zr.exe",
  },
  {
    id: "sevenExtra",
    version: "26.04",
    license: "GNU LGPL (7-Zip). Used as 7za.exe for rar and 7z extraction.",
    url: "https://www.7-zip.org/a/7z2604-extra.7z",
    sha256: "dc4b11d3399db18b063630137145f5585d8f7ac847bf3639bd1185d7d1f7cee0",
    format: "7z",
    exe: "7za.exe",
    source: "https://www.7-zip.org/download.html",
  },
  {
    id: "exiftool",
    version: "13.59",
    license:
      "GPL-1.0-or-later OR Artistic-1.0-Perl. The Windows package also carries Strawberry Perl notices.",
    url: "https://sourceforge.net/projects/exiftool/files/exiftool-13.59_64.zip/download",
    sha256: "44b512b25af500724ba579d0a53c8fc5851628b692dd5e5d94ae4a15c2cba9ec",
    format: "zip",
    exe: "exiftool.exe",
    source: "https://exiftool.org/checksums-13.59.txt",
  },
  // Whistle offline dictation. Both are pinned to a repository commit; the
  // hashes are the Hugging Face LFS SHA-256s, checked against a download on
  // 2026-10-28.
  {
    id: "needle",
    version: "needle3-d6c7d6a",
    license: "Apache-2.0 (Cactus Compute Needle engine)",
    url: "https://huggingface.co/Cactus-Compute/needle3/resolve/d6c7d6a2e9655505e0f8e23339356dd1705900eb/windows-x86_64/needle.exe",
    sha256: "0d4bc1da8c51f5600f5c4f4bb4a92e0abe142fae7b69e695ccab93e6745c883d",
    format: "exe",
    exe: "needle.exe",
    source:
      "https://huggingface.co/Cactus-Compute/needle3/tree/d6c7d6a2e9655505e0f8e23339356dd1705900eb/windows-x86_64",
  },
  {
    id: "whistle",
    version: "whistle-7411186",
    license: "Apache-2.0 (Cactus Compute Whistle model)",
    url: "https://huggingface.co/Cactus-Compute/whistle/resolve/741118687e1f008f06d1351a402a731274789790/whistle.cact",
    sha256: "b6e02f048568ac5d01a2042556c658061e699acbc0aa2a1439f52f3d461dffeb",
    format: "file",
    exe: "whistle.cact",
    source:
      "https://huggingface.co/Cactus-Compute/whistle/tree/741118687e1f008f06d1351a402a731274789790",
  },
];
