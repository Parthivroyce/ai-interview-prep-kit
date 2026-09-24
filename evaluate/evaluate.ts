import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { runGenerationPipeline } from "../packages/pipeline/pipeline";
import { sanitizeToExactAppendixA } from "../packages/shared/appendixA";
import { batchInputSchema } from "../packages/shared/schemas";

dotenv.config();

interface ParsedArgs {
  input: string;
  output: string;
}

function parseCommandLineArgs(args: string[]): ParsedArgs {
  let input = "";
  let output = "";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--input" && args[i + 1]) {
      input = args[i + 1];
      i++;
    } else if (arg.startsWith("--input=")) {
      input = arg.split("=")[1];
    } else if (arg === "--output" && args[i + 1]) {
      output = args[i + 1];
      i++;
    } else if (arg.startsWith("--output=")) {
      output = arg.split("=")[1];
    }
  }

  if (!input || !output) {
    console.error("Usage: npm run evaluate -- --input <cases.json> --output <kits.json>");
    process.exit(1);
  }

  return { input, output };
}

async function runEvaluation(): Promise<void> {
  const args = parseCommandLineArgs(process.argv.slice(2));

  console.log(`[Evaluator] Reading input cases from: ${args.input}`);
  const inputDataRaw = await fs.readFile(path.resolve(process.cwd(), args.input), "utf-8");
  const parsedInput = JSON.parse(inputDataRaw);

  const validation = batchInputSchema.safeParse(parsedInput);
  if (!validation.success) {
    console.error("[Evaluator] Invalid input cases format:", validation.error.message);
    process.exit(1);
  }

  const cases = validation.data;
  console.log(`[Evaluator] Found ${cases.length} evaluation case(s). Processing...`);

  const outputKits: Array<{
    id: string;
    status: "ok" | "failed";
    kit: any | null;
    error: { code: string; message: string } | null;
  }> = [];

  for (const c of cases) {
    console.log(`[Evaluator] Starting case: ${c.id} (${c.company_url}, ${c.days} days)`);
    try {
      // Run the EXACT SAME generation pipeline with allowLocal: true enabled for evaluator/test servers
      const res = await runGenerationPipeline({
        jd: c.jd,
        company_url: c.company_url,
        days: c.days,
        allowLocal: true,
        onProgress: (p) => {
          console.log(`  [${c.id}] ${p.step} (${p.progress}%)`);
        },
      });

      const exactKit = sanitizeToExactAppendixA(res.kit);

      outputKits.push({
        id: c.id,
        status: "ok",
        kit: exactKit,
        error: null,
      });
      console.log(`[Evaluator] ✓ Case ${c.id} completed successfully.`);
    } catch (err: any) {
      console.error(`[Evaluator] ✗ Case ${c.id} failed:`, err.message || err);
      let errorCode = "GENERATION_FAILED";
      if (err.message?.includes("unreachable") || err.message?.includes("fetch")) {
        errorCode = "COMPANY_UNREACHABLE";
      } else if (err.message?.includes("validation")) {
        errorCode = "VALIDATION_ERROR";
      }

      outputKits.push({
        id: c.id,
        status: "failed",
        kit: null,
        error: {
          code: errorCode,
          message: err.message || "Failed to generate kit.",
        },
      });
    }
  }

  const finalOutput = {
    version: "1.0",
    generated_at: new Date().toISOString(),
    kits: outputKits,
  };

  const outputPath = path.resolve(process.cwd(), args.output);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(finalOutput, null, 2), "utf-8");

  console.log(`[Evaluator] Finished all cases. Output saved to: ${args.output}`);
}

runEvaluation().catch(err => {
  console.error("[Evaluator] Fatal error:", err);
  process.exit(1);
});
