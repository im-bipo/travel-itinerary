type WaveDividerProps = {
  shade?: "100" | "200";
};

export default function WaveDivider({ shade = "100" }: WaveDividerProps) {
  return (
    <section
      aria-hidden="true"
      className={shade === "200" ? "text-gray-200" : "text-gray-100"}
    >
      <svg
        viewBox="0 0 1440 64"
        className="block h-10 w-full"
        fill="#E3F0EA"
        preserveAspectRatio="none"
      >
        <path d="M0,32 C180,64 360,0 540,24 C720,48 900,64 1080,40 C1260,16 1350,12 1440,28 L1440,64 L0,64 Z" />
      </svg>
    </section>
  );
}
