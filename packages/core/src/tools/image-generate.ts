import { tool } from "ai";
import { z } from "zod";

export const imageGenerateTool = tool({
  description: "Generate an image based on a text description. Uses AI image generation models.",
  parameters: z.object({
    prompt: z.string().describe("A detailed description of the image to generate"),
    size: z.enum(["256x256", "512x512", "1024x1024", "1792x1024", "1024x1792"]).optional().default("1024x1024"),
    n: z.number().min(1).max(4).optional().default(1),
  }),
  execute: async ({ prompt, size = "1024x1024", n = 1 }) => {
    return JSON.stringify({
      note: "Image generation requires an image-capable provider (DALL-E, Stable Diffusion, etc.)",
      prompt,
      size,
      n,
      generated: false,
      message: "Configure an image generation provider in settings to enable this feature. For now, the prompt above can be used with external tools.",
    });
  },
});
