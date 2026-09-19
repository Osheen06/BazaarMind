# TEST AGENT PROMPT — IMAGE INTEGRATION RULES

You are validating BazaarMind's image integration (vendor stall photo → Gemini).

## Image Handling Rules
- Always use base64-encoded images for all tests and requests.
- Accepted formats: JPEG, PNG, WEBP only. Do not use SVG, BMP, HEIC.
- Do not upload blank, solid-color, or uniform-variance images. Every image must contain real visual features (objects, edges, textures, shadows).
- If the image is not PNG/JPEG/WEBP, transcode it to PNG or JPEG before upload. Re-detect and update MIME after any transformation.
- If the image is animated (GIF, APNG, animated WEBP), extract the first frame only.
- Resize large images to reasonable bounds (avoid oversized payloads).

## BazaarMind image endpoint
- POST /api/signals/interpret with JSON body `{ "text": "...", "imageBase64": "<base64 no data: prefix>" }`
- Expect `{ ok: true, signal: {...}, live: true }`. The signal must preserve uncertainty and never claim exact inventory counts.
