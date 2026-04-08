/**
 * Cover Overlay Endpoint for admin-api.js
 *
 * Add this route to /root/sitechist-openclaw/tools/admin-api.js
 * Requires: ImageMagick (convert), GCS credentials on VPS
 *
 * POST /api/cover/overlay
 * Body: { imageBase64, title, projectId, branding: { logoDark, logoPosition, logoSize, titlePosition, titleSize, titleColor, titleShadow, linkText, linkPosition, linkColor } }
 * Returns: { ok: true, url: "https://storage.googleapis.com/...", base64: "..." }
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

// ── Paste this into admin-api.js after existing routes ──

// app.post('/api/cover/overlay', async (req, res) => {
function registerCoverOverlay(app, AUTH_TOKEN) {
  app.post('/api/cover/overlay', async (req, res) => {
    try {
      const auth = req.headers.authorization;
      if (auth !== AUTH_TOKEN) return res.status(401).json({ ok: false, error: 'unauthorized' });

      const { imageBase64, title, projectId, branding } = req.body;
      if (!imageBase64 || !title) return res.status(400).json({ ok: false, error: 'imageBase64 and title required' });

      const b = branding || {};
      const tmpDir = '/tmp/covers';
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

      const id = crypto.randomBytes(8).toString('hex');
      const inputPath = path.join(tmpDir, `${id}-input.png`);
      const outputPath = path.join(tmpDir, `${id}-output.png`);
      const logoPath = path.join(tmpDir, `${id}-logo.png`);

      // Write input image
      fs.writeFileSync(inputPath, Buffer.from(imageBase64, 'base64'));

      // Build ImageMagick command
      const cmds = [];
      cmds.push(`convert "${inputPath}"`);

      // === Title overlay ===
      const titleSize = b.titleSize || '48';
      const titleColor = b.titleColor || '#FFFFFF';
      const titlePos = b.titlePosition || 'bottom-left';
      const gravity = positionToGravity(titlePos);

      // Shadow under title for readability
      if (b.titleShadow !== false) {
        cmds.push(`-gravity ${gravity} -fill "rgba(0,0,0,0.7)" -font "DejaVu-Sans-Bold" -pointsize ${titleSize}`);
        cmds.push(`-annotate +42+42 "${escapeIM(title)}"`);
      }

      // Title text
      cmds.push(`-gravity ${gravity} -fill "${titleColor}" -font "DejaVu-Sans-Bold" -pointsize ${titleSize}`);
      cmds.push(`-annotate +40+40 "${escapeIM(title)}"`);

      // === Link text overlay ===
      if (b.linkText) {
        const linkGravity = positionToGravity(b.linkPosition || 'bottom-right');
        const linkColor = b.linkColor || '#93c5fd';
        cmds.push(`-gravity ${linkGravity} -fill "${linkColor}" -font "DejaVu-Sans" -pointsize 22`);
        cmds.push(`-annotate +20+20 "${escapeIM(b.linkText)}"`);
      }

      // Write intermediate (text overlay done)
      cmds.push(`"${outputPath}"`);
      execSync(cmds.join(' \\\n  '), { timeout: 15000 });

      // === Logo overlay (composite) ===
      if (b.logoDark) {
        try {
          // Download logo
          const logoResp = await fetch(b.logoDark);
          if (logoResp.ok) {
            const logoBuf = Buffer.from(await logoResp.arrayBuffer());
            fs.writeFileSync(logoPath, logoBuf);

            const logoSize = b.logoSize || '60';
            const logoGravity = positionToGravity(b.logoPosition || 'top-left');

            execSync(
              `convert "${outputPath}" \\( "${logoPath}" -resize ${logoSize}x${logoSize} \\) -gravity ${logoGravity} -geometry +20+20 -composite "${outputPath}"`,
              { timeout: 10000 }
            );
          }
        } catch (e) {
          console.error('Logo overlay failed:', e.message);
        }
      }

      // Read result
      const resultBuffer = fs.readFileSync(outputPath);
      const resultBase64 = resultBuffer.toString('base64');

      // Upload to GCS
      const gcsFilename = `covers/${projectId || 'default'}/${id}.png`;
      let url = '';
      try {
        url = await uploadToGCS(gcsFilename, resultBuffer);
      } catch (e) {
        console.error('GCS upload failed:', e.message);
        // Still return base64 even if GCS fails
      }

      // Cleanup
      [inputPath, outputPath, logoPath].forEach(f => { try { fs.unlinkSync(f); } catch {} });

      res.json({ ok: true, url, base64: resultBase64 });
    } catch (e) {
      console.error('Cover overlay error:', e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });
}

function positionToGravity(pos) {
  const map = {
    'top-left': 'NorthWest', 'top-center': 'North', 'top-right': 'NorthEast',
    'center': 'Center',
    'bottom-left': 'SouthWest', 'bottom-center': 'South', 'bottom-right': 'SouthEast',
  };
  return map[pos] || 'SouthWest';
}

function escapeIM(text) {
  // Escape special chars for ImageMagick -annotate
  return text.replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/%/g, '%%');
}

async function uploadToGCS(filename, buffer) {
  // Uses gsutil (must be configured on VPS)
  const tmpPath = `/tmp/${crypto.randomBytes(4).toString('hex')}.png`;
  fs.writeFileSync(tmpPath, buffer);
  try {
    execSync(`gsutil cp "${tmpPath}" "gs://uspeshnyy-projects/openclaw/${filename}"`, { timeout: 15000 });
    execSync(`gsutil acl ch -u AllUsers:R "gs://uspeshnyy-projects/openclaw/${filename}"`, { timeout: 10000 });
    return `https://storage.googleapis.com/uspeshnyy-projects/openclaw/${filename}`;
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
}

module.exports = { registerCoverOverlay };
