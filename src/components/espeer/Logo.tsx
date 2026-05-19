const logoUrl = "/expeer-logo.png";

interface LogoProps {
  className?: string;
  /** height in px; width auto */
  height?: number;
  alt?: string;
}

/**
 * EXPEER wordmark logo. Uses the uploaded brand asset.
 * Pass `height` to control size (width auto-scales to preserve aspect ratio).
 */
export function Logo({ className = "", height = 24, alt = "EXPEER" }: LogoProps) {
  return (
    <img
      src={logoUrl}
      alt={alt}
      style={{ height }}
      className={`w-auto select-none ${className}`}
      draggable={false}
    />
  );
}

export default Logo;
