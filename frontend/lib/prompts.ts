// Prompt templates shared between frontend (preview display) and App backend
// The App backend uses these in app/utils/prompts.server.ts

export const PAINTING_STYLES = {
  "classic-oil": {
    name: "Classic Oil",
    description: "Timeless elegance of traditional oil painting",
    prompt:
      "Transform this pet photo into a classic oil painting in the style of Dutch Golden Age masters. Use rich, warm tones with visible brushstrokes, dramatic lighting from the left side, and a dark, textured background. The pet should appear noble and dignified, as if sitting for a formal portrait in a grand hall.",
  },
  impressionist: {
    name: "Impressionist",
    description: "Soft brushstrokes with vibrant light and color",
    prompt:
      "Transform this pet photo into an impressionist painting inspired by Claude Monet and Pierre-Auguste Renoir. Use loose, visible brushstrokes with vibrant, natural light. Emphasize soft color transitions, dappled sunlight effects, and a dreamy garden or outdoor setting. The pet should appear gentle and full of life.",
  },
} as const;

export function getStylePrompt(style: string): string {
  const key = style as keyof typeof PAINTING_STYLES;
  return PAINTING_STYLES[key]?.prompt ?? PAINTING_STYLES["classic-oil"].prompt;
}

export function getStyleName(style: string): string {
  const key = style as keyof typeof PAINTING_STYLES;
  return PAINTING_STYLES[key]?.name ?? style;
}
