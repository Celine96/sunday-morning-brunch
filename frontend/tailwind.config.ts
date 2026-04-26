import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        cream: {
          50: "#FFFDF9",
          100: "#FAF8F5",
          200: "#F5F0E8",
          300: "#EDE5D8",
          400: "#E0D5C4",
          500: "#D4C9B5",
        },
        warm: {
          50: "#FAF8F5",
          100: "#F5F0E8",
          200: "#EDE5D8",
          300: "#D4C4A8",
          400: "#B8A88E",
          500: "#9C8E74",
          600: "#7A6E58",
          700: "#5C5242",
          800: "#3D372C",
          900: "#2A2520",
        },
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
