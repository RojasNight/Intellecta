import React, { useState } from "react";

export function ImageWithFallback(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [didError, setDidError] = useState(false);
  const { src, alt, style, className, ...rest } = props;
  const hasImage = typeof src === "string" && src.trim().length > 0;

  const fallback = (
    <div
      className={`inline-flex items-center justify-center overflow-hidden ${className ?? ""}`}
      style={{
        background: "linear-gradient(145deg, #FDFBF7 0%, #E8E4DC 100%)",
        border: "1px solid rgba(26,43,60,0.10)",
        color: "#4A5F7A",
        ...style,
      }}
      role="img"
      aria-label={alt || "Обложка книги не загружена"}
      data-original-url={src}
    >
      <div className="flex h-full w-full flex-col items-center justify-center px-3 text-center">
        <div
          aria-hidden
          style={{
            width: 34,
            height: 48,
            borderRadius: 4,
            border: "2px solid #1A2B3C",
            boxShadow: "inset 7px 0 0 rgba(26,43,60,0.12)",
            marginBottom: 10,
            opacity: 0.72,
          }}
        />
        <span style={{ fontSize: 12, lineHeight: 1.35 }}>Обложка скоро появится</span>
      </div>
    </div>
  );

  if (!hasImage || didError) {
    return fallback;
  }

  return <img src={src} alt={alt} className={className} style={style} {...rest} onError={() => setDidError(true)} />;
}
