import React from "react";
import Image from "next/image";

type SpotImageProps = {
  src?: string;
  alt: string;
  className?: string;
  sizes: string;
  fill?: boolean;
  width?: number;
  height?: number;
  priority?: boolean;
};

function canUseNextImage(src: string) {
  if (src.startsWith("/") || src.startsWith("data:")) {
    return true;
  }

  try {
    const url = new URL(src);
    return url.hostname === "commons.wikimedia.org" || url.hostname === "upload.wikimedia.org";
  } catch {
    return false;
  }
}

export function SpotImage({
  src,
  alt,
  className,
  sizes,
  fill,
  width,
  height,
  priority = false,
}: SpotImageProps) {
  const imageSrc = typeof src === "string" && src.length > 0 ? src : "/placeholder.svg";

  if (!canUseNextImage(imageSrc)) {
    return (
      <img
        src={imageSrc}
        alt={alt}
        className={className}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
      />
    );
  }

  if (fill) {
    return (
      <Image
        src={imageSrc}
        alt={alt}
        className={className}
        sizes={sizes}
        fill
        priority={priority}
      />
    );
  }

  return (
    <Image
      src={imageSrc}
      alt={alt}
      className={className}
      sizes={sizes}
      width={width ?? 112}
      height={height ?? 112}
      priority={priority}
    />
  );
}
