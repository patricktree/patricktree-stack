import { withPigment } from "@pigment-css/nextjs-plugin";

import wywConfig from "@patricktree-stack/config-wyw-in-js/class-name-slug.cjs";

export function createNextConfig(nextConfig = {}) {
  return {
    distDir: "dist",
    reactStrictMode: true,

    eslint: {
      dirs: ["."],
      ignoreDuringBuilds: true,
    },

    typescript: {
      tsconfigPath: "./tsconfig.next.json",
      ignoreBuildErrors: true,
    },

    webpack(config) {
      // moduleResolution: node16 support for Next.js (https://github.com/vercel/next.js/discussions/41189#discussioncomment-4026895)
      config.resolve.extensionAlias = {
        ...config.resolve.extensionAlias,
        ".js": [".js", ".ts"],
        ".jsx": [".jsx", ".tsx"],
      };
      return config;
    },

    ...nextConfig,
  };
}

export function withPigmentCss(nextConfig, options = {}) {
  return withPigment(nextConfig, {
    classNameSlug: wywConfig.createClassNameSlug,
    ...options,
  });
}
