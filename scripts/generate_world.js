#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// ── Config ──────────────────────────────────────────────────────────────
const API_KEY = process.env.WORLD_LABS_API || "";
const BASE_URL = "https://api.worldlabs.ai/marble/v1";
const MODEL = "Marble 0.1-plus";
const DISPLAY_NAME = "YHack2026 World";
const TEXT_PROMPT = "";

const PROJECT_ROOT = path.join(__dirname, "..");
const IMAGES_DIR = path.join(PROJECT_ROOT, "images");
const OUTPUT_FILE = path.join(PROJECT_ROOT, "world_response.json");

// ── Helpers ─────────────────────────────────────────────────────────────
function apiHeaders() {
  return {
    "Content-Type": "application/json",
    "WLT-Api-Key": API_KEY,
  };
}

function uploadHeaders(requiredHeaders) {
  return {
    "Content-Type": "image/jpeg",
    ...requiredHeaders,
  };
}

async function prepareUpload(fileName) {
  const res = await fetch(`${BASE_URL}/media-assets:prepare_upload`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({
      file_name: fileName,
      kind: "image",
      extension: "jpg",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`prepare_upload failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function uploadFile(uploadInfo, filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const res = await fetch(uploadInfo.upload_url, {
    method: uploadInfo.upload_method,
    headers: uploadHeaders(uploadInfo.required_headers || {}),
    body: fileBuffer,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`File upload failed (${res.status}): ${body}`);
  }
}

async function generateWorld(multiImagePrompt) {
  const res = await fetch(`${BASE_URL}/worlds:generate`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({
      display_name: DISPLAY_NAME,
      model: MODEL,
      world_prompt: {
        type: "multi-image",
        multi_image_prompt: multiImagePrompt,
        reconstruct_images: true,
        text_prompt: TEXT_PROMPT || undefined,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`generateWorld failed (${res.status}): ${body}`);
  }
  return res.json();
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  if (!API_KEY) {
    console.error("Error: WORLD_LABS_API environment variable is not set.");
    console.error("Set it in your .env or export it before running.");
    process.exit(1);
  }

  // Collect and sort JPEG images from the images directory
  if (!fs.existsSync(IMAGES_DIR)) {
    console.error(`Error: Images directory not found: ${IMAGES_DIR}`);
    console.error("Create an 'images' folder and place your JPEG files there.");
    process.exit(1);
  }

  const imageFiles = fs
    .readdirSync(IMAGES_DIR)
    .filter((f) => /\.jpe?g$/i.test(f))
    .sort();

  if (imageFiles.length === 0) {
    console.error("Error: No JPEG images found in the images directory.");
    process.exit(1);
  }

  console.log(`Found ${imageFiles.length} images in ${IMAGES_DIR}`);

  // Assign azimuths: 0, 45, 90, 135, 180, 225, 270, 315
  const AZIMUTH_STEP = 360 / imageFiles.length;
  const imageEntries = imageFiles.map((file, i) => ({
    file,
    azimuth: Math.round(i * AZIMUTH_STEP),
    filePath: path.join(IMAGES_DIR, file),
  }));

  for (const entry of imageEntries) {
    console.log(`  ${entry.file} → azimuth ${entry.azimuth}°`);
  }

  // Step 1: Upload each image via prepare_upload + PUT
  console.log("\n── Uploading images ──");
  const multiImagePrompt = [];

  for (const entry of imageEntries) {
    console.log(`Uploading ${entry.file}...`);
    const prepareRes = await prepareUpload(entry.file);
    const mediaAssetId =
      prepareRes.media_asset?.media_asset_id ||
      prepareRes.media_asset?.id ||
      prepareRes.media_asset_id;

    await uploadFile(prepareRes.upload_info, entry.filePath);
    console.log(`  Uploaded → media_asset_id: ${mediaAssetId}`);

    multiImagePrompt.push({
      azimuth: entry.azimuth,
      content: {
        source: "media_asset",
        media_asset_id: mediaAssetId,
      },
    });
  }

  // Step 2: Generate the world
  console.log("\n── Generating world ──");
  const generateRes = await generateWorld(multiImagePrompt);
  const operationId = generateRes.operation_id;
  console.log(`Operation started: ${operationId}`);

  // Save the response to JSON
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(generateRes, null, 2));
  console.log(`Response saved to ${OUTPUT_FILE}`);
  console.log(`\nOperation ID: ${operationId}`);
  console.log(
    `\nPoll manually: curl -H "WLT-Api-Key: $WORLD_LABS_API" ${BASE_URL}/operations/${operationId}`
  );
}

main().catch((err) => {
  console.error("\nFatal error:", err.message);
  process.exit(1);
});
