// The `warrant` logotype: Cormorant italic (standing in for Panagram Signature
// Italic) with the lavender dot — the brand's one piece of iconography. The dot
// means the decision point / the human in the loop; it is never decoration.

export function Wordmark({ size = 26 }: { size?: number }) {
  const dot = Math.round(size * 0.26);
  return (
    <span
      aria-label="warrant"
      className="inline-flex select-none items-start leading-none text-ink"
    >
      <span
        className="font-serif italic lowercase"
        style={{ fontSize: size, lineHeight: 1, letterSpacing: "-0.01em" }}
      >
        warrant
      </span>
      <span
        aria-hidden
        className="rounded-full bg-dot"
        style={{
          width: dot,
          height: dot,
          marginLeft: Math.round(size * 0.1),
          marginTop: Math.round(size * 0.12),
        }}
      />
    </span>
  );
}
