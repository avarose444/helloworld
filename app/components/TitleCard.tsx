// Godard-style title card: letters cycle through rouge, blanc, bleu.
const TITLE_COLORS = ["text-rouge", "text-white", "text-bleu"];

export default function TitleCard({ text }: { text: string }) {
  let i = 0;
  return (
    <span aria-label={text}>
      {text.split("").map((char, index) =>
        char === " " ? (
          <span key={index}> </span>
        ) : (
          <span key={index} aria-hidden className={TITLE_COLORS[i++ % TITLE_COLORS.length]}>
            {char}
          </span>
        )
      )}
    </span>
  );
}
