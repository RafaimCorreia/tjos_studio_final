import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const FFMPEG = path.resolve("node_modules/ffmpeg-static/ffmpeg");
const SRC = path.resolve("videos_portfolio");
const TMP = path.resolve(".tmp-home-video");
const DEST = path.resolve("assets/video");

const W = 960;
const H = 540;

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
fs.mkdirSync(DEST, { recursive: true });

const files = fs.readdirSync(SRC).filter(f => /\.mp4$/i.test(f)).sort();

function probeDuration(filePath){
  try {
    execFileSync(FFMPEG, ["-i", filePath], { stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    const out = (e.stderr || "").toString();
    const m = out.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
    if (m) return (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]);
  }
  return null;
}

const listLines = [];
files.forEach((file, i) => {
  const srcPath = path.join(SRC, file);
  const duration = probeDuration(srcPath) || 30;
  const clipDur = Math.random() < 0.5 ? 4 : 5;
  const latestStart = Math.max(2, duration - clipDur - 2);
  const start = 2 + Math.random() * Math.max(0, latestStart - 2);

  const outName = `clip-${String(i + 1).padStart(2, "0")}.mp4`;
  const outPath = path.join(TMP, outName);
  console.log(`[${i + 1}/${files.length}] trimming: ${file} @ ${start.toFixed(1)}s for ${clipDur}s`);
  execFileSync(FFMPEG, [
    "-y",
    "-ss", start.toFixed(2),
    "-i", srcPath,
    "-t", String(clipDur),
    "-vf", `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=25`,
    "-an",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "26",
    "-pix_fmt", "yuv420p",
    outPath
  ], { stdio: ["ignore", "ignore", "inherit"] });
  listLines.push(`file '${outPath.replace(/'/g, "'\\''")}'`);
});

const listFile = path.join(TMP, "concat.txt");
fs.writeFileSync(listFile, listLines.join("\n"));

const outFile = path.join(DEST, "home-loop.mp4");
console.log("concatenating...");
execFileSync(FFMPEG, [
  "-y",
  "-f", "concat",
  "-safe", "0",
  "-i", listFile,
  "-c", "copy",
  outFile
], { stdio: ["ignore", "ignore", "inherit"] });

const posterFile = path.join(DEST, "home-loop-poster.jpg");
execFileSync(FFMPEG, [
  "-y",
  "-i", outFile,
  "-frames:v", "1",
  "-q:v", "3",
  posterFile
], { stdio: ["ignore", "ignore", "inherit"] });

fs.rmSync(TMP, { recursive: true, force: true });

const size = fs.statSync(outFile).size;
console.log(`Done. ${outFile} (${(size / 1024 / 1024).toFixed(1)} MB)`);
