import Image from "next/image";

interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * Brand logo — always uses the real icon from /public/icons.
 * Use this everywhere the My Classroom logo appears.
 */
export function Logo({ size = 36, className = "" }: LogoProps) {
  return (
    <Image
      src="/icons/icon-192x192.png.png"
      alt="My Classroom"
      width={size}
      height={size}
      className={`object-cover ${className}`}
      priority={size >= 36}
    />
  );
}
