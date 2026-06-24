import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tesseract.js (OCR) and sharp spawn workers / load native+wasm assets from
  // node_modules at runtime; keep them external so the bundler doesn't rewrite
  // their internal file paths.
  serverExternalPackages: ["tesseract.js", "sharp"],
};

export default nextConfig;
