import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        clairvoie: {
          bleu: "#1E3A5F",
          bleuclair: "#3E6D9C",
          vert: "#2E7D5B",
          ambre: "#C9862A",
          rouge: "#B8433C",
        },
      },
    },
  },
  plugins: [],
};
export default config;
