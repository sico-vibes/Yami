import { useEffect, useState } from "react";
import { api } from "../api";
import { fitSize } from "./adjust";
import { sampleStill } from "./paint";
import type { WheelFile } from "./types";

export function sourceSize(image: CanvasImageSource) {
  if (image instanceof HTMLImageElement && image.naturalWidth)
    return { width: image.naturalWidth, height: image.naturalHeight };
  if (image instanceof HTMLVideoElement)
    return { width: image.videoWidth || 720, height: image.videoHeight || 480 };
  if ("width" in image)
    return { width: Number(image.width) || 720, height: Number(image.height) || 480 };
  return { width: 720, height: 480 };
}

export function paintStill(
  canvas: HTMLCanvasElement,
  image: CanvasImageSource,
  max = 720,
) {
  const fitted = fitSize(sourceSize(image).width, sourceSize(image).height, max);
  canvas.width = fitted.width;
  canvas.height = fitted.height;
  const ctx = canvas.getContext("2d");
  ctx?.drawImage(image, 0, 0, fitted.width, fitted.height);
  return ctx;
}

export function useStill(file: WheelFile | undefined) {
  const [image, setImage] = useState<CanvasImageSource | null>(null);
  const [note, setNote] = useState("");
  useEffect(() => {
    let cancel = false;
    if (!file || file.path.startsWith("preview://")) {
      setImage(sampleStill());
      return;
    }
    void api("wheel.preview", { path: file.path })
      .then((url: string) => {
        const loaded = new Image();
        loaded.onload = () => {
          if (!cancel) setImage(loaded);
        };
        loaded.onerror = () => {
          if (!cancel) setNote("That image could not be previewed.");
        };
        loaded.src = url;
      })
      .catch((error: Error) => {
        if (!cancel) {
          setNote(error.message);
          setImage(sampleStill());
        }
      });
    return () => {
      cancel = true;
    };
  }, [file?.path]);
  return { image, note, setNote };
}

export function useStills(files: WheelFile[]) {
  const [images, setImages] = useState<CanvasImageSource[]>([]);
  const [note, setNote] = useState("");
  useEffect(() => {
    let cancel = false;
    void Promise.all(
      files.map(async (file) => {
        if (file.path.startsWith("preview://")) return sampleStill();
        const url = await api("wheel.preview", { path: file.path });
        const loaded = new Image();
        await new Promise<void>((resolve, reject) => {
          loaded.onload = () => resolve();
          loaded.onerror = () => reject(new Error(`${file.name} could not be previewed.`));
          loaded.src = url;
        });
        return loaded;
      }),
    )
      .then((loaded) => {
        if (!cancel) setImages(loaded);
      })
      .catch((error: Error) => {
        if (!cancel) setNote(error.message);
      });
    return () => {
      cancel = true;
    };
  }, [files.map((file) => file.path).join("|")]);
  return { images, note, setNote };
}
