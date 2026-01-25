/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans Thai"', "Inter", "sans-serif"],
      },
      colors: {
        boots: {
          base: "#184290", // สีหลักตามที่ขอ
          hover: "#12326b", // สีตอนเมาส์ชี้ (เข้มขึ้น)
          light: "#eef4ff", // สีพื้นหลังอ่อนๆ
          text: "#202124",
          subtext: "#5f6368",
        },
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
