import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    transpilePackages: ["@veriflow/api", "@veriflow/shared"]
};

export default nextConfig;
