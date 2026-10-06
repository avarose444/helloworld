import Image from "next/image";

// A photo with a caption laid over it like a film subtitle.
export default function SubtitledPhoto({
  src,
  alt,
  subtitle,
  sizes,
  priority,
}: {
  src: string;
  alt: string;
  subtitle?: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <div className="relative aspect-[4/5] overflow-hidden border-2 border-black bg-black">
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
      {subtitle && (
        <p
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-5 pb-5 pt-16 text-center font-mono text-lg font-bold leading-snug text-white sm:text-xl"
          style={{ textShadow: "0 0 3px #000, 0 1px 2px #000" }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
