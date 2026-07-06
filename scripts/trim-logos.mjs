import sharp from "sharp";
import path from "node:path";

const dir = "/Users/rafaim/CLAUDE/brand_assets";
const outDir = "/Users/rafaim/CLAUDE/assets";

const jobs = [
  { in: "LOGO ALONE BLACK.png", out: "logo-mark-black.png" },
  { in: "LOGO + POST.png", out: "logo-lockup-black.png" },
];

for (const job of jobs) {
  const inputPath = path.join(dir, job.in);
  const outputPath = path.join(outDir, job.out);
  const img = sharp(inputPath);
  const trimmed = img.trim({ threshold: 10 });
  await trimmed.toFile(outputPath);
  const meta = await sharp(outputPath).metadata();
  console.log(job.out, meta.width, meta.height);
}
