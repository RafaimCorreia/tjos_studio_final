import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const SRC = path.resolve("stills_portfolio");
const DEST = path.resolve("assets/work");
const FFMPEG = path.resolve("node_modules/ffmpeg-static/ffmpeg");

fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(DEST, { recursive: true });

function detectBarCrop(imgPath, negate){
  const filter = (negate ? "negate," : "") + "cropdetect=limit=24:round=2:skip=0";
  const res = spawnSync(FFMPEG, ["-v", "verbose", "-i", imgPath, "-vf", filter, "-f", "null", "-"], { encoding: "utf8" });
  const out = res.stderr || "";
  const matches = [...out.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)];
  if (!matches.length) return null;
  const last = matches[matches.length - 1];
  return { w: +last[1], h: +last[2], x: +last[3], y: +last[4] };
}

function getDimensions(imgPath){
  const res = spawnSync(FFMPEG, ["-i", imgPath], { encoding: "utf8" });
  const m = (res.stderr || "").match(/Video:.* (\d+)x(\d+)/);
  return m ? { w: +m[1], h: +m[2] } : null;
}

// Some downloaded Instagram stills bake in solid letterbox bars (white or
// black) to pad a widescreen photo into a square canvas. Detect and trim
// those bars conservatively so the work grid shows clean, full-bleed crops.
function trimLetterbox(srcPath, destPath){
  const dims = getDimensions(srcPath);
  if (!dims){ fs.copyFileSync(srcPath, destPath); return false; }

  const candidates = [detectBarCrop(srcPath, false), detectBarCrop(srcPath, true)]
    .filter(Boolean)
    .filter(function(c){ return c.x === 0 && c.w === dims.w && c.h < dims.h; })
    .filter(function(c){
      const ratio = c.h / dims.h;
      return ratio >= 0.5 && ratio <= 0.96;
    });

  if (!candidates.length){ fs.copyFileSync(srcPath, destPath); return false; }

  const best = candidates.reduce(function(a, b){ return b.h < a.h ? b : a; });
  spawnSync(FFMPEG, [
    "-y", "-i", srcPath,
    "-vf", `crop=${best.w}:${best.h}:${best.x}:${best.y}`,
    "-q:v", "2",
    destPath
  ]);
  return true;
}

var folders = fs.readdirSync(SRC).filter(function(f){
  return fs.statSync(path.join(SRC, f)).isDirectory();
});

function folderDate(f){
  var m = f.match(/(\d{8})_(\d{6})$/);
  return m ? m[1] + m[2] : "0";
}

folders.sort(function(a, b){ return folderDate(b).localeCompare(folderDate(a)); });

var manifest = [];

folders.forEach(function(folder, idx){
  var srcDir = path.join(SRC, folder);
  var files = fs.readdirSync(srcDir).filter(function(f){
    return /\.(jpg|jpeg|png|webp)$/i.test(f);
  });
  files.sort(function(a, b){
    var na = parseInt(a.match(/^(\d+)/)[1], 10);
    var nb = parseInt(b.match(/^(\d+)/)[1], 10);
    return na - nb;
  });

  var id = String(idx + 1).padStart(2, "0");
  var destDir = path.join(DEST, id);
  fs.mkdirSync(destDir, { recursive: true });

  files.forEach(function(file, i){
    var ext = path.extname(file).toLowerCase();
    var destName = String(i + 1).padStart(2, "0") + ext;
    var trimmed = trimLetterbox(path.join(srcDir, file), path.join(destDir, destName));
    if (trimmed) console.log("  trimmed bars:", folder, "/", file);
  });

  manifest.push({
    id: id,
    count: files.length,
    ext: files.length ? path.extname(files[0]).toLowerCase() : ".jpg"
  });
});

fs.writeFileSync(path.join(DEST, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("Built", manifest.length, "projects into", DEST);
manifest.forEach(function(p){ console.log(" ", p.id, "-", p.count, "images"); });
