import config from "../config";

import { warmup } from "../boot";

import { AIMemory } from "../stdlib/ai/ai-memory";
import { Signale } from "signale";

import path from "node:path";
import { createReadStream } from "node:fs";

import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { OpenAISDK } from "../lib/openai";
import { tmpDir } from "../paths";
import { writeFileSync } from "node:fs";
import brain from "../../keys/brain.json";

const rl = readline.createInterface({ input: stdin, output: stdout });

const TAG = "FineTune";
const logger = new Signale({
  scope: TAG,
});

warmup()
  .then(async () => {
    const aiMemory = AIMemory.getInstance();
    const openai = OpenAISDK();

    const promptMemory = await aiMemory.getPromptMemory();
    const declarativeMemory = await aiMemory.getDeclarativeMemory();

    const memory = [...promptMemory, ...declarativeMemory];
    logger.info("Brain size", memory.length);

    // Now create a list of prompts that will be used to fine-tune the model
    const initialPrompt = memory.map((item) => item.text).join("\n");

    // Create a JSONL string from the prompts
    const jsonLines = brain
      .map((item) => ({
        messages: [{ role: "system", content: initialPrompt }, ...item.messages],
      }))
      .map((item) => JSON.stringify(item))
      .join("\n");

    const tempFile = path.join(tmpDir, "brain.jsonl");
    writeFileSync(tempFile, jsonLines);

    logger.info("Created JSONL file for fine-tuning: ", tempFile);

    if ((await rl.question("Do you want to continue (y/n)? ")) !== "y") {
      logger.warn("Aborted");
      process.exit(0);
    }

    // Upload the file and start fine-tuning
    const file = await openai.files.create({
      file: createReadStream(tempFile),
      purpose: "fine-tune",
    });

    const fineTune = await openai.fineTuning.jobs.create({
      training_file: file.id,
      model: config().openai.fineTuneModel,
      suffix: config().aiName,
    });

    logger.info("Started fine-tuning job, waiting for...", fineTune);
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Query the job status in loop until it's finished
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const job = await openai.fineTuning.jobs.retrieve(fineTune.id);
      logger.pending("Job status: ", job.status);

      if (job.status === "succeeded") {
        break;
      }

      if (job.status === "failed") {
        logger.error("Fine-tuning job failed", job);
        process.exit(1);
      }

      await new Promise((resolve) => setTimeout(resolve, 2500));
    }

    logger.info("Done");
    process.exit(0);
  })
  .catch((err) => {
    logger.error(err);
    process.exit(1);
  });
