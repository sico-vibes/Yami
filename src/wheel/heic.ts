/** True only when the ffmpeg report lists both an HEVC encoder and an HEIC or HEIF muxer. */
export function heicEncodeAvailable(encoderText: string, muxerText: string) {
  const encoder = /\b(libx265|hevc_nvenc|hevc_qsv|hevc_amf)\b/.test(
    encoderText,
  );
  const muxer = /\b(heic|heif)\b/i.test(muxerText);
  return encoder && muxer;
}
