export type EngineId = "ffmpeg" | "magick" | "sevenZip" | "sevenExtra" | "exiftool";
export type EngineSpec = {
  id: EngineId;
  version: string;
  license: string;
  url: string;
  sha256: string;
  format: "zip" | "7z" | "exe";
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
    source: "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip.sha256",
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
    license: "GPL-1.0-or-later OR Artistic-1.0-Perl. The Windows package also carries Strawberry Perl notices.",
    url: "https://sourceforge.net/projects/exiftool/files/exiftool-13.59_64.zip/download",
    sha256: "44b512b25af500724ba579d0a53c8fc5851628b692dd5e5d94ae4a15c2cba9ec",
    format: "zip",
    exe: "exiftool.exe",
    source: "https://exiftool.org/checksums-13.59.txt",
  },
];
