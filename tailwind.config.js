/** @type {import("tailwindcss").Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        ring: "hsl(var(--ring))",
        boots: {
          base: {
            DEFAULT: "hsl(var(--boots))",
            foreground: "hsl(var(--boots-foreground))"
          },
          light: "hsl(var(--boots-light))"
        },
        discount: {
          DEFAULT: "hsl(var(--discount))",
          foreground: "hsl(var(--discount-foreground))"
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      ringColor: {
        "boots-base": "hsl(var(--boots))",
        "boots-light": "hsl(var(--boots-light))",
        "discount": "hsl(var(--discount))"
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans Thai", "sans-serif"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
