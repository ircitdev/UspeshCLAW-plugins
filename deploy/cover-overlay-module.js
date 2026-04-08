// cover-overlay.js — ImageMagick cover overlay + GCS upload
// Required by admin-api.js: if (p === "/api/cover/overlay") return require("./cover-overlay")(req,res,readBody,json);
const fs = require("fs");
const crypto = require("crypto");
const { execSync } = require("child_process");

const GRAVITY = {
  "top-left": "NorthWest", "top-center": "North", "top-right": "NorthEast",
  "center": "Center",
  "bottom-left": "SouthWest", "bottom-center": "South", "bottom-right": "SouthEast",
};

// Escape a string for use as ImageMagick -annotate argument (single-quoted shell arg)
function safeIM(s) {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "%%")
    .replace(/\n/g, " ")
    .replace(/\r/g, "");
}

// Wrap arg in single quotes for shell, escaping internal single quotes
function shQ(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

module.exports = async function handleCoverOverlay(req, res, readBody, json) {
  var inputPath, outputPath, logoPath;
  try {
    var body = JSON.parse(await readBody(req));
    if (!body.imageBase64 || !body.title) {
      return json(res, { ok: false, error: "imageBase64 and title required" }, 400);
    }
    var b = body.branding || {};
    var tmpDir = "/tmp/covers";
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    var id = crypto.randomBytes(8).toString("hex");
    inputPath = tmpDir + "/" + id + "-input.png";
    outputPath = tmpDir + "/" + id + "-output.png";
    logoPath   = tmpDir + "/" + id + "-logo.png";

    fs.writeFileSync(inputPath, Buffer.from(body.imageBase64, "base64"));

    var tg = GRAVITY[b.titlePosition || "bottom-left"] || "SouthWest";
    var tc = "#" + (b.titleColor || "FFFFFF").replace(/#/g, "");
    var ts = String(parseInt(b.titleSize) || 48);
    var title = safeIM(body.title);

    var args = ["convert", inputPath];

    // Shadow pass
    if (b.titleShadow !== false) {
      args.push(
        "-gravity", tg, "-fill", "rgba(0,0,0,0.6)",
        "-font", "DejaVu-Sans-Bold", "-pointsize", ts,
        "-annotate", "+42+42", title
      );
    }
    // Title text
    args.push(
      "-gravity", tg, "-fill", tc,
      "-font", "DejaVu-Sans-Bold", "-pointsize", ts,
      "-annotate", "+40+40", title
    );

    // Link text (e.g. "@uspeshgpt")
    if (b.linkText) {
      var lg = GRAVITY[b.linkPosition || "bottom-right"] || "SouthEast";
      var lc = "#" + (b.linkColor || "93c5fd").replace(/#/g, "");
      args.push(
        "-gravity", lg, "-fill", lc,
        "-font", "DejaVu-Sans", "-pointsize", "24",
        "-annotate", "+20+20", safeIM(b.linkText)
      );
    }
    args.push(outputPath);

    execSync(args.map(shQ).join(" "), { timeout: 15000 });

    // Logo composite
    if (b.logoDark) {
      try {
        var lr = await fetch(b.logoDark);
        if (lr.ok) {
          fs.writeFileSync(logoPath, Buffer.from(await lr.arrayBuffer()));
          var logoG = GRAVITY[b.logoPosition || "top-right"] || "NorthEast";
          var logoSz = String(parseInt(b.logoSize) || 110);
          execSync(
            "convert " + shQ(outputPath) +
            " \\( " + shQ(logoPath) + " -resize " + logoSz + "x" + logoSz + " \\)" +
            " -gravity " + logoG + " -geometry +20+20 -composite " + shQ(outputPath),
            { timeout: 10000 }
          );
        }
      } catch (le) { console.error("logo overlay:", le.message); }
      try { fs.unlinkSync(logoPath); } catch {}
    }

    var buf = fs.readFileSync(outputPath);
    var b64 = buf.toString("base64");

    // Upload to GCS
    var url = "";
    try {
      var gcsPath = "covers/" + (body.projectId || "default") + "/" + id + ".png";
      var gcsTmp  = "/tmp/" + id + "_gcs.png";
      fs.writeFileSync(gcsTmp, buf);
      execSync("gsutil cp " + shQ(gcsTmp) + " " + shQ("gs://uspeshnyy-projects/openclaw/" + gcsPath), { timeout: 20000 });
      execSync("gsutil acl ch -u AllUsers:R " + shQ("gs://uspeshnyy-projects/openclaw/" + gcsPath), { timeout: 10000 });
      url = "https://storage.googleapis.com/uspeshnyy-projects/openclaw/" + gcsPath;
      try { fs.unlinkSync(gcsTmp); } catch {}
    } catch (ge) { console.error("GCS upload:", ge.message); }

    [inputPath, outputPath].forEach(function(f) { try { if (f) fs.unlinkSync(f); } catch {} });
    json(res, { ok: true, url: url, base64: b64 });

  } catch (e) {
    [inputPath, outputPath, logoPath].forEach(function(f) { try { if (f) fs.unlinkSync(f); } catch {} });
    json(res, { ok: false, error: e.message }, 500);
  }
};
