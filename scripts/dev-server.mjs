import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { cwd } from "node:process";
import { spawn } from "node:child_process";

const root = cwd();
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || `localhost:${port}`}`);

  if (request.method === "GET" && requestUrl.pathname === "/api/healthz") {
    writeJson(response, 200, { ok: true, port });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/generator-ocr") {
    await handleGeneratorOcr(request, response);
    return;
  }

  const urlPath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const safePath = normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath);

  try {
    const body = await readFile(filePath);
    const contentType = mimeTypes[extname(filePath)] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

async function handleGeneratorOcr(request, response) {
  try {
    const payload = await readJsonBody(request);
    const images = Array.isArray(payload?.images) ? payload.images : [];
    if (!images.length) {
      writeJson(response, 400, { error: "No images were provided for OCR." });
      return;
    }

    const tempDir = await mkdtemp(join(tmpdir(), "cifi-generator-ocr-"));
    const imagePaths = [];

    try {
      for (const [index, image] of images.entries()) {
        const extension = getImageExtension(image.type, image.name, index);
        const filename = sanitizeFileName(image.name || `generator-${index + 1}${extension}`);
        const filePath = join(tempDir, filename.endsWith(extension) ? filename : `${filename}${extension}`);
        const base64 = String(image.data || "").replace(/^data:[^;]+;base64,/, "");
        await writeFile(filePath, Buffer.from(base64, "base64"));
        imagePaths.push(filePath);
      }

      const scriptPath = join(root, "scripts", "generator-ocr.ps1");
      const result = await runProcess("powershell", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        ...imagePaths
      ]);

      let parsed;
      try {
        parsed = JSON.parse(result.stdout || "{}");
      } catch {
        writeJson(response, 500, {
          error: "OCR script returned invalid JSON.",
          stdout: result.stdout,
          stderr: result.stderr
        });
        return;
      }

      writeJson(response, 200, parsed);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    writeJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => {
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(stderr || stdout || `Process exited with code ${code}.`));
    });
  });
}

function getImageExtension(type = "", name = "", index = 0) {
  const extFromName = extname(name);
  if (extFromName) {
    return extFromName;
  }
  const map = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp"
  };
  return map[type] || `.img${index + 1}`;
}

function sanitizeFileName(value) {
  return value.replace(/[^a-z0-9._-]+/gi, "-");
}

function writeJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

server.listen(port, () => {
  console.log(`CIFI Optimization Suite running at http://localhost:${port}`);
});
