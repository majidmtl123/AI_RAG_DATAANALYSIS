import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tesseract.js (OCR) and sharp spawn workers / load native+wasm assets from
  // node_modules at runtime; keep them external so the bundler doesn't rewrite
  // their internal file paths.
  serverExternalPackages: ["tesseract.js", "sharp"],

  // Because the two packages above are external, Next's bundler does not analyze
  // their internal requires, so Vercel's file tracer can miss the runtime assets
  // (tesseract worker script, the wasm core, language data, sharp native libs).
  // Explicitly include them in the trace for the OCR routes so they exist in the
  // deployed serverless function.
  outputFileTracingIncludes: {
    "/api/screenshot": [
      "./node_modules/tesseract.js/**",
      "./node_modules/tesseract.js-core/**",
      "./node_modules/sharp/**",
      "./node_modules/@img/**",
    ],
    "/api/screenshot-chat": [
      "./node_modules/tesseract.js/**",
      "./node_modules/tesseract.js-core/**",
    ],
  },
};

export default nextConfig;
