import Image from "next/image";

// A photo with its caption printed underneath, like a subtitle card below the
// frame, so the text stays readable on busy photos.
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
    <figure className="border-2 border-black bg-black">
      <div className="relative aspect-[4/5] overflow-hidden">
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
      </div>
      {subtitle && (
        <figcaption className="border-t-2 border-black px-4 py-3 text-center font-mono text-base font-bold leading-snug text-white sm:text-lg">
          {subtitle}
        </figcaption>
      )}
    </figure>
  );
}
