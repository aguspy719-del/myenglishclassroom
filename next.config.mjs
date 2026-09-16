/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  // Enable compression
  compress: true,
  // Reduce bundle size
  experimental: {
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
  },
};

export default nextConfig;
