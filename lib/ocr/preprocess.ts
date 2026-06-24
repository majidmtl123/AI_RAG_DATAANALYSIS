import sharp from "sharp";
import { createLogger } from "@/lib/logger";

const log = createLogger("ocr/preprocess");

/** Upscale small images so OCR has more pixels to work with. */
const MIN_TARGET_WIDTH = 1500;

/**
 * Preprocess a screenshot to improve OCR accuracy:
 * - flatten transparency onto white
 * - convert to grayscale
 * - upscale if small
 * - normalize contrast and lightly sharpen
 *
 * Returns a PNG buffer. On any failure, returns the original bytes so OCR can
 * still attempt to read the raw image.
 */
export async function preprocessImage(input: Uint8Array): Promise<Buffer> {
  try {
    const image = sharp(input, { failOn: "none" });
    const meta = await image.metadata();
    const width = meta.width ?? 0;

    let pipeline = image.flatten({ background: "#ffffff" }).grayscale();

    if (width > 0 && width < MIN_TARGET_WIDTH) {
      const scale = Math.min(3, MIN_TARGET_WIDTH / width);
      pipeline = pipeline.resize({ width: Math.round(width * scale), withoutEnlargement: false });
    }

    const out = await pipeline.normalize().sharpen().png().toBuffer();
    log.debug("Preprocessed image", { inWidth: width, outBytes: out.length });
    return out;
  } catch (err) {
    log.warn("Preprocess failed; using original bytes", {
      error: err instanceof Error ? err.message : String(err),
    });
    return Buffer.from(input);
  }
}
