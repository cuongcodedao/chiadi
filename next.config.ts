import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Thư mục cha có package.json lạc; neo gốc vào đúng repo này.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
